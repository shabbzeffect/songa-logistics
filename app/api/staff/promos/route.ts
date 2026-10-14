import { z } from "zod";
import { eq } from "drizzle-orm";
import * as s from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { actorLabel, staffSession } from "@/lib/staff";

export async function GET() {
  const gate = await staffSession(["ops"]);
  if ("error" in gate) return fail(gate.error, gate.status);
  const db = await getDb();
  return ok({ promos: await db.select().from(s.promos) });
}

const createSchema = z.object({
  code: z.string().trim().min(3).max(24),
  label: z.string().trim().max(120).default(""),
  percent: z.number().int().min(1).max(90).nullable().optional(),
  amountOff: z.number().int().min(1).nullable().optional(),
  cap: z.number().int().min(0).nullable().optional(),
  minSubtotal: z.number().int().min(0).default(0),
  maxUses: z.number().int().min(1).nullable().optional(),
  active: z.boolean().default(true),
});

export async function POST(req: Request) {
  const gate = await staffSession(["ops"]);
  if ("error" in gate) return fail(gate.error, gate.status);
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return fail("Check the promo details", 400);
  if (!parsed.data.percent && !parsed.data.amountOff)
    return fail("Give a percent or a fixed amount off.", 400);
  const db = await getDb();
  try {
    const [row] = await db
      .insert(s.promos)
      .values({ ...parsed.data, code: parsed.data.code.toUpperCase() })
      .returning();
    await db.insert(s.auditEvents).values({
      kind: "promo.created", entityId: row.id, detail: { code: row.code }, actor: actorLabel(gate.session),
    });
    return ok({ promo: row }, 201);
  } catch {
    return fail("That code already exists.", 409);
  }
}

const toggleSchema = z.object({
  code: z.string().trim().min(1).max(24),
  active: z.boolean(),
});

/** Activate / deactivate a promo without deleting its history. */
export async function PATCH(req: Request) {
  const gate = await staffSession(["ops"]);
  if ("error" in gate) return fail(gate.error, gate.status);
  const body = await req.json().catch(() => null);
  const parsed = toggleSchema.safeParse(body);
  if (!parsed.success) return fail("Pick a promo and an on/off state.", 400);
  const db = await getDb();
  const rows = await db.select().from(s.promos).where(eq(s.promos.code, parsed.data.code.toUpperCase()));
  const promo = rows[0];
  if (!promo) return fail("Promo not found.", 404);
  await db.update(s.promos).set({ active: parsed.data.active }).where(eq(s.promos.id, promo.id));
  await db.insert(s.auditEvents).values({
    kind: "promo.toggle", entityId: promo.id,
    detail: { code: promo.code, active: parsed.data.active }, actor: actorLabel(gate.session),
  });
  return ok({ promo: { ...promo, active: parsed.data.active } });
}
