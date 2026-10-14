import { count, inArray } from "drizzle-orm";
import * as s from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { staffSession } from "@/lib/staff";

const ORDER_MOTION = ["placed", "accepted", "preparing", "ready", "picked_up", "on_the_way"];
const PARCEL_MOTION = ["requested", "confirmed", "assigned", "picked_up", "in_transit"];

/** Per-rider active workload so dispatch can balance assignments. */
export async function GET() {
  const gate = await staffSession(["ops"]);
  if ("error" in gate) return fail(gate.error, gate.status);
  const db = await getDb();
  const allRiders = await db.select().from(s.riders);
  const [orderLoad, parcelLoad] = await Promise.all([
    db
      .select({ riderId: s.orders.riderId, n: count() })
      .from(s.orders)
      .where(inArray(s.orders.status, ORDER_MOTION))
      .groupBy(s.orders.riderId),
    db
      .select({ riderId: s.parcels.riderId, n: count() })
      .from(s.parcels)
      .where(inArray(s.parcels.status, PARCEL_MOTION))
      .groupBy(s.parcels.riderId),
  ]);
  const ordersBy = new Map(orderLoad.map((r) => [r.riderId, r.n]));
  const parcelsBy = new Map(parcelLoad.map((r) => [r.riderId, r.n]));
  // Unassigned counts (riderId IS NULL won't appear in group-by; query separately).
  const [unassignedOrders, unassignedParcels] = await Promise.all([
    db.select({ n: count() }).from(s.orders).where(inArray(s.orders.status, ORDER_MOTION)),
    db.select({ n: count() }).from(s.parcels).where(inArray(s.parcels.status, PARCEL_MOTION)),
  ]);
  return ok({
    riders: allRiders.map((r) => ({
      id: r.id, name: r.name, city: r.city, active: r.active, verified: r.verified,
      activeOrders: ordersBy.get(r.id) ?? 0,
      activeParcels: parcelsBy.get(r.id) ?? 0,
    })),
    unassignedHint: {
      ordersInMotion: unassignedOrders[0]?.n ?? 0,
      parcelsInMotion: unassignedParcels[0]?.n ?? 0,
    },
  });
}
