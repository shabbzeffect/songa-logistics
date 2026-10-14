"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useShop } from "@/lib/shop-context";
import { CATEGORIES, cityName } from "@/lib/geo";
import { EmptyState, SectionTitle } from "@/components/ui";
import { MerchantCard } from "@/app/page";

function BrowseInner() {
  const params = useSearchParams();
  const { city, setCity, favorites } = useShop();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [category, setCategory] = useState(params.get("category") ?? "");
  const [maxFee, setMaxFee] = useState("");
  const [minRating, setMinRating] = useState("");
  const [openOnly, setOpenOnly] = useState(false);
  const [favOnly, setFavOnly] = useState(false);
  const [sort, setSort] = useState("relevance");
  const [results, setResults] = useState<Parameters<typeof MerchantCard>[0]["m"][]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setQ(params.get("q") ?? "");
    const col = params.get("collection");
    if (col === "lunch") setCategory("food");
    if (params.get("category")) setCategory(params.get("category")!);
    if (params.get("minRating")) setMinRating(params.get("minRating")!);
  }, [params]);

  useEffect(() => {
    setLoading(true);
    const sp = new URLSearchParams({ city });
    if (q.trim()) sp.set("q", q.trim());
    if (category) sp.set("category", category);
    if (maxFee) sp.set("maxFee", maxFee);
    if (minRating) sp.set("minRating", minRating);
    if (openOnly) sp.set("open", "1");
    if (sort) sp.set("sort", sort);
    const col = params.get("collection");
    fetch(`/api/merchants?${sp}`)
      .then((r) => r.json())
      .then((j) => {
        let list = (j.ok ? j.data.merchants : []) as typeof results;
        if (col === "lunch") list = list.filter((m) => m.prepMinutes <= 25);
        setResults(list);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, category, maxFee, minRating, openOnly, sort, params]);

  const visible = favOnly ? results.filter((m) => favorites.includes(m.id)) : results;

  return (
    <div className="space-y-6">
      <SectionTitle title={`Browse ${cityName(city)}`} sub="Search and filters change these results in real time" />
      <form
        className="grid gap-3 rounded-2xl bg-white p-4 shadow-sm sm:grid-cols-6"
        onSubmit={(e) => e.preventDefault()}
        aria-label="Search and filter shops"
      >
        <label className="sm:col-span-2">
          <span className="mb-1 block text-xs font-bold uppercase text-stone-500">Search</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Dish, shop, area…" className="w-full rounded-xl border border-stone-300 px-3 py-2" />
        </label>
        <label>
          <span className="mb-1 block text-xs font-bold uppercase text-stone-500">City</span>
          <select value={city} onChange={(e) => setCity(e.target.value)} className="w-full rounded-xl border border-stone-300 px-3 py-2">
            <option value="nairobi">Nairobi</option>
            <option value="mombasa">Mombasa</option>
            <option value="kisumu">Kisumu</option>
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs font-bold uppercase text-stone-500">Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-xl border border-stone-300 px-3 py-2">
            <option value="">All</option>
            {CATEGORIES.filter((c) => c.slug !== "parcel").map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs font-bold uppercase text-stone-500">Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="w-full rounded-xl border border-stone-300 px-3 py-2">
            <option value="relevance">Relevance</option>
            <option value="fee">Lowest delivery fee</option>
            <option value="rating">Top rated</option>
          </select>
        </label>
        <div className="flex items-end gap-3">
          <label className="flex items-center gap-1.5 text-sm font-semibold">
            <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} className="h-4 w-4" /> Open now
          </label>
          <label className="flex items-center gap-1.5 text-sm font-semibold">
            <input type="checkbox" checked={favOnly} onChange={(e) => setFavOnly(e.target.checked)} className="h-4 w-4" /> ♥ Saved
          </label>
        </div>
        <label>
          <span className="mb-1 block text-xs font-bold uppercase text-stone-500">Max fee (KSh)</span>
          <input value={maxFee} onChange={(e) => setMaxFee(e.target.value.replace(/\D/g, ""))} placeholder="e.g. 120" inputMode="numeric" className="w-full rounded-xl border border-stone-300 px-3 py-2" />
        </label>
        <label>
          <span className="mb-1 block text-xs font-bold uppercase text-stone-500">Min rating</span>
          <select value={minRating} onChange={(e) => setMinRating(e.target.value)} className="w-full rounded-xl border border-stone-300 px-3 py-2">
            <option value="">Any</option>
            <option value="4">4.0+</option>
            <option value="4.5">4.5+</option>
          </select>
        </label>
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => { setQ(""); setCategory(""); setMaxFee(""); setMinRating(""); setOpenOnly(false); setFavOnly(false); setSort("relevance"); }}
            className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-bold"
          >
            Clear
          </button>
        </div>
      </form>

      {loading ? (
        <p className="text-sm text-stone-500" role="status">Searching shops…</p>
      ) : visible.length === 0 ? (
        <EmptyState
          title={favOnly ? "No saved shops match" : "Nothing matches those filters"}
          hint={favOnly ? "Tap the ♡ on any shop to save it here, or clear the Saved filter." : "Try widening the delivery fee, clearing the search, or switching city — new shops join every week."}
          action={<Link href="/partner" className="font-bold text-coral-600 hover:underline">Know a shop? Invite them →</Link>}
        />
      ) : (
        <>
          <p className="text-sm text-stone-600" role="status">{visible.length} shop{visible.length === 1 ? "" : "s"} found{favOnly ? " · showing saved only" : ""}</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((m) => <MerchantCard key={m.id} m={m} />)}
          </div>
        </>
      )}
    </div>
  );
}

export default function BrowsePage() {
  return (
    <Suspense fallback={<p className="text-sm text-stone-500">Loading…</p>}>
      <BrowseInner />
    </Suspense>
  );
}
