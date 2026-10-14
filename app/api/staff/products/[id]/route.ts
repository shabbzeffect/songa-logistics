import { eq } from "drizzle-orm";
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
