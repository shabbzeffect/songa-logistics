import { eq } from "drizzle-orm";
import * as s from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { maskPhone } from "@/lib/phone";

/** Public tracking — the high-entropy token is the capability. */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const db = await getDb();
  const rows = await db.select().from(s.orders).where(eq(s.orders.trackingToken, token));
  const order = rows[0];
  if (!order) return fail("We couldn't find that order. Check the link and try again.", 404);

  const [items, events, merchRows] = await Promise.all([
    db.select().from(s.orderItems).where(eq(s.orderItems.orderId, order.id)),
    db.select().from(s.orderEvents).where(eq(s.orderEvents.orderId, order.id)),
    db.select().from(s.merchants).where(eq(s.merchants.id, order.merchantId)),
  ]);
  let rider: { name: string; phone: string } | null = null;
  if (order.riderId) {
    const r = await db.select().from(s.riders).where(eq(s.riders.id, order.riderId));
    if (r[0]) rider = { name: r[0].name, phone: maskPhone(r[0].phone) };
  }
  const merchant = merchRows[0];
  return ok({
    order: {
      ref: order.ref, status: order.status, paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus, subtotal: order.subtotal, discount: order.discount,
      deliveryFee: order.deliveryFee, serviceFee: order.serviceFee, tip: order.tip,
      total: order.total, promoCode: order.promoCode, scheduledFor: order.scheduledFor,
      area: order.area, city: order.city, createdAt: order.createdAt,
      prepMinutes: merchant?.prepMinutes ?? 20,
    },
    merchant: merchant ? { id: merchant.id, name: merchant.name } : null,
    rider,
    items: items.map((i) => ({
      name: i.name, qty: i.qty, unitPrice: i.unitPrice, modifierDelta: i.modifierDelta,
      modifiers: i.modifiers, lineTotal: i.lineTotal, note: i.note,
    })),
    events: events
      .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
      .map((e) => ({ status: e.status, note: e.note, at: e.createdAt })),
  });
}
