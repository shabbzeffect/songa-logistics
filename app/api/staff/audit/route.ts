import { desc, eq } from "drizzle-orm";
import * as s from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { staffSession } from "@/lib/staff";

/** Ops audit trail viewer — most recent money/status changes first. */
export async function GET(req: Request) {
  const gate = await staffSession(["ops"]);
  if ("error" in gate) return fail(gate.error, gate.status);
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") ?? "";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 200);
  const db = await getDb();
  const rows = kind
    ? await db.select().from(s.auditEvents).where(eq(s.auditEvents.kind, kind)).orderBy(desc(s.auditEvents.createdAt)).limit(limit)
    : await db.select().from(s.auditEvents).orderBy(desc(s.auditEvents.createdAt)).limit(limit);
  // Distinct kinds for the filter dropdown (cheap: scan recent 500).
  const recent = await db.select({ kind: s.auditEvents.kind }).from(s.auditEvents).orderBy(desc(s.auditEvents.createdAt)).limit(500);
  const kinds = [...new Set(recent.map((r) => r.kind))].sort();
  return ok({
    events: rows.map((e) => ({
      id: e.id, kind: e.kind, entityId: e.entityId, detail: e.detail, actor: e.actor, at: e.createdAt,
    })),
    kinds,
  });
}
