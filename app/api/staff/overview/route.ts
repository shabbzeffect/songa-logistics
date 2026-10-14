import { count, eq, inArray, sql, sum } from "drizzle-orm";
import * as s from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { actorLabel, staffSession } from "@/lib/staff";

/** Ops HQ overview: shops, orders in motion, delivered value, riders, parcels, leads. */
export async function GET() {
  const gate = await staffSession(["ops"]);
  if ("error" in gate) return fail(gate.error, gate.status);
  void actorLabel;
  const db = await getDb();
  const [shops, inMotion, delivered, riders, parcels, leads] = await Promise.all([
    db.select({ n: count() }).from(s.merchants),
    db.select({ n: count() }).from(s.orders).where(
      inArray(s.orders.status, ["placed", "accepted", "preparing", "ready", "picked_up", "on_the_way"]),
    ),
    db.select({ n: count(), v: sum(s.orders.total) }).from(s.orders).where(eq(s.orders.status, "delivered")),
    db.select({ n: count() }).from(s.riders).where(eq(s.riders.active, true)),
    db.select({ n: count() }).from(s.parcels).where(
      inArray(s.parcels.status, ["requested", "confirmed", "assigned", "picked_up", "in_transit"]),
    ),
    db.select({ n: count() }).from(s.leads).where(eq(s.leads.handled, false)),
  ]);
  const recentOrders = await db
    .select()
    .from(s.orders)
    .orderBy(sql`${s.orders.createdAt} DESC`)
    .limit(10);
  const recentLeads = await db
    .select()
    .from(s.leads)
    .orderBy(sql`${s.leads.createdAt} DESC`)
    .limit(5);
  return ok({
    shops: shops[0]?.n ?? 0,
    ordersInMotion: inMotion[0]?.n ?? 0,
    deliveredCount: delivered[0]?.n ?? 0,
    deliveredValue: Number(delivered[0]?.v ?? 0),
    activeRiders: riders[0]?.n ?? 0,
    parcelsInMotion: parcels[0]?.n ?? 0,
    openLeads: leads[0]?.n ?? 0,
    recentOrders: recentOrders.map((o) => ({
      id: o.id, ref: o.ref, token: o.trackingToken, status: o.status, total: o.total,
      merchantId: o.merchantId, city: o.city, createdAt: o.createdAt,
    })),
    recentLeads,
  });
}
