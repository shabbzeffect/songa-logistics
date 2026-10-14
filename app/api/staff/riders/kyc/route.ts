import { eq } from "drizzle-orm";
import { z } from "zod";
import * as s from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { actorLabel, staffSession } from "@/lib/staff";

const reviewSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["approved", "rejected", "pending"]),
  note: z.string().trim().max(300).default(""),
});

/** Ops review of rider KYC. Rejections need an actionable note for the rider. */
export async function PATCH(req: Request) {
  const gate = await staffSession(["ops"]);
  if ("error" in gate) return fail(gate.error, gate.status);
  const body = await req.json().catch(() => null);
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) return fail("Pick a rider and a decision.", 400);
  if (parsed.data.status === "rejected" && parsed.data.note.length < 3)
    return fail("Give the rider a short reason so they can fix it.", 400);

  const db = await getDb();
  const upd = await db
    .update(s.riders)
    .set({ kycStatus: parsed.data.status, kycNote: parsed.data.note })
    .where(eq(s.riders.id, parsed.data.id))
    .returning({ id: s.riders.id });
  if (!upd[0]) return fail("Rider not found.", 404);
  await db.insert(s.auditEvents).values({
    kind: "rider.kyc.reviewed", entityId: parsed.data.id,
    detail: { status: parsed.data.status, note: parsed.data.note || undefined },
    actor: actorLabel(gate.session),
  });
  return ok({ status: parsed.data.status });
}
