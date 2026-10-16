import { eq, inArray } from "drizzle-orm";
import * as s from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { actorLabel, staffSession } from "@/lib/staff";
import { merchantUpsertSchema } from "@/lib/validation";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await staffSession(["ops", "merchant"]);
  if ("error" in gate) return fail(gate.error, gate.status);
  const { id } = await ctx.params;
  if (gate.session.role === "merchant" && gate.session.actorId !== id)
    return fail("You can only edit your own shop.", 403);
  const body = await req.json().catch(() => null);
  const parsed = merchantUpsertSchema.partial().safeParse(body);
  if (!parsed.success) return fail("Check the shop details", 400);
  const db = await getDb();
  const upd = await db.update(s.merchants).set(parsed.data).where(eq(s.merchants.id, id)).returning();
  if (!upd[0]) return fail("Shop not found", 404);
  await db.insert(s.auditEvents).values({
    kind: "merchant.updated", entityId: id, detail: parsed.data, actor: actorLabel(gate.session),
  });
  return ok({ merchant: upd[0] });
}

/**
 * Delete a shop (ops only). Refused when the shop has orders on record —
 * history, reviews and analytics must stay intact; unapprove or close instead.
 * Otherwise removes the menu (modifier options → groups → products), the
 * shop's reviews, then the shop itself. Audited.
 */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await staffSession(["ops"]);
  if ("error" in gate) return fail(gate.error, gate.status);
  const { id } = await ctx.params;
  const db = await getDb();
  const existing = await db.select().from(s.merchants).where(eq(s.merchants.id, id));
  if (!existing[0]) return fail("Shop not found", 404);
  const orderRefs = await db
    .select({ id: s.orders.id })
    .from(s.orders)
    .where(eq(s.orders.merchantId, id))
    .limit(1);
  if (orderRefs.length > 0)
    return fail("This shop has orders on record — unapprove or close it instead of deleting.", 409);

  const prods = await db.select({ id: s.products.id }).from(s.products).where(eq(s.products.merchantId, id));
  const pids = prods.map((p) => p.id);
  let groupCount = 0;
  if (pids.length > 0) {
    const groups = await db
      .select({ id: s.modifierGroups.id })
      .from(s.modifierGroups)
      .where(inArray(s.modifierGroups.productId, pids));
    groupCount = groups.length;
    const gids = groups.map((g) => g.id);
    if (gids.length > 0) await db.delete(s.modifierOptions).where(inArray(s.modifierOptions.groupId, gids));
    await db.delete(s.modifierGroups).where(inArray(s.modifierGroups.productId, pids));
    await db.delete(s.products).where(inArray(s.products.id, pids));
  }
  await db.delete(s.reviews).where(eq(s.reviews.merchantId, id));
  await db.delete(s.merchants).where(eq(s.merchants.id, id));
  await db.insert(s.auditEvents).values({
    kind: "merchant.deleted", entityId: id,
    detail: { name: existing[0].name, products: pids.length, modifierGroups: groupCount },
    actor: actorLabel(gate.session),
  });
  return ok({ deleted: id });
}
