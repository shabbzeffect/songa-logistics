import { eq } from "drizzle-orm";
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
