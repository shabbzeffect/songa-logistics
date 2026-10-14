import { eq } from "drizzle-orm";
import * as s from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { percentOff } from "@/lib/money";

/** Validate a promo code against a subtotal — no side effects. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const code = String(body?.code ?? "").trim().toUpperCase();
  const subtotal = Math.round(Number(body?.subtotal ?? 0));
  if (!code) return fail("Enter a promo code", 400);
  const db = await getDb();
  const rows = await db.select().from(s.promos).where(eq(s.promos.code, code));
  const p = rows[0];
  if (!p || !p.active) return fail("That code isn't valid.", 404);
  if (p.expiresAt && new Date(p.expiresAt).getTime() < Date.now())
    return fail("That code has expired.", 400);
  if (subtotal < (p.minSubtotal ?? 0))
    return fail(`Needs a subtotal of at least KSh ${p.minSubtotal}.`, 400);
  if (p.maxUses != null && (p.used ?? 0) >= p.maxUses) return fail("That code has run out.", 400);
  const discount = p.percent
    ? percentOff(subtotal, p.percent, p.cap)
    : Math.min(p.amountOff ?? 0, subtotal);
  return ok({ code, label: p.label, discount });
}
