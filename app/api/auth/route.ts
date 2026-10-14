import { eq } from "drizzle-orm";
import { z } from "zod";
import * as s from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { getSession, setSession, clearSession, type Role } from "@/lib/auth";

const loginSchema = z.object({
  role: z.enum(["ops", "merchant", "courier"]),
  actorId: z.string().min(1),
});

export async function GET() {
  const session = await getSession();
  const db = await getDb();
  const [merchantList, riderList] = await Promise.all([
    db.select({ id: s.merchants.id, name: s.merchants.name, city: s.merchants.city }).from(s.merchants),
    db.select({ id: s.riders.id, name: s.riders.name, city: s.riders.city }).from(s.riders),
  ]);
  return ok({ session, merchants: merchantList, riders: riderList });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return fail("Pick a role and account", 400);
  const db = await getDb();
  if (parsed.data.role === "merchant") {
    const m = await db.select().from(s.merchants).where(eq(s.merchants.id, parsed.data.actorId));
    if (!m[0]) return fail("Shop not found", 404);
    await setSession({ role: "merchant", actorId: m[0].id, name: m[0].name });
  } else if (parsed.data.role === "courier") {
    const r = await db.select().from(s.riders).where(eq(s.riders.id, parsed.data.actorId));
    if (!r[0]) return fail("Rider not found", 404);
    await setSession({ role: "courier", actorId: r[0].id, name: r[0].name });
  } else {
    // Demo ops access — in production this would be a staff SSO/password gate.
    await setSession({ role: "ops", name: "Ops team" });
  }
  return ok({ session: await getSession() });
}

export async function DELETE() {
  await clearSession();
  return ok({ signedOut: true });
}

export type { Role };
