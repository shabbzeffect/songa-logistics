"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Field, SectionTitle, inputCls } from "@/components/ui";

const DEMO_LOGIN = process.env.NODE_ENV !== "production";

export default function LoginPage() {
  const router = useRouter();
  const [session, setSession] = useState<{ role: string; name?: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth").then((r) => r.json()).then((j) => {
      if (j.ok && j.data.session.role !== "customer") setSession(j.data.session);
    });
  }, []);

  async function signOut() {
    await fetch("/api/auth", { method: "DELETE" });
    setSession(null);
  }

  async function refresh(to: string) {
    const r = await fetch("/api/auth");
    const j = await r.json();
    if (j.ok && j.data.session.role !== "customer") {
      setSession(j.data.session);
      router.push(to);
    }
  }

  if (session) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <SectionTitle title="Sign in" sub="You are signed in" />
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
          <p className="font-bold">Signed in as {session.name ?? session.role}</p>
          <button onClick={signOut} className="mt-3 rounded-xl border border-stone-300 px-5 py-2 font-bold">Sign out</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <SectionTitle title="Sign in" sub="One account for riders, customers and staff" />
      <OtpCard onDone={(role) => refresh(role === "courier" ? "/courier" : "/orders")} />
      <StaffCard onDone={(role) => refresh(role === "merchant" ? "/merchant" : "/hq")} />
      {DEMO_LOGIN && <DemoCard />}
      <p className="text-xs text-stone-500">
        Riders and customers sign in with a 6-digit code texted to their phone. Staff use a
        password set up by an administrator. Codes expire after 10 minutes and each code works once.
      </p>
    </div>
  );
}

function OtpCard({ onDone }: { onDone: (role: string) => void }) {
  const [phone, setPhone] = useState("");
  const [purpose, setPurpose] = useState<"login_rider" | "login_customer">("login_rider");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function request() {
    setMsg("");
    setBusy(true);
    try {
      const r = await fetch("/api/auth/otp/request", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, purpose }),
      });
      const j = await r.json();
      if (!j.ok) { setMsg(j.error ?? "Couldn't send a code."); return; }
      setStep("code");
      setMsg(j.data.sent ? "Code sent — check your SMS." : "Demo mode: use the code shown in the server log.");
    } catch {
      setMsg("Network hiccup — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setBusy(true);
    try {
      const r = await fetch("/api/auth/otp/verify", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, code, purpose }),
      });
      const j = await r.json();
      if (!j.ok) { setMsg(j.error ?? "That code didn't work."); return; }
      const me = await fetch("/api/auth").then((x) => x.json());
      onDone(me.ok ? me.data.session.role : "customer");
    } catch {
      setMsg("Network hiccup — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl bg-white p-6 shadow-sm" aria-label="Sign in with phone code">
      <h2 className="font-display font-extrabold text-forest-950">Riders & customers</h2>
      <Field label="I am a…">
        <select value={purpose} onChange={(e) => { setPurpose(e.target.value as typeof purpose); setStep("phone"); setCode(""); }} className={inputCls}>
          <option value="login_rider">Rider (delivery partner)</option>
          <option value="login_customer">Customer (order history on any device)</option>
        </select>
      </Field>
      {step === "code" ? (
        <form onSubmit={verify} className="space-y-3" aria-label="Enter verification code">
          <Field label="6-digit code" hint={`Sent to ${phone} · expires after 10 minutes`}>
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} required inputMode="numeric" placeholder="••••••" className={inputCls} />
          </Field>
          <button disabled={busy} className="w-full rounded-xl bg-forest-900 py-3 font-black text-white disabled:opacity-50">
            {busy ? "Checking…" : "Verify & sign in"}
          </button>
          <button type="button" onClick={() => setStep("phone")} className="w-full text-sm font-bold text-stone-500">
            Use a different number
          </button>
        </form>
      ) : (
        <form
          onSubmit={(e) => { e.preventDefault(); request(); }}
          className="space-y-3"
          aria-label="Request verification code"
        >
          <Field label="Phone number" hint="The number Songa has on file for you">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="0712 345 678" inputMode="tel" className={inputCls} />
          </Field>
          <button disabled={busy} className="w-full rounded-xl bg-forest-900 py-3 font-black text-white disabled:opacity-50">
            {busy ? "Sending…" : "Text me a code"}
          </button>
        </form>
      )}
      {msg && <p className="text-sm font-semibold" role="status">{msg}</p>}
    </div>
  );
}

function StaffCard({ onDone }: { onDone: (role: string) => void }) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setBusy(true);
    try {
      const r = await fetch("/api/auth/staff", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });
      const j = await r.json();
      if (!j.ok) { setMsg(j.error ?? "Couldn't sign in."); return; }
      onDone(j.data.role);
    } catch {
      setMsg("Network hiccup — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl bg-white p-6 shadow-sm" aria-label="Staff sign in">
      <h2 className="font-display font-extrabold text-forest-950">Staff — ops & merchants</h2>
      <Field label="Phone number"><input value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="0712 345 678" inputMode="tel" className={inputCls} /></Field>
      <Field label="Password"><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" className={inputCls} /></Field>
      {msg && <p className="text-sm font-semibold text-red-700" role="alert">{msg}</p>}
      <button disabled={busy} className="w-full rounded-xl bg-coral-500 py-3 font-black text-white disabled:opacity-50">
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

function DemoCard() {
  const [role, setRole] = useState<"ops" | "merchant" | "courier">("ops");
  const [actorId, setActorId] = useState("");
  const [merchants, setMerchants] = useState<{ id: string; name: string; city: string }[]>([]);
  const [riders, setRiders] = useState<{ id: string; name: string; city: string }[]>([]);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth").then((r) => r.json()).then((j) => {
      if (j.ok) { setMerchants(j.data.merchants); setRiders(j.data.riders); }
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
    router.push(role === "ops" ? "/hq" : role === "merchant" ? "/merchant" : "/courier");
  }

  return (
    <div className="space-y-3 rounded-2xl border border-dashed border-forest-700/40 bg-white/70 p-6">
      <h2 className="font-display font-extrabold text-forest-950">Demo shortcut</h2>
      <p className="text-xs text-stone-500">Local development only — this panel never appears in production builds.</p>
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
    </div>
  );
}
