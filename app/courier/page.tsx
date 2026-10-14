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
  const [rider, setRider] = useState<{ id: string; name: string; active: boolean } | null>(null);
  const [today, setToday] = useState({ jobs: 0, earned: 0 });

  const load = useCallback(async () => {
    const me = await api<{ session: { actorId?: string } }>("/api/auth");
    const actorId = me.ok ? me.data?.session.actorId : undefined;
    const rl = await api<{ riders: { id: string; name: string; active: boolean }[] }>("/api/staff/riders");
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
