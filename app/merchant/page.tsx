"use client";

import { useCallback, useEffect, useState } from "react";
import { api, Gate, OrderCard, PageHead, type StaffOrder } from "@/components/staff";
import { EmptyState, Price } from "@/components/ui";

interface Product {
  id: string; name: string; price: number; stock: number; trackInventory: boolean;
  available: boolean; section: string;
}

export default function MerchantPage() {
  return (
    <Gate roles={["merchant", "ops"]}>
      <Console />
    </Gate>
  );
}

function Console() {
  const [tab, setTab] = useState<"orders" | "menu" | "shop" | "reviews">("orders");
  const [orders, setOrders] = useState<StaffOrder[]>([]);
  const [filter, setFilter] = useState("");
  const [shop, setShop] = useState<{ id: string; name: string; open: boolean; deliveryFee: number; freeOver: number | null; minOrder: number; prepMinutes: number } | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<{ id: string; rating: number; comment: string; reply: string; at: string }[]>([]);
  const [msg, setMsg] = useState("");

  const loadReviews = useCallback(async () => {
    const j = await api<{ reviews: typeof reviews }>("/api/staff/reviews");
    if (j.ok && j.data) setReviews(j.data.reviews);
  }, []);

  const loadOrders = useCallback(async () => {
    const j = await api<{ orders: StaffOrder[] }>(`/api/staff/orders${filter ? `?status=${filter}` : ""}`);
    if (j.ok && j.data) setOrders(j.data.orders);
  }, [filter]);

  const loadShop = useCallback(async () => {
    const me = await api<{ session: { actorId?: string } }>("/api/auth");
    const actorId = me.ok ? me.data?.session.actorId : undefined;
    const all = await api<{ merchants: typeof shop[] }>("/api/staff/merchants");
    const mine = (all.ok ? all.data?.merchants ?? [] : []).find((m) => !actorId || m!.id === actorId) ?? null;
    setShop(mine);
    if (mine?.id) {
      const det = await api<{ products: Product[] }>(`/api/merchants/${mine.id}`);
      if (det.ok && det.data) setProducts(det.data.products);
    }
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);
  useEffect(() => { loadShop(); }, [loadShop]);
  useEffect(() => { if (tab === "reviews") loadReviews(); }, [tab, loadReviews]);

  async function sendReply(id: string, reply: string) {
    const j = await api(`/api/staff/reviews/${id}`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ reply }),
    });
    setMsg(j.ok ? "Reply posted — customers see it on your shop page." : (j.error ?? "Couldn't post."));
    loadReviews();
  }

  async function patchProduct(id: string, body: object) {
    const j = await api(`/api/staff/products/${id}`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    });
    setMsg(j.ok ? "Saved." : (j.error ?? "Couldn't save."));
    loadShop();
  }

  async function patchShop(body: object) {
    if (!shop) return;
    const j = await api(`/api/staff/merchants/${shop.id}`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    });
    setMsg(j.ok ? "Shop updated." : (j.error ?? "Couldn't save."));
    loadShop();
  }

  async function addProduct(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!shop) return;
    const fd = new FormData(e.currentTarget);
    const j = await api("/api/staff/products", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        merchantId: shop.id,
        name: String(fd.get("name")), price: Number(fd.get("price")),
        stock: Number(fd.get("stock")), section: String(fd.get("section") || "Main"),
        description: String(fd.get("description") || ""),
      }),
    });
    setMsg(j.ok ? "Item added." : (j.error ?? "Couldn't add."));
    e.currentTarget.reset();
    loadShop();
  }

  return (
    <div className="space-y-5">
      <PageHead title="Merchant console" sub={shop ? shop.name : "Your shop workspace"} />
      <div className="flex gap-2" role="tablist" aria-label="Merchant sections">
        {(["orders", "menu", "shop", "reviews"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`rounded-xl px-4 py-2 text-sm font-bold capitalize ${tab === t ? "bg-forest-900 text-white" : "bg-white"}`}>
            {t}
          </button>
        ))}
      </div>
      {msg && <p className="text-sm font-semibold" role="status">{msg}</p>}

      {tab === "orders" && (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-semibold">
            Filter:
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-lg border border-stone-300 px-2 py-1.5">
              <option value="">All active + history</option>
              <option value="placed">Placed</option>
              <option value="accepted">Accepted</option>
              <option value="preparing">Preparing</option>
              <option value="ready">Ready</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          {orders.length === 0 ? <EmptyState title="No orders here" hint="New orders will pop up in this queue. Prep-time updates keep customers calm." /> :
            orders.map((o) => <OrderCard key={o.id} o={o} onDone={loadOrders} showCustomer />)}
        </div>
      )}

      {tab === "menu" && (
        <div className="space-y-3">
          {products.map((p) => (
            <article key={p.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-white p-4 shadow-sm">
              <div className="min-w-40 flex-1">
                <p className="font-bold">{p.name} <span className="text-xs text-stone-500">· {p.section}</span></p>
                <p className="text-sm"><Price value={p.price} className="font-bold" /> · stock {p.stock} · {p.available ? "live" : "paused"}</p>
              </div>
              <button onClick={() => patchProduct(p.id, { available: !p.available })} className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-bold">
                {p.available ? "Pause" : "Unpause"}
              </button>
              <label className="flex items-center gap-1 text-xs">KSh
                <input type="number" defaultValue={p.price} min={1} id={`pr-${p.id}`} className="w-24 rounded-lg border border-stone-300 px-2 py-1.5" />
              </label>
              <button onClick={() => patchProduct(p.id, { price: Number((document.getElementById(`pr-${p.id}`) as HTMLInputElement).value) })} className="rounded-lg bg-forest-900 px-3 py-1.5 text-xs font-bold text-white">Set price</button>
              <label className="flex items-center gap-1 text-xs">Stock
                <input type="number" defaultValue={p.stock} min={0} id={`st-${p.id}`} className="w-20 rounded-lg border border-stone-300 px-2 py-1.5" />
              </label>
              <button onClick={() => patchProduct(p.id, { stock: Number((document.getElementById(`st-${p.id}`) as HTMLInputElement).value) })} className="rounded-lg bg-forest-900 px-3 py-1.5 text-xs font-bold text-white">Set stock</button>
            </article>
          ))}
          <form onSubmit={addProduct} className="grid gap-2 rounded-2xl bg-white p-4 shadow-sm sm:grid-cols-5">
            <input name="name" required placeholder="New item name" className="rounded-lg border border-stone-300 px-2 py-1.5 text-sm" />
            <input name="price" required type="number" min={1} placeholder="Price KSh" className="rounded-lg border border-stone-300 px-2 py-1.5 text-sm" />
            <input name="stock" type="number" min={0} defaultValue={20} placeholder="Stock" className="rounded-lg border border-stone-300 px-2 py-1.5 text-sm" />
            <input name="section" placeholder="Section" className="rounded-lg border border-stone-300 px-2 py-1.5 text-sm" />
            <button className="rounded-lg bg-coral-500 px-3 py-1.5 text-sm font-bold text-white">Add item</button>
          </form>
        </div>
      )}

      {tab === "shop" && shop && (
        <div className="max-w-xl space-y-3 rounded-2xl bg-white p-5 shadow-sm">
          <label className="flex cursor-pointer items-center justify-between font-bold">
            Open for orders
            <input type="checkbox" checked={shop.open} onChange={(e) => patchShop({ open: e.target.checked })} className="h-5 w-10 accent-green-800" />
          </label>
          <label className="block text-sm font-semibold">Delivery fee (KSh)
            <input type="number" defaultValue={shop.deliveryFee} min={0} id="m-fee" className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2" />
          </label>
          <label className="block text-sm font-semibold">Prep time (minutes)
            <input type="number" defaultValue={shop.prepMinutes} min={5} max={180} id="m-prep" className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2" />
          </label>
          <label className="block text-sm font-semibold">Minimum order (KSh)
            <input type="number" defaultValue={shop.minOrder} min={0} id="m-min" className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2" />
          </label>
          <button
            onClick={() => patchShop({
              deliveryFee: Number((document.getElementById("m-fee") as HTMLInputElement).value),
              prepMinutes: Number((document.getElementById("m-prep") as HTMLInputElement).value),
              minOrder: Number((document.getElementById("m-min") as HTMLInputElement).value),
            })}
            className="rounded-xl bg-forest-900 px-5 py-2.5 font-bold text-white">
            Save shop settings
          </button>
        </div>
      )}

      {tab === "reviews" && (
        <div className="space-y-2">
          {reviews.length === 0 ? (
            <EmptyState title="No reviews yet" hint="Customer ratings for delivered orders land here — reply to keep the conversation warm." />
          ) : reviews.map((r) => (
            <ReplyRow key={r.id} r={r} onReply={sendReply} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReplyRow({ r, onReply }: {
  r: { id: string; rating: number; comment: string; reply: string; at: string };
  onReply: (id: string, reply: string) => void;
}) {
  const [text, setText] = useState(r.reply);
  return (
    <article className="rounded-2xl bg-white p-4 text-sm shadow-sm">
      <p aria-label={`Rated ${r.rating} out of 5`}>
        <span aria-hidden className="text-sun-400">{"★".repeat(r.rating)}</span>
        <span aria-hidden className="text-stone-300">{"★".repeat(5 - r.rating)}</span>
        <span className="ml-2 text-xs text-stone-500">{new Date(r.at).toLocaleDateString("en-KE")}</span>
      </p>
      {r.comment && <p className="mt-1 text-stone-700">“{r.comment}”</p>}
      <label className="mt-2 block">
        <span className="mb-1 block text-xs font-bold uppercase text-stone-500">Your reply</span>
        <textarea
          value={text} onChange={(e) => setText(e.target.value)} maxLength={500} rows={2}
          placeholder="Asante for the feedback — …"
          className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
        />
      </label>
      <button
        onClick={() => text.trim() && onReply(r.id, text.trim())}
        className="mt-2 rounded-xl bg-forest-900 px-4 py-2 text-sm font-bold text-white"
      >
        {r.reply ? "Update reply" : "Post reply"}
      </button>
    </article>
  );
}
