/**
 * M-Pesa Daraja integration (STK push / C2B).
 *
 * Gated behind real credentials: until MPESA_ENABLED=true with all fields,
 * STK push is unavailable and checkout offers cash / M-Pesa on delivery only.
 * This module never claims success from a button click: payment intents stay
 * `pending` until a verified callback (or a query) confirms them.
 *
 * Env:
 *   MPESA_ENABLED=true, MPESA_ENV=sandbox|production (default sandbox)
 *   MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE, MPESA_PASSKEY,
 *   MPESA_CALLBACK_URL, MPESA_TRANSACTION_TYPE (default CustomerPayBillOnline)
 */

interface MpesaConfig {
  baseUrl: string;
  consumerKey: string;
  consumerSecret: string;
  shortcode: string;
  passkey: string;
  transactionType: string;
  callbackUrl: string;
}

export function mpesaConfig(): MpesaConfig | null {
  const {
    MPESA_ENABLED,
    MPESA_ENV,
    MPESA_CONSUMER_KEY,
    MPESA_CONSUMER_SECRET,
    MPESA_SHORTCODE,
    MPESA_PASSKEY,
    MPESA_CALLBACK_URL,
    MPESA_TRANSACTION_TYPE,
  } = process.env;
  if (
    MPESA_ENABLED !== "true" ||
    !MPESA_CONSUMER_KEY ||
    !MPESA_CONSUMER_SECRET ||
    !MPESA_SHORTCODE ||
    !MPESA_PASSKEY ||
    !MPESA_CALLBACK_URL
  ) {
    return null;
  }
  return {
    baseUrl:
      MPESA_ENV === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke",
    consumerKey: MPESA_CONSUMER_KEY,
    consumerSecret: MPESA_CONSUMER_SECRET,
    shortcode: MPESA_SHORTCODE,
    passkey: MPESA_PASSKEY,
    transactionType: MPESA_TRANSACTION_TYPE || "CustomerPayBillOnline",
    callbackUrl: MPESA_CALLBACK_URL,
  };
}

export function mpesaConfigured(): boolean {
  return mpesaConfig() !== null;
}

