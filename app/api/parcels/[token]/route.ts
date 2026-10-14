import { and, eq } from "drizzle-orm";
import { z } from "zod";
import * as s from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { canTransitionParcel, type ParcelStatus } from "@/lib/status";
import { maskPhone } from "@/lib/phone";

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const db = await getDb();
  const rows = await db.select().from(s.parcels).where(eq(s.parcels.trackingToken, token));
  const p = rows[0];
  if (!p) return fail("We couldn't find that parcel. Check the link.", 404);
  const events = await db.select().from(s.parcelEvents).where(eq(s.parcelEvents.parcelId, p.id));
  let rider: { name: string } | null = null;
  if (p.riderId) {
    const r = await db.select().from(s.riders).where(eq(s.riders.id, p.riderId));
    if (r[0]) rider = { name: r[0].name };
  }
  return ok({
    parcel: {
      ref: p.ref, status: p.status, city: p.city, quote: p.quote,
      pickupArea: p.pickupArea, dropoffArea: p.dropoffArea,
      contents: p.contents, size: p.size, weightKg: p.weightKg / 10,
      senderName: p.senderName, senderPhone: maskPhone(p.senderPhone),
      recipientName: p.recipientName, recipientPhone: maskPhone(p.recipientPhone),
      createdAt: p.createdAt,
    },
    rider,
    events: events
      .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
      .map((e) => ({ status: e.status, note: e.note, at: e.createdAt })),
  });
}

const patchSchema = z.object({
  to: z.enum(["confirmed", "assigned", "picked_up", "in_transit", "delivered", "cancelled"]),
  riderId: z.string().min(1).optional(),
  note: z.string().max(300).optional().default(""),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid status change", 400);
  const session = await getSession();
  if (!["ops", "merchant", "courier"].includes(session.role))
    return fail("Sign in as staff to update parcels.", 403);
  const db = await getDb();
  const rows = await db.select().from(s.parcels).where(eq(s.parcels.trackingToken, token));
  const p = rows[0];
  if (!p) return fail("Parcel not found", 404);
  const from = p.status as ParcelStatus;
  const to = parsed.data.to as ParcelStatus;
  if (!canTransitionParcel(from, to)) return fail(`Can't move parcel from ${from} to ${to}.`, 409);

  let riderToSet: string | undefined;
  if (parsed.data.riderId || to === "assigned") {
    const rid = parsed.data.riderId ?? (session.role === "courier" ? session.actorId : undefined);
    if (!rid) return fail("Choose a rider to assign.", 400);
    const r = await db.select().from(s.riders).where(eq(s.riders.id, rid));
    if (!r[0]?.verified) return fail("Rider isn't verified.", 400);
    if (r[0].city !== p.city) return fail("Rider serves a different city.", 400);
    riderToSet = rid;
  }
  if (session.role === "courier" && p.riderId && session.actorId !== p.riderId)
    return fail("Assigned to another rider.", 403);

  const actor = `${session.role}:${(session.actorId ?? "staff").slice(0, 8)}`;
  await db.transaction(async (tx) => {
    const upd = await tx
      .update(s.parcels)
      .set({
        status: to,
        ...(riderToSet ? { riderId: riderToSet } : {}),
      })
      .where(and(eq(s.parcels.id, p.id), eq(s.parcels.status, from)))
      .returning();
    if (upd.length === 0) throw new Error("race");
    if (to === "delivered") {
      await tx.update(s.paymentIntents).set({ status: "paid" }).where(eq(s.paymentIntents.parcelId, p.id));
    }
    if (to === "cancelled") {
      await tx.update(s.paymentIntents).set({ status: "voided" }).where(eq(s.paymentIntents.parcelId, p.id));
    }
    await tx.insert(s.parcelEvents).values({ parcelId: p.id, status: to, note: parsed.data.note, actor });
    await tx.insert(s.auditEvents).values({
      kind: "parcel.status", entityId: p.id, detail: { from, to }, actor,
    });
  }).catch(() => null);

  const verify = await (await getDb()).select().from(s.parcels).where(eq(s.parcels.id, p.id));
  if (!verify[0] || verify[0].status !== to) return fail("Changed just now — refresh and retry.", 409);
  return ok({ status: to });
}
