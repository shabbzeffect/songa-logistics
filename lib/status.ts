/** Explicit state machines for orders and parcels. Invalid jumps are rejected. */

export const ORDER_STATUSES = [
  "placed",
  "accepted",
  "preparing",
  "ready",
  "picked_up",
  "on_the_way",
  "delivered",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

const ORDER_FLOW: Record<Exclude<OrderStatus, "cancelled">, OrderStatus[]> = {
  placed: ["accepted", "cancelled"],
  accepted: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["picked_up", "cancelled"],
  picked_up: ["on_the_way"],
  on_the_way: ["delivered"],
  delivered: [],
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  if (from === "cancelled" || from === "delivered") return false;
  if (to === "cancelled") return ["placed", "accepted", "preparing", "ready"].includes(from);
  return (ORDER_FLOW[from as keyof typeof ORDER_FLOW] ?? []).includes(to);
}

export function orderStatusLabel(s: OrderStatus): string {
  switch (s) {
    case "placed": return "Order placed";
    case "accepted": return "Accepted by shop";
    case "preparing": return "Being prepared";
    case "ready": return "Ready for pickup";
    case "picked_up": return "Picked up";
    case "on_the_way": return "On the way";
    case "delivered": return "Delivered";
    case "cancelled": return "Cancelled";
  }
}

export const PARCEL_STATUSES = [
  "requested",
  "confirmed",
  "assigned",
  "picked_up",
  "in_transit",
  "delivered",
  "cancelled",
] as const;
export type ParcelStatus = (typeof PARCEL_STATUSES)[number];

const PARCEL_FLOW: Record<ParcelStatus, ParcelStatus[]> = {
  requested: ["confirmed", "cancelled"],
  confirmed: ["assigned", "cancelled"],
  assigned: ["picked_up", "cancelled"],
  picked_up: ["in_transit"],
  in_transit: ["delivered"],
  delivered: [],
  cancelled: [],
};

export function canTransitionParcel(from: ParcelStatus, to: ParcelStatus): boolean {
  return (PARCEL_FLOW[from] ?? []).includes(to);
}

export function parcelStatusLabel(s: ParcelStatus): string {
  switch (s) {
    case "requested": return "Request received";
    case "confirmed": return "Pickup confirmed";
    case "assigned": return "Rider assigned";
    case "picked_up": return "Picked up";
    case "in_transit": return "In transit";
    case "delivered": return "Delivered";
    case "cancelled": return "Cancelled";
  }
}
