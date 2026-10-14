import type { Metadata } from "next";
import Link from "next/link";
import { SectionTitle } from "@/components/ui";
import { PROHIBITED_ITEMS } from "@/lib/parcels";

export const metadata: Metadata = { title: "Help & policies" };

export default function SupportPage() {
  const wa = process.env.NEXT_PUBLIC_WHATSAPP ?? "";
  const phone = process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? "+254700000000";
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <SectionTitle title="Help & policies" sub="Straight answers, no fine print" />

      <section id="contact" className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="font-display text-lg font-extrabold text-forest-950">Talk to a human</h2>
        <ul className="mt-2 space-y-1 text-sm">
          <li>Phone: <a className="font-bold text-forest-700 hover:underline" href={`tel:${phone}`}>{phone}</a> (8am–10pm EAT)</li>
          {wa && <li>WhatsApp: <a className="font-bold text-forest-700 hover:underline" href={`https://wa.me/${wa}`}>chat with us</a></li>}
          <li>Partner enquiries: <Link className="font-bold text-forest-700 hover:underline" href="/partner">partnership form</Link></li>
        </ul>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="font-display text-lg font-extrabold text-forest-950">Cancellations & refunds (what we actually do)</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-stone-700">
          <li>Cancel free any time before the kitchen finishes prep (statuses placed → ready) from your tracking page. Stock returns to the shelf automatically.</li>
          <li>Cash / M-Pesa on delivery: nothing is charged before arrival, so cancellation simply voids the payment request.</li>
          <li>Online M-Pesa (once live): failed or cancelled-before-dispatch payments are reversed to your M-Pesa; completed deliveries are refunded only for wrong/missing items, after review.</li>
          <li>Wrong or missing items? Contact us within 24 hours with your order ref (e.g. SG-ABC123) and a photo — we make it right.</li>
        </ul>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="font-display text-lg font-extrabold text-forest-950">Delivery times</h2>
        <p className="mt-1 text-sm text-stone-700">
          Every time you see (~35 min) is an <strong>estimate</strong> from the kitchen&apos;s usual prep plus rider time —
          traffic on Ngong Road is real. We never show a guaranteed time, and we never show a live rider map unless GPS is connected
          (today it isn&apos;t — you get honest step-by-step status instead).
        </p>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="font-display text-lg font-extrabold text-forest-950">E-commerce parcels: what we can&apos;t carry</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-stone-700">
          {PROHIBITED_ITEMS.map((p) => <li key={p}>{p}</li>)}
        </ul>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="font-display text-lg font-extrabold text-forest-950">Medical courier</h2>
        <p className="mt-1 text-sm text-stone-700">
          Our medical courier moves pharmacy essentials in sealed, tamper-evident packaging with priority
          dispatch. Prescription orders are verified with a pharmacist by phone before dispatch. We don&apos;t
          diagnose, don&apos;t stock age-restricted items in this demo, and our riders never open medical
          parcels. Always read pack leaflets and talk to a pharmacist or clinician for medical advice.
        </p>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="font-display text-lg font-extrabold text-forest-950">Your data</h2>
        <p className="mt-1 text-sm text-stone-700">
          We keep only what delivery needs: name, phone, address and order history. Rider phones are masked on tracking pages,
          customer contacts are only visible to staff handling your order, and every money/status change is audit-logged.
          Ask us to delete your data any time via the contacts above.
        </p>
      </section>
    </div>
  );
}
