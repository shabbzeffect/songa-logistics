import { z } from "zod";
import { eq } from "drizzle-orm";
import * as s from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { actorLabel, staffSession } from "@/lib/staff";
import { productUpsertSchema } from "@/lib/validation";

const createSchema = productUpsertSchema.extend({ merchantId: z.string().min(1) });

/** Staff menu browser — ops sees any shop's items (?merchantId=), merchants see their own. */
export async function GET(req: Request) {
  const gate = await staffSession(["ops", "merchant"]);
  if ("error" in gate) return fail(gate.error, gate.status);
  const merchantId = new URL(req.url).searchParams.get("merchantId") ?? "";
  const db = await getDb();
  if (gate.session.role === "merchant") {
    const own = gate.session.actorId ?? "";
    if (!own) return fail("Sign in with a staff account to continue.", 403);
    if (merchantId && merchantId !== own) return fail("You can only see your own items.", 403);
    const rows = await db.select().from(s.products).where(eq(s.products.merchantId, own));
    return ok({ products: rows });
  }
  const rows = merchantId
    ? await db.select().from(s.products).where(eq(s.products.merchantId, merchantId))
    : await db.select().from(s.products);
  return ok({ products: rows });
}

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
