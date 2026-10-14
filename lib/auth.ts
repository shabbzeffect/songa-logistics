import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export type Role = "ops" | "merchant" | "courier" | "customer";
export interface Session {
  role: Role;
  actorId?: string;
  name?: string;
}

const COOKIE = "songa_session";

function secret(): string {
  return process.env.SESSION_SECRET ?? "songa-demo-secret-change-me";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export async function getSession(): Promise<Session> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return { role: "customer" };
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return { role: "customer" };
  const expected = sign(payload);
  try {
    if (
      payload.length !== Buffer.from(expected).length ||
      sig.length !== expected.length ||
      !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    )
      return { role: "customer" };
  } catch {
    return { role: "customer" };
  }
  try {
    const s = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Session;
    if (!["ops", "merchant", "courier", "customer"].includes(s.role)) return { role: "customer" };
    return s;
  } catch {
    return { role: "customer" };
  }
}

export async function setSession(s: Session): Promise<void> {
  const payload = Buffer.from(JSON.stringify(s)).toString("base64url");
  const jar = await cookies();
  jar.set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export function requireRole(s: Session, roles: Role[]): boolean {
  return roles.includes(s.role);
}
