import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import * as schema from "../drizzle/schema";

const globalForDb = globalThis as unknown as { __songaDb?: ReturnType<typeof createDb> };

async function createDb() {
  const dir = join(process.cwd(), "data", "pgdata");
  mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  await client.waitReady;
  // NOTE: no explicit type arguments here — they collapse drizzle's
  // inferred row types (see drizzle-orm/pglite overloads).
  const db = drizzle(client, { schema });

  // Lightweight migration check: does the merchants table exist?
  const marker = join(process.cwd(), "data", ".migrated_0001");
  const check = await client.query(
    "SELECT 1 FROM information_schema.tables WHERE table_name='merchants' LIMIT 1",
  );
  if (check.rows.length === 0 || !existsSync(marker)) {
    const sql = readFileSync(join(process.cwd(), "drizzle", "0001_init.sql"), "utf8");
    // PGlite exec handles multi-statement scripts
    await client.exec(sql);
    const { seedDatabase } = await import("./seed");
    await seedDatabase(db);
    try {
      const { writeFileSync } = await import("node:fs");
      writeFileSync(marker, new Date().toISOString());
    } catch {
      /* marker is best-effort */
    }
  }
  // Incremental migration 0002: reviews table (idempotent — covers fresh + existing DBs).
  const marker2 = join(process.cwd(), "data", ".migrated_0002");
  const checkReviews = await client.query(
    "SELECT 1 FROM information_schema.tables WHERE table_name='reviews' LIMIT 1",
  );
  if (checkReviews.rows.length === 0 || !existsSync(marker2)) {
    const sql2 = readFileSync(join(process.cwd(), "drizzle", "0002_reviews.sql"), "utf8");
    await client.exec(sql2);
    try {
      const { writeFileSync } = await import("node:fs");
      writeFileSync(marker2, new Date().toISOString());
    } catch {
      /* marker is best-effort */
    }
  }
  // Incremental migration 0003: consolidate shop categories (idempotent).
  const marker3 = join(process.cwd(), "data", ".migrated_0003");
  const checkCats = await client.query(
    "SELECT 1 FROM merchants WHERE category IN ('care','retail','flowers') LIMIT 1",
  );
  if (checkCats.rows.length > 0 || !existsSync(marker3)) {
    const sql3 = readFileSync(join(process.cwd(), "drizzle", "0003_categories.sql"), "utf8");
    await client.exec(sql3);
    try {
      const { writeFileSync } = await import("node:fs");
      writeFileSync(marker3, new Date().toISOString());
    } catch {
      /* marker is best-effort */
    }
  }
  return db;
}

export type Db = Awaited<ReturnType<typeof createDb>>;

export function getDb(): ReturnType<typeof createDb> {
  if (!globalForDb.__songaDb) globalForDb.__songaDb = createDb();
  return globalForDb.__songaDb;
}
