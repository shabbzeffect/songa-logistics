import type { ReactNode } from "react";
import { formatKES } from "@/lib/money";

export function Price({ value, className = "" }: { value: number; className?: string }) {
  return <span className={className}>{formatKES(value)}</span>;
}

export function Badge({ children, tone = "green" }: { children: ReactNode; tone?: "green" | "coral" | "sand" | "red" }) {
  const tones: Record<string, string> = {
    green: "bg-forest-100 text-forest-900",
    coral: "bg-coral-100 text-coral-600",
    sand: "bg-cream-200 text-forest-900",
    red: "bg-red-100 text-red-800",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Rating({ value, count }: { value: number; count?: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm" aria-label={`Rated ${value} out of 5`}>
      <span aria-hidden className="text-sun-400">★</span>
      <strong>{value.toFixed(1)}</strong>
      {count != null && <span className="text-stone-500">({count})</span>}
    </span>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-forest-700/30 bg-white/60 px-6 py-10 text-center">
      <p className="font-display text-lg font-bold text-forest-950">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-stone-600">{hint}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Field({
  label, children, hint, error,
}: { label: string; children: ReactNode; hint?: string; error?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-forest-950">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-stone-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-semibold text-red-700">{error}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-[15px] text-stone-900 placeholder:text-stone-400 focus:border-forest-700";

// Demo catalogue artwork lives in components/art.tsx (hand-built SVG scenes,
// one per image hint — real partner photos replace these at onboarding).
export { Art } from "./art";

export function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-3">
      <h2 className="font-display text-xl font-extrabold text-forest-950">{title}</h2>
      {sub && <p className="text-sm text-stone-600">{sub}</p>}
    </div>
  );
}
