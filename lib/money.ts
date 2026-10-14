/** Money helpers — all amounts are integer KES (whole shillings). Never floats. */

export function formatKES(amountKes: number, opts?: { code?: boolean }): string {
  const n = Math.round(amountKes);
  const grouped = new Intl.NumberFormat("en-KE", {
    maximumFractionDigits: 0,
  }).format(n);
  return opts?.code ? `KES ${grouped}` : `KSh ${grouped}`;
}

/** Clamp + round any input to a safe integer KES amount. */
export function toKES(input: unknown): number {
  const n = typeof input === "string" ? Number(input) : (input as number);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

export function percentOff(subtotal: number, percent: number, cap?: number | null): number {
  if (percent <= 0 || subtotal <= 0) return 0;
  const raw = Math.floor((subtotal * Math.min(percent, 100)) / 100);
  return cap != null && cap >= 0 ? Math.min(raw, cap) : raw;
}

export interface PricedLine {
  unitPrice: number;
  qty: number;
  modifierDelta: number;
}

export function lineTotal(line: PricedLine): number {
  return (line.unitPrice + line.modifierDelta) * Math.max(0, Math.floor(line.qty));
}

export interface OrderTotals {
  subtotal: number;
  discount: number;
  deliveryFee: number;
  serviceFee: number;
  tip: number;
  total: number;
}

const SERVICE_FEE_RATE = 5; // 5%
const SERVICE_FEE_CAP = 250; // KSh 250 cap

export function serviceFeeFor(subtotalAfterDiscount: number): number {
  if (subtotalAfterDiscount <= 0) return 0;
  return Math.min(Math.round((subtotalAfterDiscount * SERVICE_FEE_RATE) / 100), SERVICE_FEE_CAP);
}

export function calcTotals(args: {
  lines: PricedLine[];
  discount?: number;
  deliveryFee?: number;
  tip?: number;
  freeDeliveryOver?: number | null;
}): OrderTotals {
  const subtotal = args.lines.reduce((s, l) => s + lineTotal(l), 0);
  const discount = Math.min(toKES(args.discount ?? 0), subtotal);
  const afterDiscount = subtotal - discount;
  let deliveryFee = toKES(args.deliveryFee ?? 0);
  if (args.freeDeliveryOver != null && afterDiscount >= args.freeDeliveryOver) deliveryFee = 0;
  const serviceFee = serviceFeeFor(afterDiscount);
  const tip = toKES(args.tip ?? 0);
  return {
    subtotal,
    discount,
    deliveryFee,
    serviceFee,
    tip,
    total: afterDiscount + deliveryFee + serviceFee + tip,
  };
}
