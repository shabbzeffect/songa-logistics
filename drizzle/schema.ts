import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uuid,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

/** Users & roles. Riders/customers prove their phone via OTP; staff use passwords (see 0004). */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  phone: text("phone"),
  role: text("role").notNull().default("customer"), // customer|merchant|courier|ops
  merchantId: uuid("merchant_id"),
  riderId: uuid("rider_id"),
  passwordHash: text("password_hash"), // staff only (scrypt); OTP accounts have NULL
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
},
  (t) => [uniqueIndex("users_phone_role_idx").on(t.phone, t.role)],
);

export const merchants = pgTable(
  "merchants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    city: text("city").notNull(), // nairobi|mombasa|kisumu
    areas: text("areas").notNull().default(""), // comma-separated service areas
    category: text("category").notNull(), // food|grocery|medical (parcel is a service, not a shop)
    deliveryFee: integer("delivery_fee").notNull().default(150),
    freeOver: integer("free_over"), // null = no free delivery
    minOrder: integer("min_order").notNull().default(0),
    prepMinutes: integer("prep_minutes").notNull().default(20),
    rating: integer("rating").notNull().default(45), // x10, e.g. 45 = 4.5 (demo seed value)
    ratingsCount: integer("ratings_count").notNull().default(0),
    open: boolean("open").notNull().default(true),
    approved: boolean("approved").notNull().default(true),
    imageHint: text("image_hint").notNull().default("meal"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("merchants_city_idx").on(t.city), index("merchants_category_idx").on(t.category)],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    price: integer("price").notNull(), // KES integer
    section: text("section").notNull().default("Main"),
    dietary: text("dietary").notNull().default(""), // e.g. "vegetarian, halal"
    allergens: text("allergens").notNull().default(""),
    stock: integer("stock").notNull().default(0),
    trackInventory: boolean("track_inventory").notNull().default(true),
    available: boolean("available").notNull().default(true),
    imageHint: text("image_hint").notNull().default("meal"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("products_merchant_idx").on(t.merchantId)],
);

/** Modifier groups, e.g. "Ugali size" (required, choose 1), "Extras" (optional, many). */
export const modifierGroups = pgTable("modifier_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id").notNull(),
  name: text("name").notNull(),
  required: boolean("required").notNull().default(false),
  multi: boolean("multi").notNull().default(false),
  sort: integer("sort").notNull().default(0),
});

export const modifierOptions = pgTable("modifier_options", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id").notNull(),
  name: text("name").notNull(),
  priceDelta: integer("price_delta").notNull().default(0),
  available: boolean("available").notNull().default(true),
});

export const promos = pgTable("promos", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  label: text("label").notNull().default(""),
  percent: integer("percent"), // e.g. 10 = 10%
  amountOff: integer("amount_off"), // KES alternative
  cap: integer("cap"), // max discount KES
  minSubtotal: integer("min_subtotal").notNull().default(0),
  maxUses: integer("max_uses"), // null = unlimited
  used: integer("used").notNull().default(0),
  active: boolean("active").notNull().default(true),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export const riders = pgTable("riders", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  city: text("city").notNull(),
  active: boolean("active").notNull().default(true), // availability toggle
  verified: boolean("verified").notNull().default(true),
  kycStatus: text("kyc_status").notNull().default("pending"), // pending|submitted|approved|rejected
  kycNote: text("kyc_note").notNull().default(""),
  kycDocs: jsonb("kyc_docs").notNull().default([]), // [{type, ref}] — ID + licence refs, never photos in demo
});

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ref: text("ref").notNull().unique(), // e.g. SG-XXXXXX (customer-facing)
    trackingToken: text("tracking_token").notNull().unique(), // high-entropy
    merchantId: uuid("merchant_id").notNull(),
    riderId: uuid("rider_id"),
    customerName: text("customer_name").notNull(),
    phone: text("phone").notNull(), // +254...
    city: text("city").notNull(),
    area: text("area").notNull(),
    addressLine: text("address_line").notNull(),
    landmark: text("landmark").notNull().default(""),
    deliveryNotes: text("delivery_notes").notNull().default(""),
    status: text("status").notNull().default("placed"),
    paymentMethod: text("payment_method").notNull(),
    paymentStatus: text("payment_status").notNull().default("pending"), // pending|paid_on_delivery|paid|failed|refunded
    subtotal: integer("subtotal").notNull(),
    discount: integer("discount").notNull().default(0),
    deliveryFee: integer("delivery_fee").notNull().default(0),
    serviceFee: integer("service_fee").notNull().default(0),
    tip: integer("tip").notNull().default(0),
    total: integer("total").notNull(),
    promoCode: text("promo_code").notNull().default(""),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    proofNote: text("proof_note").notNull().default(""), // OTP/photo consent note
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("orders_status_idx").on(t.status), index("orders_merchant_idx").on(t.merchantId)],
);

