import { eq } from "drizzle-orm";
import * as s from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { fail, ok } from "@/lib/api";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = await getDb();
  const rows = await db.select().from(s.merchants).where(eq(s.merchants.id, id));
  const m = rows[0];
  if (!m || !m.approved) return fail("Shop not found", 404);

  const prods = await db.select().from(s.products).where(eq(s.products.merchantId, id));
  // Modifier catalogue for this shop
  const allGroups = await db.select().from(s.modifierGroups);
  const myGroupIds = new Set(allGroups.filter((g) => prods.some((p) => p.id === g.productId)).map((g) => g.id));
  const allOpts = await db.select().from(s.modifierOptions);

  return ok({
    merchant: {
      id: m.id, name: m.name, description: m.description, city: m.city, areas: m.areas,
      category: m.category, deliveryFee: m.deliveryFee, freeOver: m.freeOver,
      minOrder: m.minOrder, prepMinutes: m.prepMinutes,
      rating: m.rating / 10, ratingsCount: m.ratingsCount, open: m.open, imageHint: m.imageHint,
    },
    products: prods.map((p) => ({
      id: p.id, name: p.name, description: p.description, price: p.price,
      section: p.section, dietary: p.dietary, allergens: p.allergens,
      stock: p.stock, trackInventory: p.trackInventory, available: p.available && (!p.trackInventory || p.stock > 0),
      paused: !p.available, imageHint: p.imageHint,
      modifiers: allGroups
        .filter((g) => g.productId === p.id)
        .sort((a, b) => a.sort - b.sort)
        .map((g) => ({
          id: g.id, name: g.name, required: g.required, multi: g.multi,
          options: allOpts
            .filter((o) => myGroupIds.has(o.groupId) && o.groupId === g.id && o.available)
            .map((o) => ({ id: o.id, name: o.name, priceDelta: o.priceDelta })),
        })),
    })),
  });
}
