import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import * as s from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { actorLabel, staffSession } from "@/lib/staff";

export async function GET() {
  const gate = await staffSession(["ops"]);
  if ("error" in gate) return fail(gate.error, gate.status);
  const db = await getDb();
  const rows = await db.select().from(s.leads).orderBy(sql`${s.leads.createdAt} DESC`).limit(100);
  return ok({ leads: rows });
}

export async function PATCH(req: Request) {
  const gate = await staffSession(["ops"]);
  if ("error" in gate) return fail(gate.error, gate.status);
  const body = await req.json().catch(() => null);
  const parsed = z.object({ id: z.string().min(1), handled: z.boolean() }).safeParse(body);
  if (!parsed.success) return fail("Invalid request", 400);
  const db = await getDb();
  await db.update(s.leads).set({ handled: parsed.data.handled }).where(eq(s.leads.id, parsed.data.id));
  await db.insert(s.auditEvents).values({
    kind: "lead.handled", entityId: parsed.data.id,
    detail: { handled: parsed.data.handled }, actor: actorLabel(gate.session),
  });
  return ok({ updated: true });
}
