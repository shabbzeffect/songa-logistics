import { eq } from "drizzle-orm";
import { z } from "zod";
import * as s from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { actorLabel, staffSession } from "@/lib/staff";

const replySchema = z.object({ reply: z.string().trim().min(1).max(500) });

/** Merchant/ops reply to a customer review. Merchants can only reply to their own shop. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await staffSession(["ops", "merchant"]);
  if ("error" in gate) return fail(gate.error, gate.status);
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = replySchema.safeParse(body);
  if (!parsed.success) return fail("Write a reply (1–500 characters).", 400);

  const db = await getDb();
  const rows = await db.select().from(s.reviews).where(eq(s.reviews.id, id));
  const review = rows[0];
  if (!review) return fail("Review not found.", 404);
  if (gate.session.role === "merchant" && review.merchantId !== gate.session.actorId)
    return fail("You can only reply to your own shop's reviews.", 403);

  const [updated] = await db
    .update(s.reviews)
    .set({ reply: parsed.data.reply, repliedAt: new Date() })
    .where(eq(s.reviews.id, id))
    .returning();
  await db.insert(s.auditEvents).values({
    kind: "review.replied", entityId: id,
    detail: { merchantId: review.merchantId, orderId: review.orderId }, actor: actorLabel(gate.session),
  });
  return ok({ review: updated });
}
