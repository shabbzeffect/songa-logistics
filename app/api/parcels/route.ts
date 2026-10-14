import { eq } from "drizzle-orm";
import * as s from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { fail, ok, rateLimit } from "@/lib/api";
import { parcelSchema } from "@/lib/validation";
import { normalizeKEPhone } from "@/lib/phone";
import { quoteParcel, type ParcelSize } from "@/lib/parcels";
import { newIdempotencyKey, newParcelRef, newTrackingToken } from "@/lib/ids";
import { notifyParcel } from "@/lib/notify";

export async function POST(req: Request) {
  if (!rateLimit("parcel:create", 20)) return fail("Too many requests.", 429);
  const body = await req.json().catch(() => null);
  const parsed = parcelSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Please check the highlighted fields", 400, {
      issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  const input = parsed.data;
  const senderPhone = normalizeKEPhone(input.senderPhone);
  const recipientPhone = normalizeKEPhone(input.recipientPhone);
  if (!senderPhone || !recipientPhone) return fail("Enter valid Kenyan mobile numbers.", 400);

  // Server-side estimate — never trust a client quote
  const quote = quoteParcel(input.city, input.size, input.weightKg);
  const db = await getDb();

  const prior = await db
    .select()
    .from(s.idempotencyKeys)
    .where(eq(s.idempotencyKeys.key, input.idempotencyKey));
  if (prior.length > 0) return ok({ ...(prior[0].response as object), replayed: true });

  const ref = newParcelRef();
  const trackingToken = newTrackingToken();
  const response = { ref, trackingToken, quote, status: "requested" };

  await db.transaction(async (tx) => {
    const [parcel] = await tx
      .insert(s.parcels)
      .values({
        ref, trackingToken, city: input.city,
        senderName: input.senderName.trim(), senderPhone,
        pickupArea: input.pickupArea.trim(), pickupAddress: input.pickupAddress.trim(),
        recipientName: input.recipientName.trim(), recipientPhone,
        dropoffArea: input.dropoffArea.trim(), dropoffAddress: input.dropoffAddress.trim(),
        contents: input.contents.trim(), size: input.size,
        weightKg: Math.round(input.weightKg * 10),
        quote, status: "requested", idempotencyKey: input.idempotencyKey,
      })
      .returning();
    await tx.insert(s.parcelEvents).values({
      parcelId: parcel.id, status: "requested",
      note: `Pickup request received. We'll confirm by SMS before dispatch.`, actor: "customer",
    });
    await tx.insert(s.paymentIntents).values({
      parcelId: parcel.id, method: "cash_on_delivery", amount: quote,
      status: "pending_on_delivery", idempotencyKey: `pay-${input.idempotencyKey}`,
    });
    await tx.insert(s.auditEvents).values({
      kind: "parcel.created", entityId: parcel.id, detail: { ref, quote }, actor: "customer",
    });
    await tx.insert(s.idempotencyKeys).values({ key: input.idempotencyKey, scope: "parcel", response });
  });

  // Sender confirmation SMS (skipped silently until SMS is configured).
  await notifyParcel({
    ref, parcelId: ref, to: "requested",
    pickupArea: input.pickupArea.trim(), dropoffArea: input.dropoffArea.trim(),
    senderPhone, recipientPhone, recipientName: input.recipientName.trim(),
  });

  return ok(response, 201);
}

/** Server-side quote preview (still an estimate). */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const city = u.searchParams.get("city") ?? "nairobi";
  const size = (u.searchParams.get("size") ?? "small") as ParcelSize;
  const weight = Number(u.searchParams.get("weight") ?? 1);
  if (!["small", "medium", "large"].includes(size)) return fail("Invalid size", 400);
  if (!Number.isFinite(weight) || weight < 0.1 || weight > 20) return fail("Weight must be 0.1–20 kg", 400);
  void newIdempotencyKey;
  return ok({ quote: quoteParcel(city, size, weight), estimate: true });
}
