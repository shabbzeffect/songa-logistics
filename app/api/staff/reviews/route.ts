import { desc, eq } from "drizzle-orm";
import * as s from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { staffSession } from "@/lib/staff";

/** Reviews for moderation/replies — own shop for merchants, everything for ops. */
export async function GET(req: Request) {
  const gate = await staffSession(["ops", "merchant"]);
  if ("error" in gate) return fail(gate.error, gate.status);
  const url = new URL(req.url);
  const merchantId = url.searchParams.get("merchantId") ?? "";
  const db = await getDb();
  const base = () => db.select().from(s.reviews).orderBy(desc(s.reviews.createdAt)).limit(50);
  const rows =
    gate.session.role === "merchant"
      ? await db
          .select()
          .from(s.reviews)
          .where(eq(s.reviews.merchantId, gate.session.actorId!))
          .orderBy(desc(s.reviews.createdAt))
          .limit(50)
      : merchantId
        ? await db
            .select()
            .from(s.reviews)
            .where(eq(s.reviews.merchantId, merchantId))
            .orderBy(desc(s.reviews.createdAt))
            .limit(50)
        : await base();
  return ok({
    reviews: rows.map((r) => ({
      id: r.id, orderId: r.orderId, merchantId: r.merchantId, rating: r.rating,
      comment: r.comment, reply: r.reply, repliedAt: r.repliedAt, at: r.createdAt,
    })),
  });
}
