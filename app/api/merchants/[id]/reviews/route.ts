import { desc, eq } from "drizzle-orm";
import * as s from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { fail, ok } from "@/lib/api";

/** Public recent reviews for a shop (no customer PII). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = await getDb();
  const merch = await db.select().from(s.merchants).where(eq(s.merchants.id, id));
  if (!merch[0] || !merch[0].approved) return fail("Shop not found", 404);
  const rows = await db
    .select()
    .from(s.reviews)
    .where(eq(s.reviews.merchantId, id))
    .orderBy(desc(s.reviews.createdAt))
    .limit(20);
  return ok({
    reviews: rows.map((r) => ({ rating: r.rating, comment: r.comment, at: r.createdAt })),
    count: merch[0].ratingsCount,
    rating: merch[0].rating / 10,
  });
}
