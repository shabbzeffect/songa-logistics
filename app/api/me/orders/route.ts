import { desc, eq, inArray } from "drizzle-orm";
import * as s from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";

/** Account order history for the verified phone on this session (cross-device). */
export async function GET() {
  const session = await getSession();
  if (!session.phone) return fail("Sign in with your phone number to see account orders.", 401);
  const db = await getDb();
  const rows = await db
    .select()
    .from(s.orders)
    .where(eq(s.orders.phone, session.phone))
    .orderBy(desc(s.orders.createdAt))
    .limit(30);
  const merchIds = [...new Set(rows.map((o) => o.merchantId))];
  const merchRows = merchIds.length
    ? await db.select().from(s.merchants).where(inArray(s.merchants.id, merchIds))
    : [];
  const names = new Map(merchRows.map((m) => [m.id, m.name]));
  return ok({
    orders: rows.map((o) => ({
      ref: o.ref, token: o.trackingToken, total: o.total, status: o.status,
      merchant: names.get(o.merchantId) ?? "Songa order", at: o.createdAt,
    })),
  });
}
