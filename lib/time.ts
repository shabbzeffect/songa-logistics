/** Africa/Nairobi time helpers. */

export const NAIROBI_TZ = "Africa/Nairobi";

export function nowNairobi(): Date {
  return new Date();
}

export function formatNairobi(iso: string | Date, opts?: Intl.DateTimeFormatOptions): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("en-KE", {
    timeZone: NAIROBI_TZ,
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    ...opts,
  }).format(d);
}

/** Scheduled orders: must be at least 90 min ahead and within 7 days. */
export function validateScheduledFor(iso: string): { ok: boolean; error?: string } {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return { ok: false, error: "Invalid date" };
  const diff = when.getTime() - Date.now();
  if (diff < 90 * 60 * 1000) return { ok: false, error: "Scheduled orders need at least 90 minutes notice" };
  if (diff > 7 * 24 * 3600 * 1000) return { ok: false, error: "You can schedule up to 7 days ahead" };
  return { ok: true };
}
