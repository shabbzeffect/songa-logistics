"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useShop, saveLocalOrder } from "@/lib/shop-context";
import { cityAreas } from "@/lib/geo";
import { Field, Price, inputCls, SectionTitle } from "@/components/ui";
import { formatKES } from "@/lib/money";

function key() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function CheckoutPage() {
  const router = useRouter();
  const { city, basket, setQty, clearBasket, subtotal } = useShop();
  const [merchant, setMerchant] = useState<{ deliveryFee: number; freeOver: number | null; minOrder: number; open: boolean; name: string } | null>(null);
  const [form, setForm] = useState({
    customerName: "", phone: "", area: "", addressLine: "", landmark: "",
    deliveryNotes: "", paymentMethod: "cash_on_delivery", promoCode: "", tip: "0", scheduledFor: "",
  });
  const [promo, setPromo] = useState<{ code: string; discount: number } | null>(null);
  const [promoMsg, setPromoMsg] = useState("");
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");
  const [idemKey, setIdemKey] = useState("");

  useEffect(() => { setIdemKey(key()); }, []);
  useEffect(() => {
    if (basket.merchantId) {
      fetch(`/api/merchants/${basket.merchantId}`)
        .then((r) => r.json())
        .then((j) => { if (j.ok) setMerchant(j.data.merchant); });
    } else setMerchant(null);
  }, [basket.merchantId]);

  const areas = useMemo(() => cityAreas(city), [city]);
  const tip = Math.max(0, Math.min(5000, Number(form.tip) || 0));
  const discount = promo?.discount ?? 0;
  const afterDiscount = Math.max(0, subtotal - discount);
  const deliveryFee = merchant && merchant.freeOver != null && afterDiscount >= merchant.freeOver ? 0 : (merchant?.deliveryFee ?? 0);
  const serviceFee = afterDiscount > 0 ? Math.min(Math.round((afterDiscount * 5) / 100), 250) : 0;
  const total = afterDiscount + deliveryFee + serviceFee + tip;

  async function applyPromo() {
    setPromoMsg("");
    const code = form.promoCode.trim();
    if (!code) return;
    const r = await fetch("/api/promos/validate", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, subtotal }),
    });
    const j = await r.json();
    if (j.ok) { setPromo({ code: j.data.code, discount: j.data.discount }); setPromoMsg(`Applied — you save ${formatKES(j.data.discount)}`); }
    else { setPromo(null); setPromoMsg(j.error ?? "Invalid code"); }
  }

  async function place() {
    setError("");
    if (!basket.merchantId || basket.lines.length === 0) { setError("Your basket is empty."); return; }
    setPlacing(true);
    try {
      const r = await fetch("/api/checkout", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          merchantId: basket.merchantId,
          items: basket.lines.map((l) => ({ productId: l.productId, qty: l.qty, selections: l.selections, note: l.note })),
          customerName: form.customerName, phone: form.phone, city,
          area: form.area, addressLine: form.addressLine, landmark: form.landmark,
          deliveryNotes: form.deliveryNotes, paymentMethod: form.paymentMethod,
          promoCode: promo?.code ?? form.promoCode, tip, idempotencyKey: idemKey,
          ...(form.scheduledFor ? { scheduledFor: new Date(form.scheduledFor).toISOString() } : {}),
        }),
      });
      const j = await r.json();
      if (!j.ok) {
        setError(j.error ?? "Couldn't place the order.");
        // New key for a genuinely new attempt (old key is unused on validation failure,
        // but rotating is harmless and prevents accidental replays)
        setIdemKey(key());
        return;
      }
      saveLocalOrder({ ref: j.data.ref, token: j.data.trackingToken, total: j.data.total, merchant: basket.merchantName ?? "", at: new Date().toISOString() });
      clearBasket();
      router.push(`/track/${j.data.trackingToken}`);
    } catch {
      setError("Network hiccup — check your connection and try again. You won't be charged twice: tap Place once.");
    } finally {
      setPlacing(false);
    }
  }

  if (!basket.lines.length) {
    return (
      <div className="space-y-4">
        <SectionTitle title="Checkout" />
        <p className="rounded-2xl bg-white p-6 text-sm text-stone-600 shadow-sm">
          Your basket is empty. <Link href="/browse" className="font-bold text-coral-600 hover:underline">Find something tasty →</Link>
        </p>
      </div>
    );
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-5 lg:col-span-3">
        <SectionTitle title="Checkout" sub={basket.merchantName ? `From ${basket.merchantName}` : ""} />
        {merchant && !merchant.open && (
          <p className="rounded-xl bg-coral-100 px-4 py-2 text-sm font-semibold text-coral-600" role="alert">
            This shop just closed — you can review your basket but can&apos;t place the order right now.
          </p>
        )}
        <div className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="font-display font-extrabold text-forest-950">Where should we bring it?</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your name"><input value={form.customerName} onChange={set("customerName")} placeholder="e.g. Wanjiru Kamau" autoComplete="name" className={inputCls} /></Field>
            <Field label="Phone (M-Pesa number)" hint="07…, 01… or +254…"><input value={form.phone} onChange={set("phone")} placeholder="0712 345 678" inputMode="tel" autoComplete="tel" className={inputCls} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Area / estate">
              <input value={form.area} onChange={set("area")} placeholder="e.g. Kilimani" list="area-list" className={inputCls} />
              <datalist id="area-list">{areas.map((a) => <option key={a} value={a} />)}</datalist>
            </Field>
            <Field label="Apartment / building & house no."><input value={form.addressLine} onChange={set("addressLine")} placeholder="e.g. Rose Apartments, Hse B4" className={inputCls} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Landmark (optional)"><input value={form.landmark} onChange={set("landmark")} placeholder="e.g. Opposite the petrol station" className={inputCls} /></Field>
            <Field label="Gate / drop-off instructions (optional)"><input value={form.deliveryNotes} onChange={set("deliveryNotes")} placeholder="e.g. Call on arrival, ask for gate B" className={inputCls} /></Field>
          </div>
          <Field label="Schedule for later (optional)" hint="Needs at least 90 minutes notice, up to 7 days ahead">
            <input type="datetime-local" value={form.scheduledFor} onChange={set("scheduledFor")} className={inputCls} />
          </Field>
        </div>

        <div className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="font-display font-extrabold text-forest-950">Payment</h2>
          <div className="grid gap-2" role="radiogroup" aria-label="Payment method">
            {[
              { v: "cash_on_delivery", t: "Cash on delivery", d: "Pay the rider in cash when your food arrives." },
              { v: "mpesa_on_delivery", t: "M-Pesa on delivery", d: "The rider shows a till/paybill number on arrival. Nothing leaves your phone today." },
              { v: "mpesa_stk", t: "M-Pesa now (STK push)", d: "Online push — available once live M-Pesa is switched on." },
            ].map((o) => (
              <label key={o.v} className={`flex cursor-pointer gap-3 rounded-xl border px-4 py-3 ${form.paymentMethod === o.v ? "border-forest-700 bg-forest-50" : "border-stone-200"}`}>
                <input type="radio" name="pay" checked={form.paymentMethod === o.v} onChange={() => setForm((f) => ({ ...f, paymentMethod: o.v }))} className="mt-1 h-4 w-4" />
                <span><span className="block font-bold">{o.t}</span><span className="block text-sm text-stone-600">{o.d}</span></span>
              </label>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Promo code (optional)">
              <div className="flex gap-2">
                <input value={form.promoCode} onChange={set("promoCode")} placeholder="e.g. KARIBU10" className={inputCls + " uppercase"} />
                <button type="button" onClick={applyPromo} className="rounded-xl bg-forest-900 px-4 font-bold text-white">Apply</button>
              </div>
              {promoMsg && <span className={`mt-1 block text-xs font-semibold ${promo ? "text-forest-700" : "text-coral-600"}`}>{promoMsg}</span>}
            </Field>
            <Field label="Rider tip (optional, KSh)" hint="100% goes to your rider">
              <input value={form.tip} onChange={set("tip")} inputMode="numeric" placeholder="0" className={inputCls} />
            </Field>
          </div>
        </div>
      </div>

      <aside className="lg:col-span-2" aria-label="Order summary">
        <div className="sticky top-20 space-y-3 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="font-display font-extrabold text-forest-950">Your order</h2>
          <ul className="divide-y divide-stone-100">
            {basket.lines.map((l) => (
              <li key={l.key} className="py-2">
                <div className="flex justify-between gap-2 text-sm">
                  <span className="font-semibold">{l.qty}× {l.name}</span>
                  <Price value={(l.price + l.delta) * l.qty} className="font-bold" />
                </div>
                {l.selectionLabels.map((s, i) => <p key={i} className="text-xs text-stone-500">· {s.group}: {s.option}</p>)}
                <div className="mt-1 flex items-center gap-2">
                  <button onClick={() => setQty(l.key, l.qty - 1)} className="rounded-lg border border-stone-300 px-2 font-bold" aria-label={`Remove one ${l.name}`}>−</button>
                  <span className="text-sm font-bold">{l.qty}</span>
                  <button onClick={() => setQty(l.key, l.qty + 1)} className="rounded-lg border border-stone-300 px-2 font-bold" aria-label={`Add one ${l.name}`}>+</button>
                </div>
              </li>
            ))}
          </ul>
          <dl className="space-y-1 border-t border-stone-100 pt-3 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd><Price value={subtotal} /></dd></div>
            {discount > 0 && <div className="flex justify-between font-semibold text-forest-700"><dt>Promo {promo?.code}</dt><dd>−<Price value={discount} /></dd></div>}
            <div className="flex justify-between"><dt>Delivery</dt><dd>{deliveryFee === 0 ? <span className="font-bold text-forest-700">FREE</span> : <Price value={deliveryFee} />}</dd></div>
            <div className="flex justify-between"><dt>Service fee</dt><dd><Price value={serviceFee} /></dd></div>
            {tip > 0 && <div className="flex justify-between"><dt>Rider tip</dt><dd><Price value={tip} /></dd></div>}
            <div className="flex justify-between border-t border-stone-100 pt-2 text-base font-black"><dt>Total</dt><dd><Price value={total} /></dd></div>
          </dl>
          {merchant?.freeOver != null && afterDiscount < merchant.freeOver && (
            <p className="text-xs text-stone-600">Add <Price value={merchant.freeOver - afterDiscount} className="font-bold" /> more for free delivery 🎉</p>
          )}
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700" role="alert">{error}</p>}
          <button
            onClick={place}
            disabled={placing || (merchant != null && !merchant.open)}
            className="w-full rounded-xl bg-coral-500 py-3 font-black text-white hover:bg-coral-600 disabled:opacity-50"
          >
            {placing ? "Placing your order…" : `Place order · ${formatKES(total)}`}
          </button>
          <p className="text-xs text-stone-500">One shop per order. Prices re-checked on our side before anything is confirmed — no hidden charges, ever.</p>
        </div>
      </aside>
    </div>
  );
}
