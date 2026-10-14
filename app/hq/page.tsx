"use client";

import { useCallback, useEffect, useState } from "react";
import { api, Gate, OrderCard, PageHead, actionLabel, type StaffOrder } from "@/components/staff";
import { Badge, EmptyState, Price } from "@/components/ui";
import { formatKES } from "@/lib/money";

interface Overview {
  shops: number; ordersInMotion: number; deliveredCount: number; deliveredValue: number;
  activeRiders: number; parcelsInMotion: number; openLeads: number;
  recentOrders: { id: string; ref: string; token: string; status: string; total: number; merchantId: string; city: string; createdAt: string }[];
}

export default function HqPage() {
  return (
    <Gate roles={["ops"]}>
      <Hq />
    </Gate>
  );
}

function Hq() {
  const [tab, setTab] = useState<"today" | "orders" | "parcels" | "shops" | "promos" | "leads" | "riders" | "audit" | "analytics">("today");
  const [ov, setOv] = useState<Overview | null>(null);
  const [orders, setOrders] = useState<StaffOrder[]>([]);
  const [status, setStatus] = useState("");
  const [parcels, setParcels] = useState<{ id: string; ref: string; token: string; status: string; city: string; quote: number; pickupArea: string; dropoffArea: string; contents: string; recipientName: string; riderId: string | null }[]>([]);
  const [shops, setShops] = useState<{ id: string; name: string; city: string; category: string; open: boolean; approved: boolean; deliveryFee: number }[]>([]);
  const [promos, setPromos] = useState<{ code: string; label: string; active: boolean; used: number; maxUses: number | null }[]>([]);
  const [leads, setLeads] = useState<{ id: string; kind: string; businessName: string; contactName: string; phone: string; city: string; message: string; handled: boolean }[]>([]);
  const [riders, setRiders] = useState<{ id: string; name: string; city: string; active: boolean; verified: boolean; kycStatus: string; kycNote?: string }[]>([]);
  const [workload, setWorkload] = useState<Record<string, { activeOrders: number; activeParcels: number }>>({});
  const [audit, setAudit] = useState<{ id: string; kind: string; entityId: string; detail: unknown; actor: string; at: string }[]>([]);
  const [auditKinds, setAuditKinds] = useState<string[]>([]);
  const [auditKind, setAuditKind] = useState("");
  const [anDays, setAnDays] = useState(30);
  const [anCity, setAnCity] = useState("");
  const [analytics, setAnalytics] = useState<{
    orders: { revenue: number; count: number; cancelled: number; cancelRate: number; discount: number; aov: number };
    parcels: { revenue: number; count: number };
    series: { day: string; revenue: number; orders: number }[];
    byCity: { city: string; revenue: number; orders: number }[];
    byCategory: { category: string; revenue: number; orders: number }[];
    topShops: { id: string; name: string; revenue: number; orders: number }[];
  } | null>(null);
  const [msg, setMsg] = useState("");

  const loadAll = useCallback(async () => {
    const [o, ord, par, sho, pro, lea, rid, wl] = await Promise.all([
      api<Overview>("/api/staff/overview"),
      api<{ orders: StaffOrder[] }>(`/api/staff/orders${status ? `?status=${status}` : ""}`),
      api<{ parcels: typeof parcels }>("/api/staff/parcels"),
      api<{ merchants: typeof shops }>("/api/staff/merchants"),
      api<{ promos: typeof promos }>("/api/staff/promos"),
      api<{ leads: typeof leads }>("/api/staff/leads"),
      api<{ riders: typeof riders }>("/api/staff/riders"),
      api<{ riders: { id: string; activeOrders: number; activeParcels: number }[] }>("/api/staff/workload"),
    ]);
    if (o.ok && o.data) setOv(o.data);
    if (ord.ok && ord.data) setOrders(ord.data.orders);
    if (par.ok && par.data) setParcels(par.data.parcels);
    if (sho.ok && sho.data) setShops(sho.data.merchants);
    if (pro.ok && pro.data) setPromos(pro.data.promos);
    if (lea.ok && lea.data) setLeads(lea.data.leads);
    if (rid.ok && rid.data) setRiders(rid.data.riders);
    if (wl.ok && wl.data) {
      const map: Record<string, { activeOrders: number; activeParcels: number }> = {};
      for (const r of wl.data.riders) map[r.id] = { activeOrders: r.activeOrders, activeParcels: r.activeParcels };
      setWorkload(map);
    }
  }, [status]);

  const loadAudit = useCallback(async () => {
    const j = await api<{ events: typeof audit; kinds: string[] }>(
      `/api/staff/audit?limit=50${auditKind ? `&kind=${encodeURIComponent(auditKind)}` : ""}`,
    );
    if (j.ok && j.data) { setAudit(j.data.events); setAuditKinds(j.data.kinds); }
  }, [auditKind]);

  useEffect(() => { loadAll(); const t = setInterval(loadAll, 15000); return () => clearInterval(t); }, [loadAll]);
  useEffect(() => { loadAudit(); }, [loadAudit]);

  const loadAnalytics = useCallback(async () => {
    const j = await api<{ orders: NonNullable<typeof analytics>["orders"]; parcels: NonNullable<typeof analytics>["parcels"]; series: NonNullable<typeof analytics>["series"]; byCity: NonNullable<typeof analytics>["byCity"]; byCategory: NonNullable<typeof analytics>["byCategory"]; topShops: NonNullable<typeof analytics>["topShops"] }>(
      `/api/staff/analytics?days=${anDays}${anCity ? `&city=${anCity}` : ""}`,
    );
    if (j.ok && j.data) {
      setAnalytics({
        orders: j.data.orders, parcels: j.data.parcels, series: j.data.series,
        byCity: j.data.byCity, byCategory: j.data.byCategory, topShops: j.data.topShops,
      });
    }
  }, [anDays, anCity]);

  useEffect(() => { if (tab === "analytics") loadAnalytics(); }, [tab, loadAnalytics]);

  async function parcelGo(token: string, to: string, riderId?: string) {
    const j = await api(`/api/parcels/${token}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ to, ...(riderId ? { riderId } : {}) }),
    });
    setMsg(j.ok ? `Parcel → ${to}` : (j.error ?? "Failed"));
    loadAll();
  }

  async function toggleShop(id: string, body: object) {
    const j = await api(`/api/staff/merchants/${id}`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    });
    setMsg(j.ok ? "Shop updated — public storefront reflects it." : (j.error ?? "Failed"));
    loadAll();
  }

  async function handleLead(id: string, handled: boolean) {
    await api("/api/staff/leads", {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, handled }),
    });
    loadAll();
  }

  async function togglePromo(code: string, active: boolean) {
    const j = await api("/api/staff/promos", {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, active }),
    });
    setMsg(j.ok ? `Promo ${code} ${active ? "on" : "off"}.` : (j.error ?? "Failed"));
    loadAll();
  }

  async function reviewKyc(id: string, status: "approved" | "rejected", note = "") {
    const j = await api("/api/staff/riders/kyc", {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status, note }),
    });
    setMsg(j.ok ? `Rider KYC ${status}.` : (j.error ?? "Failed"));
    loadAll();
  }

  async function addPromo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const j = await api("/api/staff/promos", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code: String(fd.get("code")), label: String(fd.get("label") || ""),
        percent: fd.get("percent") ? Number(fd.get("percent")) : null,
        amountOff: fd.get("amountOff") ? Number(fd.get("amountOff")) : null,
        minSubtotal: Number(fd.get("minSubtotal") || 0),
      }),
    });
    setMsg(j.ok ? "Promo created." : (j.error ?? "Failed"));
    e.currentTarget.reset();
    loadAll();
  }

  return (
    <div className="space-y-5">
      <PageHead title="Operations HQ" sub="Shops, orders in motion, riders, parcels and partner leads" />
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="HQ sections">
        {(["today", "orders", "parcels", "shops", "promos", "leads", "riders", "audit", "analytics"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`rounded-xl px-4 py-2 text-sm font-bold capitalize ${tab === t ? "bg-forest-950 text-white" : "bg-white"}`}>
            {t}{t === "leads" && ov && ov.openLeads > 0 ? ` (${ov.openLeads})` : ""}
          </button>
        ))}
      </div>
      {msg && <p className="text-sm font-semibold" role="status">{msg}</p>}

      {tab === "today" && ov && (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["Shops live", String(ov.shops)],
            ["Orders in motion", String(ov.ordersInMotion)],
            ["Delivered value", formatKES(ov.deliveredValue)],
            ["Delivered orders", String(ov.deliveredCount)],
            ["Riders online", String(ov.activeRiders)],
            ["Parcels in motion", String(ov.parcelsInMotion)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase text-stone-500">{k}</p>
              <p className="font-display text-3xl font-black text-forest-950">{v}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "orders" && (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-semibold">Status
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-stone-300 px-2 py-1.5">
              <option value="">All</option>
              {["placed", "accepted", "preparing", "ready", "picked_up", "on_the_way", "delivered", "cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          {orders.length === 0 ? <EmptyState title="No orders" hint="Try another status filter." /> :
            orders.map((o) => <OrderCard key={o.id} o={o} onDone={loadAll} showCustomer showAssign riders={riders} />)}
        </div>
      )}

      {tab === "parcels" && (
        <div className="space-y-3">
          {parcels.length === 0 ? <EmptyState title="No parcels" hint="Parcel requests from the Send page land here." /> :
            parcels.map((p) => (
              <ParcelRow key={p.id} p={p} riders={riders.filter((r) => r.city === p.city)} onGo={parcelGo} />
            ))}
        </div>
      )}

      {tab === "shops" && (
        <div className="space-y-2">
          {shops.map((m) => (
            <article key={m.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-white p-4 shadow-sm">
              <div className="min-w-48 flex-1">
                <p className="font-bold">{m.name} <span className="text-xs text-stone-500">· {m.city} · {m.category}</span></p>
                <p className="text-xs">{m.approved ? (m.open ? "Live" : "Paused by ops") : "Pending approval"}</p>
              </div>
              <Badge tone={m.approved ? "green" : "sand"}>{m.approved ? "Approved" : "Pending"}</Badge>
              <button onClick={() => toggleShop(m.id, { approved: !m.approved })} className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-bold">
                {m.approved ? "Unapprove" : "Approve"}
              </button>
              <button onClick={() => toggleShop(m.id, { open: !m.open })} className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-bold">
                {m.open ? "Close" : "Open"}
              </button>
            </article>
          ))}
        </div>
      )}

      {tab === "promos" && (
        <div className="space-y-3">
          <ul className="space-y-2">
            {promos.map((p) => (
              <li key={p.code} className="flex items-center gap-2 rounded-2xl bg-white p-3 text-sm shadow-sm">
                <strong>{p.code}</strong><span className="text-stone-500">{p.label}</span>
                <span className="ml-auto text-xs">used {p.used}{p.maxUses ? `/${p.maxUses}` : ""}</span>
                <Badge tone={p.active ? "green" : "sand"}>{p.active ? "Active" : "Off"}</Badge>
                <button
                  onClick={() => togglePromo(p.code, !p.active)}
                  className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-bold"
                  aria-label={`Turn ${p.code} ${p.active ? "off" : "on"}`}
                >
                  {p.active ? "Turn off" : "Turn on"}
                </button>
              </li>
            ))}
          </ul>
          <form onSubmit={addPromo} className="grid gap-2 rounded-2xl bg-white p-4 shadow-sm sm:grid-cols-6">
            <input name="code" required placeholder="CODE" className="rounded-lg border border-stone-300 px-2 py-1.5 text-sm uppercase" />
            <input name="label" placeholder="Label" className="rounded-lg border border-stone-300 px-2 py-1.5 text-sm sm:col-span-2" />
            <input name="percent" type="number" min={1} max={90} placeholder="% off" className="rounded-lg border border-stone-300 px-2 py-1.5 text-sm" />
            <input name="amountOff" type="number" min={1} placeholder="KSh off" className="rounded-lg border border-stone-300 px-2 py-1.5 text-sm" />
            <button className="rounded-lg bg-forest-900 px-3 py-1.5 text-sm font-bold text-white">Create</button>
          </form>
        </div>
      )}

      {tab === "leads" && (
        <div className="space-y-2">
          {leads.length === 0 ? <EmptyState title="No leads" hint="Partner enquiries from /partner appear here." /> :
            leads.map((l) => (
              <article key={l.id} className="rounded-2xl bg-white p-4 text-sm shadow-sm">
                <p><Badge tone={l.handled ? "green" : "coral"}>{l.handled ? "Handled" : "New"}</Badge> <strong className="ml-2">{l.businessName}</strong> <span className="text-stone-500">· {l.kind} · {l.city}</span></p>
                <p className="mt-1">{l.contactName} · {l.phone}</p>
                {l.message && <p className="mt-1 text-stone-600">“{l.message}”</p>}
                <button onClick={() => handleLead(l.id, !l.handled)} className="mt-2 rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-bold">
                  {l.handled ? "Reopen" : "Mark handled"}
                </button>
              </article>
            ))}
        </div>
      )}

      {tab === "riders" && (
        <div className="space-y-2">
          {riders.map((r) => {
            const w = workload[r.id];
            const load = w ? w.activeOrders + w.activeParcels : null;
            return (
              <article key={r.id} className="rounded-2xl bg-white p-4 text-sm shadow-sm">
                <div className="flex items-center gap-2">
                  <p className="flex-1">
                    <strong>{r.name}</strong> <span className="text-stone-500">· {r.city}</span>
                    {load != null && (
                      <span className="ml-2 text-xs font-semibold text-stone-600">
                        · {w!.activeOrders} order{w!.activeOrders === 1 ? "" : "s"} + {w!.activeParcels} parcel{w!.activeParcels === 1 ? "" : "s"} active
                      </span>
                    )}
                  </p>
                  {load != null && load >= 5 && <Badge tone="coral">Busy</Badge>}
                  <Badge tone={r.kycStatus === "approved" ? "green" : r.kycStatus === "rejected" ? "red" : "sand"}>
                    KYC {r.kycStatus}
                  </Badge>
                  <Badge tone={r.active ? "green" : "sand"}>{r.active ? "Online" : "Offline"}</Badge>
                  {!r.verified && <Badge tone="red">Unverified</Badge>}
                </div>
                {r.kycNote && <p className="mt-1 text-xs text-stone-500">KYC note: {r.kycNote}</p>}
                {r.kycStatus !== "approved" && (
                  <KycReviewRow id={r.id} status={r.kycStatus} onReview={reviewKyc} />
                )}
              </article>
            );
          })}
        </div>
      )}

      {tab === "audit" && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-semibold">Event type
            <select value={auditKind} onChange={(e) => setAuditKind(e.target.value)} className="rounded-lg border border-stone-300 px-2 py-1.5">
              <option value="">All</option>
              {auditKinds.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
          {audit.length === 0 ? <EmptyState title="No audit events" hint="Money and status changes are recorded here as they happen." /> :
            audit.map((e) => (
              <article key={e.id} className="rounded-2xl bg-white p-3 text-sm shadow-sm">
                <p>
                  <Badge tone="sand">{e.kind}</Badge>
                  <span className="ml-2 text-xs text-stone-500">{new Date(e.at).toLocaleString("en-KE")} · {e.actor}</span>
                </p>
                <p className="mt-1 font-mono text-xs text-stone-600">{JSON.stringify(e.detail)}</p>
              </article>
            ))}
        </div>
      )}

      {tab === "analytics" && (
        <AnalyticsTab
          data={analytics}
          days={anDays}
          setDays={setAnDays}
          city={anCity}
          setCity={setAnCity}
        />
      )}
    </div>
  );
}

const PARCEL_NEXT: Record<string, string[]> = {
  requested: ["confirmed", "cancelled"],
  confirmed: ["assigned", "cancelled"],
  assigned: ["picked_up", "cancelled"],
  picked_up: ["in_transit"],
  in_transit: ["delivered"],
};

function KycReviewRow({ id, status, onReview }: {
  id: string; status: string; onReview: (id: string, status: "approved" | "rejected", note?: string) => void;
}) {
  const [note, setNote] = useState("");
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="text-xs text-stone-500">KYC {status}:</span>
      <button onClick={() => onReview(id, "approved")} className="rounded-lg bg-forest-900 px-3 py-1.5 text-xs font-bold text-white">
        Approve
      </button>
      <input
        value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason (required to reject)"
        className="min-w-44 flex-1 rounded-lg border border-stone-300 px-2 py-1.5 text-xs" aria-label={`Rejection reason`}
      />
      <button onClick={() => onReview(id, "rejected", note)} className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-bold text-red-700">
        Reject
      </button>
    </div>
  );
}

function ParcelRow({ p, riders, onGo }: {
  p: { ref: string; token: string; status: string; quote: number; pickupArea: string; dropoffArea: string; contents: string; recipientName: string; riderId: string | null };
  riders: { id: string; name: string }[];
  onGo: (token: string, to: string, riderId?: string) => void;
}) {
  const [riderId, setRiderId] = useState(p.riderId ?? "");
  return (
    <article className="rounded-2xl bg-white p-4 text-sm shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <strong>{p.ref}</strong>
        <Badge tone={p.status === "cancelled" ? "red" : p.status === "delivered" ? "green" : "coral"}>{p.status}</Badge>
        <span className="ml-auto font-extrabold"><Price value={p.quote} /></span>
      </div>
      <p className="mt-1 text-stone-600">{p.pickupArea} → {p.dropoffArea} · {p.contents} · for {p.recipientName}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {(PARCEL_NEXT[p.status] ?? []).map((to) => (
          <span key={to} className="flex items-center gap-1">
            {to === "assigned" && (
              <select value={riderId} onChange={(e) => setRiderId(e.target.value)} className="rounded-lg border border-stone-300 px-2 py-1.5 text-xs" aria-label={`Rider for ${p.ref}`}>
                <option value="">Rider…</option>
                {riders.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            )}
            <button
              onClick={() => onGo(p.token, to, to === "assigned" ? riderId || undefined : undefined)}
              disabled={to === "assigned" && !riderId}
              className="rounded-lg bg-forest-900 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            >
              {actionLabel(to)}
            </button>
          </span>
        ))}
      </div>
    </article>
  );
}

type AnalyticsData = {
  orders: { revenue: number; count: number; cancelled: number; cancelRate: number; discount: number; aov: number };
  parcels: { revenue: number; count: number };
  series: { day: string; revenue: number; orders: number }[];
  byCity: { city: string; revenue: number; orders: number }[];
  byCategory: { category: string; revenue: number; orders: number }[];
  topShops: { id: string; name: string; revenue: number; orders: number }[];
};

function AnalyticsTab({ data, days, setDays, city, setCity }: {
  data: AnalyticsData | null; days: number; setDays: (d: number) => void;
  city: string; setCity: (c: string) => void;
}) {
  const maxRevenue = Math.max(1, ...(data?.series.map((s) => s.revenue) ?? [1]));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
        <span>Last</span>
        {[7, 30, 90].map((d) => (
          <button key={d} onClick={() => setDays(d)}
            className={`rounded-xl px-3 py-1.5 ${days === d ? "bg-forest-950 text-white" : "bg-white"}`}>
            {d} days
          </button>
        ))}
        <label className="ml-2 flex items-center gap-1.5">City
          <select value={city} onChange={(e) => setCity(e.target.value)} className="rounded-lg border border-stone-300 px-2 py-1.5">
            <option value="">All cities</option>
            <option value="nairobi">Nairobi</option>
            <option value="mombasa">Mombasa</option>
            <option value="kisumu">Kisumu</option>
          </select>
        </label>
      </div>

      {!data ? (
        <p className="text-sm text-stone-500" role="status">Loading analytics…</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              ["Delivered revenue", formatKES(data.orders.revenue)],
              ["Delivered orders", String(data.orders.count)],
              ["Avg order value", formatKES(data.orders.aov)],
              ["Cancel rate", `${data.orders.cancelRate}%`],
              ["Promo discounts", formatKES(data.orders.discount)],
              ["Parcel revenue", formatKES(data.parcels.revenue)],
              ["Parcels delivered", String(data.parcels.count)],
              ["Combined revenue", formatKES(data.orders.revenue + data.parcels.revenue)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="text-xs font-bold uppercase text-stone-500">{k}</p>
                <p className="font-display text-2xl font-black text-forest-950">{v}</p>
              </div>
            ))}
          </div>

          <section className="rounded-2xl bg-white p-5 shadow-sm" aria-label="Daily delivered revenue">
            <h3 className="font-display font-extrabold text-forest-950">Daily delivered revenue</h3>
            {data.series.every((s) => s.revenue === 0) ? (
              <p className="mt-2 text-sm text-stone-500">No delivered orders in this window yet — revenue bars appear as deliveries complete.</p>
            ) : (
              <div className="mt-3 flex h-36 items-end gap-1" role="img" aria-label={`Revenue peaked at ${formatKES(maxRevenue)}`}>
                {data.series.map((s) => (
                  <div key={s.day} className="flex-1" title={`${s.day}: ${formatKES(s.revenue)} (${s.orders} orders)`}>
                    <div className="rounded-t bg-forest-700" style={{ height: `${Math.max(2, Math.round((s.revenue / maxRevenue) * 130))}px` }} />
                  </div>
                ))}
              </div>
            )}
            {data.series.length > 0 && (
              <div className="mt-1 flex justify-between text-[11px] text-stone-500">
                <span>{data.series[0].day}</span>
                <span>{data.series[data.series.length - 1].day}</span>
              </div>
            )}
          </section>

          <div className="grid gap-3 md:grid-cols-3">
            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <h3 className="font-display font-extrabold text-forest-950">By city</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {data.byCity.length === 0 && <li className="text-stone-500">No data yet.</li>}
                {data.byCity.map((c) => (
                  <li key={c.city} className="flex justify-between gap-2">
                    <span className="capitalize">{c.city} <span className="text-stone-400">({c.orders})</span></span>
                    <Price value={c.revenue} className="font-bold" />
                  </li>
                ))}
              </ul>
            </section>
            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <h3 className="font-display font-extrabold text-forest-950">By vertical</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {data.byCategory.length === 0 && <li className="text-stone-500">No data yet.</li>}
                {data.byCategory.map((c) => (
                  <li key={c.category} className="flex justify-between gap-2">
                    <span className="capitalize">{c.category} <span className="text-stone-400">({c.orders})</span></span>
                    <Price value={c.revenue} className="font-bold" />
                  </li>
                ))}
              </ul>
            </section>
            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <h3 className="font-display font-extrabold text-forest-950">Top shops</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {data.topShops.length === 0 && <li className="text-stone-500">No data yet.</li>}
                {data.topShops.map((m) => (
                  <li key={m.id} className="flex justify-between gap-2">
                    <span>{m.name} <span className="text-stone-400">({m.orders})</span></span>
                    <Price value={m.revenue} className="font-bold" />
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
