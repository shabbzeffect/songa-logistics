import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import * as s from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { fail, ok, rateLimit } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { canTransitionOrder, type OrderStatus } from "@/lib/status";

const patchSchema = z.object({
  to: z.enum(["placed", "accepted", "preparing", "ready", "picked_up", "on_the_way", "delivered", "cancelled"]),
  riderId: z.string().min(1).optional(),
  note: z.string().max(300).optional().default(""),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!rateLimit(`order-patch:${token}`, 30)) return fail("Too many requests.", 429);
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid status change", 400);
  const { to, riderId, note } = parsed.data;
  const session = await getSession();
  const db = await getDb();

  const rows = await db.select().from(s.orders).where(eq(s.orders.trackingToken, token));
  const order = rows[0];
  if (!order) return fail("Order not found", 404);
  const from = order.status as OrderStatus;

  // Assignment-only (no status change): ops/owning merchant, or a courier claiming an unassigned job
  if ((to as string) === from) {
    // Terminal orders accept no further writes — exactly-once semantics.
    if (from === "cancelled" || from === "delivered")
      return fail(`This order is already ${from}.`, 409);
    if (session.role !== "ops" && session.role !== "merchant" && session.role !== "courier")
      return fail("Sign in as staff to assign riders.", 403);
    if (session.role === "merchant" && session.actorId !== order.merchantId)
      return fail("This order belongs to a different shop.", 403);
    const rid = riderId ?? (session.role === "courier" ? session.actorId : undefined);
    if (!rid) return fail("Choose a rider to assign.", 400);
    if (session.role === "courier" && session.actorId !== rid) return fail("You can only claim jobs for yourself.", 403);
    if (order.riderId && session.role === "courier" && order.riderId !== session.actorId)
      return fail("This job is assigned to another rider.", 403);
    const db2 = await getDb();
    const r = await db2.select().from(s.riders).where(eq(s.riders.id, rid));
    if (!r[0]?.verified) return fail("That rider isn't verified.", 400);
    if (r[0].city !== order.city) return fail("That rider serves a different city.", 400);
    const actor2 = `${session.role}:${(session.actorId ?? "staff").slice(0, 8)}`;
    await db2.transaction(async (tx) => {
      await tx.update(s.orders).set({ riderId: rid }).where(eq(s.orders.id, order.id));
      await tx.insert(s.orderEvents).values({ orderId: order.id, status: from, note: `Rider assigned: ${r[0].name}`, actor: actor2 });
      await tx.insert(s.auditEvents).values({ kind: "order.assign", entityId: order.id, detail: { rider: rid }, actor: actor2 });
    });
    return ok({ status: from, riderId: rid });
  }

  if (!canTransitionOrder(from, to as OrderStatus))
    return fail(`Can't move this order from ${from} to ${to}.`, 409);

  const isStaff = session.role === "ops" || session.role === "merchant" || session.role === "courier";
  if (!isStaff && to !== "cancelled")
    return fail("Please ask the shop or support to update this order.", 403);
  if (session.role === "merchant" && session.actorId !== order.merchantId)
    return fail("This order belongs to a different shop.", 403);
  if (session.role === "courier") {
    if (to === "cancelled") return fail("Riders can't cancel orders — contact support.", 403);
    if (order.riderId && session.actorId !== order.riderId)
      return fail("This job is assigned to another rider.", 403);
  }
  const actor = `${session.role}${session.actorId ? `:${session.actorId.slice(0, 8)}` : ":guest"}`;

  try {
    const result = await db.transaction(async (tx) => {
      if (to === "cancelled") {
        // Conditional update → exactly-once cancellation + stock restore
        const upd = await tx
          .update(s.orders)
          .set({ status: "cancelled" })
          .where(
            and(eq(s.orders.id, order.id), sql`${s.orders.status} IN ('placed','accepted','preparing','ready')`),
          )
          .returning();
        if (upd.length === 0) throw new Error("race");
        const items = await tx.select().from(s.orderItems).where(eq(s.orderItems.orderId, order.id));
        for (const it of items) {
          const pr = await tx.select().from(s.products).where(eq(s.products.id, it.productId));
          if (pr[0]?.trackInventory) {
            await tx
              .update(s.products)
              .set({ stock: sql`${s.products.stock} + ${it.qty}` })
              .where(eq(s.products.id, it.productId));
          }
        }
        await tx
          .update(s.paymentIntents)
          .set({ status: "voided" })
          .where(eq(s.paymentIntents.orderId, order.id));
        await tx.insert(s.orderEvents).values({
          orderId: order.id, status: "cancelled",
          note: note || "Order cancelled — stock returned to shelf", actor,
        });
        await tx.insert(s.auditEvents).values({
          kind: "order.cancelled", entityId: order.id,
          detail: { from, restored: true }, actor,
        });
        return { status: "cancelled" };
      }

      // Rider assignment (ops or owning merchant; courier self-claims if unassigned)
      let riderToSet: string | undefined;
      if (riderId) {
        if (session.role !== "ops" && session.role !== "merchant" && session.role !== "courier")
          throw new Error("forbidden-rider");
        const r = await tx.select().from(s.riders).where(eq(s.riders.id, riderId));
        const rider = r[0];
        if (!rider || !rider.verified) throw new Error("bad-rider");
        if (rider.city !== order.city) throw new Error("rider-city");
        if (session.role === "courier" && session.actorId !== riderId) throw new Error("forbidden-rider");
        riderToSet = riderId;
      }
      if (session.role === "courier" && !order.riderId && !riderToSet) riderToSet = session.actorId;

      const upd = await tx
        .update(s.orders)
        .set({
          status: to,
          ...(riderToSet ? { riderId: riderToSet } : {}),
          ...(to === "delivered"
            ? { paymentStatus: "paid", proofNote: note || "Delivered" }
            : {}),
        })
        .where(and(eq(s.orders.id, order.id), eq(s.orders.status, from)))
        .returning();
      if (upd.length === 0) throw new Error("race");
      if (to === "delivered") {
        await tx
          .update(s.paymentIntents)
          .set({ status: "paid" })
          .where(eq(s.paymentIntents.orderId, order.id));
      }
      await tx.insert(s.orderEvents).values({ orderId: order.id, status: to, note, actor });
      await tx.insert(s.auditEvents).values({
        kind: "order.status", entityId: order.id,
        detail: { from, to, rider: riderToSet ?? order.riderId }, actor,
      });
      return { status: to };
    });
    return ok(result);
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    if (m === "race") return fail("This order changed just now. Refresh and try again.", 409);
    if (m === "bad-rider") return fail("That rider isn't verified.", 400);
    if (m === "rider-city") return fail("That rider serves a different city.", 400);
    if (m === "forbidden-rider") return fail("You can't assign this rider.", 403);
    console.error("order patch failed", e);
    return fail("Couldn't update the order. Try again.", 500);
  }
}
