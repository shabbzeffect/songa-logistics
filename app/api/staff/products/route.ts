import { z } from "zod";
import * as s from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { actorLabel, staffSession } from "@/lib/staff";
import { productUpsertSchema } from "@/lib/validation";

const createSchema = productUpsertSchema.extend({ merchantId: z.string().min(1) });

export async function POST(req: Request) {
  const gate = await staffSession(["ops", "merchant"]);
  if ("error" in gate) return fail(gate.error, gate.status);
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return fail("Check the product details", 400);
  const { merchantId, ...data } = parsed.data;
  if (gate.session.role === "merchant" && gate.session.actorId !== merchantId)
    return fail("You can only add items to your own shop.", 403);
  const db = await getDb();
  const [row] = await db.insert(s.products).values({ ...data, merchantId }).returning();
  await db.insert(s.auditEvents).values({
    kind: "product.created", entityId: row.id, detail: { name: row.name, price: row.price },
    actor: actorLabel(gate.session),
  });
  return ok({ product: row }, 201);
}
