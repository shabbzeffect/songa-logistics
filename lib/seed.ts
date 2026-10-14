import type { Db } from "./db";
import {
  merchants,
  products,
  modifierGroups,
  modifierOptions,
  promos,
  riders,
} from "../drizzle/schema";

/** Fictional demo catalogue. Clearly sample data until real partners join. */

export async function seedDatabase(db: Db): Promise<void> {
  const existing = await db.select().from(merchants);
  if (existing.length > 0) return;

  await db.insert(riders).values([
    { name: "Brian Otieno", phone: "+254722111222", city: "nairobi", active: true, verified: true },
    { name: "Faith Wanjiku", phone: "+254733444555", city: "nairobi", active: true, verified: true },
    { name: "Ali Said", phone: "+254722333444", city: "mombasa", active: true, verified: true },
    { name: "Grace Achieng", phone: "+254701222333", city: "kisumu", active: true, verified: true },
  ]);

  await db.insert(promos).values([
    { code: "KARIBU10", label: "10% off your first order (up to KSh 300)", percent: 10, cap: 300, minSubtotal: 500, active: true },
    { code: "LUNCH150", label: "KSh 150 off orders over KSh 800", amountOff: 150, minSubtotal: 800, active: true },
    { code: "SWEET20", label: "20% off gifts & shopping (up to KSh 500)", percent: 20, cap: 500, minSubtotal: 1000, active: true },
  ]);

  async function addMerchant(
    m: typeof merchants.$inferInsert,
    items: (Omit<typeof products.$inferInsert, "merchantId"> & {
      modifiers?: { name: string; required: boolean; multi: boolean; options: { name: string; priceDelta: number }[] }[];
    })[],
  ) {
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
}
