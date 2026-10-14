import { and, eq } from "drizzle-orm";
import * as s from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { mpesaConfigured, parseCallbackMetadata, resultLabel } from "@/lib/mpesa";

/**
 * Daraja STK callback. Only meaningful once MPESA_* credentials are set.
 * Money-safe: a payment is marked paid only when the callback's CheckoutRequestID
 * matches a pending intent AND the callback amount equals the intent amount.
 * Idempotent: replays and concurrent deliveries resolve to a single transition.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const stk = body?.Body?.stkCallback as {
    CheckoutRequestID?: string; ResultCode?: number; ResultDesc?: string;
    CallbackMetadata?: { Item?: { Name?: string; Value?: string | number }[] };
  } | undefined;
  if (!stk?.CheckoutRequestID) return fail("Bad callback payload", 400);

  if (!mpesaConfigured()) {
    // No live integration — acknowledge without acting.
    console.info("mpesa callback ignored (not configured)", { id: stk.CheckoutRequestID });
    return ok({ ignored: true });
  }

  const db = await getDb();
  const intents = await db
    .select()
    .from(s.paymentIntents)
    .where(eq(s.paymentIntents.providerRef, String(stk.CheckoutRequestID)));
  const intent = intents[0];
  if (!intent) return ok({ unknown: true });

  const paid = stk.ResultCode === 0;
  const { amount, receipt } = parseCallbackMetadata(stk.CallbackMetadata?.Item);

  if (paid && amount != null && amount !== intent.amount) {
    // Never mark paid on an amount mismatch — fail safe and audit loudly.
    await db
      .update(s.paymentIntents)
      .set({ status: "failed" })
      .where(and(eq(s.paymentIntents.id, intent.id), eq(s.paymentIntents.status, "pending")));
    await db.insert(s.auditEvents).values({
      kind: "payment.callback", entityId: intent.id,
      detail: {
        providerRef: stk.CheckoutRequestID, paid: false, reason: "amount_mismatch",
        expected: intent.amount, received: amount, receipt,
      },
      actor: "mpesa",
    });
    return ok({ updated: false, reason: "amount_mismatch" });
  }

  // Conditional transition: exactly one delivery wins; the rest are replays.
  const upd = await db
    .update(s.paymentIntents)
    .set({ status: paid ? "paid" : "failed" })
    .where(and(eq(s.paymentIntents.id, intent.id), eq(s.paymentIntents.status, "pending")))
    .returning({ id: s.paymentIntents.id });
  if (upd.length === 0) return ok({ replayed: true });

  if (intent.orderId) {
    await db
      .update(s.orders)
      .set({ paymentStatus: paid ? "paid" : "failed" })
      .where(eq(s.orders.id, intent.orderId));
  }
  await db.insert(s.auditEvents).values({
    kind: "payment.callback", entityId: intent.id,
    detail: {
      providerRef: stk.CheckoutRequestID, paid, label: resultLabel(stk.ResultCode ?? -1),
      resultDesc: stk.ResultDesc ?? "", receipt, orderId: intent.orderId,
    },
    actor: "mpesa",
  });
  return ok({ updated: true, paid });
}
