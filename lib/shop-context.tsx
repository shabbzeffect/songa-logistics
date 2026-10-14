"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface BasketLine {
  key: string;
  productId: string;
  name: string;
  price: number;
  qty: number;
  selections: Record<string, string>;
  selectionLabels: { group: string; option: string; delta: number }[];
  delta: number;
  note: string;
}

interface BasketState {
  merchantId: string | null;
  merchantName: string | null;
  lines: BasketLine[];
}

interface ShopCtx {
  city: string;
  setCity: (c: string) => void;
  basket: BasketState;
  addLine: (merchantId: string, merchantName: string, line: Omit<BasketLine, "key">) => { replaced: boolean };
  setQty: (key: string, qty: number) => void;
  clearBasket: () => void;
  setMerchant: (id: string | null, name: string | null) => void;
  count: number;
  subtotal: number;
  confirmReplace: { merchantName: string; merchantId: string; pending: Omit<BasketLine, "key"> } | null;
  resolveReplace: (ok: boolean) => void;
  favorites: string[];
  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
}

const Ctx = createContext<ShopCtx | null>(null);
const BASKET_KEY = "songa_basket_v1";
const CITY_KEY = "songa_city";
const FAV_KEY = "songa_favorites_v1";

function loadFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) return list.filter((x) => typeof x === "string").slice(0, 100);
    }
  } catch { /* ignore */ }
  return [];
}

function loadBasket(): BasketState {
  try {
    const raw = localStorage.getItem(BASKET_KEY);
    if (raw) return JSON.parse(raw) as BasketState;
  } catch { /* ignore */ }
  return { merchantId: null, merchantName: null, lines: [] };
}

export function ShopProvider({ children }: { children: ReactNode }) {
  const [city, setCityState] = useState("nairobi");
  const [basket, setBasket] = useState<BasketState>({ merchantId: null, merchantName: null, lines: [] });
  const [confirmReplace, setConfirmReplace] = useState<ShopCtx["confirmReplace"]>(null);
  const [ready, setReady] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    try {
      const c = localStorage.getItem(CITY_KEY);
      if (c) setCityState(c);
      setBasket(loadBasket());
      setFavorites(loadFavorites());
    } catch { /* ignore */ }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) {
      try { localStorage.setItem(FAV_KEY, JSON.stringify(favorites)); } catch { /* ignore */ }
    }
  }, [favorites, ready]);

  useEffect(() => {
    if (ready) {
      try { localStorage.setItem(BASKET_KEY, JSON.stringify(basket)); } catch { /* ignore */ }
    }
  }, [basket, ready]);

  const setCity = useCallback((c: string) => {
    setCityState(c);
    try { localStorage.setItem(CITY_KEY, c); } catch { /* ignore */ }
  }, []);

  const pushLine = useCallback((merchantId: string, merchantName: string, line: Omit<BasketLine, "key">) => {
    const key = `${line.productId}::${Object.entries(line.selections).sort().map(([k, v]) => `${k}=${v}`).join(",")}`;
    setBasket((b) => {
      const ix = b.lines.findIndex((l) => l.key === key);
      if (ix >= 0) {
        const lines = b.lines.slice();
        lines[ix] = { ...lines[ix], qty: Math.min(20, lines[ix].qty + line.qty) };
        return { ...b, lines };
      }
      return { merchantId, merchantName, lines: [...b.lines, { ...line, key }] };
    });
  }, []);

  const addLine = useCallback(
    (merchantId: string, merchantName: string, line: Omit<BasketLine, "key">) => {
      if (basket.merchantId && basket.merchantId !== merchantId && basket.lines.length > 0) {
        setConfirmReplace({ merchantName, merchantId, pending: line });
        return { replaced: false };
      }
      pushLine(merchantId, merchantName, line);
      return { replaced: true };
    },
    [basket, pushLine],
  );

  const resolveReplace = useCallback(
    (ok: boolean) => {
      if (ok && confirmReplace) {
        setBasket({ merchantId: null, merchantName: null, lines: [] });
        // push after reset
        const { merchantId, merchantName, pending } = confirmReplace;
        const key = `${pending.productId}::${Object.entries(pending.selections).sort().map(([k, v]) => `${k}=${v}`).join(",")}`;
        setBasket({ merchantId, merchantName, lines: [{ ...pending, key }] });
      }
      setConfirmReplace(null);
    },
    [confirmReplace],
  );

  const setQty = useCallback((key: string, qty: number) => {
    setBasket((b) => {
      if (qty <= 0) return { ...b, lines: b.lines.filter((l) => l.key !== key) };
      return { ...b, lines: b.lines.map((l) => (l.key === key ? { ...l, qty: Math.min(20, qty) } : l)) };
    });
  }, []);

  const clearBasket = useCallback(() => setBasket({ merchantId: null, merchantName: null, lines: [] }), []);
  const toggleFavorite = useCallback((id: string) => {
    setFavorites((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id].slice(0, 100)));
  }, []);
  const isFavorite = useCallback((id: string) => favorites.includes(id), [favorites]);
  const setMerchant = useCallback((id: string | null, name: string | null) => {
    setBasket((b) => ({ ...b, merchantId: id, merchantName: name }));
  }, []);

  const { count, subtotal } = useMemo(() => ({
    count: basket.lines.reduce((t, l) => t + l.qty, 0),
    subtotal: basket.lines.reduce((t, l) => t + (l.price + l.delta) * l.qty, 0),
  }), [basket]);

  const value: ShopCtx = { city, setCity, basket, addLine, setQty, clearBasket, setMerchant, count, subtotal, confirmReplace, resolveReplace, favorites, toggleFavorite, isFavorite };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useShop(): ShopCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useShop outside provider");
  return c;
}

/** Device-local order refs (until account sign-in exists). */
export function saveLocalOrder(entry: { ref: string; token: string; total: number; merchant: string; at: string }) {
  try {
    const raw = localStorage.getItem("songa_orders_v1");
    const list = raw ? (JSON.parse(raw) as typeof entry[]) : [];
    list.unshift(entry);
    localStorage.setItem("songa_orders_v1", JSON.stringify(list.slice(0, 30)));
  } catch { /* ignore */ }
}

export function loadLocalOrders(): { ref: string; token: string; total: number; merchant: string; at: string }[] {
  try {
    const raw = localStorage.getItem("songa_orders_v1");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
