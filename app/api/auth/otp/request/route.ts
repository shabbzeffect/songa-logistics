import { and, eq } from "drizzle-orm";
import { z } from "zod";
import * as s from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { fail, ok, rateLimit } from "@/lib/api";
import { normalizeKEPhone } from "@/lib/phone";
import { expiryDate, generateCode, hashCode } from "@/lib/otp";
import { sendSms, smsConfigured } from "@/lib/sms";

const requestSchema = z.object({
  phone: z.string().trim().min(9),
  purpose: z.enum(["login_rider", "login_customer"]),
});

/**
 * Step 1 of phone login: mint a single-use 6-digit code.
 * Always returns ok (even when no rider matches) so phone numbers can't be probed.
 */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  if (!rateLimit(`otp-req:${ip}`, 20)) return fail("Too many requests. Slow down a little.", 429);
  const body = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return fail("Enter a valid Kenyan mobile number, e.g. 0712 345 678", 400);
  const phone = normalizeKEPhone(parsed.data.phone);
  if (!phone) return fail("Enter a valid Kenyan mobile number, e.g. 0712 345 678", 400);
  if (!rateLimit(`otp-phone:${phone}`, 5, 10 * 60_000))
    return fail("Too many codes sent to this number. Wait 10 minutes and retry.", 429);

  const db = await getDb();
  // Riders must already exist (onboarded via HQ); customers are always eligible.
  let eligible = parsed.data.purpose === "login_customer";
  if (parsed.data.purpose === "login_rider") {
    const r = await db
      .select()
      .from(s.riders)
      .where(and(eq(s.riders.phone, phone), eq(s.riders.verified, true)));
    eligible = r.length > 0;
  }

  if (eligible) {
    // Invalidate older unconsumed codes so only the newest works.
    await db
      .update(s.verificationCodes)
      .set({ consumed: true })
      .where(
        and(
          eq(s.verificationCodes.phone, phone),
          eq(s.verificationCodes.purpose, parsed.data.purpose),
          eq(s.verificationCodes.consumed, false),
        ),
      );
    const code = generateCode();
    await db.insert(s.verificationCodes).values({
      phone,
      codeHash: hashCode(code),
      purpose: parsed.data.purpose,
      expiresAt: expiryDate(),
    });
    const sms = await sendSms(phone, `Your Songa Logistics code is ${code}. It expires in 10 minutes.`);
    await db.insert(s.auditEvents).values({
      kind: "otp.requested", entityId: phone,
      detail: { purpose: parsed.data.purpose, sms: sms.ok }, actor: "public",
    });
    if (!sms.ok) {
      console.info(`OTP for ${phone} (${parsed.data.purpose}): ${smsConfigured() ? "provider failed" : "SMS not configured"}`);
      // Demo path: hand the code back outside production so the flow is testable.
      if (process.env.NODE_ENV !== "production") return ok({ sent: false, demoCode: code });
      return ok({ sent: false });
    }
    return ok({ sent: true });
  }

  return ok({ sent: true });
}
