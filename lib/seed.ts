import { eq, inArray, sql } from "drizzle-orm";
import type { Db } from "./db";
import { calcTotals } from "./money";
import { nextRatingX10 } from "./validation";
import {
  auditEvents,
  merchants,
  orderEvents,
  orderItems,
  orders,
  paymentIntents,
  products,
  modifierGroups,
  modifierOptions,
  promos,
  reviews,
  riders,
} from "../drizzle/schema";

/** Fictional demo catalogue. Clearly sample data until real partners join. */

export async function seedDatabase(db: Db): Promise<void> {
  // Idempotent per-entity (never a blanket early-return): migration 0003 inserts
  // two pharmacy merchants on fresh databases BEFORE this seed runs, so a
  // "merchants exist → skip everything" guard would leave fresh DBs with 2 shops,
  // zero riders and zero promos. Each section below fills only what is missing.

  // Demo riders start KYC-approved (mirrors migration 0005's grandfathering of
  // verified riders) so dispatch works on a fresh database. The KYC review
  // queue is still exercisable: any resubmission flips a rider to submitted.
  const existingRiders = await db.select({ id: riders.id }).from(riders);
  if (existingRiders.length === 0) {
    await db.insert(riders).values([
      { name: "Brian Otieno", phone: "+254722111222", city: "nairobi", active: true, verified: true, kycStatus: "approved" },
      { name: "Faith Wanjiku", phone: "+254733444555", city: "nairobi", active: true, verified: true, kycStatus: "approved" },
      { name: "Ali Said", phone: "+254722333444", city: "mombasa", active: true, verified: true, kycStatus: "approved" },
      { name: "Grace Achieng", phone: "+254701222333", city: "kisumu", active: true, verified: true, kycStatus: "approved" },
    ]);
  }

  const existingPromos = await db.select({ code: promos.code }).from(promos);
  const havePromo = new Set(existingPromos.map((p) => p.code));
  const wantedPromos = [
    { code: "KARIBU10", label: "10% off your first order (up to KSh 300)", percent: 10, cap: 300, minSubtotal: 500, active: true },
    { code: "LUNCH150", label: "KSh 150 off orders over KSh 800", amountOff: 150, minSubtotal: 800, active: true },
    { code: "SWEET20", label: "20% off gifts & shopping (up to KSh 500)", percent: 20, cap: 500, minSubtotal: 1000, active: true },
  ].filter((p) => !havePromo.has(p.code));
  if (wantedPromos.length > 0) await db.insert(promos).values(wantedPromos);

  async function addMerchant(
    m: typeof merchants.$inferInsert,
    items: (Omit<typeof products.$inferInsert, "merchantId"> & {
      modifiers?: { name: string; required: boolean; multi: boolean; options: { name: string; priceDelta: number }[] }[];
    })[],
  ) {
    // Skip shops that already exist by name (e.g. the two pharmacies migration
    // 0003 inserts on fresh databases, with identical shelves).
    const dup = await db.select({ id: merchants.id }).from(merchants).where(eq(merchants.name, m.name));
    if (dup.length > 0) return dup[0].id;
    const [row] = await db.insert(merchants).values(m).returning({ id: merchants.id });
    for (const { modifiers, ...p } of items) {
      const [prod] = await db
        .insert(products)
        .values({ ...p, merchantId: row.id })
        .returning({ id: products.id });
      for (const g of modifiers ?? []) {
        const [grp] = await db
          .insert(modifierGroups)
          .values({ productId: prod.id, name: g.name, required: g.required, multi: g.multi })
          .returning({ id: modifierGroups.id });
        for (const o of g.options) {
          await db.insert(modifierOptions).values({ groupId: grp.id, name: o.name, priceDelta: o.priceDelta });
        }
      }
    }
    return row.id;
  }

  // ——— Nairobi ————————————————————————————————————————
  await addMerchant(
    {
      name: "Mama Njoroge's Kitchen", description: "Homely Kenyan classics — ugali, sukuma wiki, slow-cooked beef. Cooked fresh from 10am.",
      city: "nairobi", areas: "Kilimani, Westlands, Lavington", category: "food",
      deliveryFee: 120, freeOver: 1500, minOrder: 200, prepMinutes: 25, rating: 47, ratingsCount: 212, imageHint: "stew",
    },
    [
      { name: "Beef Stew + Ugali", description: "Slow-cooked beef, sukuma wiki, ugali", price: 380, section: "Mains", dietary: "halal option", allergens: "gluten", stock: 40, imageHint: "stew",
        modifiers: [
          { name: "Ugali size", required: true, multi: false, options: [{ name: "Regular", priceDelta: 0 }, { name: "Large (+KSh 50)", priceDelta: 50 }] },
          { name: "Extras", required: false, multi: true, options: [{ name: "Extra sukuma (+KSh 60)", priceDelta: 60 }, { name: "Avocado (+KSh 80)", priceDelta: 80 }] },
        ] },
      { name: "Chicken Pilau", description: "Coastal-style pilau with kachumbari", price: 350, section: "Mains", dietary: "halal", allergens: "", stock: 35, imageHint: "rice" },
      { name: "Githeri Special", description: "Fried githeri with avocado", price: 250, section: "Mains", dietary: "vegetarian, vegan option", allergens: "", stock: 30, imageHint: "beans" },
      { name: "Mango Juice (500ml)", description: "Fresh-pressed mango, no added sugar", price: 180, section: "Drinks", dietary: "vegan", allergens: "", stock: 50, imageHint: "juice" },
    ],
  );

  await addMerchant(
    {
      name: "Kilimani Greens Mart", description: "Your neighbourhood market run — fresh veg, fruit, milk and pantry staples.",
      city: "nairobi", areas: "Kilimani, Lavington, South B", category: "grocery",
      deliveryFee: 100, freeOver: 2000, minOrder: 300, prepMinutes: 15, rating: 46, ratingsCount: 158, imageHint: "veg",
    },
    [
      { name: "Veggie Basket", description: "Sukuma, spinach, carrots, tomatoes, onions (feeds 3–4)", price: 550, section: "Fresh", dietary: "vegan", allergens: "", stock: 25, imageHint: "veg" },
      { name: "Fresh Milk (1L)", description: "Pasteurised whole milk", price: 120, section: "Dairy", dietary: "vegetarian", allergens: "milk", stock: 60, imageHint: "milk" },
      { name: "Brown Eggs (tray of 12)", description: "Farm eggs", price: 360, section: "Dairy", dietary: "vegetarian", allergens: "egg", stock: 20, imageHint: "eggs" },
      { name: "Ndengu (1kg)", description: "Green grams, pre-cleaned", price: 220, section: "Pantry", dietary: "vegan", allergens: "", stock: 40, imageHint: "grains" },
    ],
  );

  await addMerchant(
    {
      name: "DawaPlus Essentials", description: "Songa medical courier — pharmacy essentials sealed and rushed to your door. Non-prescription medicines, first aid, vitamins; prescription orders are verified with our pharmacists by phone.",
      city: "nairobi", areas: "Kilimani, Westlands, CBD", category: "medical",
      deliveryFee: 100, freeOver: null, minOrder: 0, prepMinutes: 10, rating: 44, ratingsCount: 96, imageHint: "care" },
    [
      { name: "Paracetamol 500mg (20 tabs)", description: "General pain & fever relief. Follow the pack leaflet.", price: 150, section: "Essentials", stock: 100, imageHint: "care" },
      { name: "Plasters (30 pack)", description: "Assorted waterproof plasters", price: 200, section: "First aid", stock: 80, imageHint: "care" },
      { name: "Vitamin C (30 tabs)", description: "Food supplement, not a medicine", price: 450, section: "Vitamins", stock: 60, imageHint: "care" },
      { name: "Shea Body Lotion", description: "Unperfumed moisturising lotion 400ml", price: 650, section: "Personal care", stock: 30, imageHint: "care" },
    ],
  );

  await addMerchant(
    {
      name: "Maua Yetu", description: "Fresh-cut flowers from Limuru growers, wrapped in-store. Groceries & shopping delivery — add a handwritten note at checkout.",
      city: "nairobi", areas: "Kilimani, Westlands, Karen, Lavington", category: "grocery",
      deliveryFee: 200, freeOver: 3000, minOrder: 500, prepMinutes: 20, rating: 48, ratingsCount: 74, imageHint: "flowers" },
    [
      { name: "Rose Bunch (10 stems)", description: "Mixed red & pink roses", price: 1200, section: "Bouquets", stock: 15, imageHint: "flowers" },
      { name: "Sunflower Jar", description: "Sunflowers in a reusable jar", price: 950, section: "Bouquets", stock: 12, imageHint: "flowers" },
      { name: "Greeting Card", description: "Handwritten message on recycled card", price: 150, section: "Extras", stock: 100, trackInventory: false, imageHint: "gift" },
    ],
  );

  await addMerchant(
    {
      name: "Zawadi Corner", description: "Curated shopping finds — notebooks, candles, kitenge totes and little gifts, delivered with your groceries.",
      city: "nairobi", areas: "Kilimani, CBD, Westlands", category: "grocery",
      deliveryFee: 150, freeOver: null, minOrder: 0, prepMinutes: 15, rating: 43, ratingsCount: 51, imageHint: "gift" },
    [
      { name: "Kitenge Tote", description: "Handmade ankara tote bag", price: 850, section: "Gifts", stock: 20, imageHint: "gift" },
      { name: "Scented Candle", description: "Vanilla & sandalwood, 40hr burn", price: 1100, section: "Home", stock: 18, imageHint: "gift" },
      { name: "Notebook Set (3)", description: "Recycled-paper A5 notebooks", price: 600, section: "Stationery", stock: 35, imageHint: "gift" },
    ],
  );

  // ——— Mombasa ————————————————————————————————————————
  await addMerchant(
    {
      name: "Pwani Fish Pot", description: "Swahili coastal cooking — coconut fish curry, biryani, fresh juices.",
      city: "mombasa", areas: "Nyali, Bamburi, CBD", category: "food",
      deliveryFee: 130, freeOver: 1500, minOrder: 200, prepMinutes: 30, rating: 46, ratingsCount: 188, imageHint: "fish" },
    [
      { name: "Coconut Fish Curry + Rice", description: "Tamarind & coconut, with wali wa nazi", price: 450, section: "Mains", allergens: "fish", stock: 30, imageHint: "fish",
        modifiers: [
          { name: "Spice level", required: true, multi: false, options: [{ name: "Mild", priceDelta: 0 }, { name: "Medium", priceDelta: 0 }, { name: "Pili-pili (+KSh 0)", priceDelta: 0 }] },
        ] },
      { name: "Chicken Biryani", description: "With raita & kachumbari", price: 420, section: "Mains", dietary: "halal", stock: 25, imageHint: "rice" },
      { name: "Passion Juice (500ml)", description: "Fresh passion & mango", price: 150, section: "Drinks", dietary: "vegan", stock: 40, imageHint: "juice" },
    ],
  );

  await addMerchant(
    {
      name: "Nyali Daily Mart", description: "Groceries, snacks and household basics across Nyali and Bamburi.",
      city: "mombasa", areas: "Nyali, Bamburi, Likoni", category: "grocery",
      deliveryFee: 110, freeOver: 2000, minOrder: 300, prepMinutes: 15, rating: 44, ratingsCount: 87, imageHint: "veg" },
    [
      { name: "Fruit Box", description: "Mangoes, pineapples, bananas, pawpaw", price: 600, section: "Fresh", dietary: "vegan", stock: 20, imageHint: "fruit" },
      { name: "Chapati Flour (2kg)", description: "Home-style atta", price: 280, section: "Pantry", allergens: "gluten", stock: 50, imageHint: "grains" },
      { name: "Cooking Oil (1L)", description: "Vegetable oil", price: 340, section: "Pantry", stock: 45, imageHint: "grains" },
    ],
  );

  await addMerchant(
    {
      name: "Dawa Bora Pharmacy", description: "Songa medical courier in Mombasa — sealed pharmacy essentials and first-aid supplies, rushed to your door.",
      city: "mombasa", areas: "Nyali, CBD, Bamburi", category: "medical",
      deliveryFee: 100, freeOver: null, minOrder: 0, prepMinutes: 10, rating: 45, ratingsCount: 63, imageHint: "care" },
    [
      { name: "Paracetamol 500mg (20 tabs)", description: "General pain & fever relief. Follow the pack leaflet.", price: 150, section: "Essentials", stock: 90, imageHint: "care" },
      { name: "ORS Sachets (6 pack)", description: "Oral rehydration salts for dehydration recovery.", price: 180, section: "Essentials", stock: 70, imageHint: "care" },
      { name: "Digital Thermometer", description: "Fast-read digital thermometer with storage case.", price: 650, section: "Devices", stock: 25, imageHint: "care" },
    ],
  );

  // ——— Kisumu —————————————————————————————————————————
  await addMerchant(
    {
      name: "Lakeside Kitchen", description: "Lakeside favourites — tilapia, ugali, traditional greens.",
      city: "kisumu", areas: "Milimani, Kondele, CBD", category: "food",
      deliveryFee: 100, freeOver: 1200, minOrder: 200, prepMinutes: 30, rating: 45, ratingsCount: 143, imageHint: "fish" },
    [
      { name: "Fried Tilapia + Ugali", description: "Whole tilapia, managu, ugali", price: 550, section: "Mains", allergens: "fish", stock: 22, imageHint: "fish",
        modifiers: [
          { name: "Side greens", required: true, multi: false, options: [{ name: "Managu", priceDelta: 0 }, { name: "Sukuma wiki", priceDelta: 0 }] },
        ] },
      { name: "Kuon + Omena", description: "Ugali with fried omena & kachumbari", price: 280, section: "Mains", allergens: "fish", stock: 28, imageHint: "stew" },
      { name: "Uji (500ml)", description: "Fermented millet porridge", price: 120, section: "Drinks", dietary: "vegan", stock: 30, imageHint: "juice" },
    ],
  );

  await addMerchant(
    {
      name: "Milimani Mini Mart", description: "Everyday groceries and essentials in Milimani and Kondele.",
      city: "kisumu", areas: "Milimani, Kondele, Nyalenda", category: "grocery",
      deliveryFee: 90, freeOver: 1800, minOrder: 250, prepMinutes: 15, rating: 43, ratingsCount: 66, imageHint: "veg" },
    [
      { name: "Breakfast Pack", description: "Milk 500ml, bread, eggs (6), margarine", price: 520, section: "Bundles", dietary: "vegetarian", allergens: "milk, egg, gluten", stock: 18, imageHint: "eggs" },
      { name: "Sukuma + Tomatoes Bundle", description: "A week's greens starter", price: 200, section: "Fresh", dietary: "vegan", stock: 40, imageHint: "veg" },
    ],
  );

  await addMerchant(
    {
      name: "Oginga Dawa Pharmacy", description: "Songa medical courier in Kisumu — pharmacy essentials and first-aid supplies, sealed and delivered fast.",
      city: "kisumu", areas: "Milimani, CBD, Kondele", category: "medical",
      deliveryFee: 90, freeOver: null, minOrder: 0, prepMinutes: 10, rating: 44, ratingsCount: 41, imageHint: "care" },
    [
      { name: "Paracetamol 500mg (20 tabs)", description: "General pain & fever relief. Follow the pack leaflet.", price: 150, section: "Essentials", stock: 80, imageHint: "care" },
      { name: "Antiseptic Liquid (250ml)", description: "First-aid antiseptic for cuts and grazes.", price: 220, section: "First aid", stock: 55, imageHint: "care" },
      { name: "Multivitamins (30 tabs)", description: "Daily multivitamin food supplement.", price: 550, section: "Vitamins", stock: 40, imageHint: "care" },
    ],
  );

  await seedDemoHistory(db);
}

