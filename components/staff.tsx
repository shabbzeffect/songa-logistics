"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge, EmptyState, Price, SectionTitle } from "@/components/ui";
import { orderStatusLabel } from "@/lib/status";

/** Shared staff helpers. */
export async function api<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; data?: T; error?: string }> {
  const r = await fetch(url, init);
  return r.json();
}

export interface StaffOrder {
  id: string; ref: string; token: string; status: string; total: number;
  city: string; area: string; customerName: string; phone?: string;
  merchantId: string; merchantName: string; riderId: string | null; riderName: string | null;
  paymentMethod: string; paymentStatus: string; scheduledFor: string | null; createdAt: string;
}

const NEXT: Record<string, string[]> = {
  placed: ["accepted", "cancelled"],
  accepted: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["picked_up", "cancelled"],
  picked_up: ["on_the_way"],
  on_the_way: ["delivered"],
};

export function StatusButtons({ token, status, onDone, allowRiderNote }: {
  token: string; status: string; onDone: () => void; allowRiderNote?: boolean;
}) {
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  async function go(to: string) {
    setBusy(to);
    await api(`/api/orders/${token}/status`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ to, note }),
    });
    setBusy("");
    onDone();
  }
  const options = NEXT[status] ?? [];
  if (!options.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {allowRiderNote && options.includes("delivered") && (
        <input
          value={note} onChange={(e) => setNote(e.target.value)} placeholder="Proof note (e.g. OTP 4521 / photo taken)"
          className="rounded-lg border border-stone-300 px-2 py-1 text-xs" aria-label="Proof of delivery note"
        />
      )}
      {options.map((to) => (
        <button
          key={to} disabled={!!busy}
          onClick={() => go(to)}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold ${to === "cancelled" ? "border border-red-300 text-red-700" : "bg-forest-900 text-white"}`}
        >
          {busy === to ? "…" : actionLabel(to)}
        </button>
      ))}
    </div>
  );
}

export function actionLabel(to: string): string {
  switch (to) {
    case "accepted": return "Accept";
    case "preparing": return "Start preparing";
    case "ready": return "Mark ready";
    case "picked_up": return "Picked up";
    case "on_the_way": return "On the way";
    case "delivered": return "Delivered";
    case "cancelled": return "Cancel";
    case "confirmed": return "Confirm pickup";
    case "assigned": return "Assign";
    case "in_transit": return "In transit";
    default: return to;
  }
}

export function OrderCard({ o, onDone, showCustomer, riders, showAssign }: {
  o: StaffOrder; onDone: () => void; showCustomer?: boolean;
  riders?: { id: string; name: string; city: string }[]; showAssign?: boolean;
}) {
  const [riderId, setRiderId] = useState(o.riderId ?? "");
  async function assign() {
    if (!riderId) return;
    await api(`/api/orders/${o.token}/status`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ to: o.status, riderId, note: "Rider assigned" }),
    });
    onDone();
  }
  return (
    <article className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <strong className="font-display">{o.ref}</strong>
        <Badge tone={o.status === "cancelled" ? "red" : o.status === "delivered" ? "green" : "coral"}>{orderStatusLabel(o.status as never)}</Badge>
        {o.scheduledFor && <Badge tone="sand">Scheduled</Badge>}
        <span className="ml-auto font-extrabold"><Price value={o.total} /></span>
      </div>
      <p className="mt-1 text-sm text-stone-600">
        {o.merchantName} · {o.area}, {o.city}
        {showCustomer && <> · {o.customerName}{o.phone ? ` · ${o.phone}` : ""}</>}
        {o.riderName ? <> · Rider: {o.riderName}</> : " · No rider yet"}
        {" · "}{o.paymentMethod.replaceAll("_", " ")} ({o.paymentStatus.replaceAll("_", " ")})
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <StatusButtons token={o.token} status={o.status} onDone={onDone} allowRiderNote />
        {showAssign && riders && ["placed", "accepted", "preparing", "ready"].includes(o.status) && (
          <span className="flex items-center gap-1">
            <select value={riderId} onChange={(e) => setRiderId(e.target.value)} className="rounded-lg border border-stone-300 px-2 py-1.5 text-xs" aria-label={`Assign rider to ${o.ref}`}>
              <option value="">Rider…</option>
              {riders.filter((r) => r.city === o.city).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <button onClick={assign} disabled={!riderId} className="rounded-lg bg-coral-500 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">Assign</button>
          </span>
        )}
        <Link href={`/track/${o.token}`} className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-bold">Tracking view</Link>
      </div>
    </article>
  );
}

export function Gate({ children, roles }: { children: React.ReactNode; roles: string[] }) {
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading");
  useEffect(() => {
    fetch("/api/auth").then((r) => r.json()).then((j) => {
      setState(j.ok && roles.includes(j.data.session.role) ? "ok" : "denied");
    });
  }, [roles]);
  if (state === "loading") return <p className="text-sm text-stone-500">Checking access…</p>;
  if (state === "denied")
    return <EmptyState title="Staff only" hint="Sign in with the right workspace to continue." action={<Link href="/login" className="font-bold text-coral-600 hover:underline">Sign in →</Link>} />;
  return <>{children}</>;
}

export function PageHead({ title, sub }: { title: string; sub?: string }) {
  return <SectionTitle title={title} sub={sub} />;
}
