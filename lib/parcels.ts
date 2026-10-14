/** Parcel quote — an *estimate*, never presented as a guaranteed price. */

export const PROHIBITED_ITEMS = [
  "Cash, bank cards or securities",
  "Firearms, ammunition or explosives",
  "Flammable fuels, gas canisters or fireworks",
  "Illegal drugs or controlled substances",
  "Alcohol or tobacco products",
  "Perishable medical samples or prescription medicines",
  "Live animals",
  "Fragile glass without protective packaging",
  "Items worth more than KSh 50,000 (use insured courier instead)",
] as const;

export type ParcelSize = "small" | "medium" | "large";

const BASE: Record<ParcelSize, number> = { small: 150, medium: 250, large: 400 };
const PER_KG: Record<ParcelSize, number> = { small: 40, medium: 50, large: 60 };
const CITY_FLAT: Record<string, number> = { nairobi: 0, mombasa: 50, kisumu: 50 };

export function quoteParcel(city: string, size: ParcelSize, weightKg: number): number {
  const w = Math.min(Math.max(weightKg, 0.5), 20);
  return Math.round(BASE[size] + PER_KG[size] * w + (CITY_FLAT[city] ?? 0));
}

export function sizeLabel(s: ParcelSize): string {
  return s === "small" ? "Small (fits a backpack)" : s === "medium" ? "Medium (fits a shopping bag)" : "Large (fits a car boot)";
}
