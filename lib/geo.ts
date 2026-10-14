export const CITIES = [
  { slug: "nairobi", name: "Nairobi", areas: ["Kilimani", "Westlands", "CBD", "Karen", "Eastleigh", "South B", "Lavington", "Embakasi"] },
  { slug: "mombasa", name: "Mombasa", areas: ["Nyali", "CBD", "Likoni", "Bamburi", "Diani"] },
  { slug: "kisumu", name: "Kisumu", areas: ["Milimani", "Kondele", "CBD", "Nyalenda", "Riat"] },
] as const;

export type CitySlug = (typeof CITIES)[number]["slug"];

export function cityName(slug: string): string {
  return CITIES.find((c) => c.slug === slug)?.name ?? slug;
}

export function cityAreas(slug: string): string[] {
  return CITIES.find((c) => c.slug === slug)?.areas.slice() ?? [];
}

export const CATEGORIES = [
  { slug: "food", name: "Food Delivery", hint: "Kitchens & restaurants" },
  { slug: "grocery", name: "Groceries & Shopping", hint: "Markets, shops, gifts & more" },
  { slug: "medical", name: "Medical Courier", hint: "Pharmacy & medical essentials" },
  { slug: "parcel", name: "E-commerce Parcels", hint: "Shop-to-doorstep deliveries" },
] as const;

export function categoryName(slug: string): string {
  return CATEGORIES.find((c) => c.slug === slug)?.name ?? slug;
}
