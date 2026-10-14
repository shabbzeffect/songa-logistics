import { and, gte, inArray } from "drizzle-orm";
import * as s from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { staffSession } from "@/lib/staff";

/** Nairobi calendar day (YYYY-MM-DD) for bucketing — revenue is counted in EAT. */
function eatDay(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
}

/**
 * Ops revenue analytics: delivered order + parcel value over a trailing window,
 * with daily series, city/category splits and top shops. All money is integer KES.
 */
export async function GET(req: Request) {
  const gate = await staffSession(["ops"]);
  if ("error" in gate) return fail(gate.error, gate.status);
  const url = new URL(req.url);
  const days = Math.min(Math.max(Number(url.searchParams.get("days")) || 30, 1), 90);
  const city = (url.searchParams.get("city") ?? "").trim();
  const since = new Date(Date.now() - days * 24 * 3_600_000);

  const db = await getDb();
  const orderConds = [gte(s.orders.createdAt, since)];
  if (city) orderConds.push(inArray(s.orders.city, [city]));
  const [orders, parcels, merchants] = await Promise.all([
    db.select().from(s.orders).where(and(...orderConds)),
    db
      .select()
      .from(s.parcels)
      .where(and(gte(s.parcels.createdAt, since), ...(city ? [inArray(s.parcels.city, [city])] : []))),
    db.select().from(s.merchants),
  ]);
  const merchById = new Map(merchants.map((m) => [m.id, m]));

  const delivered = orders.filter((o) => o.status === "delivered");
  const cancelled = orders.filter((o) => o.status === "cancelled");
  const revenue = delivered.reduce((t, o) => t + o.total, 0);
  const discount = delivered.reduce((t, o) => t + o.discount, 0);
  const parcelsDelivered = parcels.filter((p) => p.status === "delivered");
  const parcelRevenue = parcelsDelivered.reduce((t, p) => t + p.quote, 0);

  // Daily series (zero-filled across the whole window).
  const seriesMap = new Map<string, { revenue: number; orders: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const key = eatDay(new Date(Date.now() - i * 24 * 3_600_000));
    seriesMap.set(key, { revenue: 0, orders: 0 });
  }
  for (const o of delivered) {
    const b = seriesMap.get(eatDay(o.createdAt));
    if (b) { b.revenue += o.total; b.orders += 1; }
  }

  const byCity = new Map<string, { revenue: number; orders: number }>();
  for (const o of delivered) {
    const b = byCity.get(o.city) ?? { revenue: 0, orders: 0 };
    b.revenue += o.total; b.orders += 1;
    byCity.set(o.city, b);
  }

  const byCategory = new Map<string, { revenue: number; orders: number }>();
  for (const o of delivered) {
    const cat = merchById.get(o.merchantId)?.category ?? "other";
    const b = byCategory.get(cat) ?? { revenue: 0, orders: 0 };
    b.revenue += o.total; b.orders += 1;
    byCategory.set(cat, b);
  }

  const byShop = new Map<string, { revenue: number; orders: number }>();
  for (const o of delivered) {
    const b = byShop.get(o.merchantId) ?? { revenue: 0, orders: 0 };
    b.revenue += o.total; b.orders += 1;
    byShop.set(o.merchantId, b);
  }
  const topShops = [...byShop.entries()]
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5)
    .map(([id, v]) => ({ id, name: merchById.get(id)?.name ?? "Unknown shop", ...v }));

  return ok({
    range: { days, since, city: city || null },
    orders: {
      revenue, count: delivered.length,
      cancelled: cancelled.length,
      cancelRate: orders.length ? Math.round((cancelled.length / orders.length) * 1000) / 10 : 0,
      discount, aov: delivered.length ? Math.round(revenue / delivered.length) : 0,
    },
    parcels: { revenue: parcelRevenue, count: parcelsDelivered.length },
    series: [...seriesMap.entries()].map(([day, v]) => ({ day, ...v })),
    byCity: [...byCity.entries()].map(([c, v]) => ({ city: c, ...v })).sort((a, b) => b.revenue - a.revenue),
    byCategory: [...byCategory.entries()].map(([c, v]) => ({ category: c, ...v })).sort((a, b) => b.revenue - a.revenue),
    topShops,
  });
}
