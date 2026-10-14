/**
 * SMS sending — gated behind a real provider.
 *
 * Until SMS_* env vars are configured AND SMS_ENABLED=true, codes are NOT sent:
 * routes log the code server-side and (outside production) return it in the API
 * response so the flow is testable end to end. Wire a provider (Africa's Talking,
 * Twilio, …) here before public launch.
 */

export function smsConfigured(): boolean {
  return process.env.SMS_ENABLED === "true" && !!process.env.SMS_API_KEY && !!process.env.SMS_SENDER;
}

export async function sendSms(
  _toE164: string,
  _message: string,
): Promise<{ ok: true; providerRef: string } | { ok: false; error: string }> {
  // Real implementation lives here once credentials exist:
  // 1. POST to the provider with sender ID + API key (server-side only)
  // 2. Return the provider's message ID; the route stores it for audit
  if (!smsConfigured()) {
    return { ok: false, error: "SMS is not configured yet." };
  }
  return { ok: false, error: "SMS provider call failed. Please retry." };
}
