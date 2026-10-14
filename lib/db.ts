import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import * as schema from "../drizzle/schema";

// Single static type for all call sites. Both drivers run the same schema through
// the same drizzle query API, so the hosted client is cast once here — this keeps
// full row-type inference everywhere else (a union would collapse it).
export type Db = PgliteDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __songaDb?: Promise<Db> };

/** Minimal raw-client surface shared by PGlite and node-postgres. */
interface RawClient {
  query(sql: string): Promise<{ rows: Array<Record<string, unknown>> }>;
  execScript(sql: string): Promise<void>;
}

const MIGRATIONS: { version: string; file: string }[] = [
  { version: "0001", file: "0001_init.sql" },
  { version: "0002", file: "0002_reviews.sql" },
  { version: "0003", file: "0003_categories.sql" },
];

async function migrate(raw: RawClient): Promise<void> {
  await raw.execScript(
    `CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
  );
  const done = await raw.query(`SELECT version FROM schema_migrations`);
  const applied = new Set(done.rows.map((r) => String(r.version)));
  for (const m of MIGRATIONS) {
    if (applied.has(m.version)) continue;
    // All migration scripts are idempotent (IF NOT EXISTS / conditional writes),
    // so recording them late on existing databases is safe.
    const sql = readFileSync(join(process.cwd(), "drizzle", m.file), "utf8");
    await raw.execScript(sql);
    await raw.query(`INSERT INTO schema_migrations (version) VALUES ('${m.version}') ON CONFLICT DO NOTHING`);
  }
}

async function createDb(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    // Hosted Postgres (Neon / Supabase / RDS / local docker). Uses a small pool;
    // on serverless prefer your provider's pooled connection string (PgBouncer).
    const local = /localhost|127\.0\.0\.1/.test(url);
    const pool = new Pool({
      connectionString: url,
      max: 5,
      ssl: local ? undefined : { rejectUnauthorized: false },
    });
    const raw: RawClient = {
      // node-postgres runs multi-statement scripts as a simple query.
      query: (sql) => pool.query(sql).then((r) => ({ rows: r.rows })),
      execScript: (sql) => pool.query(sql).then(() => undefined),
    };
    const db = drizzleNodePg(pool, { schema }) as unknown as Db;
    await migrate(raw);
    // Never auto-seed fictional demo data in production — real partners onboard via HQ.
    if (process.env.NODE_ENV !== "production") {
      const { seedDatabase } = await import("./seed");
      await seedDatabase(db);
    }
    return db;
  }

  // Local dev default: embedded PGlite (real Postgres engine, data in data/pgdata).
  if (process.env.VERCEL === "1") {
    throw new Error(
      "DATABASE_URL is not set. PGlite has no persistent disk on serverless — set DATABASE_URL to your hosted Postgres (see README: Deploying).",
    );
  }
  const dir = join(process.cwd(), "data", "pgdata");
  mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  await client.waitReady;
  // NOTE: no explicit type arguments here — they collapse drizzle's
  // inferred row types (see drizzle-orm/pglite overloads).
  const db = drizzlePglite(client, { schema });
  const raw: RawClient = {
    query: (sql) => client.query(sql).then((r) => ({ rows: r.rows as Array<Record<string, unknown>> })),
    execScript: (sql) => client.exec(sql).then(() => undefined),
  };
  await migrate(raw);
  // Never auto-seed fictional demo data in production — real partners onboard via HQ.
  if (process.env.NODE_ENV !== "production") {
    const { seedDatabase } = await import("./seed");
    await seedDatabase(db);
  }
  return db;
}

export function getDb(): Promise<Db> {
  if (!globalForDb.__songaDb) globalForDb.__songaDb = createDb();
  return globalForDb.__songaDb;
}