/**
 * Demo order history + reviews. Three delivered COD orders for a fictional
 * customer (Amina Demo, +254712345678 — sign in with 0712345678 to see them
 * under account order history). Two carry star ratings with merchant replies so
 * the storefront "What neighbours say" section renders; the third is left
 * unreviewed so the rate-your-order demo path stays exercisable.
 */
const DEMO_CUSTOMER = { name: "Amina Demo", phone: "+254712345678" };

async function seedDemoHistory(db: Db): Promise<void> {
  const refs = ["SG-SEEDAA", "SG-SEEDAB", "SG-SEEDAC"];
  const sentinel = await db.select({ id: orders.id }).from(orders).where(inArray(orders.ref, refs));
  if (sentinel.length > 0) return;

  async function findMerchant(name: string) {
    const rows = await db.select().from(merchants).where(eq(merchants.name, name));
    return rows[0];
  }
  async function findRider(name: string) {
    const rows = await db.select().from(riders).where(eq(riders.name, name));
    return rows[0];
  }
  async function findProduct(merchantId: string, name: string) {
    const rows = await db
      .select()
      .from(products)
      .where(eq(products.merchantId, merchantId));
    return rows.find((p) => p.name === name);
  }

  const mama = await findMerchant("Mama Njoroge's Kitchen");
  const greens = await findMerchant("Kilimani Greens Mart");
  const pwani = await findMerchant("Pwani Fish Pot");
  const brian = await findRider("Brian Otieno");
  const ali = await findRider("Ali Said");
  if (!mama || !greens || !pwani || !brian || !ali) return;

  const specs: {
    ref: string; token: string; idem: string; merchant: typeof mama;
    rider: typeof brian; city: string; area: string; address: string;
    lines: { product: string; qty: number; modifiers: { group: string; option: string; delta: number }[] }[];
    review?: { rating: number; comment: string; reply: string };
  }[] = [
    {
      ref: "SG-SEEDAA", token: "seed-demo-token-aaaa0001", idem: "seed-demo-order-1",
      merchant: mama, rider: brian, city: "nairobi", area: "Kilimani", address: "Kindaruma Court, Hse B4",
      lines: [
        {
          product: "Beef Stew + Ugali", qty: 2,
          modifiers: [
            { group: "Ugali size", option: "Regular", delta: 0 },
            { group: "Extras", option: "Avocado (+KSh 80)", delta: 80 },
          ],
        },
        { product: "Mango Juice (500ml)", qty: 1, modifiers: [] },
      ],
      review: {
        rating: 5,
        comment: "Beef stew tastes like home — ugali was still hot and the rider called on arrival.",
        reply: "Asante sana Amina! Karibu tena.",
      },
    },
    {
      ref: "SG-SEEDAB", token: "seed-demo-token-aaaa0002", idem: "seed-demo-order-2",
      merchant: greens, rider: brian, city: "nairobi", area: "Kilimani", address: "Kindaruma Court, Hse B4",
      lines: [
        { product: "Veggie Basket", qty: 1, modifiers: [] },
        { product: "Fresh Milk (1L)", qty: 1, modifiers: [] },
      ],
      review: {
        rating: 4,
        comment: "Veggie basket was fresh and the milk had a long expiry date. Greens were a little wilted.",
        reply: "Thanks for shopping with us — we have shared your note with our morning suppliers.",
      },
    },
    {
      ref: "SG-SEEDAC", token: "seed-demo-token-aaaa0003", idem: "seed-demo-order-3",
      merchant: pwani, rider: ali, city: "mombasa", area: "Nyali", address: "Links Road, Flat 3C",
      lines: [
        { product: "Coconut Fish Curry + Rice", qty: 1, modifiers: [{ group: "Spice level", option: "Medium", delta: 0 }] },
        { product: "Passion Juice (500ml)", qty: 1, modifiers: [] },
      ],
    },
  ];

  for (const s of specs) {
    const priced = [];
    for (const l of s.lines) {
      const p = await findProduct(s.merchant.id, l.product);
      if (!p) continue;
      priced.push({ p, qty: l.qty, modifiers: l.modifiers, delta: l.modifiers.reduce((t, x) => t + x.delta, 0) });
    }
    if (priced.length !== s.lines.length) continue;

    // Same maths as checkout (server-authoritative totals).
    const totals = calcTotals({
      lines: priced.map((l) => ({ unitPrice: l.p.price, qty: l.qty, modifierDelta: l.delta })),
      deliveryFee: s.merchant.deliveryFee,
      freeDeliveryOver: s.merchant.freeOver,
    });

    const [order] = await db
      .insert(orders)
      .values({
        ref: s.ref,
        trackingToken: s.token,
        merchantId: s.merchant.id,
        riderId: s.rider.id,
        customerName: DEMO_CUSTOMER.name,
        phone: DEMO_CUSTOMER.phone,
        city: s.city,
        area: s.area,
        addressLine: s.address,
        status: "delivered",
        paymentMethod: "cash_on_delivery",
        paymentStatus: "paid",
        subtotal: totals.subtotal,
        discount: totals.discount,
        deliveryFee: totals.deliveryFee,
        serviceFee: totals.serviceFee,
        tip: totals.tip,
        total: totals.total,
        proofNote: "Delivered — received by the customer",
        idempotencyKey: s.idem,
      })
      .returning({ id: orders.id });

    for (const l of priced) {
      await db.insert(orderItems).values({
        orderId: order.id, productId: l.p.id, name: l.p.name,
        unitPrice: l.p.price, modifierDelta: l.delta, modifiers: l.modifiers,
        qty: l.qty, lineTotal: (l.p.price + l.delta) * l.qty,
      });
      if (l.p.trackInventory) {
        await db
          .update(products)
          .set({ stock: sql`${products.stock} - ${l.qty}` })
          .where(eq(products.id, l.p.id));
      }
    }

    const trail: { status: string; note: string; actor: string }[] = [
      { status: "placed", note: "Order placed", actor: "customer" },
      { status: "accepted", note: `Accepted by ${s.merchant.name}`, actor: "merchant" },
      { status: "preparing", note: "Being prepared", actor: "merchant" },
      { status: "ready", note: "Ready for pickup", actor: "merchant" },
      { status: "picked_up", note: `Picked up by ${s.rider.name}`, actor: `courier:${s.rider.id.slice(0, 8)}` },
      { status: "on_the_way", note: "On the way", actor: `courier:${s.rider.id.slice(0, 8)}` },
      { status: "delivered", note: "Delivered — received by the customer", actor: `courier:${s.rider.id.slice(0, 8)}` },
    ];
    for (const e of trail) {
      await db.insert(orderEvents).values({ orderId: order.id, status: e.status, note: e.note, actor: e.actor });
    }
    await db.insert(paymentIntents).values({
      orderId: order.id, method: "cash_on_delivery", amount: totals.total,
      status: "paid", idempotencyKey: `pay-${s.idem}`,
    });
    await db.insert(auditEvents).values({
      kind: "order.created", entityId: order.id,
      detail: { ref: s.ref, total: totals.total, paymentMethod: "cash_on_delivery", demo: true }, actor: "customer",
    });

    if (s.review) {
      const [review] = await db
        .insert(reviews)
        .values({
          orderId: order.id, merchantId: s.merchant.id,
          rating: s.review.rating, comment: s.review.comment,
          reply: s.review.reply, repliedAt: new Date(),
        })
        .returning({ id: reviews.id });
      // Same aggregate blend as the live review endpoint (rating stored x10).
      const next = nextRatingX10(s.merchant.rating, s.merchant.ratingsCount, s.review.rating);
      await db.update(merchants).set({ rating: next.rating, ratingsCount: next.count }).where(eq(merchants.id, s.merchant.id));
      await db.insert(auditEvents).values({
        kind: "review.created", entityId: review.id,
        detail: { orderId: order.id, merchantId: s.merchant.id, rating: s.review.rating, demo: true }, actor: "customer",
      });
    }
  }
}
