import * as s from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { actorLabel, staffSession } from "@/lib/staff";
import { merchantUpsertSchema } from "@/lib/validation";

export async function GET() {
  const gate = await staffSession(["ops", "merchant"]);
  if ("error" in gate) return fail(gate.error, gate.status);
  const db = await getDb();
  const rows = await db.select().from(s.merchants);
  const scoped =
    gate.session.role === "merchant" && gate.session.actorId
      ? rows.filter((m) => m.id === gate.session.actorId)
      : rows;
  return ok({ merchants: scoped });
}

export async function POST(req: Request) {
  const gate = await staffSession(["ops"]);
  if ("error" in gate) return fail(gate.error, gate.status);
  const body = await req.json().catch(() => null);
  const parsed = merchantUpsertSchema.safeParse(body);
  if (!parsed.success) return fail("Check the shop details", 400);
  const db = await getDb();
  const [row] = await db.insert(s.merchants).values({ ...parsed.data }).returning();
  await db.insert(s.auditEvents).values({
    kind: "merchant.created", entityId: row.id, detail: { name: row.name }, actor: actorLabel(gate.session),
  });
  return ok({ merchant: row }, 201);
}
