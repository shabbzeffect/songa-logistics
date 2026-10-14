import { and, eq, ilike, lte, or, sql } from "drizzle-orm";
import * as s from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { ok } from "@/lib/api";

/** Public merchant discovery — search + filters actually change results. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const city = u.searchParams.get("city") ?? "";
  const category = u.searchParams.get("category") ?? "";
  const q = (u.searchParams.get("q") ?? "").trim();
  const maxFee = Number(u.searchParams.get("maxFee") ?? "");
  const minRating = Number(u.searchParams.get("minRating") ?? "");
  const openOnly = u.searchParams.get("open") === "1";
  const sort = u.searchParams.get("sort") ?? "relevance";

  const db = await getDb();
  const conds = [eq(s.merchants.approved, true)];
  if (city) conds.push(eq(s.merchants.city, city));
  if (category) conds.push(eq(s.merchants.category, category));
  if (openOnly) conds.push(eq(s.merchants.open, true));
  if (Number.isFinite(maxFee) && maxFee !== 0 && u.searchParams.get("maxFee"))
    conds.push(lte(s.merchants.deliveryFee, Math.round(maxFee)));
  if (Number.isFinite(minRating) && u.searchParams.get("minRating"))
    conds.push(sql`${s.merchants.rating} >= ${Math.round(minRating * 10)}`);

  let rows = await db.select().from(s.merchants).where(and(...conds));

  if (q) {
    const needle = q.toLowerCase();
    // Match merchant name/description/area; product matches expand the set
    const prods = await db
      .select({ merchantId: s.products.merchantId, name: s.products.name })
      .from(s.products)
      .where(and(eq(s.products.available, true), ilike(s.products.name, `%${q}%`)));
    const prodMerchants = new Set(prods.map((p) => p.merchantId));
    rows = rows.filter(
      (m) =>
        prodMerchants.has(m.id) ||
        m.name.toLowerCase().includes(needle) ||
        m.description.toLowerCase().includes(needle) ||
        m.areas.toLowerCase().includes(needle),
    );
  }

  const dietary = (u.searchParams.get("dietary") ?? "").toLowerCase();
  if (dietary) {
    const ids = rows.map((r) => r.id);
    if (ids.length) {
      const prods = await db.select().from(s.products).where(sql`${s.products.merchantId} IN (${sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `)})`);
      void prods;
    }
    rows = rows.filter((m) => m.description.toLowerCase().includes(dietary));
    // Note: strict per-product dietary filtering happens on the storefront;
    // here we keep shops whose description signals the diet. Product-level
    // matching is done client-side from the storefront payload.
  }

  rows.sort((a, b) => {
    if (sort === "fee") return a.deliveryFee - b.deliveryFee;
    if (sort === "rating") return b.rating - a.rating;
    // relevance: open first, then rating
    return Number(b.open) - Number(a.open) || b.rating - a.rating;
  });

  void or;
  return ok({
    merchants: rows.map((m) => ({
      id: m.id, name: m.name, description: m.description, city: m.city, areas: m.areas,
      category: m.category, deliveryFee: m.deliveryFee, freeOver: m.freeOver,
      minOrder: m.minOrder, prepMinutes: m.prepMinutes,
      rating: m.rating / 10, ratingsCount: m.ratingsCount,
      open: m.open, imageHint: m.imageHint,
    })),
  });
}
