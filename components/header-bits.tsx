"use client";

import Link from "next/link";
import { useShop } from "@/lib/shop-context";
import { CITIES } from "@/lib/geo";

/** City picker + basket pill + replace-cart confirmation dialog. */
export default function HeaderBits() {
  const { city, setCity, count, confirmReplace, resolveReplace } = useShop();
  return (
    <>
      <div className="flex items-center gap-2">
        <label htmlFor="city" className="sr-only">Choose your city</label>
        <select
          id="city"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="rounded-lg bg-white/10 px-2 py-2 text-sm font-semibold text-cream-50 outline-none"
        >
          {CITIES.map((c) => (
            <option key={c.slug} value={c.slug} className="text-black">{c.name}</option>
          ))}
        </select>
        <Link
          href="/checkout"
          className="relative rounded-xl bg-coral-500 px-3.5 py-2 text-sm font-bold text-white hover:bg-coral-600"
          aria-label={count ? `Basket, ${count} items` : "Basket"}
        >
          Basket{count > 0 && (
            <span className="ml-1.5 rounded-full bg-white px-1.5 text-xs font-black text-coral-600">{count}</span>
          )}
        </Link>
      </div>

      {confirmReplace && (
        <div role="dialog" aria-modal="true" aria-label="Replace basket" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-stone-900 shadow-xl">
            <h2 className="font-display text-lg font-extrabold">Start a new basket?</h2>
            <p className="mt-1 text-sm text-stone-600">
              Your basket has items from another shop. Checkout handles one shop at a time —
              replace it with items from <strong>{confirmReplace.merchantName}</strong>?
            </p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => resolveReplace(false)} className="flex-1 rounded-xl border border-stone-300 px-4 py-2.5 font-bold">
                Keep mine
              </button>
              <button onClick={() => resolveReplace(true)} className="flex-1 rounded-xl bg-coral-500 px-4 py-2.5 font-bold text-white">
                Replace
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
