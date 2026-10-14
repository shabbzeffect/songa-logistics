import * as s from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { fail, ok, rateLimit } from "@/lib/api";
import { leadSchema } from "@/lib/validation";
import { normalizeKEPhone } from "@/lib/phone";

export async function POST(req: Request) {
  if (!rateLimit("leads", 10)) return fail("Too many requests.", 429);
  const body = await req.json().catch(() => null);
  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) return fail("Please check the form", 400);
  const phone = normalizeKEPhone(parsed.data.phone);
  if (!phone) return fail("Enter a valid Kenyan mobile number.", 400);
  const db = await getDb();
  const [lead] = await db
    .insert(s.leads)
    .values({ ...parsed.data, phone, message: parsed.data.message ?? "" })
    .returning({ id: s.leads.id });
  await db.insert(s.auditEvents).values({
    kind: "lead.created", entityId: lead.id, detail: { kind: parsed.data.kind }, actor: "public",
  });
  return ok({ id: lead.id }, 201);
}
