"use client";

import { useState } from "react";
import { Field, SectionTitle, inputCls } from "@/components/ui";

export default function PartnerPage() {
  const [f, setF] = useState({ kind: "food", businessName: "", contactName: "", phone: "", city: "nairobi", message: "" });
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSending(true);
    try {
      const r = await fetch("/api/leads", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f),
      });
      const j = await r.json();
      if (!j.ok) { setError(j.error ?? "Couldn't send. Try again."); return; }
      setDone(true);
    } catch {
      setError("Network hiccup — try again.");
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm">
        <p className="text-4xl" aria-hidden>🎉</p>
        <h1 className="font-display mt-2 text-2xl font-black text-forest-950">Asante — we got it!</h1>
        <p className="mt-2 text-stone-600">Our partnerships team will call you within 2 working days. Karibu to Songa.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <SectionTitle title="Grow with Songa" sub="Kitchens, markets, shops, pharmacies, online sellers, riders — tell us about yourself and we'll call you back." />
      <form onSubmit={submit} className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
        <Field label="I am a…">
          <select value={f.kind} onChange={set("kind")} className={inputCls}>
            <option value="food">Restaurant / kitchen (food delivery)</option>
            <option value="grocery">Market / shop / gifts (groceries &amp; shopping)</option>
            <option value="medical">Pharmacy / clinic (medical courier)</option>
            <option value="ecommerce">Online seller (e-commerce parcels)</option>
            <option value="rider">Rider (delivery partner)</option>
          </select>
        </Field>
        <Field label="Business name"><input value={f.businessName} onChange={set("businessName")} required className={inputCls} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your name"><input value={f.contactName} onChange={set("contactName")} required className={inputCls} /></Field>
          <Field label="Phone"><input value={f.phone} onChange={set("phone")} required placeholder="0712 345 678" className={inputCls} /></Field>
        </div>
        <Field label="City / town">
          <select value={f.city} onChange={set("city")} className={inputCls}>
            <option value="nairobi">Nairobi</option>
            <option value="mombasa">Mombasa</option>
            <option value="kisumu">Kisumu</option>
            <option value="other">Elsewhere in Kenya</option>
          </select>
        </Field>
        <Field label="Anything we should know? (optional)"><textarea value={f.message} onChange={set("message")} rows={3} className={inputCls} /></Field>
        {error && <p className="text-sm font-semibold text-red-700" role="alert">{error}</p>}
        <button disabled={sending} className="w-full rounded-xl bg-forest-900 py-3 font-black text-white disabled:opacity-50">
          {sending ? "Sending…" : "Request a callback"}
        </button>
      </form>
    </div>
  );
}