/** Immutable price snapshot per line. */
export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull(),
  productId: uuid("product_id").notNull(),
  name: text("name").notNull(),
  unitPrice: integer("unit_price").notNull(),
  modifierDelta: integer("modifier_delta").notNull().default(0),
  modifiers: jsonb("modifiers").notNull().default([]), // [{group, option, delta}]
  qty: integer("qty").notNull(),
  lineTotal: integer("line_total").notNull(),
  note: text("note").notNull().default(""),
});

export const orderEvents = pgTable(
  "order_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").notNull(),
    status: text("status").notNull(),
    note: text("note").notNull().default(""),
    actor: text("actor").notNull().default("system"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("order_events_order_idx").on(t.orderId)],
);

export const paymentIntents = pgTable("payment_intents", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id"),
  parcelId: uuid("parcel_id"),
  method: text("method").notNull(),
  amount: integer("amount").notNull(),
  status: text("status").notNull().default("pending"), // pending|pending_on_delivery|paid|failed|refunded
  providerRef: text("provider_ref").notNull().default(""),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const parcels = pgTable(
  "parcels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ref: text("ref").notNull().unique(),
    trackingToken: text("tracking_token").notNull().unique(),
    city: text("city").notNull(),
    senderName: text("sender_name").notNull(),
    senderPhone: text("sender_phone").notNull(),
    pickupArea: text("pickup_area").notNull(),
    pickupAddress: text("pickup_address").notNull(),
    recipientName: text("recipient_name").notNull(),
    recipientPhone: text("recipient_phone").notNull(),
    dropoffArea: text("dropoff_area").notNull(),
    dropoffAddress: text("dropoff_address").notNull(),
    contents: text("contents").notNull(),
    size: text("size").notNull(),
    weightKg: integer("weight_kg").notNull(), // x10 (12 = 1.2kg) — integers only
    quote: integer("quote").notNull(),
    status: text("status").notNull().default("requested"),
    riderId: uuid("rider_id"),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("parcels_status_idx").on(t.status)],
);

export const parcelEvents = pgTable("parcel_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  parcelId: uuid("parcel_id").notNull(),
  status: text("status").notNull(),
  note: text("note").notNull().default(""),
  actor: text("actor").notNull().default("system"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const leads = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: text("kind").notNull(),
  businessName: text("business_name").notNull(),
  contactName: text("contact_name").notNull(),
  phone: text("phone").notNull(),
  city: text("city").notNull(),
  message: text("message").notNull().default(""),
  handled: boolean("handled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Append-only audit trail for money + status changes. */
export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull(), // order.status|order.payment|parcel.status|promo.use|stock.restore|merchant|product|lead
    entityId: text("entity_id").notNull(),
    detail: jsonb("detail").notNull().default({}),
    actor: text("actor").notNull().default("system"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("audit_entity_idx").on(t.entityId)],
);

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    key: text("key").primaryKey(),
    scope: text("scope").notNull(), // checkout|parcel
    response: jsonb("response").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("idem_key_idx").on(t.key)],
);

/** One-time passcodes for phone login. Only hashes are stored; codes are single-use. */
export const verificationCodes = pgTable(
  "verification_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phone: text("phone").notNull(), // +254...
    codeHash: text("code_hash").notNull(), // sha256 hex of the 6-digit code
    purpose: text("purpose").notNull(), // login_rider|login_customer
    attempts: integer("attempts").notNull().default(0),
    consumed: boolean("consumed").notNull().default(false),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("verification_codes_phone_idx").on(t.phone)],
);

/** Customer reviews — one per delivered order. Rating is 1–5 stars. */
export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").notNull().unique(),
    merchantId: uuid("merchant_id").notNull(),
    rating: integer("rating").notNull(), // 1..5
    comment: text("comment").notNull().default(""),
    reply: text("reply").notNull().default(""), // merchant/ops response
    repliedAt: timestamp("replied_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("reviews_merchant_idx").on(t.merchantId)],
);
