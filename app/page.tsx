"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useShop } from "@/lib/shop-context";
import { CATEGORIES, cityName } from "@/lib/geo";
import { Art, Badge, EmptyState, Price, Rating, SectionTitle } from "@/components/ui";

interface Merchant {
  id: string; name: string; description: string; city: string; areas: string;
  category: string; deliveryFee: number; freeOver: number | null; minOrder: number;
  prepMinutes: number; rating: number; ratingsCount: number; open: boolean; imageHint: string;
}

const COLLECTIONS: { title: string; sub: string; match: (m: Merchant) => boolean; href: string }[] = [
  { title: "Quick lunch", sub: "Ready in about 20 minutes", match: (m) => m.category === "food" && m.prepMinutes <= 25, href: "/browse?collection=lunch" },
  { title: "Market run", sub: "Groceries & shopping without the queue", match: (m) => m.category === "grocery", href: "/browse?category=grocery" },
  { title: "Medical courier", sub: "Pharmacy essentials, sealed & rushed", match: (m) => m.category === "medical", href: "/browse?category=medical" },
  { title: "Highly rated", sub: "Neighbourhood favourites", match: (m) => m.rating >= 4.5, href: "/browse?minRating=4.5" },
];

export default function HomePage() {
  const { city } = useShop();
  const [q, setQ] = useState("");
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/merchants?city=${city}`)
      .then((r) => r.json())
      .then((j) => setMerchants(j.ok ? j.data.merchants : []))
      .finally(() => setLoading(false));
  }, [city]);

  const searched = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return null;
    return merchants.filter(
      (m) => m.name.toLowerCase().includes(needle) || m.description.toLowerCase().includes(needle),
    ).slice(0, 6);
  }, [q, merchants]);

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="overflow-hidden rounded-3xl bg-forest-950 text-cream-50">
        <div className="grid gap-6 p-8 sm:grid-cols-2 sm:p-12">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-sun-400">Nairobi · Mombasa · Kisumu</p>
            <h1 className="font-display mt-2 text-4xl font-black leading-tight sm:text-5xl">
              We move <span className="text-coral-500">what matters.</span>
            </h1>
            <p className="mt-3 max-w-md text-cream-100/90">
              Medical courier sealed and rushed, lunch from the kitchen down the road, the market run
              you skipped, and e-commerce parcels at your gate — Songa Logistics delivers across town.
              Pay cash or M-Pesa on delivery.
            </p>
            <form
              className="mt-5 flex max-w-md gap-2"
              onSubmit={(e) => { e.preventDefault(); if (q.trim()) window.location.href = `/browse?q=${encodeURIComponent(q.trim())}&city=${city}`; }}
              role="search"
            >
              <label htmlFor="home-search" className="sr-only">Search shops or dishes</label>
              <input
                id="home-search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Try ‘pilau’, ‘vitamin C’, ‘tilapia’…"
                className="w-full rounded-xl px-4 py-3 text-stone-900"
              />
              <button className="rounded-xl bg-coral-500 px-5 font-bold text-white hover:bg-coral-600" type="submit">
                Search
              </button>
            </form>
            {searched && (
              <ul className="mt-2 max-w-md rounded-xl bg-white p-2 text-stone-900 shadow-lg" aria-label="Quick results">
                {searched.map((m) => (
                  <li key={m.id}>
                    <Link href={`/m/${m.id}`} className="block rounded-lg px-3 py-2 hover:bg-cream-100">
                      <strong>{m.name}</strong> <span className="text-sm text-stone-500">· {m.areas}</span>
                    </Link>
                  </li>
                ))}
                {searched.length === 0 && <li className="px-3 py-2 text-sm">Nothing matches — try ‘fish’ or ‘milk’.</li>}
              </ul>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3" aria-hidden>
            <Art hint="stew" label="" className="h-36 rounded-2xl" />
            <Art hint="care" label="" className="h-36 rounded-2xl" />
            <Art hint="veg" label="" className="h-36 rounded-2xl" />
            <Art hint="gift" label="" className="h-36 rounded-2xl" />
          </div>
        </div>
      </section>

      {/* Categories */}
      <section aria-label="Categories">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {CATEGORIES.filter((c) => c.slug !== "parcel").map((c) => (
            <Link key={c.slug} href={`/browse?category=${c.slug}`} className="card-lift rounded-2xl bg-white p-4 text-center shadow-sm">
              <span className="font-display text-lg font-extrabold text-forest-900">{c.name}</span>
              <span className="mt-0.5 block text-xs text-stone-500">{c.hint}</span>
            </Link>
          ))}
          <Link href="/parcel" className="card-lift rounded-2xl bg-forest-900 p-4 text-center text-cream-50 shadow-sm">
            <span className="font-display text-lg font-extrabold">E-commerce Parcels</span>
            <span className="mt-0.5 block text-xs text-cream-200/80">Shop-to-doorstep delivery</span>
          </Link>
        </div>
      </section>

      {/* Collections */}
      {COLLECTIONS.map((col) => {
        const items = merchants.filter(col.match).slice(0, 4);
        if (!items.length) return null;
        return (
          <section key={col.title} aria-label={col.title}>
            <div className="mb-3 flex items-end justify-between">
              <div>
                <h2 className="font-display text-xl font-extrabold text-forest-950">{col.title}</h2>
                <p className="text-sm text-stone-600">{col.sub} · in {cityName(city)}</p>
              </div>
              <Link href={col.href} className="text-sm font-bold text-coral-600 hover:underline">See all</Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {items.map((m) => <MerchantCard key={m.id} m={m} />)}
            </div>
          </section>
        );
      })}

      {/* Near you */}
      <section aria-label={`Shops in ${cityName(city)}`}>
        <SectionTitle title={`Around ${cityName(city)}`} sub="Neighbourhood shops delivering to you now" />
        {loading ? (
          <p className="text-sm text-stone-500">Loading shops…</p>
        ) : merchants.length === 0 ? (
          <EmptyState title="No shops here yet" hint="We're onboarding shops in this city. Try another city, or partner with us below." action={<Link href="/partner" className="font-bold text-coral-600 hover:underline">Partner with Songa →</Link>} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {merchants.map((m) => <MerchantCard key={m.id} m={m} />)}
          </div>
        )}
      </section>

      {/* Trust strip */}
      <section className="grid gap-3 rounded-3xl bg-white p-6 shadow-sm sm:grid-cols-3" aria-label="How Songa works">
        <div><p className="font-bold text-forest-950">Clear prices, no surprises</p><p className="text-sm text-stone-600">Itemised totals at checkout. Delivery fee shown upfront.</p></div>
        <div><p className="font-bold text-forest-950">Medical runs handled with care</p><p className="text-sm text-stone-600">Sealed, tamper-evident pharmacy courier with pharmacist verification.</p></div>
        <div><p className="font-bold text-forest-950">Real status updates</p><p className="text-sm text-stone-600">Track placed → delivered with a link. No fake rider maps.</p></div>
      </section>
    </div>
  );
}

export function MerchantCard({ m }: { m: Merchant }) {
  const { toggleFavorite, isFavorite } = useShop();
  const fav = isFavorite(m.id);
  return (
    <div className="card-lift relative overflow-hidden rounded-2xl bg-white shadow-sm">
      <Link href={`/m/${m.id}`} aria-label={`${m.name}, ${m.open ? "open" : "closed"}`}>
        <Art hint={m.imageHint} label={`${m.name} cover`} className="h-28" />
      </Link>
      <button
        type="button"
        onClick={() => toggleFavorite(m.id)}
        aria-pressed={fav}
        aria-label={fav ? `Remove ${m.name} from favorites` : `Save ${m.name} to favorites`}
        title={fav ? "Saved" : "Save"}
        className={`absolute right-2 top-2 rounded-full px-2.5 py-1 text-sm font-black shadow ${fav ? "bg-coral-500 text-white" : "bg-white/90 text-stone-500"}`}
      >
        {fav ? "♥" : "♡"}
      </button>
      <Link href={`/m/${m.id}`} className="block p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display font-extrabold text-forest-950">{m.name}</h3>
          {m.open ? <Badge>Open</Badge> : <Badge tone="sand">Closed</Badge>}
        </div>
        <p className="mt-0.5 line-clamp-2 text-sm text-stone-600">{m.description}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <Rating value={m.rating} count={m.ratingsCount} />
          <span className="text-stone-500">·</span>
          <Price value={m.deliveryFee} className="font-semibold" />
          <span className="text-stone-500">delivery</span>
          <span className="text-stone-500">·</span>
          <span className="text-stone-600">~{m.prepMinutes + 20} min</span>
        </div>
        {m.freeOver != null && (
          <p className="mt-1 text-xs font-semibold text-forest-700">Free delivery over <Price value={m.freeOver} /></p>
        )}
      </Link>
    </div>
  );
}
