import * as s from "@/drizzle/schema";
import { getDb, type Db } from "@/lib/db";
import { rateLimit } from "@/lib/api";
import { smsConfigured, sendSms } from "@/lib/sms";
import { formatKES } from "@/lib/money";

/**
 * Customer + rider SMS notifications. Fire-and-forget by contract: every send is
 * wrapped so a provider outage can never break an order transition. Without
 * SMS credentials everything is skipped silently (logged, never fatal).
 */

export function orderCustomerMessage(args: {
  ref: string; merchant: string; total: number; to: string; riderName?: string; note?: string;
}): string | null {
  const { ref, merchant, total, to, riderName, note } = args;
  switch (to) {
    case "placed":
      return `Songa: order ${ref} received at ${merchant} (${formatKES(total)}). We'll text you updates — asante!`;
    case "accepted":
      return `Songa: ${merchant} accepted order ${ref} — the kitchen is on it.`;
    case "on_the_way":
      return `Songa: ${riderName ? `${riderName}, your rider, is` : "Your rider is"} on the way with order ${ref}.`;
    case "delivered":
      return `Songa: order ${ref} delivered. Asante for choosing Songa!`;
    case "cancelled":
      return `Songa: order ${ref} was cancelled${note ? ` — ${note}` : ""}. Nothing was charged.`;
    default:
      return null; // preparing/ready/picked_up stay quiet to avoid SMS fatigue
  }
}

export function parcelMessage(args: {
  ref: string; to: string; pickupArea: string; dropoffArea: string; recipientName: string; forRecipient: boolean;
}): string | null {
  const { ref, to, pickupArea, dropoffArea, recipientName, forRecipient } = args;
  if (!forRecipient) {
    switch (to) {
      case "requested":
        return `Songa: parcel ${ref} (${pickupArea} → ${dropoffArea}) received. We'll confirm pickup by SMS.`;
      case "cancelled":
        return `Songa: parcel ${ref} was cancelled. Nothing was charged.`;
      default:
        return null;
    }
  }
  switch (to) {
    case "in_transit":
      return `Songa: a parcel for ${recipientName} (${ref}) is on its way to ${dropoffArea}.`;
    case "delivered":
      return `Songa: parcel ${ref} delivered to ${dropoffArea}. Asante!`;
    default:
      return null;
  }
}

export function riderJobMessage(args: {
  ref: string; kind: "order" | "parcel"; pickup: string; dropoff: string; merchant?: string;
}): string {
  const { ref, kind, pickup, dropoff, merchant } = args;
  return kind === "order"
    ? `Songa job ${ref}: ${merchant ?? "pickup"} (${pickup}) → ${dropoff}. Open your courier workspace.`
    : `Songa parcel ${ref}: pickup ${pickup} → ${dropoff}. Open your courier workspace.`;
}

async function dispatch(db: Db, phone: string, message: string, context: { kind: string; entityId: string }): Promise<void> {
  try {
    if (!smsConfigured()) return;
    if (!rateLimit(`sms:${phone}`, 20, 3_600_000)) {
      console.info("SMS skipped (recipient rate limit)", { phone: `${phone.slice(0, 5)}***` });
      return;
    }
    const r = await sendSms(phone, message);
    await db.insert(s.auditEvents).values({
      kind: r.ok ? "sms.sent" : "sms.failed", entityId: context.entityId,
      detail: { ...context, ...(r.ok ? { providerRef: r.providerRef } : { error: r.error }) },
      actor: "system",
    });
  } catch (e) {
    console.error("notify failed", e);
  }
}

/** Customer SMS for an order transition. Null-message statuses stay quiet. */
export async function notifyOrder(args: {
  phone: string; ref: string; merchant: string; total: number; orderId: string;
  to: string; riderName?: string; note?: string;
}): Promise<void> {
  const message = orderCustomerMessage(args);
  if (!message || !smsConfigured()) return;
  const db = await getDb();
  await dispatch(db, args.phone, message, { kind: `order.${args.to}`, entityId: args.orderId });
}

/** Sender/recipient SMS for a parcel transition. */
export async function notifyParcel(args: {
  ref: string; parcelId: string; to: string; pickupArea: string; dropoffArea: string;
  senderPhone: string; recipientPhone: string; recipientName: string;
}): Promise<void> {
  if (!smsConfigured()) return;
  const db = await getDb();
  const senderMsg = parcelMessage({ ...args, forRecipient: false });
  if (senderMsg) await dispatch(db, args.senderPhone, senderMsg, { kind: `parcel.${args.to}`, entityId: args.parcelId });
  const recipMsg = parcelMessage({ ...args, forRecipient: true });
  if (recipMsg && args.recipientPhone !== args.senderPhone) {
    await dispatch(db, args.recipientPhone, recipMsg, { kind: `parcel.${args.to}`, entityId: args.parcelId });
  }
}

/** New-job SMS to the assigned rider. */
export async function notifyRider(args: {
  phone: string; ref: string; kind: "order" | "parcel"; entityId: string;
  pickup: string; dropoff: string; merchant?: string;
}): Promise<void> {
  if (!smsConfigured()) return;
  const db = await getDb();
  await dispatch(db, args.phone, riderJobMessage(args), { kind: "job.assigned", entityId: args.entityId });
}
