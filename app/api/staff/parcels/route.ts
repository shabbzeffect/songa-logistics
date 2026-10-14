import { sql } from "drizzle-orm";
import * as s from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { staffSession } from "@/lib/staff";

export async function GET() {
  const gate = await staffSession(["ops", "courier"]);
  if ("error" in gate) return fail(gate.error, gate.status);
  const db = await getDb();
  const rows = await db
    .select()
    .from(s.parcels)
    .orderBy(sql`${s.parcels.createdAt} DESC`)
    .limit(60);
  return ok({
    parcels: rows.map((p) => ({
      id: p.id, ref: p.ref, token: p.trackingToken, status: p.status,
      city: p.city, quote: p.quote, pickupArea: p.pickupArea, dropoffArea: p.dropoffArea,
      contents: p.contents, recipientName: p.recipientName, riderId: p.riderId,
      createdAt: p.createdAt,
    })),
  });
}
