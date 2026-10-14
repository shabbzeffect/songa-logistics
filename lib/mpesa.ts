/**
 * M-Pesa Daraja integration — gated behind real credentials.
 *
 * Until MPESA_* env vars are configured AND MPESA_ENABLED=true, STK push is
 * unavailable and checkout must use cash_on_delivery / mpesa_on_delivery.
 * This module never claims success from a button click: payment intents stay
 * `pending` until a verified callback arrives.
 */

export function mpesaConfigured(): boolean {
  return (
    process.env.MPESA_ENABLED === "true" &&
    !!process.env.MPESA_CONSUMER_KEY &&
    !!process.env.MPESA_CONSUMER_SECRET &&
    !!process.env.MPESA_SHORTCODE &&
    !!process.env.MPESA_PASSKEY
  );
}

export interface StkRequest {
  orderRef: string;
  phoneE164: string; // +254...
  amount: number; // KES integer
}

export async function initiateStkPush(_req: StkRequest): Promise<{ ok: false; error: string }> {
  // Real implementation lives here once credentials exist:
  // 1. OAuth token via consumer key/secret (server-side only)
  // 2. STK push with timestamp+password (shortcode+passkey+timestamp, base64)
  // 3. Persist CheckoutRequestID, return pending — callback completes it
  // 4. Callback route verifies source, updates intent idempotently, logs audit
  if (!mpesaConfigured()) {
    return {
      ok: false,
      error:
        "Online M-Pesa is not configured yet. Choose Cash on delivery or M-Pesa on delivery — you'll pay the rider when your order arrives.",
    };
  }
  return { ok: false, error: "STK push failed to initiate. Please retry or pay on delivery." };
}

export function toMsisdn(e164: string): string {
  return e164.replace("+", "");
}
