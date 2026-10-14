import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

async function main() {
  const client = new PGlite();
  await client.waitReady;
  const sql = readFileSync("drizzle/0001_init.sql", "utf8");
  try {
    await client.exec(sql);
    console.log("MIGRATION OK");
    const r = await client.query("SELECT count(*) FROM merchants");
    console.log("merchants:", JSON.stringify(r.rows));
  } catch (e) {
    console.error("MIGRATION FAILED:", (e as Error).message);
    process.exit(1);
  }
}

main();
