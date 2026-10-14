import { eq } from "drizzle-orm";
import { z } from "zod";
import * as s from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { fail, ok, rateLimit } from "@/lib/api";
import { getSession } from "@/lib/auth";

const kycSchema = z.object({
  idNumber: z.string().trim().min(5).max(20).regex(/^[A-Za-z0-9-]+$/, "Letters, digits and dashes only"),
  licenseNumber: z.string().trim().min(5).max(20).regex(/^[A-Za-z0-9-]+$/, "Letters, digits and dashes only"),
});

/**
 * Rider self-submission for KYC review (national ID + driving licence refs —
 * document numbers only, never photos in this flow). Resets status to submitted.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (session.role !== "courier" || !session.actorId)
    return fail("Sign in as a rider to submit KYC documents.", 403);
  if (!rateLimit(`kyc:${session.actorId}`, 5, 3_600_000))
    return fail("Too many submissions. Try again later.", 429);
  const body = await req.json().catch(() => null);
  const parsed = kycSchema.safeParse(body);
  if (!parsed.success) return fail("Enter your ID and licence numbers (5–20 characters).", 400);

  const db = await getDb();
  const upd = await db
    .update(s.riders)
    .set({
      kycStatus: "submitted",
      kycDocs: [
        { type: "national_id", ref: parsed.data.idNumber },
        { type: "driving_license", ref: parsed.data.licenseNumber },
      ],
    })
    .where(eq(s.riders.id, session.actorId))
    .returning({ id: s.riders.id });
  if (!upd[0]) return fail("Rider profile not found.", 404);
  await db.insert(s.auditEvents).values({
    kind: "rider.kyc.submitted", entityId: session.actorId,
    detail: { docs: 2 }, actor: `courier:${session.actorId.slice(0, 8)}`,
  });
  return ok({ status: "submitted" });
}
