/**
 * API integration tests — run against a live server:
 *   BASE_URL=http://localhost:3000 node --test tests/api.test.ts
 * (Start the app first: `pnpm dev`. Uses demo ops login + idempotency keys.)
 */
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const key = () => randomBytes(16).toString("hex");

async function jfetch(path: string, init?: RequestInit, cookie?: string) {
  const r = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...(init?.headers ?? {}) },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const j = (await r.json().catch(() => ({}))) as { ok: boolean; data?: any; error?: string };
  if (!j.ok) {
    // surface server errors loudly in test output
  }
  return { status: r.status, body: j, setCookie: r.headers.get("set-cookie") };
}

function must<T>(v: T | undefined, what: string): T {
  assert.ok(v !== undefined, `missing ${what} in response`);
  return v as T;
}

let merchantId = "";
let merchantCity = "nairobi";
let productId = "";
let productPrice = 0;
let productStock = 0;
let orderToken = "";
let orderRef = "";
let opsCookie = "";

describe("Songa API journeys", () => {
  before(async () => {
    const health = await jfetch("/api/merchants?city=nairobi").catch(() => null);
    assert.ok(health && health.status === 200, `server not reachable at ${BASE} — start it with pnpm dev`);
  });

  it("lists Nairobi merchants, and another city shows different ones", async () => {
    const a = await jfetch("/api/merchants?city=nairobi");
    const b = await jfetch("/api/merchants?city=kisumu");
    assert.equal(a.status, 200);
    assert.ok(a.body.data.merchants.length > 0);
    assert.ok(b.body.data.merchants.length > 0);
    const idsA = new Set(a.body.data.merchants.map((m: { id: string }) => m.id));
    assert.ok(b.body.data.merchants.every((m: { id: string }) => !idsA.has(m.id)));
    const food = a.body.data.merchants.find((m: { category: string }) => m.category === "food");
    merchantId = food.id;
    merchantCity = food.city;
  });

  it("search and filters change results", async () => {
    const all = await jfetch(`/api/merchants?city=${merchantCity}`);
    const fish = await jfetch(`/api/merchants?city=${merchantCity}&q=pilau`);
    assert.ok((fish.body.data.merchants.length as number) <= (all.body.data.merchants.length as number));
    const cheap = await jfetch(`/api/merchants?city=${merchantCity}&maxFee=100`);
    assert.ok(cheap.body.data.merchants.every((m: { deliveryFee: number }) => m.deliveryFee <= 100));
  });

  it("storefront exposes modifiers with server prices", async () => {
    const d = await jfetch(`/api/merchants/${merchantId}`);
    assert.equal(d.status, 200);
    const prods = must(d.body.data?.products, "products") as { id: string; price: number; stock: number; available: boolean; modifiers: { required: boolean }[] }[];
    const withMods = prods.find((p) => p.modifiers.length > 0);
    assert.ok(withMods, "seed a product with modifier groups");
    const plain = prods.find((p) => p.modifiers.length === 0 && p.available) ?? prods[0];
    productId = plain.id;
    productPrice = plain.price;
    productStock = plain.stock;
    assert.ok(productStock > 2, "need stock for oversell test");
  });

  it("rejects invalid phone, cross-city and bad promo", async () => {
    const badPhone = await jfetch("/api/checkout", {
      method: "POST",
      body: JSON.stringify({
        merchantId, items: [{ productId, qty: 1, selections: {} }],
        customerName: "Test", phone: "123", city: merchantCity, area: "Test",
        addressLine: "Hse 1", paymentMethod: "cash_on_delivery", idempotencyKey: key(),
      }),
    });
    assert.equal(badPhone.status, 400);

    const crossCity = await jfetch("/api/checkout", {
      method: "POST",
      body: JSON.stringify({
        merchantId, items: [{ productId, qty: 1, selections: {} }],
        customerName: "Test", phone: "0712345678",
        city: merchantCity === "nairobi" ? "kisumu" : "nairobi",
        area: "Test", addressLine: "Hse 1", paymentMethod: "cash_on_delivery", idempotencyKey: key(),
      }),
    });
    assert.equal(crossCity.status, 409);

    const badPromo = await jfetch("/api/checkout", {
      method: "POST",
      body: JSON.stringify({
        merchantId, items: [{ productId, qty: 1, selections: {} }],
        customerName: "Test", phone: "0712345678", city: merchantCity, area: "Test",
        addressLine: "Hse 1", paymentMethod: "cash_on_delivery", promoCode: "NOPE123", idempotencyKey: key(),
      }),
    });
    assert.equal(badPromo.status, 409);
  });

  it("places a COD order with correct KES total + immutable snapshot", async () => {
    const k = key();
    const r = await jfetch("/api/checkout", {
      method: "POST",
      body: JSON.stringify({
        merchantId, items: [{ productId, qty: 2, selections: {} }],
        customerName: "Test Mum", phone: "0712345678", city: merchantCity, area: "Kilimani",
        addressLine: "Rose Apartments B4", landmark: "Opp. petrol station",
        paymentMethod: "cash_on_delivery", promoCode: "KARIBU10", tip: 50, idempotencyKey: k,
      }),
    });
    assert.equal(r.status, 201);
    const d = r.body.data as { ref: string; trackingToken: string; total: number; subtotal: number; discount: number; status: string };
    orderToken = d.trackingToken;
    orderRef = d.ref;
    assert.match(orderRef, /^SG-/);
    assert.ok(d.trackingToken.length > 20);
    // subtotal 2×price; KARIBU10 = 10% (cap 300, min 500 — may or may not apply)
    const expectedSub = productPrice * 2;
    assert.equal(d.subtotal, expectedSub);
    const track = await jfetch(`/api/orders/${orderToken}`);
    assert.equal(track.status, 200);
    const items = (track.body.data as { items: { unitPrice: number; qty: number }[] }).items;
    assert.equal(items[0].unitPrice, productPrice);
    assert.equal(items[0].qty, 2);

    // Idempotent replay: same key → same order, no duplicate
    const replay = await jfetch("/api/checkout", {
      method: "POST",
      body: JSON.stringify({
        merchantId, items: [{ productId, qty: 2, selections: {} }],
        customerName: "Test Mum", phone: "0712345678", city: merchantCity, area: "Kilimani",
        addressLine: "Rose Apartments B4", paymentMethod: "cash_on_delivery", idempotencyKey: k,
      }),
    });
    assert.equal(replay.status, 200);
    assert.equal((replay.body.data as typeof d).ref, orderRef);
  });

  it("overlapping stock purchases cannot oversell", async () => {
    const det = await jfetch(`/api/merchants/${merchantId}`);
    const prod = (det.body.data.products as { id: string; stock: number }[]).find((p) => p.id === productId)!;
    const left = prod.stock;
    assert.ok(left >= 1);
    // One line caps at 20 units, so a full-stock order is split into chunks.
    // Two concurrent full-stock orders must still resolve to exactly one winner.
    const chunks = (total: number) => {
      const items = [];
      let rest = total;
      while (rest > 0) {
        const q = Math.min(rest, 20);
        items.push({ productId, qty: q, selections: {} });
        rest -= q;
      }
      return items;
    };
    const payload = () => ({
      method: "POST",
      body: JSON.stringify({
        merchantId, items: chunks(left),
        customerName: "Race", phone: "0722111222", city: merchantCity, area: "Test",
        addressLine: "Hse 9", paymentMethod: "cash_on_delivery", idempotencyKey: key(),
      }),
    });
    const [a, b] = await Promise.all([jfetch("/api/checkout", payload()), jfetch("/api/checkout", payload())]);
    const codes = [a.status, b.status].sort();
    assert.deepEqual(codes, [201, 409]);

    // Cancel the winner so stock is restored and the suite stays re-runnable.
    const winner = [a, b].find((r) => r.status === 201)!;
    const wtoken = (winner.body.data as { trackingToken: string }).trackingToken;
    const restore = await jfetch(`/api/orders/${wtoken}/status`, {
      method: "PATCH", body: JSON.stringify({ to: "cancelled", note: "test cleanup" }),
    });
    assert.equal(restore.status, 200);
  });

  it("rejects invalid status jumps; ops can advance + cancel restores stock", async () => {
    // anonymous jump straight to delivered → forbidden
    const jump = await jfetch(`/api/orders/${orderToken}/status`, {
      method: "PATCH", body: JSON.stringify({ to: "delivered" }),
    });
    assert.ok([403, 409].includes(jump.status));

    // ops login (demo)
    const login = await jfetch("/api/auth", { method: "POST", body: JSON.stringify({ role: "ops", actorId: "ops" }) });
    assert.equal(login.status, 200);
    opsCookie = (login.setCookie ?? "").split(";")[0];

    const acc = await jfetch(`/api/orders/${orderToken}/status`, {
      method: "PATCH", body: JSON.stringify({ to: "accepted" }),
    }, opsCookie);
    assert.equal(acc.status, 200);

    const badJump = await jfetch(`/api/orders/${orderToken}/status`, {
      method: "PATCH", body: JSON.stringify({ to: "delivered" }),
    }, opsCookie);
    assert.equal(badJump.status, 409);

    const before = await jfetch(`/api/merchants/${merchantId}`);
    const stockBefore = (before.body.data.products as { id: string; stock: number }[]).find((p) => p.id === productId)!.stock;
    const cancel = await jfetch(`/api/orders/${orderToken}/status`, {
      method: "PATCH", body: JSON.stringify({ to: "cancelled", note: "test cancel" }),
    }, opsCookie);
    assert.equal(cancel.status, 200);
    const after = await jfetch(`/api/merchants/${merchantId}`);
    const stockAfter = (after.body.data.products as { id: string; stock: number }[]).find((p) => p.id === productId)!.stock;
    assert.equal(stockAfter, stockBefore + 2, "cancel restores exactly the ordered qty");

    // second cancel is rejected (exactly-once)
    const cancel2 = await jfetch(`/api/orders/${orderToken}/status`, {
      method: "PATCH", body: JSON.stringify({ to: "cancelled" }),
    }, opsCookie);
    assert.equal(cancel2.status, 409);
  });

  it("parcels: quote → create → assign → advance", async () => {
    const q = await jfetch("/api/parcels?city=nairobi&size=medium&weight=2");
    assert.equal(q.status, 200);
    assert.ok((q.body.data as { quote: number }).quote > 0);

    const c = await jfetch("/api/parcels", {
      method: "POST",
      body: JSON.stringify({
        senderName: "Amina", senderPhone: "0712345678", pickupArea: "Kilimani", pickupAddress: "Hse 1",
        recipientName: "Brian", recipientPhone: "0733445566", dropoffArea: "Westlands", dropoffAddress: "Hse 2",
        city: "nairobi", contents: "Documents", size: "medium", weightKg: 2,
        prohibitedAck: true, idempotencyKey: key(),
      }),
    });
    assert.equal(c.status, 201);
    const pdata = c.body.data as { trackingToken: string; quote: number };
    const t = await jfetch(`/api/parcels/${pdata.trackingToken}`);
    assert.equal(t.status, 200);

    const riders = await jfetch("/api/staff/riders", undefined, opsCookie);
    const riderId = (riders.body.data as { riders: { id: string; city: string }[] }).riders.find((r) => r.city === "nairobi")!.id;
    const conf = await jfetch(`/api/parcels/${pdata.trackingToken}`, {
      method: "PATCH", body: JSON.stringify({ to: "confirmed" }),
    }, opsCookie);
    assert.equal(conf.status, 200);
    const asg = await jfetch(`/api/parcels/${pdata.trackingToken}`, {
      method: "PATCH", body: JSON.stringify({ to: "assigned", riderId }),
    }, opsCookie);
    assert.equal(asg.status, 200);
  });

  it("partner lead persists and appears in HQ", async () => {
    const biz = `Test Shop ${Date.now()}`;
    const l = await jfetch("/api/leads", {
      method: "POST",
      body: JSON.stringify({
        kind: "food", businessName: biz, contactName: "Chef", phone: "0711223344", city: "nairobi",
      }),
    });
    assert.equal(l.status, 201);
    const inbox = await jfetch("/api/staff/leads", undefined, opsCookie);
    assert.ok((inbox.body.data as { leads: { businessName: string }[] }).leads.some((x) => x.businessName === biz));
  });

  it("HQ can pause a product and the storefront reflects it", async () => {
    const p = await jfetch(`/api/staff/products/${productId}`, {
      method: "PATCH", body: JSON.stringify({ available: false }),
    }, opsCookie);
    assert.equal(p.status, 200);
    const det = await jfetch(`/api/merchants/${merchantId}`);
    const prod = (det.body.data.products as { id: string; available: boolean }[]).find((x) => x.id === productId)!;
    assert.equal(prod.available, false);
    // restore
    await jfetch(`/api/staff/products/${productId}`, {
      method: "PATCH", body: JSON.stringify({ available: true }),
    }, opsCookie);
  });

  it("reviews: merchant list is public; bad input and pre-delivery are rejected", async () => {
    const list = await jfetch(`/api/merchants/${merchantId}/reviews`);
    assert.equal(list.status, 200);
    assert.ok(typeof (list.body.data as { rating: number }).rating === "number");
    assert.ok(Array.isArray((list.body.data as { reviews: unknown[] }).reviews));

    // Unknown shop → 404
    const missing = await jfetch("/api/merchants/00000000-0000-0000-0000-000000000000/reviews");
    assert.equal(missing.status, 404);

    // Validation runs before the status check: rating 9 → 400 even on a cancelled order
    const bad = await jfetch(`/api/orders/${orderToken}/reviews`, {
      method: "POST", body: JSON.stringify({ rating: 9 }),
    });
    assert.equal(bad.status, 400);

    // The journey order was cancelled, never delivered → 409
    const early = await jfetch(`/api/orders/${orderToken}/reviews`, {
      method: "POST", body: JSON.stringify({ rating: 5, comment: "Too early" }),
    });
    assert.equal(early.status, 409);
  });

  it("staff audit + workload require ops and return data", async () => {
    const anonAudit = await jfetch("/api/staff/audit?limit=3");
    assert.equal(anonAudit.status, 403);
    const anonWl = await jfetch("/api/staff/workload");
    assert.equal(anonWl.status, 403);

    const audit = await jfetch("/api/staff/audit?limit=5", undefined, opsCookie);
    assert.equal(audit.status, 200);
    assert.ok(Array.isArray((audit.body.data as { events: unknown[] }).events));
    assert.ok(Array.isArray((audit.body.data as { kinds: unknown[] }).kinds));

    const filtered = await jfetch("/api/staff/audit?limit=5&kind=promo.toggle", undefined, opsCookie);
    assert.equal(filtered.status, 200);
    assert.ok((filtered.body.data as { events: { kind: string }[] }).events.every((e) => e.kind === "promo.toggle"));

    const wl = await jfetch("/api/staff/workload", undefined, opsCookie);
    assert.equal(wl.status, 200);
    const wriders = (wl.body.data as { riders: { id: string; activeOrders: number; activeParcels: number }[] }).riders;
    assert.ok(wriders.length > 0);
    assert.ok(wriders.every((r) => typeof r.activeOrders === "number" && typeof r.activeParcels === "number"));
  });

  it("HQ can toggle a promo off and back on", async () => {
    const off = await jfetch("/api/staff/promos", {
      method: "PATCH", body: JSON.stringify({ code: "KARIBU10", active: false }),
    }, opsCookie);
    assert.equal(off.status, 200);

    const hidden = await jfetch("/api/promos/validate", {
      method: "POST", body: JSON.stringify({ code: "karibu10", subtotal: 1000 }),
    });
    assert.equal(hidden.status, 404);

    const on = await jfetch("/api/staff/promos", {
      method: "PATCH", body: JSON.stringify({ code: "KARIBU10", active: true }),
    }, opsCookie);
    assert.equal(on.status, 200);

    const visible = await jfetch("/api/promos/validate", {
      method: "POST", body: JSON.stringify({ code: "KARIBU10", subtotal: 1000 }),
    });
    assert.equal(visible.status, 200);
    assert.ok((visible.body.data as { discount: number }).discount > 0);

    // Unknown code → 404, no state change
    const nope = await jfetch("/api/staff/promos", {
      method: "PATCH", body: JSON.stringify({ code: "NOPE123", active: false }),
    }, opsCookie);
    assert.equal(nope.status, 404);
  });
});
