import { eq, inArray } from "drizzle-orm";
import * as s from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { actorLabel, staffSession } from "@/lib/staff";
import { productUpsertSchema } from "@/lib/validation";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await staffSession(["ops", "merchant"]);
  if ("error" in gate) return fail(gate.error, gate.status);
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = productUpsertSchema.partial().safeParse(body);
  if (!parsed.success) return fail("Check the product details", 400);
  const db = await getDb();
  const existing = await db.select().from(s.products).where(eq(s.products.id, id));
  if (!existing[0]) return fail("Product not found", 404);
  if (gate.session.role === "merchant" && gate.session.actorId !== existing[0].merchantId)
    return fail("You can only edit your own items.", 403);
  const upd = await db.update(s.products).set(parsed.data).where(eq(s.products.id, id)).returning();
  await db.insert(s.auditEvents).values({
    kind: "product.updated", entityId: id, detail: parsed.data, actor: actorLabel(gate.session),
  });
  return ok({ product: upd[0] });
}

/**
 * Delete a menu item (ops, or the owning shop). Refused when the item appears
 * on past orders — snapshots are immutable; pause it instead. Otherwise
 * removes its modifier options/groups, then the item. Audited.
 */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await staffSession(["ops", "merchant"]);
  if ("error" in gate) return fail(gate.error, gate.status);
  const { id } = await ctx.params;
  const db = await getDb();
  const existing = await db.select().from(s.products).where(eq(s.products.id, id));
  if (!existing[0]) return fail("Item not found", 404);
  if (gate.session.role === "merchant" && gate.session.actorId !== existing[0].merchantId)
    return fail("You can only delete your own items.", 403);
  const refs = await db
    .select({ id: s.orderItems.id })
    .from(s.orderItems)
    .where(eq(s.orderItems.productId, id))
    .limit(1);
  if (refs.length > 0)
    return fail("This item is on past orders — pause it instead of deleting.", 409);

  const groups = await db
    .select({ id: s.modifierGroups.id })
    .from(s.modifierGroups)
    .where(eq(s.modifierGroups.productId, id));
  const gids = groups.map((g) => g.id);
  if (gids.length > 0) await db.delete(s.modifierOptions).where(inArray(s.modifierOptions.groupId, gids));
  await db.delete(s.modifierGroups).where(eq(s.modifierGroups.productId, id));
  await db.delete(s.products).where(eq(s.products.id, id));
  await db.insert(s.auditEvents).values({
    kind: "product.deleted", entityId: id,
    detail: { name: existing[0].name, merchantId: existing[0].merchantId, modifierGroups: gids.length },
    actor: actorLabel(gate.session),
  });
  return ok({ deleted: id });
}
