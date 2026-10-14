"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Field, SectionTitle, inputCls } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<"ops" | "merchant" | "courier">("ops");
  const [actorId, setActorId] = useState("");
  const [merchants, setMerchants] = useState<{ id: string; name: string; city: string }[]>([]);
  const [riders, setRiders] = useState<{ id: string; name: string; city: string }[]>([]);
  const [session, setSession] = useState<{ role: string; name?: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth").then((r) => r.json()).then((j) => {
      if (j.ok) {
        setMerchants(j.data.merchants);
        setRiders(j.data.riders);
        if (j.data.session.role !== "customer") setSession(j.data.session);
      }
    });
  }, []);

  async function signIn() {
    setError("");
    const r = await fetch("/api/auth", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ role, actorId: role === "ops" ? "ops" : actorId }),
    });
    const j = await r.json();
    if (!j.ok) { setError(j.error ?? "Couldn't sign in."); return; }
    const dest = role === "ops" ? "/hq" : role === "merchant" ? "/merchant" : "/courier";
    router.push(dest);
  }

  async function signOut() {
    await fetch("/api/auth", { method: "DELETE" });
    setSession(null);
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <SectionTitle title="Sign in" sub="Demo access — pick a workspace to explore" />
      {session ? (
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
          <p className="font-bold">Signed in as {session.name ?? session.role}</p>
          <button onClick={signOut} className="mt-3 rounded-xl border border-stone-300 px-5 py-2 font-bold">Sign out</button>
        </div>
      ) : (
        <div className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
          <Field label="Workspace">
            <select value={role} onChange={(e) => setRole(e.target.value as typeof role)} className={inputCls}>
              <option value="ops">Operations HQ</option>
              <option value="merchant">Merchant console</option>
              <option value="courier">Courier workspace</option>
            </select>
          </Field>
          {role === "merchant" && (
            <Field label="Your shop">
              <select value={actorId} onChange={(e) => setActorId(e.target.value)} className={inputCls}>
                <option value="">Choose…</option>
                {merchants.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.city})</option>)}
              </select>
            </Field>
          )}
          {role === "courier" && (
            <Field label="Your rider profile">
              <select value={actorId} onChange={(e) => setActorId(e.target.value)} className={inputCls}>
                <option value="">Choose…</option>
                {riders.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.city})</option>)}
              </select>
            </Field>
          )}
          {error && <p className="text-sm font-semibold text-red-700" role="alert">{error}</p>}
          <button onClick={signIn} className="w-full rounded-xl bg-forest-900 py-3 font-black text-white">Enter workspace</button>
          <p className="text-xs text-stone-500">Demo only: no passwords yet. Production will use staff SSO + rider phone OTP.</p>
        </div>
      )}
    </div>
  );
}
