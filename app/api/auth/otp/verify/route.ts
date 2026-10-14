import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import * as s from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { fail, ok, rateLimit } from "@/lib/api";
import { normalizeKEPhone } from "@/lib/phone";
import { OTP_MAX_ATTEMPTS, isExpired, verifyCode } from "@/lib/otp";
import { setSession } from "@/lib/auth";

const verifySchema = z.object({
  phone: z.string().trim().min(9),
  code: z.string().trim(),
  purpose: z.enum(["login_rider", "login_customer"]),
});

const GENERIC = "That code didn't work. Request a fresh one and try again.";

/**
 * Step 2 of phone login: redeem a code for a session cookie.
 * Every failure looks identical (401) so codes can't be brute-forced or probed.
 */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  if (!rateLimit(`otp-verify:${ip}`, 30)) return fail("Too many requests. Slow down a little.", 429);
  const body = await req.json().catch(() => null);
  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) return fail(GENERIC, 401);
  const phone = normalizeKEPhone(parsed.data.phone);
  if (!phone) return fail(GENERIC, 401);

  const db = await getDb();
  const rows = await db
    .select()
    .from(s.verificationCodes)
    .where(
      and(
        eq(s.verificationCodes.phone, phone),
        eq(s.verificationCodes.purpose, parsed.data.purpose),
        eq(s.verificationCodes.consumed, false),
      ),
    )
    .orderBy(desc(s.verificationCodes.createdAt))
    .limit(1);
  const row = rows[0];
  if (!row) return fail(GENERIC, 401);
  if (isExpired(row.expiresAt)) {
    await db.update(s.verificationCodes).set({ consumed: true }).where(eq(s.verificationCodes.id, row.id));
    return fail(GENERIC, 401);
  }
  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    await db.update(s.verificationCodes).set({ consumed: true }).where(eq(s.verificationCodes.id, row.id));
    return fail(GENERIC, 401);
  }
  if (!verifyCode(parsed.data.code, row.codeHash)) {
    const attempts = row.attempts + 1;
    await db
      .update(s.verificationCodes)
      .set({ attempts, consumed: attempts >= OTP_MAX_ATTEMPTS })
      .where(eq(s.verificationCodes.id, row.id));
    return fail(GENERIC, 401);
  }
  await db.update(s.verificationCodes).set({ consumed: true }).where(eq(s.verificationCodes.id, row.id));

  if (parsed.data.purpose === "login_rider") {
    const r = await db
      .select()
      .from(s.riders)
      .where(and(eq(s.riders.phone, phone), eq(s.riders.verified, true)));
    const rider = r[0];
    if (!rider) return fail(GENERIC, 401);
    await db.insert(s.users).values({ name: rider.name, phone, role: "courier", riderId: rider.id }).onConflictDoNothing();
    await setSession({ role: "courier", actorId: rider.id, name: rider.name, phone });
    await db.insert(s.auditEvents).values({
      kind: "otp.verified", entityId: rider.id, detail: { purpose: "login_rider" }, actor: `courier:${rider.id.slice(0, 8)}`,
    });
  } else {
    const existing = await db
      .select()
      .from(s.users)
      .where(and(eq(s.users.phone, phone), eq(s.users.role, "customer")));
    let userId = existing[0]?.id;
    const name = existing[0]?.name ?? "Songa customer";
    if (!userId) {
      const [created] = await db.insert(s.users).values({ name, phone, role: "customer" }).returning({ id: s.users.id });
      userId = created.id;
    }
    await setSession({ role: "customer", actorId: userId, name, phone });
    await db.insert(s.auditEvents).values({
      kind: "otp.verified", entityId: userId, detail: { purpose: "login_customer" }, actor: `customer:${userId.slice(0, 8)}`,
    });
  }
  return ok({ verified: true });
}
