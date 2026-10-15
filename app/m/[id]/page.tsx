"use client";

import { Suspense, use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useShop } from "@/lib/shop-context";
import { Art } from "@/components/art";
import { Badge, EmptyState, Price, Rating } from "@/components/ui";
import { formatKES } from "@/lib/money";

interface Modifier {
  id: string; name: string; required: boolean; multi: boolean;
  options: { id: string; name: string; priceDelta: number }[];
}
interface Product {
  id: string; name: string; description: string; price: number; section: string;
  dietary: string; allergens: string; stock: number; trackInventory: boolean;
  available: boolean; paused: boolean; imageHint: string; modifiers: Modifier[];
}
interface Merchant {
  id: string; name: string; description: string; city: string; areas: string;
  category: string; deliveryFee: number; freeOver: number | null; minOrder: number;
  prepMinutes: number; rating: number; ratingsCount: number; open: boolean; imageHint: string;
}

export default function StorefrontPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="text-sm text-stone-500" role="status">Opening shop…</p>}>
      <StorefrontInner params={params} />
    </Suspense>
  );
}

function StorefrontInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { addLine } = useShop();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [diet, setDiet] = useState("");
  const [active, setActive] = useState<Product | null>(null);
  const [added, setAdded] = useState("");

  useEffect(() => {
    fetch(`/api/merchants/${id}`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) setNotFound(true);
        else { setMerchant(j.data.merchant); setProducts(j.data.products); }
      })
      .finally(() => setLoading(false));
  }, [id]);

  const sections = useMemo(() => {
    const map = new Map<string, Product[]>();
    const needle = diet.trim().toLowerCase();
    for (const p of products) {
      if (needle && !`${p.dietary} ${p.name} ${p.description}`.toLowerCase().includes(needle)) continue;
      const arr = map.get(p.section) ?? [];
      arr.push(p);
      map.set(p.section, arr);
    }
    return [...map.entries()];
  }, [products, diet]);

  if (loading) return <p className="text-sm text-stone-500" role="status">Opening shop…</p>;
  if (notFound || !merchant) return <EmptyState title="Shop not found" hint="It may have moved or closed. Browse other neighbourhood shops." action={<Link href="/browse" className="font-bold text-coral-600 hover:underline">Back to browse →</Link>} />;

  return (
    <div className="space-y-6">
      <Link href="/browse" className="text-sm font-bold text-forest-700 hover:underline">← All shops</Link>
      <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
        <Art hint={merchant.imageHint} label={`${merchant.name} cover`} className="h-44" />
        <div className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl font-black text-forest-950">{merchant.name}</h1>
              <p className="mt-1 max-w-2xl text-stone-600">{merchant.description}</p>
              <p className="mt-2 text-sm text-stone-500">Serves: {merchant.areas} · {merchant.city}</p>
            </div>
            {merchant.open ? <Badge>Open now</Badge> : <Badge tone="sand">Closed</Badge>}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-stone-100 pt-4 text-sm">
            <Rating value={merchant.rating} count={merchant.ratingsCount} />
            <span><Price value={merchant.deliveryFee} className="font-bold" /> delivery</span>
            {merchant.freeOver != null && <span className="font-semibold text-forest-700">Free over <Price value={merchant.freeOver} /></span>}
            {merchant.minOrder > 0 && <span>Min order <Price value={merchant.minOrder} /></span>}
            <span className="text-stone-600">~{merchant.prepMinutes + 20} min (estimate, not guaranteed)</span>
          </div>
        </div>
      </section>

      <div className="flex items-center gap-2">
        <label htmlFor="diet" className="text-sm font-bold">Dietary:</label>
        <input id="diet" value={diet} onChange={(e) => setDiet(e.target.value)} placeholder="e.g. vegetarian, vegan, halal" className="w-full max-w-xs rounded-xl border border-stone-300 px-3 py-2 text-sm" />
      </div>

      {added && <p className="rounded-xl bg-forest-100 px-4 py-2 text-sm font-semibold text-forest-900" role="status">{added}</p>}

      {sections.length === 0 ? (
        <EmptyState title="No dishes match" hint="Clear the dietary filter to see the full menu." />
      ) : sections.map(([section, items]) => (
        <section key={section} aria-label={section}>
          <h2 className="font-display mb-3 text-lg font-extrabold text-forest-950">{section}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((p) => (
              <article key={p.id} className="flex gap-3 rounded-2xl bg-white p-3 shadow-sm">
                <Art hint={p.imageHint} label={p.name} className="h-20 w-20 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-forest-950">{p.name}</h3>
                  <p className="line-clamp-2 text-sm text-stone-600">{p.description}</p>
                  <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                    {p.dietary && <span className="rounded-full bg-forest-100 px-2 py-0.5 font-semibold text-forest-800">{p.dietary}</span>}
                    {p.allergens && <span className="rounded-full bg-cream-200 px-2 py-0.5 font-semibold text-stone-700">Contains: {p.allergens}</span>}
                    {p.trackInventory && p.stock <= 5 && p.available && <span className="rounded-full bg-coral-100 px-2 py-0.5 font-semibold text-coral-600">Only {p.stock} left</span>}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <Price value={p.price} className="font-extrabold text-forest-950" />
                    {!p.available ? (
                      <span className="text-sm font-semibold text-stone-400">{p.paused ? "Paused" : "Out of stock"}</span>
                    ) : !merchant.open ? (
                      <span className="text-sm font-semibold text-stone-400">Shop closed</span>
                    ) : (
                      <button
                        onClick={() => (p.modifiers.length ? setActive(p) : doAdd(p, {}, []))}
                        className="rounded-xl bg-forest-900 px-4 py-1.5 text-sm font-bold text-white hover:bg-forest-800"
                      >
                        {p.modifiers.length ? "Choose" : "Add"}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}

      {active && (
        <ModifierDialog
          product={active}
          onClose={() => setActive(null)}
          onAdd={(sel, labels, note) => {
            doAdd(active, sel, labels, note);
            setActive(null);
          }}
        />
      )}

      <ShopReviews id={id} />
    </div>
  );

  function doAdd(p: Product, sel: Record<string, string>, labels: { group: string; option: string; delta: number }[], note = "") {
    const delta = labels.reduce((t, l) => t + l.delta, 0);
    addLine(merchant!.id, merchant!.name, {
      productId: p.id, name: p.name, price: p.price, qty: 1,
      selections: sel, selectionLabels: labels, delta, note,
    });
    setAdded(`${p.name} added to basket`);
    setTimeout(() => setAdded(""), 2500);
  }
}

function ModifierDialog({
  product, onClose, onAdd,
}: {
  product: Product;
  onClose: () => void;
  onAdd: (sel: Record<string, string>, labels: { group: string; option: string; delta: number }[], note: string) => void;
}) {
  const [sel, setSel] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const delta = product.modifiers.reduce((t, g) => {
    const o = g.options.find((x) => x.id === sel[g.id]);
    return t + (o?.priceDelta ?? 0);
  }, 0);

  return (
    <div role="dialog" aria-modal="true" aria-label={`Choose options for ${product.name}`} className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6">
        <h2 className="font-display text-xl font-extrabold text-forest-950">{product.name}</h2>
        <p className="text-sm text-stone-600">{product.description}</p>
        {product.modifiers.map((g) => (
          <fieldset key={g.id} className="mt-4">
            <legend className="text-sm font-bold">
              {g.name} {g.required ? <span className="text-coral-600">· required</span> : <span className="font-normal text-stone-500">· optional</span>}
            </legend>
            <div className="mt-1 space-y-1">
              {g.options.map((o) => (
                <label key={o.id} className="flex cursor-pointer items-center gap-2 rounded-xl border border-stone-200 px-3 py-2 text-sm hover:border-forest-700">
                  <input
                    type="radio"
                    name={g.id}
                    checked={sel[g.id] === o.id}
                    onChange={() => setSel((s) => ({ ...s, [g.id]: o.id }))}
                    className="h-4 w-4"
                  />
                  <span className="flex-1">{o.name}</span>
                  {o.priceDelta > 0 && <span className="font-semibold">+{formatKES(o.priceDelta)}</span>}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-bold">Note for the kitchen (optional)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="e.g. no coriander" className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" />
        </label>
        {error && <p className="mt-2 text-sm font-semibold text-red-700" role="alert">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-stone-300 px-4 py-2.5 font-bold">Cancel</button>
          <button
            onClick={() => {
              const missing = product.modifiers.find((g) => g.required && !sel[g.id]);
              if (missing) { setError(`Please choose: ${missing.name}`); return; }
              const labels = product.modifiers.flatMap((g) => {
                const o = g.options.find((x) => x.id === sel[g.id]);
                return o ? [{ group: g.name, option: o.name, delta: o.priceDelta }] : [];
              });
              onAdd(sel, labels, note);
            }}
            className="flex-1 rounded-xl bg-coral-500 px-4 py-2.5 font-bold text-white"
          >
            Add · {formatKES(product.price + delta)}
          </button>
        </div>
      </div>
    </div>
  );
}

function ShopReviews({ id }: { id: string }) {
  const [reviews, setReviews] = useState<{ rating: number; comment: string; reply: string; at: string }[]>([]);
  useEffect(() => {
    fetch(`/api/merchants/${id}/reviews`)
      .then((r) => r.json())
      .then((j) => { if (j.ok) setReviews(j.data.reviews); })
      .catch(() => {});
  }, [id]);
  if (!reviews.length) return null;
  return (
    <section aria-label="Customer reviews">
      <h2 className="font-display mb-3 text-lg font-extrabold text-forest-950">
        What neighbours say ({reviews.length})
      </h2>
      <ul className="space-y-2">
        {reviews.map((r, i) => (
          <li key={i} className="rounded-2xl bg-white p-4 text-sm shadow-sm">
            <p aria-label={`Rated ${r.rating} out of 5`}>
              <span aria-hidden className="text-sun-400">{"★".repeat(r.rating)}</span>
              <span aria-hidden className="text-stone-300">{"★".repeat(5 - r.rating)}</span>
              <span className="ml-2 text-xs text-stone-500">{new Date(r.at).toLocaleDateString("en-KE")}</span>
            </p>
            {r.comment && <p className="mt-1 text-stone-700">“{r.comment}”</p>}
            {r.reply && (
              <p className="mt-2 rounded-xl bg-cream-100 px-3 py-2 text-stone-700">
                <span className="font-bold">Shop reply: </span>“{r.reply}”
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
