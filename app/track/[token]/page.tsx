"use client";

import { Suspense, use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge, EmptyState, Price, SectionTitle } from "@/components/ui";
import { orderStatusLabel, type OrderStatus } from "@/lib/status";
import { formatNairobi } from "@/lib/time";

const FLOW: OrderStatus[] = ["placed", "accepted", "preparing", "ready", "picked_up", "on_the_way", "delivered"];

interface TrackData {
  order: {
    ref: string; status: OrderStatus; paymentMethod: string; paymentStatus: string;
    subtotal: number; discount: number; deliveryFee: number; serviceFee: number;
    tip: number; total: number; promoCode: string; scheduledFor: string | null;
    area: string; city: string; createdAt: string; prepMinutes: number; notifyPhone: string;
  };
  merchant: { id: string; name: string } | null;
  rider: { name: string; phone: string } | null;
  items: { name: string; qty: number; unitPrice: number; modifierDelta: number; modifiers: { group: string; option: string }[]; lineTotal: number; note: string }[];
  events: { status: string; note: string; at: string }[];
}

export default function TrackPage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={<p className="text-sm text-stone-500" role="status">Finding your order…</p>}>
      <TrackInner params={params} />
    </Suspense>
  );
}

function TrackInner({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<TrackData | null>(null);
  const [missing, setMissing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const r = await fetch(`/api/orders/${token}`);
    const j = await r.json();
    if (!j.ok) setMissing(true);
    else setData(j.data);
  }, [token]);

  useEffect(() => {
    load();
    const t = setInterval(() => {
      // Poll real status — stop once delivered/cancelled
      setData((d) => {
        if (d && (d.order.status === "delivered" || d.order.status === "cancelled")) return d;
        load();
        return d;
      });
    }, 8000);
    return () => clearInterval(t);
  }, [load]);

  async function cancel() {
    if (!confirm("Cancel this order? Stock goes straight back to the shelf.")) return;
    setCancelling(true);
    setMsg("");
    const r = await fetch(`/api/orders/${token}/status`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ to: "cancelled", note: "Cancelled by customer" }),
    });
    const j = await r.json();
    if (j.ok) { setMsg("Order cancelled."); load(); }
    else setMsg(j.error ?? "Couldn't cancel.");
    setCancelling(false);
  }

  if (missing) return <EmptyState title="Order not found" hint="Check your tracking link — it should look like /track/… with a long code." action={<Link href="/orders" className="font-bold text-coral-600 hover:underline">My orders →</Link>} />;
  if (!data) return <p className="text-sm text-stone-500" role="status">Finding your order…</p>;

  const { order } = data;
  const stepIx = FLOW.indexOf(order.status);
  const cancellable = ["placed", "accepted", "preparing", "ready"].includes(order.status);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <SectionTitle title={`Order ${order.ref}`} sub={`Placed ${formatNairobi(order.createdAt)} · ${data.merchant?.name ?? ""}`} />
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={order.status === "cancelled" ? "red" : order.status === "delivered" ? "green" : "coral"}>
            {orderStatusLabel(order.status)}
          </Badge>
          {order.scheduledFor && <Badge tone="sand">Scheduled · {formatNairobi(order.scheduledFor)}</Badge>}
          <span className="ml-auto text-sm text-stone-500">Delivering to {order.area}</span>
        </div>

        {order.status !== "cancelled" && order.status !== "delivered" && (
          <ol className="mt-5 space-y-0" aria-label="Delivery progress">
            {FLOW.map((s, i) => (
              <li key={s} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-black ${i <= stepIx ? "bg-forest-900 text-white" : "bg-stone-200 text-stone-500"}`}>
                    {i < stepIx ? "✓" : i + 1}
                  </span>
                  {i < FLOW.length - 1 && <span className={`h-5 w-0.5 ${i < stepIx ? "bg-forest-900" : "bg-stone-200"}`} />}
                </div>
                <p className={`pb-4 text-sm ${i <= stepIx ? "font-bold text-forest-950" : "text-stone-400"}`}>{orderStatusLabel(s)}</p>
              </li>
            ))}
          </ol>
        )}

        <p className="text-xs text-stone-500">
          Times are estimates based on the kitchen&apos;s usual prep ({order.prepMinutes} min + rider time) — not guaranteed.
          {data.rider ? <> Your rider is <strong>{data.rider.name}</strong> ({data.rider.phone}).</> : " A rider is assigned once the kitchen accepts."}
          {" "}Status updates also go by SMS to {order.notifyPhone}.
        </p>

        {cancellable && (
          <button onClick={cancel} disabled={cancelling} className="mt-3 rounded-xl border border-red-300 px-4 py-2 text-sm font-bold text-red-700">
            {cancelling ? "Cancelling…" : "Cancel order"}
          </button>
        )}
        {msg && <p className="mt-2 text-sm font-semibold" role="status">{msg}</p>}
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="font-display font-extrabold text-forest-950">Items</h2>
        <ul className="mt-2 divide-y divide-stone-100">
          {data.items.map((it, i) => (
            <li key={i} className="py-2 text-sm">
              <div className="flex justify-between"><span className="font-semibold">{it.qty}× {it.name}</span><Price value={it.lineTotal} className="font-bold" /></div>
              {it.modifiers.map((m, k) => <p key={k} className="text-xs text-stone-500">· {m.group}: {m.option}</p>)}
              {it.note && <p className="text-xs italic text-stone-500">“{it.note}”</p>}
            </li>
          ))}
        </ul>
        <dl className="mt-2 space-y-1 border-t border-stone-100 pt-2 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd><Price value={order.subtotal} /></dd></div>
          {order.discount > 0 && <div className="flex justify-between"><dt>Promo</dt><dd>−<Price value={order.discount} /></dd></div>}
          <div className="flex justify-between"><dt>Delivery</dt><dd><Price value={order.deliveryFee} /></dd></div>
          <div className="flex justify-between"><dt>Service</dt><dd><Price value={order.serviceFee} /></dd></div>
          {order.tip > 0 && <div className="flex justify-between"><dt>Tip</dt><dd><Price value={order.tip} /></dd></div>}
          <div className="flex justify-between font-black"><dt>Total</dt><dd><Price value={order.total} /></dd></div>
        </dl>
        <p className="mt-2 text-xs text-stone-500">
          Paid via {order.paymentMethod === "cash_on_delivery" ? "cash on delivery" : order.paymentMethod === "mpesa_on_delivery" ? "M-Pesa on delivery" : "M-Pesa"} · {order.paymentStatus.replaceAll("_", " ")}
        </p>
        {order.paymentMethod === "mpesa_stk" && (order.paymentStatus === "pending" || order.paymentStatus === "failed") && (
          <MpesaPromptBox token={token} failed={order.paymentStatus === "failed"} onUpdate={load} />
        )}
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="font-display font-extrabold text-forest-950">Status history</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {data.events.map((e, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span><strong>{orderStatusLabel(e.status as OrderStatus)}</strong>{e.note && <span className="text-stone-500"> — {e.note}</span>}</span>
              <span className="shrink-0 text-stone-400">{formatNairobi(e.at)}</span>
            </li>
          ))}
        </ul>
      </div>

      {order.status === "delivered" && <ReviewBox token={token} />}
    </div>
  );
}

function ReviewBox({ token }: { token: string }) {
  const [existing, setExisting] = useState<{ rating: number; comment: string; reply?: string } | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(`/api/orders/${token}/reviews`)
      .then((r) => r.json())
      .then((j) => { if (j.ok && j.data.review) setExisting(j.data.review); })
      .catch(() => {});
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    const r = await fetch(`/api/orders/${token}/reviews`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ rating, comment }),
    });
    const j = await r.json();
    if (j.ok) { setExisting(j.data.review); setMsg(j.data.duplicate ? "You already rated this order — asante!" : "Asante for the rating!"); }
    else setMsg(j.error ?? "Couldn't save your review.");
    setSaving(false);
  }

  if (existing) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="font-display font-extrabold text-forest-950">Your rating</h2>
        <p className="mt-1 text-sm" aria-label={`You rated ${existing.rating} out of 5`}>
          <span aria-hidden className="text-sun-400">{"★".repeat(existing.rating)}</span>
          <span aria-hidden className="text-stone-300">{"★".repeat(5 - existing.rating)}</span>
          <span className="ml-2 font-bold">{existing.rating}/5</span>
        </p>
        {existing.comment && <p className="mt-1 text-sm text-stone-600">“{existing.comment}”</p>}
        {existing.reply && (
          <p className="mt-2 rounded-xl bg-cream-100 px-3 py-2 text-sm text-stone-700">
            <span className="font-bold">Shop reply: </span>“{existing.reply}”
          </p>
        )}
        {msg && <p className="mt-1 text-sm font-semibold" role="status">{msg}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl bg-white p-6 shadow-sm" aria-label="Rate this order">
      <h2 className="font-display font-extrabold text-forest-950">How was it?</h2>
      <p className="text-sm text-stone-600">Your rating helps neighbours pick the best spots.</p>
      <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Star rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n === 1 ? "" : "s"}`}
            onClick={() => setRating(n)}
            className={`rounded-lg px-2 py-1 text-2xl ${n <= rating ? "text-sun-400" : "text-stone-300"}`}
          >
            ★
          </button>
        ))}
      </div>
      <label className="mt-2 block">
        <span className="mb-1 block text-sm font-bold">Comment (optional)</span>
        <textarea
          value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} rows={2}
          placeholder="What stood out?"
          className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
        />
      </label>
      {msg && <p className="mt-2 text-sm font-semibold" role="status">{msg}</p>}
      <button disabled={saving} className="mt-3 rounded-xl bg-forest-900 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">
        {saving ? "Saving…" : "Submit rating"}
      </button>
    </form>
  );
}

