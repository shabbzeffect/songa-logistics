import { getSession, type Role, type Session } from "@/lib/auth";

export async function staffSession(roles: Role[]): Promise<{ session: Session } | { error: string; status: number }> {
  const session = await getSession();
  if (!roles.includes(session.role))
    return { error: "Sign in with a staff account to continue.", status: 403 };
  return { session };
}

export function actorLabel(session: Session): string {
  return `${session.role}:${(session.actorId ?? session.name ?? "staff").slice(0, 12)}`;
}
