import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { fail, ok } from "@/lib/api";

/** Liveness + database readiness for deploys, uptime monitors and load balancers. */
export async function GET() {
  try {
    const db = await getDb();
    await db.execute(sql`SELECT 1`);
    return ok({
      status: "ok",
      db: process.env.DATABASE_URL ? "hosted" : "embedded",
      time: new Date().toISOString(),
    });
  } catch {
    return fail("Database unreachable", 503);
  }
}
