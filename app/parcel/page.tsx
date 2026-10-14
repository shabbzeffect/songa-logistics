"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useShop } from "@/lib/shop-context";
import { PROHIBITED_ITEMS, sizeLabel, type ParcelSize } from "@/lib/parcels";
import { cityAreas } from "@/lib/geo";
import { Field, Price, inputCls, SectionTitle } from "@/components/ui";
import { formatKES } from "@/lib/money";

function key() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const SIZES: ParcelSize[] = ["small", "medium", "large"];

export default function ParcelPage() {
  const router = useRouter();
  const { city } = useShop();
  const [f, setF] = useState({
    senderName: "", senderPhone: "", pickupArea: "", pickupAddress: "",
    recipientName: "", recipientPhone: "", dropoffArea: "", dropoffAddress: "",
    contents: "", size: "small" as ParcelSize, weightKg: "1", prohibitedAck: false,
  });
  const [quote, setQuote] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const areas = cityAreas(city);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const v = e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value;
    setF((p) => ({ ...p, [k]: v }));
  };

  useEffect(() => {
    const w = Number(f.weightKg);
    if (!Number.isFinite(w) || w < 0.1 || w > 20) { setQuote(null); return; }
    const t = setTimeout(() => {
      fetch(`/api/parcels?city=${city}&size=${f.size}&weight=${w}`)
        .then((r) => r.json())
        .then((j) => { if (j.ok) setQuote(j.data.quote); });
    }, 400);
    return () => clearTimeout(t);
  }, [city, f.size, f.weightKg]);

  async function submit() {
    setError("");
    if (!f.prohibitedAck) { setError("Please confirm your parcel has no prohibited items."); return; }
    setSending(true);
    try {
      const r = await fetch("/api/parcels", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...f, city, weightKg: Number(f.weightKg), idempotencyKey: key() }),
      });
      const j = await r.json();
      if (!j.ok) { setError(j.error ?? "Couldn't create the request."); return; }
      router.push(`/parcel/${j.data.trackingToken}`);
    } catch {
      setError("Network hiccup — try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <SectionTitle title="E-commerce parcels" sub={`Shop-to-doorstep delivery across ${city} — online sellers and personal sends, pay the rider on pickup`} />
      <div className="grid gap-4 rounded-2xl bg-white p-5 shadow-sm sm:grid-cols-2">
        <h2 className="font-display font-extrabold text-forest-950 sm:col-span-2">Pickup</h2>
        <Field label="Sender name"><input value={f.senderName} onChange={set("senderName")} className={inputCls} /></Field>
        <Field label="Sender phone"><input value={f.senderPhone} onChange={set("senderPhone")} placeholder="0712 345 678" inputMode="tel" className={inputCls} /></Field>
        <Field label="Pickup area">
          <input value={f.pickupArea} onChange={set("pickupArea")} list="p-areas" className={inputCls} />
          <datalist id="p-areas">{areas.map((a) => <option key={a} value={a} />)}</datalist>
        </Field>
        <Field label="Pickup address"><input value={f.pickupAddress} onChange={set("pickupAddress")} placeholder="Building, floor, gate…" className={inputCls} /></Field>
      </div>
      <div className="grid gap-4 rounded-2xl bg-white p-5 shadow-sm sm:grid-cols-2">
        <h2 className="font-display font-extrabold text-forest-950 sm:col-span-2">Drop-off</h2>
        <Field label="Recipient name"><input value={f.recipientName} onChange={set("recipientName")} className={inputCls} /></Field>
        <Field label="Recipient phone"><input value={f.recipientPhone} onChange={set("recipientPhone")} placeholder="07…" inputMode="tel" className={inputCls} /></Field>
        <Field label="Drop-off area">
          <input value={f.dropoffArea} onChange={set("dropoffArea")} list="d-areas" className={inputCls} />
          <datalist id="d-areas">{areas.map((a) => <option key={a} value={a} />)}</datalist>
        </Field>
        <Field label="Drop-off address"><input value={f.dropoffAddress} onChange={set("dropoffAddress")} className={inputCls} /></Field>
      </div>
      <div className="grid gap-4 rounded-2xl bg-white p-5 shadow-sm sm:grid-cols-2">
        <h2 className="font-display font-extrabold text-forest-950 sm:col-span-2">What&apos;s inside?</h2>
        <Field label="Contents"><input value={f.contents} onChange={set("contents")} placeholder="e.g. Online order #4521, documents envelope" className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Size">
            <select value={f.size} onChange={set("size")} className={inputCls}>
              {SIZES.map((s) => <option key={s} value={s}>{sizeLabel(s)}</option>)}
            </select>
          </Field>
          <Field label="Weight (kg)" hint="Max 20 kg"><input value={f.weightKg} onChange={set("weightKg")} inputMode="decimal" className={inputCls} /></Field>
        </div>
        <div className="rounded-xl bg-cream-100 p-4 sm:col-span-2">
          <p className="text-sm font-bold">We can&apos;t carry these:</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-stone-600">
            {PROHIBITED_ITEMS.map((p) => <li key={p}>{p}</li>)}
          </ul>
          <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm font-semibold">
            <input type="checkbox" checked={f.prohibitedAck} onChange={set("prohibitedAck")} className="mt-1 h-4 w-4" />
            My parcel has none of the items above
          </label>
        </div>
      </div>
      <div className="sticky bottom-4 rounded-2xl bg-forest-950 p-5 text-cream-50 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-cream-200/70">Estimate (not a guaranteed quote)</p>
            <p className="font-display text-3xl font-black">{quote != null ? formatKES(quote) : "—"}</p>
          </div>
          <button onClick={submit} disabled={sending} className="rounded-xl bg-coral-500 px-6 py-3 font-black text-white hover:bg-coral-600 disabled:opacity-50">
            {sending ? "Requesting…" : "Request pickup"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm font-semibold text-coral-100" role="alert">{error}</p>}
        <p className="mt-1 text-xs text-cream-200/70">A rider is assigned after we confirm your pickup by phone. Pay cash or M-Pesa on pickup.</p>
      </div>
    </div>
  );
}

export function ParcelPrice({ v }: { v: number }) {
  return <Price value={v} />;
}
