import { and, eq, sql } from "drizzle-orm";
import * as s from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { staffSession } from "@/lib/staff";

/** Role-scoped order queue: ops sees all, merchants their shop, couriers their jobs. */
export async function GET(req: Request) {
  const gate = await staffSession(["ops", "merchant", "courier"]);
  if ("error" in gate) return fail(gate.error, gate.status);
  const { session } = gate;
  const u = new URL(req.url);
  const status = u.searchParams.get("status") ?? "";

  const db = await getDb();
  const conds = [];
  if (session.role === "merchant" && session.actorId) conds.push(eq(s.orders.merchantId, session.actorId));
  if (session.role === "courier" && session.actorId) conds.push(eq(s.orders.riderId, session.actorId));
  if (status) conds.push(eq(s.orders.status, status));

  const rows = await db
    .select()
    .from(s.orders)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(sql`${s.orders.createdAt} DESC`)
    .limit(60);

  const [merchList, riderList] = await Promise.all([
    db.select({ id: s.merchants.id, name: s.merchants.name }).from(s.merchants),
    db.select({ id: s.riders.id, name: s.riders.name }).from(s.riders),
  ]);
  const mName = new Map(merchList.map((m) => [m.id, m.name]));
  const rName = new Map(riderList.map((r) => [r.id, r.name]));

  return ok({
    orders: rows.map((o) => ({
      id: o.id, ref: o.ref, token: o.trackingToken, status: o.status,
      total: o.total, city: o.city, area: o.area, customerName: o.customerName,
      phone: session.role === "ops" || (session.role === "courier" && o.riderId === session.actorId) ? o.phone : undefined,
      merchantId: o.merchantId, merchantName: mName.get(o.merchantId) ?? "—",
      riderId: o.riderId, riderName: o.riderId ? (rName.get(o.riderId) ?? "—") : null,
      paymentMethod: o.paymentMethod, paymentStatus: o.paymentStatus,
      scheduledFor: o.scheduledFor, createdAt: o.createdAt,
    })),
  });
}
