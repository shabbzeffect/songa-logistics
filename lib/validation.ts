import { z } from "zod";
import { isValidKEPhone } from "./phone";

export const kePhone = z
  .string()
  .trim()
  .min(9)
  .refine(isValidKEPhone, { message: "Enter a valid Kenyan mobile number, e.g. 0712 345 678" });

export const checkoutItemSchema = z.object({
  productId: z.string().uuid().or(z.string().min(1)),
  qty: z.number().int().min(1).max(20),
  // { groupId: optionId } — server re-validates and reprices
  selections: z.record(z.string(), z.string()).default({}),
  note: z.string().max(200).optional().default(""),
});

export const checkoutSchema = z.object({
  merchantId: z.string().min(1),
  items: z.array(checkoutItemSchema).min(1).max(30),
  customerName: z.string().trim().min(2).max(80),
  phone: kePhone,
  city: z.enum(["nairobi", "mombasa", "kisumu"]),
  area: z.string().trim().min(2).max(80),
  addressLine: z.string().trim().min(4).max(200),
  landmark: z.string().trim().max(120).optional().default(""),
  deliveryNotes: z.string().trim().max(300).optional().default(""),
  paymentMethod: z.enum(["cash_on_delivery", "mpesa_on_delivery", "mpesa_stk"]),
  promoCode: z.string().trim().max(24).optional().default(""),
  tip: z.number().int().min(0).max(5000).optional().default(0),
  idempotencyKey: z.string().trim().min(8).max(128),
  scheduledFor: z.string().datetime({ offset: true }).optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const parcelSchema = z.object({
  senderName: z.string().trim().min(2).max(80),
  senderPhone: kePhone,
  pickupArea: z.string().trim().min(2).max(80),
  pickupAddress: z.string().trim().min(4).max(200),
  recipientName: z.string().trim().min(2).max(80),
  recipientPhone: kePhone,
  dropoffArea: z.string().trim().min(2).max(80),
  dropoffAddress: z.string().trim().min(4).max(200),
  city: z.enum(["nairobi", "mombasa", "kisumu"]),
  contents: z.string().trim().min(3).max(200),
  size: z.enum(["small", "medium", "large"]),
  weightKg: z.number().min(0.1).max(20),
  prohibitedAck: z.literal(true, {
    message: "Please confirm your parcel has no prohibited items",
  }),
  idempotencyKey: z.string().trim().min(8).max(128),
});

export type ParcelInput = z.infer<typeof parcelSchema>;

export const leadSchema = z.object({
  kind: z.enum(["food", "grocery", "medical", "ecommerce", "rider"]),
  businessName: z.string().trim().min(2).max(120),
  contactName: z.string().trim().min(2).max(80),
  phone: kePhone,
  city: z.enum(["nairobi", "mombasa", "kisumu", "other"]),
  message: z.string().trim().max(1000).optional().default(""),
});

export const productUpsertSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().default(""),
  price: z.number().int().min(1).max(500000),
  section: z.string().trim().max(60).optional().default("Main"),
  dietary: z.string().trim().max(120).optional().default(""),
  allergens: z.string().trim().max(200).optional().default(""),
  stock: z.number().int().min(0).max(100000),
  trackInventory: z.boolean().optional().default(true),
  available: z.boolean().optional().default(true),
  imageHint: z.string().trim().max(40).optional().default("meal"),
});

export const merchantUpsertSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(600).optional().default(""),
  city: z.enum(["nairobi", "mombasa", "kisumu"]),
  areas: z.string().trim().max(400).optional().default(""),
  category: z.enum(["food", "grocery", "medical"]),
  deliveryFee: z.number().int().min(0).max(2000),
  freeOver: z.number().int().min(0).max(100000).nullable().optional(),
  minOrder: z.number().int().min(0).max(50000).optional().default(0),
  prepMinutes: z.number().int().min(5).max(180).optional().default(20),
  open: z.boolean().optional().default(true),
  approved: z.boolean().optional().default(true),
});

export const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional().default(""),
});

export type ReviewInput = z.infer<typeof reviewSchema>;

/** New aggregate rating (x10) after adding one more star rating. Pure helper for tests/UI. */
export function nextRatingX10(currentX10: number, currentCount: number, rating: number): { rating: number; count: number } {
  const count = currentCount + 1;
  const ratingX10 = Math.round((currentX10 * currentCount + rating * 10) / count);
  return { rating: ratingX10, count };
}