/** Daraja timestamps are Africa/Nairobi wall time: YYYYMMDDHHmmss. */
export function darajaTimestamp(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}${get("month")}${get("day")}${get("hour")}${get("minute")}${get("second")}`;
}

/** base64(shortcode + passkey + timestamp) for STK push/query auth. */
export function stkPassword(shortcode: string, passkey: string, timestamp: string): string {
  return Buffer.from(`${shortcode}${passkey}${timestamp}`, "utf8").toString("base64");
}

/** +2547XXXXXXXX → 2547XXXXXXXX (PartyA/PhoneNumber format). Null when invalid. */
export function toDarajaPhone(e164: string): string | null {
  const msisdn = e164.replace("+", "");
  return /^254[17]\d{8}$/.test(msisdn) ? msisdn : null;
}

export function toMsisdn(e164: string): string {
  return e164.replace("+", "");
}

/** Human-readable labels for common Daraja ResultCodes. */
export function resultLabel(code: number): string {
  switch (code) {
    case 0: return "Paid";
    case 1: return "Insufficient balance";
    case 1032: return "Cancelled on the phone";
    case 1037: return "The request timed out";
    case 2001: return "Wrong M-Pesa PIN";
    case 1019: return "Transaction expired";
    default: return "Payment did not complete";
  }
}

// Short-lived OAuth token cache (per process).
let cachedToken: { token: string; exp: number } | null = null;

async function accessToken(cfg: MpesaConfig): Promise<string> {
  if (cachedToken && cachedToken.exp > Date.now()) return cachedToken.token;
  const basic = Buffer.from(`${cfg.consumerKey}:${cfg.consumerSecret}`, "utf8").toString("base64");
  const r = await fetch(`${cfg.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${basic}` },
    signal: AbortSignal.timeout(15_000),
  });
  const j = (await r.json().catch(() => null)) as { access_token?: string; expires_in?: string } | null;
  if (!r.ok || !j?.access_token) throw new Error(`Daraja auth failed (HTTP ${r.status}).`);
  cachedToken = { token: j.access_token, exp: Date.now() + (Number(j.expires_in || 3600) - 60) * 1000 };
  return cachedToken.token;
}

export interface StkRequest {
  orderRef: string;
  phoneE164: string; // +254...
  amount: number; // KES integer
}

export type StkResult =
  | { ok: true; checkoutRequestId: string; customerMessage: string }
  | { ok: false; error: string };

/** Send the M-Pesa prompt. Returns the CheckoutRequestID to persist on the intent. */
export async function initiateStkPush(req: StkRequest): Promise<StkResult> {
  const cfg = mpesaConfig();
  if (!cfg) {
    return {
      ok: false,
      error:
        "Online M-Pesa is not configured yet. Choose Cash on delivery or M-Pesa on delivery — you'll pay the rider when your order arrives.",
    };
  }
  const party = toDarajaPhone(req.phoneE164);
  if (!party || !Number.isInteger(req.amount) || req.amount < 1) {
    return { ok: false, error: "Check the phone number and amount, then retry." };
  }
  try {
    const token = await accessToken(cfg);
    const timestamp = darajaTimestamp();
    const r = await fetch(`${cfg.baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        BusinessShortCode: cfg.shortcode,
        Password: stkPassword(cfg.shortcode, cfg.passkey, timestamp),
        Timestamp: timestamp,
        TransactionType: cfg.transactionType,
        Amount: req.amount,
        PartyA: party,
        PartyB: cfg.shortcode,
        PhoneNumber: party,
        CallBackURL: cfg.callbackUrl,
        AccountReference: req.orderRef.slice(0, 20),
        TransactionDesc: `Songa ${req.orderRef}`.slice(0, 20),
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const j = (await r.json().catch(() => null)) as {
      ResponseCode?: string; ResponseDescription?: string; errorMessage?: string;
      CheckoutRequestID?: string; CustomerMessage?: string;
    } | null;
    if (r.ok && j?.ResponseCode === "0" && j.CheckoutRequestID) {
      return { ok: true, checkoutRequestId: j.CheckoutRequestID, customerMessage: j.CustomerMessage ?? "" };
    }
    console.error("STK push rejected", { status: r.status, body: j });
    return { ok: false, error: "M-Pesa didn't send the prompt. Please retry or pay on delivery." };
  } catch (e) {
    console.error("STK push failed", e);
    return { ok: false, error: "M-Pesa didn't send the prompt. Please retry or pay on delivery." };
  }
}

export type StkQueryResult =
  | { ok: true; resultCode: number; resultDesc: string }
  | { ok: false; error: string };

/** Ask Daraja for the current state of a pushed prompt (ResultCode 0 = paid). */
export async function queryStkPush(checkoutRequestId: string): Promise<StkQueryResult> {
  const cfg = mpesaConfig();
  if (!cfg) return { ok: false, error: "Online M-Pesa is not configured yet." };
  try {
    const token = await accessToken(cfg);
    const timestamp = darajaTimestamp();
    const r = await fetch(`${cfg.baseUrl}/mpesa/stkpushquery/v1/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        BusinessShortCode: cfg.shortcode,
        Password: stkPassword(cfg.shortcode, cfg.passkey, timestamp),
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const j = (await r.json().catch(() => null)) as { ResultCode?: string; ResultDesc?: string } | null;
    if (j?.ResultCode == null) return { ok: false, error: "M-Pesa didn't answer. Try again." };
    return { ok: true, resultCode: Number(j.ResultCode), resultDesc: j.ResultDesc ?? "" };
  } catch (e) {
    console.error("STK query failed", e);
    return { ok: false, error: "M-Pesa didn't answer. Try again." };
  }
}

/** Extract { amount, receipt } from a callback's CallbackMetadata items. */
export function parseCallbackMetadata(items: { Name?: string; Value?: string | number }[] | undefined): {
  amount: number | null; receipt: string;
} {
  let amount: number | null = null;
  let receipt = "";
  for (const it of items ?? []) {
    if (it.Name === "Amount" && typeof it.Value === "number") amount = Math.round(it.Value);
    if (it.Name === "MpesaReceiptNumber" && it.Value != null) receipt = String(it.Value);
  }
  return { amount, receipt };
}
