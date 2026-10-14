"use client";

import { Suspense, use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge, EmptyState, Price, SectionTitle } from "@/components/ui";
import { parcelStatusLabel, type ParcelStatus } from "@/lib/status";
import { formatNairobi } from "@/lib/time";

interface Data {
  parcel: {
    ref: string; status: ParcelStatus; city: string; quote: number;
    pickupArea: string; dropoffArea: string; contents: string; size: string;
    weightKg: number; senderName: string; senderPhone: string;
    recipientName: string; recipientPhone: string; createdAt: string;
  };
  rider: { name: string } | null;
  events: { status: string; note: string; at: string }[];
}

export default function ParcelTrackPage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={<p className="text-sm text-stone-500" role="status">Finding your parcel…</p>}>
      <ParcelTrackInner params={params} />
    </Suspense>
  );
}

function ParcelTrackInner({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<Data | null>(null);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/parcels/${token}`);
    const j = await r.json();
    if (!j.ok) setMissing(true);
    else setData(j.data);
  }, [token]);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  if (missing) return <EmptyState title="Parcel not found" hint="Check your tracking link." action={<Link href="/parcel" className="font-bold text-coral-600 hover:underline">Send another →</Link>} />;
  if (!data) return <p className="text-sm text-stone-500" role="status">Finding your parcel…</p>;
  const p = data.parcel;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <SectionTitle title={`Parcel ${p.ref}`} sub={`${p.pickupArea} → ${p.dropoffArea}`} />
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <Badge tone={p.status === "cancelled" ? "red" : p.status === "delivered" ? "green" : "coral"}>
          {parcelStatusLabel(p.status)}
        </Badge>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div><dt className="text-stone-500">Contents</dt><dd className="font-semibold">{p.contents}</dd></div>
          <div><dt className="text-stone-500">Size / weight</dt><dd className="font-semibold">{p.size} · {p.weightKg} kg</dd></div>
          <div><dt className="text-stone-500">Sender</dt><dd className="font-semibold">{p.senderName} ({p.senderPhone})</dd></div>
          <div><dt className="text-stone-500">Recipient</dt><dd className="font-semibold">{p.recipientName} ({p.recipientPhone})</dd></div>
          <div><dt className="text-stone-500">Estimate</dt><dd className="font-semibold"><Price value={p.quote} /></dd></div>
          <div><dt className="text-stone-500">Rider</dt><dd className="font-semibold">{data.rider?.name ?? "Not assigned yet"}</dd></div>
        </dl>
      </div>
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="font-display font-extrabold text-forest-950">Status history</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {data.events.map((e, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span><strong>{parcelStatusLabel(e.status as ParcelStatus)}</strong>{e.note && <span className="text-stone-500"> — {e.note}</span>}</span>
              <span className="shrink-0 text-stone-400">{formatNairobi(e.at)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
