import { desc, eq } from "drizzle-orm";
import * as s from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { nextRatingX10, reviewSchema } from "@/lib/validation";

/** Reviews for one order (token is the capability, same as tracking). */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const db = await getDb();
  const rows = await db.select().from(s.orders).where(eq(s.orders.trackingToken, token));
  const order = rows[0];
  if (!order) return fail("We couldn't find that order.", 404);
  const existing = await db.select().from(s.reviews).where(eq(s.reviews.orderId, order.id));
  return ok({ review: existing[0] ?? null });
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) return fail("Pick a star rating from 1 to 5.", 400);

  const db = await getDb();
  const rows = await db.select().from(s.orders).where(eq(s.orders.trackingToken, token));
  const order = rows[0];
  if (!order) return fail("We couldn't find that order.", 404);
  if (order.status !== "delivered") return fail("You can review once your order is delivered.", 409);

  const existing = await db.select().from(s.reviews).where(eq(s.reviews.orderId, order.id));
  if (existing[0]) return ok({ review: existing[0], duplicate: true });

  try {
    const [review] = await db
      .insert(s.reviews)
      .values({
        orderId: order.id,
        merchantId: order.merchantId,
        rating: parsed.data.rating,
        comment: parsed.data.comment ?? "",
      })
      .returning();
    // Update the shop's aggregate rating (stored x10).
    const merchRows = await db.select().from(s.merchants).where(eq(s.merchants.id, order.merchantId));
    const merch = merchRows[0];
    if (merch) {
      const next = nextRatingX10(merch.rating, merch.ratingsCount, parsed.data.rating);
      await db
        .update(s.merchants)
        .set({ rating: next.rating, ratingsCount: next.count })
        .where(eq(s.merchants.id, merch.id));
    }
    await db.insert(s.auditEvents).values({
      kind: "review.created", entityId: review.id,
      detail: { orderId: order.id, merchantId: order.merchantId, rating: review.rating },
      actor: "customer",
    });
    return ok({ review }, 201);
  } catch {
    const dup = await db.select().from(s.reviews).where(eq(s.reviews.orderId, order.id));
    if (dup[0]) return ok({ review: dup[0], duplicate: true });
    return fail("Couldn't save your review. Please try again.", 500);
  }
}

export async function getMerchantReviews(merchantId: string, limit = 20) {
  const db = await getDb();
  return db
    .select()
    .from(s.reviews)
    .where(eq(s.reviews.merchantId, merchantId))
    .orderBy(desc(s.reviews.createdAt))
    .limit(limit);
}
