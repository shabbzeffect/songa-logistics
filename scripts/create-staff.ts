/**
 * Create (or reset) a staff login. Run with server env loaded:
 *   npx tsx scripts/create-staff.ts --role ops --name "HQ Admin" --phone 0712345678 --password 'long-secret-here'
 *   npx tsx scripts/create-staff.ts --role merchant --merchant-id <uuid> --name "Shop Owner" --phone 0712... --password ...
 * Passwords need 10+ characters and are scrypt-hashed — never stored or logged in plain text.
 * Works against DATABASE_URL when set, otherwise the local embedded DB.
 */
import { normalizeKEPhone } from "../lib/phone";
import { hashPassword, passwordMeetsPolicy } from "../lib/password";
import { getDb } from "../lib/db";
import * as s from "../drizzle/schema";
import { and, eq } from "drizzle-orm";

function arg(name: string): string | undefined {
  const ix = process.argv.indexOf(`--${name}`);
  return ix >= 0 ? process.argv[ix + 1] : undefined;
}

async function main() {
  const role = arg("role");
  const name = arg("name");
  const phoneRaw = arg("phone");
  const password = arg("password");
  const merchantId = arg("merchant-id");
  if (role !== "ops" && role !== "merchant") throw new Error("--role must be ops or merchant");
  if (!name || name.trim().length < 2) throw new Error("--name (2+ chars) is required");
  const phone = phoneRaw ? normalizeKEPhone(phoneRaw) : null;
  if (!phone) throw new Error("--phone must be a valid Kenyan mobile number, e.g. 0712345678");
  if (!password || !passwordMeetsPolicy(password)) throw new Error("--password needs 10+ characters");
  if (role === "merchant" && !merchantId) throw new Error("--merchant-id is required for merchant staff");

  const db = await getDb();
  if (role === "merchant") {
    const m = await db.select().from(s.merchants).where(eq(s.merchants.id, merchantId!));
    if (!m[0]) throw new Error("No shop with that --merchant-id");
  }
  const passwordHash = await hashPassword(password);
  const existing = await db
    .select()
    .from(s.users)
    .where(and(eq(s.users.phone, phone), eq(s.users.role, role)));
  if (existing[0]) {
    await db
      .update(s.users)
      .set({ name: name.trim(), passwordHash, merchantId: role === "merchant" ? merchantId! : null })
      .where(eq(s.users.id, existing[0].id));
    console.log(`Updated ${role} login for ${name} (${phone})`);
  } else {
    const [row] = await db
      .insert(s.users)
      .values({ name: name.trim(), phone, role, passwordHash, merchantId: role === "merchant" ? merchantId! : null })
      .returning({ id: s.users.id });
    console.log(`Created ${role} login for ${name} (${phone}) — id ${row.id}`);
  }
}

main().then(
  () => process.exit(0),
  (e) => { console.error("FAILED:", e instanceof Error ? e.message : e); process.exit(1); },
);
