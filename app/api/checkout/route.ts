import { and, eq, inArray, sql } from "drizzle-orm";
import * as s from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { fail, ok, rateLimit } from "@/lib/api";
import { checkoutSchema } from "@/lib/validation";
import { normalizeKEPhone } from "@/lib/phone";
import { calcTotals, percentOff, toKES } from "@/lib/money";
import { newOrderRef, newTrackingToken } from "@/lib/ids";
import { validateScheduledFor } from "@/lib/time";
import { initiateStkPush, mpesaConfigured } from "@/lib/mpesa";

class ConflictError extends Error {}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  if (!rateLimit(`checkout:${ip}`, 20)) return fail("Too many requests. Slow down a little.", 429);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Please check the highlighted fields", 400, {
      issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  const input = parsed.data;
  const phone = normalizeKEPhone(input.phone);
  if (!phone) return fail("Enter a valid Kenyan mobile number, e.g. 0712 345 678", 400);

  if (input.scheduledFor) {
    const v = validateScheduledFor(input.scheduledFor);
    if (!v.ok) return fail(v.error!, 400);
  }

  if (input.paymentMethod === "mpesa_stk" && !mpesaConfigured()) {
    return fail(
      "Online M-Pesa is not switched on yet. Choose Cash on delivery or M-Pesa on delivery — you'll pay when your order arrives.",
      400,
    );
  }

  const db = await getDb();

  // Idempotency replay
  const prior = await db
    .select()
    .from(s.idempotencyKeys)
    .where(eq(s.idempotencyKeys.key, input.idempotencyKey));
  if (prior.length > 0) return ok({ ...(prior[0].response as object), replayed: true });

  try {
    const result = await db.transaction(async (tx) => {
      // — Merchant —
      const mRows = await tx.select().from(s.merchants).where(eq(s.merchants.id, input.merchantId));
      const merchant = mRows[0];
      if (!merchant || !merchant.approved) throw new ConflictError("That shop is not available right now.");
      if (!merchant.open) throw new ConflictError(`${merchant.name} is currently closed. Try another shop.`);
      if (merchant.city !== input.city)
        throw new ConflictError(`Sorry — ${merchant.name} doesn't deliver to that city.`);

      // — Products (server-authoritative prices) —
      const ids = [...new Set(input.items.map((i) => i.productId))];
      const prodRows = await tx.select().from(s.products).where(inArray(s.products.id, ids));
      const byId = new Map(prodRows.map((p) => [p.id, p]));

      // Modifier catalogue for these products
      const groupRows = await tx
        .select()
        .from(s.modifierGroups)
        .where(inArray(s.modifierGroups.productId, ids));
      const optRows = groupRows.length
        ? await tx
            .select()
            .from(s.modifierOptions)
            .where(inArray(s.modifierOptions.groupId, groupRows.map((g) => g.id)))
        : [];
      const groupsByProduct = new Map<string, typeof groupRows>();
      for (const g of groupRows) {
        const arr = groupsByProduct.get(g.productId) ?? [];
        arr.push(g);
        groupsByProduct.set(g.productId, arr);
      }
      const optsByGroup = new Map<string, typeof optRows>();
      for (const o of optRows) {
        const arr = optsByGroup.get(o.groupId) ?? [];
        arr.push(o);
        optsByGroup.set(o.groupId, arr);
      }

      const lines: {
        productId: string; name: string; unitPrice: number; modifierDelta: number;
        modifiers: { group: string; option: string; delta: number }[]; qty: number; lineTotal: number; note: string;
      }[] = [];

      for (const item of input.items) {
        const p = byId.get(item.productId);
        if (!p || p.merchantId !== merchant.id || !p.available)
          throw new ConflictError("One of your items is no longer available. Please review your basket.");
        const groups = groupsByProduct.get(p.id) ?? [];
        let delta = 0;
        const chosen: { group: string; option: string; delta: number }[] = [];
        for (const g of groups) {
          const sel = item.selections[g.id];
          if (g.required && !sel)
            throw new ConflictError(`"${p.name}" needs a choice for "${g.name}".`);
          if (!sel) continue;
          const opt = (optsByGroup.get(g.id) ?? []).find((o) => o.id === sel && o.available);
          if (!opt) throw new ConflictError(`That option for "${p.name}" is no longer available.`);
          delta += opt.priceDelta;
          chosen.push({ group: g.name, option: opt.name, delta: opt.priceDelta });
        }
        lines.push({
          productId: p.id, name: p.name, unitPrice: p.price, modifierDelta: delta,
          modifiers: chosen, qty: item.qty,
          lineTotal: (p.price + delta) * item.qty, note: item.note ?? "",
        });
      }

      const subtotal = lines.reduce((t, l) => t + l.lineTotal, 0);
      if (merchant.minOrder > 0 && subtotal < merchant.minOrder)
        throw new ConflictError(`Minimum order at ${merchant.name} is KSh ${merchant.minOrder}.`);

      // — Promo (server-validated) —
      let discount = 0;
      let promoRow: typeof s.promos.$inferSelect | undefined;
      const code = input.promoCode.trim().toUpperCase();
      if (code) {
        const pr = await tx.select().from(s.promos).where(eq(s.promos.code, code));
        promoRow = pr[0];
        if (!promoRow || !promoRow.active) throw new ConflictError("That promo code isn't valid.");
        if (promoRow.expiresAt && new Date(promoRow.expiresAt).getTime() < Date.now())
          throw new ConflictError("That promo code has expired.");
        if (subtotal < (promoRow.minSubtotal ?? 0))
          throw new ConflictError(`That code needs a subtotal of at least KSh ${promoRow.minSubtotal}.`);
        if (promoRow.maxUses != null && (promoRow.used ?? 0) >= promoRow.maxUses)
          throw new ConflictError("That promo has run out of uses.");
        discount = promoRow.percent
          ? percentOff(subtotal, promoRow.percent, promoRow.cap)
          : Math.min(promoRow.amountOff ?? 0, subtotal);
      }

      const totals = calcTotals({
        lines: lines.map((l) => ({ unitPrice: l.unitPrice, qty: l.qty, modifierDelta: l.modifierDelta })),
        discount,
        deliveryFee: merchant.deliveryFee,
        tip: toKES(input.tip),
        freeDeliveryOver: merchant.freeOver,
      });

      // — Stock: atomic conditional decrement (prevents oversell) —
      for (const l of lines) {
        const prod = byId.get(l.productId)!;
        if (!prod.trackInventory) continue;
        const upd = await tx
          .update(s.products)
          .set({ stock: sql`${s.products.stock} - ${l.qty}` })
          .where(and(eq(s.products.id, l.productId), sql`${s.products.stock} >= ${l.qty}`))
          .returning({ id: s.products.id });
        if (upd.length === 0)
          throw new ConflictError(`"${l.name}" just ran out. Please adjust the quantity.`);
      }

      // — Promo single-use guard (atomic) —
      if (promoRow) {
        const inc = await tx
          .update(s.promos)
          .set({ used: sql`${s.promos.used} + 1` })
          .where(
            and(
              eq(s.promos.id, promoRow.id),
              eq(s.promos.active, true),
              sql`(${s.promos.maxUses} IS NULL OR ${s.promos.used} < ${s.promos.maxUses})`,
            ),
          )
          .returning({ id: s.promos.id });
        if (inc.length === 0) throw new ConflictError("That promo just ran out.");
      }

      const ref = newOrderRef();
      const trackingToken = newTrackingToken();
      const paymentStatus =
        input.paymentMethod === "mpesa_stk" ? "pending" : "pending_on_delivery";

      const [order] = await tx
        .insert(s.orders)
        .values({
          ref,
          trackingToken,
          merchantId: merchant.id,
          customerName: input.customerName.trim(),
          phone,
          city: input.city,
          area: input.area.trim(),
          addressLine: input.addressLine.trim(),
          landmark: (input.landmark ?? "").trim(),
          deliveryNotes: (input.deliveryNotes ?? "").trim(),
          status: "placed",
          paymentMethod: input.paymentMethod,
          paymentStatus,
          subtotal: totals.subtotal,
          discount: totals.discount,
          deliveryFee: totals.deliveryFee,
          serviceFee: totals.serviceFee,
          tip: totals.tip,
          total: totals.total,
          promoCode: code,
          scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : undefined,
          idempotencyKey: input.idempotencyKey,
        })
        .returning();

      for (const l of lines) {
        await tx.insert(s.orderItems).values({
          orderId: order.id, productId: l.productId, name: l.name,
          unitPrice: l.unitPrice, modifierDelta: l.modifierDelta,
          modifiers: l.modifiers, qty: l.qty, lineTotal: l.lineTotal, note: l.note,
        });
      }
      await tx.insert(s.orderEvents).values({
        orderId: order.id, status: "placed",
        note: input.scheduledFor ? `Scheduled for ${input.scheduledFor}` : "Order placed",
        actor: "customer",
      });
      await tx.insert(s.paymentIntents).values({
        orderId: order.id, method: input.paymentMethod, amount: totals.total,
        status: paymentStatus, idempotencyKey: `pay-${input.idempotencyKey}`,
      });
      await tx.insert(s.auditEvents).values({
        kind: "order.created", entityId: order.id,
        detail: { ref, total: totals.total, paymentMethod: input.paymentMethod }, actor: "customer",
      });

      const response = {
        ref, trackingToken, status: "placed", total: totals.total,
        subtotal: totals.subtotal, discount: totals.discount,
        deliveryFee: totals.deliveryFee, serviceFee: totals.serviceFee, tip: totals.tip,
      };
      await tx.insert(s.idempotencyKeys).values({
        key: input.idempotencyKey, scope: "checkout", response,
      });
      return response;
    });

    // Online M-Pesa prompt goes out AFTER the order commits (never inside the tx).
    let stk: { sent: boolean; message?: string } | undefined;
    if (input.paymentMethod === "mpesa_stk") {
      const push = await initiateStkPush({ orderRef: result.ref, phoneE164: phone, amount: result.total });
      if (push.ok) {
        await db
          .update(s.paymentIntents)
          .set({ providerRef: push.checkoutRequestId })
          .where(eq(s.paymentIntents.idempotencyKey, `pay-${input.idempotencyKey}`));
        stk = { sent: true };
      } else {
        stk = { sent: false, message: push.error };
      }
    }

    return ok({ ...result, ...(stk ? { stk } : {}) }, 201);
  } catch (e) {
    if (e instanceof ConflictError) return fail(e.message, 409);
    // Double-submit race: idempotency row won by another request → replay it
    const msg = e instanceof Error ? e.message : "";
    if (/duplicate|unique|idempotency/i.test(msg)) {
      const again = await (await getDb())
        .select()
        .from(s.idempotencyKeys)
        .where(eq(s.idempotencyKeys.key, input.idempotencyKey));
      if (again.length > 0) return ok({ ...(again[0].response as object), replayed: true });
    }
    console.error("checkout failed", e);
    return fail("Something went wrong placing your order. Please try again.", 500);
  }
}
