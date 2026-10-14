import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import * as s from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { fail, ok, rateLimit } from "@/lib/api";
import { initiateStkPush, mpesaConfigured } from "@/lib/mpesa";

const resendSchema = z.object({ token: z.string().trim().min(10) });

/**
 * Re-send an expired M-Pesa prompt for a pending/failed prepaid order.
 * The new CheckoutRequestID replaces the old one, so stale callbacks can't
 * complete the payment afterwards (providerRef match fails → ignored).
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = resendSchema.safeParse(body);
  if (!parsed.success) return fail("Missing order reference.", 400);
  if (!rateLimit(`mpesa-resend:${parsed.data.token}`, 3, 10 * 60_000))
    return fail("Too many prompts sent. Wait 10 minutes and retry.", 429);
  if (!mpesaConfigured()) return fail("Online M-Pesa is not switched on yet.", 409);

  const db = await getDb();
  const rows = await db.select().from(s.orders).where(eq(s.orders.trackingToken, parsed.data.token));
  const order = rows[0];
  if (!order) return fail("Order not found.", 404);
  if (order.paymentMethod !== "mpesa_stk") return fail("This order doesn't use online M-Pesa.", 409);
  if (order.status === "cancelled" || order.status === "delivered")
    return fail(`This order is already ${order.status}.`, 409);

  const intents = await db
    .select()
    .from(s.paymentIntents)
    .where(and(eq(s.paymentIntents.orderId, order.id), inArray(s.paymentIntents.status, ["pending", "failed"])));
  const intent = intents[0];
  if (!intent) return fail("Nothing to collect — this payment is already settled.", 409);

  const push = await initiateStkPush({ orderRef: order.ref, phoneE164: order.phone, amount: order.total });
  if (!push.ok) return fail(push.error, 502);
  await db
    .update(s.paymentIntents)
    .set({ providerRef: push.checkoutRequestId, status: "pending" })
    .where(eq(s.paymentIntents.id, intent.id));
  await db.insert(s.auditEvents).values({
    kind: "payment.resent", entityId: intent.id,
    detail: { providerRef: push.checkoutRequestId, orderId: order.id }, actor: "customer",
  });
  return ok({ sent: true });
}
