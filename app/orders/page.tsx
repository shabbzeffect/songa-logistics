"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadLocalOrders } from "@/lib/shop-context";
import { Badge, EmptyState, Price, SectionTitle } from "@/components/ui";
import { orderStatusLabel, type OrderStatus } from "@/lib/status";

type LocalOrder = ReturnType<typeof loadLocalOrders>[number];

export default function OrdersPage() {
  const [orders, setOrders] = useState<LocalOrder[]>([]);
  const [live, setLive] = useState<Record<string, { status: string; total: number }>>({});

  useEffect(() => {
    const list = loadLocalOrders();
    setOrders(list);
    // Enrich each saved order with its live status (best-effort; device-local refs stay usable offline).
    list.forEach(async (o) => {
      try {
        const r = await fetch(`/api/orders/${o.token}`);
        const j = await r.json();
        if (j.ok) setLive((m) => ({ ...m, [o.token]: { status: j.data.order.status, total: j.data.order.total } }));
      } catch { /* keep local snapshot */ }
    });
  }, []);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <SectionTitle title="My orders" sub="Saved on this device — tap any order for live tracking" />
      {orders.length === 0 ? (
        <EmptyState title="No orders yet" hint="Your placed orders will appear here with tracking links." action={<Link href="/browse" className="font-bold text-coral-600 hover:underline">Browse shops →</Link>} />
      ) : (
        <ul className="space-y-2">
          {orders.map((o) => {
            const status = live[o.token]?.status;
            return (
              <li key={o.token}>
                <Link href={`/track/${o.token}`} className="card-lift flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm">
                  <span>
                    <span className="flex items-center gap-2">
                      <span className="font-black text-forest-950">{o.ref}</span>
                      {status && (
                        <Badge tone={status === "cancelled" ? "red" : status === "delivered" ? "green" : "coral"}>
                          {orderStatusLabel(status as OrderStatus)}
                        </Badge>
                      )}
                    </span>
                    <span className="block text-sm text-stone-500">{o.merchant} · {new Date(o.at).toLocaleDateString("en-KE")}</span>
                  </span>
                  <Price value={live[o.token]?.total ?? o.total} className="font-extrabold" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
