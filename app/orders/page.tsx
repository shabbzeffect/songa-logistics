"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadLocalOrders } from "@/lib/shop-context";
import { Badge, EmptyState, Price, SectionTitle } from "@/components/ui";
import { orderStatusLabel, type OrderStatus } from "@/lib/status";

type LocalOrder = ReturnType<typeof loadLocalOrders>[number];
interface AccountOrder { ref: string; token: string; total: number; merchant: string; at: string; status: string }
interface Row { ref: string; token: string; total: number; merchant: string; at: string; status?: string }

export default function OrdersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [live, setLive] = useState<Record<string, { status: string; total: number }>>({});

  useEffect(() => {
    const local = loadLocalOrders();
    fetch("/api/me/orders")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          const account = j.data.orders as AccountOrder[];
          const seen = new Set(account.map((o) => o.token));
          setRows([...account, ...local.filter((o) => !seen.has(o.token))]);
          setSignedIn(true);
        } else {
          setRows(local);
        }
      })
      .catch(() => setRows(local));
    // Enrich device-local rows with live status (account rows already carry theirs).
    local.forEach(async (o) => {
      try {
        const r = await fetch(`/api/orders/${o.token}`);
        const j = await r.json();
        if (j.ok) setLive((m) => ({ ...m, [o.token]: { status: j.data.order.status, total: j.data.order.total } }));
      } catch { /* keep local snapshot */ }
    });
  }, []);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <SectionTitle
        title="My orders"
        sub={signedIn ? "Your signed-in history plus orders saved on this device" : "Saved on this device — sign in to see orders from any device"}
      />
      {rows.length === 0 ? (
        <EmptyState title="No orders yet" hint="Your placed orders will appear here with tracking links." action={<Link href="/browse" className="font-bold text-coral-600 hover:underline">Browse shops →</Link>} />
      ) : (
        <>
          {!signedIn && (
            <p className="text-sm">
              <Link href="/login" className="font-bold text-coral-600 hover:underline">Sign in with your phone number →</Link>
              <span className="text-stone-500"> to see orders from all your devices.</span>
            </p>
          )}
          <ul className="space-y-2">
            {rows.map((o) => {
              const status = o.status ?? live[o.token]?.status;
              const total = live[o.token]?.total ?? o.total;
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
                    <Price value={total} className="font-extrabold" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
