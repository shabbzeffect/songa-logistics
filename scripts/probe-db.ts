import { getDb } from "../lib/db";
import * as s from "../drizzle/schema";

async function main() {
  try {
    const db = await getDb();
    const rows = await db.select().from(s.merchants);
    console.log("MERCHANTS:", rows.length, rows[0]?.name);
  } catch (e) {
    console.error("DB FAILED:", (e as Error).message);
    console.error((e as Error).stack?.split("\n").slice(0, 8).join("\n"));
    process.exit(1);
  }
}

main();
