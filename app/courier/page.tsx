"use client";

import { useCallback, useEffect, useState } from "react";
import { api, Gate, OrderCard, PageHead, type StaffOrder } from "@/components/staff";
import { EmptyState, Price } from "@/components/ui";

export default function CourierPage() {
  return (
    <Gate roles={["courier", "ops"]}>
      <Workspace />
    </Gate>
  );
}

function Workspace() {
  const [orders, setOrders] = useState<StaffOrder[]>([]);
  const [rider, setRider] = useState<{ id: string; name: string; active: boolean; kycStatus: string } | null>(null);
  const [today, setToday] = useState({ jobs: 0, earned: 0 });

  const load = useCallback(async () => {
    const me = await api<{ session: { actorId?: string } }>("/api/auth");
    const actorId = me.ok ? me.data?.session.actorId : undefined;
    const rl = await api<{ riders: { id: string; name: string; active: boolean; kycStatus: string }[] }>("/api/staff/riders");
    const me2 = (rl.ok ? rl.data?.riders ?? [] : []).find((r) => r.id === actorId) ?? null;
    setRider(me2);
    const j = await api<{ orders: StaffOrder[] }>("/api/staff/orders");
    if (j.ok && j.data) {
      const mine = (j.data.orders as StaffOrder[]).filter((o) => !actorId || o.riderId === actorId);
      setOrders(mine);
      const done = mine.filter((o) => o.status === "delivered");
      setToday({ jobs: done.length, earned: done.length * 120 }); // KSh 120 demo per-drop payout
    }
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [load]);

  async function toggle() {
    if (!rider) return;
    await api("/api/staff/riders", {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: rider.id, active: !rider.active }),
    });
    load();
  }

  const active = orders.filter((o) => !["delivered", "cancelled"].includes(o.status));

  return (
    <div className="space-y-5">
      <PageHead title="Courier workspace" sub={rider ? `${rider.name} · ${rider.active ? "Online — visible for dispatch" : "Offline"}` : ""} />
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <button onClick={toggle} className={`rounded-xl px-5 py-2.5 font-black text-white ${rider?.active ? "bg-stone-500" : "bg-forest-900"}`}>
          {rider?.active ? "Go offline" : "Go online"}
        </button>
        <p className="text-sm text-stone-600">
          Today: <strong>{today.jobs}</strong> drops · <strong><Price value={today.earned} /></strong> est. payout
          <span className="text-stone-400"> (KSh 120 demo per-drop rate + tips)</span>
        </p>
      </div>
      {active.length === 0 ? (
        <EmptyState title="No active jobs" hint={rider?.active ? "You're online — new jobs assigned to you will appear here." : "Go online to receive jobs."} />
      ) : (
        <div className="space-y-3">
          {active.map((o) => <OrderCard key={o.id} o={o} onDone={load} showCustomer />)}
        </div>
      )}
      <KycCard rider={rider} onDone={load} />
      <details className="rounded-2xl bg-white p-4 shadow-sm">
        <summary className="cursor-pointer font-bold">Finished today ({today.jobs})</summary>
        <ul className="mt-2 space-y-1 text-sm text-stone-600">
          {orders.filter((o) => ["delivered", "cancelled"].includes(o.status)).map((o) => (
            <li key={o.id}>{o.ref} · {o.status} · <Price value={o.total} /></li>
          ))}
        </ul>
      </details>
    </div>
  );
}

const KYC_LABEL: Record<string, string> = {
  pending: "Not submitted",
  submitted: "Under review",
  approved: "Approved",
  rejected: "Needs attention",
};

function KycCard({ rider, onDone }: {
  rider: { id: string; name: string; kycStatus: string } | null; onDone: () => void;
}) {
  const [idNumber, setIdNumber] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setBusy(true);
    const j = await api("/api/riders/kyc", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ idNumber, licenseNumber }),
    });
    setMsg(j.ok ? "Submitted — HQ reviews KYC within 2 working days." : (j.error ?? "Couldn't submit."));
    setBusy(false);
    if (j.ok) { setIdNumber(""); setLicenseNumber(""); onDone(); }
  }

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm" aria-label="KYC verification">
      <div className="flex items-center gap-2">
        <h2 className="font-display font-extrabold text-forest-950">KYC verification</h2>
        <span className="rounded-full bg-cream-200 px-2.5 py-0.5 text-xs font-semibold">
          {KYC_LABEL[rider?.kycStatus ?? "pending"] ?? rider?.kycStatus}
        </span>
      </div>
      {rider?.kycStatus === "approved" ? (
        <p className="mt-1 text-sm text-stone-600">You&apos;re cleared for dispatch. Keep your documents valid.</p>
      ) : (
        <form onSubmit={submit} className="mt-2 grid gap-2 sm:grid-cols-3">
          <label className="block text-sm font-semibold">National ID number
            <input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} required minLength={5} maxLength={20} placeholder="e.g. 12345678" className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 font-normal" />
          </label>
          <label className="block text-sm font-semibold">Driving licence number
            <input value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} required minLength={5} maxLength={20} placeholder="e.g. DL-04521" className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 font-normal" />
          </label>
          <div className="flex items-end">
            <button disabled={busy} className="w-full rounded-xl bg-forest-900 px-4 py-2 font-bold text-white disabled:opacity-50">
              {busy ? "Sending…" : rider?.kycStatus === "rejected" ? "Resubmit" : "Submit for review"}
            </button>
          </div>
          <p className="text-xs text-stone-500 sm:col-span-3">Document numbers only — never photos in this form. Dispatch unlocks once HQ approves.</p>
        </form>
      )}
      {msg && <p className="mt-2 text-sm font-semibold" role="status">{msg}</p>}
    </section>
  );
}
