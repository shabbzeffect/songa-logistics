import { eq } from "drizzle-orm";
import { z } from "zod";
import * as s from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { actorLabel, staffSession } from "@/lib/staff";

export async function GET() {
  const gate = await staffSession(["ops", "merchant", "courier"]);
  if ("error" in gate) return fail(gate.error, gate.status);
  const db = await getDb();
  const rows = await db.select().from(s.riders);
  // Couriers/merchants see names + availability; full phones and KYC docs only for ops.
  const pub = rows.map((r) => ({
    id: r.id, name: r.name, city: r.city, active: r.active, verified: r.verified,
    kycStatus: r.kycStatus,
    phone: gate.session.role === "ops" ? r.phone : undefined,
    kycNote: gate.session.role === "ops" ? r.kycNote : undefined,
    kycDocs: gate.session.role === "ops" ? r.kycDocs : undefined,
  }));
  return ok({ riders: pub });
}

export async function PATCH(req: Request) {
  const gate = await staffSession(["ops", "courier"]);
  if ("error" in gate) return fail(gate.error, gate.status);
  const body = await req.json().catch(() => null);
  const parsed = z.object({ id: z.string().min(1), active: z.boolean() }).safeParse(body);
  if (!parsed.success) return fail("Invalid request", 400);
  if (gate.session.role === "courier" && gate.session.actorId !== parsed.data.id)
    return fail("You can only change your own availability.", 403);
  const db = await getDb();
  await db.update(s.riders).set({ active: parsed.data.active }).where(eq(s.riders.id, parsed.data.id));
  await db.insert(s.auditEvents).values({
    kind: "rider.availability", entityId: parsed.data.id,
    detail: { active: parsed.data.active }, actor: actorLabel(gate.session),
  });
  return ok({ updated: true });
}
