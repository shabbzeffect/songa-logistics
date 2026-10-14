import { eq } from "drizzle-orm";
import * as s from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { mpesaConfigured } from "@/lib/mpesa";

/**
 * Daraja STK callback. Only meaningful once MPESA_* credentials are set.
 * Idempotent: repeated callbacks for the same CheckoutRequestID are ignored.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const stk = body?.Body?.stkCallback;
  if (!stk?.CheckoutRequestID) return fail("Bad callback payload", 400);

  if (!mpesaConfigured()) {
    // No live integration — acknowledge without acting.
    console.info("mpesa callback ignored (not configured)", { id: stk.CheckoutRequestID });
    return ok({ ignored: true });
  }

  // TODO (production): verify callback source/identity per Daraja docs,
  // then: success (ResultCode 0) → intent paid + order event; else failed.
  const db = await getDb();
  const intents = await db
    .select()
    .from(s.paymentIntents)
    .where(eq(s.paymentIntents.providerRef, String(stk.CheckoutRequestID)));
  const intent = intents[0];
  if (!intent) return ok({ unknown: true });
  if (intent.status === "paid" || intent.status === "failed") return ok({ replayed: true });

  const paid = stk.ResultCode === 0;
  await db
    .update(s.paymentIntents)
    .set({ status: paid ? "paid" : "failed" })
    .where(eq(s.paymentIntents.id, intent.id));
  await db.insert(s.auditEvents).values({
    kind: "payment.callback", entityId: intent.id,
    detail: { providerRef: stk.CheckoutRequestID, paid }, actor: "mpesa",
  });
  return ok({ updated: true });
}