function MpesaPromptBox({ token, failed, onUpdate }: { token: string; failed: boolean; onUpdate: () => void }) {
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");

  async function resend() {
    setSending(true);
    setMsg("");
    try {
      const r = await fetch("/api/payments/mpesa-resend", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const j = await r.json();
      if (j.ok) { setMsg("Prompt sent — enter your M-Pesa PIN on your phone."); onUpdate(); }
      else setMsg(j.error ?? "Couldn't resend the prompt.");
    } catch {
      setMsg("Network hiccup — try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl bg-forest-50 p-4 text-sm" role="status">
      <p className="font-bold text-forest-950">
        {failed ? "That M-Pesa attempt didn't complete." : "Check your phone for the M-Pesa prompt."}
      </p>
      <p className="mt-0.5 text-stone-600">
        {failed
          ? "Your order is saved — enter your PIN when the new prompt arrives."
          : "Enter your M-Pesa PIN to pay. Nothing is charged until you approve on your phone."}
      </p>
      <button
        onClick={resend} disabled={sending}
        className="mt-2 rounded-xl bg-forest-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
      >
        {sending ? "Sending…" : failed ? "Send a new prompt" : "Resend prompt"}
      </button>
      {msg && <p className="mt-1 font-semibold">{msg}</p>}
    </div>
  );
}
