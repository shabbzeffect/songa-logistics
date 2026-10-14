import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { z } from "zod";
import * as s from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { fail, ok, rateLimit } from "@/lib/api";
import { normalizeKEPhone } from "@/lib/phone";
import { verifyPassword } from "@/lib/password";
import { actorLabel, staffSession } from "@/lib/staff";
import { setSession } from "@/lib/auth";

const staffSchema = z.object({
  phone: z.string().trim().min(9),
  password: z.string().min(1).max(200),
});

const GENERIC = "Check your phone number and password.";

/** Staff sign-in (ops + merchant) with a scrypt-hashed password. */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  if (!rateLimit(`staff-login:${ip}`, 10)) return fail("Too many attempts. Wait a minute and retry.", 429);
  const body = await req.json().catch(() => null);
  const parsed = staffSchema.safeParse(body);
  if (!parsed.success) return fail(GENERIC, 401);
  const phone = normalizeKEPhone(parsed.data.phone);
  if (!phone) return fail(GENERIC, 401);

  const db = await getDb();
  const rows = await db
    .select()
    .from(s.users)
    .where(
      and(eq(s.users.phone, phone), inArray(s.users.role, ["ops", "merchant"]), isNotNull(s.users.passwordHash)),
    );
  const user = rows[0];
  if (!user?.passwordHash) return fail(GENERIC, 401);
  if (!(await verifyPassword(parsed.data.password, user.passwordHash))) return fail(GENERIC, 401);

  if (user.role === "merchant") {
    if (!user.merchantId) return fail(GENERIC, 401);
    await setSession({ role: "merchant", actorId: user.merchantId, name: user.name, phone });
  } else {
    await setSession({ role: "ops", actorId: user.id, name: user.name, phone });
  }
  const gate = await staffSession(["ops", "merchant"]);
  await db.insert(s.auditEvents).values({
    kind: "staff.login", entityId: user.id, detail: { role: user.role },
    actor: "error" in gate ? "staff" : actorLabel(gate.session),
  });
  return ok({ role: user.role });
}
