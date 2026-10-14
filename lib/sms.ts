/**
 * SMS sending via Africa's Talking (https://africastalking.com).
 *
 * Gated: until SMS_ENABLED=true with SMS_API_KEY + SMS_USERNAME, nothing is sent
 * and routes treat notifications as skipped (logged, never fatal).
 *
 * Env:
 *   SMS_ENABLED=true, SMS_API_KEY=<live|sor sandbox key>, SMS_USERNAME=<username|"sandbox">,
 *   SMS_SENDER=<sender ID or short code — required on live, optional in sandbox>
 */

interface SmsConfig {
  apiKey: string;
  username: string;
  sender: string;
}

export function smsConfig(): SmsConfig | null {
  const { SMS_ENABLED, SMS_API_KEY, SMS_USERNAME, SMS_SENDER } = process.env;
  if (SMS_ENABLED !== "true" || !SMS_API_KEY || !SMS_USERNAME) return null;
  return { apiKey: SMS_API_KEY, username: SMS_USERNAME, sender: SMS_SENDER || "SONGA" };
}

export function smsConfigured(): boolean {
  return smsConfig() !== null;
}

/** Africa's Talking wants international format without the +: 2547XXXXXXXX. */
export function toProviderPhone(e164: string): string | null {
  const msisdn = e164.replace("+", "");
  return /^254[17]\d{8}$/.test(msisdn) ? msisdn : null;
}

export type SmsResult = { ok: true; providerRef: string } | { ok: false; error: string };

export async function sendSms(toE164: string, message: string): Promise<SmsResult> {
  const cfg = smsConfig();
  if (!cfg) return { ok: false, error: "SMS is not configured yet." };
  const to = toProviderPhone(toE164);
  if (!to || !message.trim()) return { ok: false, error: "Bad recipient or empty message." };
  try {
    const form = new URLSearchParams({ username: cfg.username, to, message: message.slice(0, 480), from: cfg.sender });
    const r = await fetch("https://api.africastalking.com/version1/messaging", {
      method: "POST",
      headers: {
        apiKey: cfg.apiKey,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
      signal: AbortSignal.timeout(15_000),
    });
    const j = (await r.json().catch(() => null)) as {
      SMSMessageData?: { Recipients?: { status?: string; messageId?: string; cost?: string }[] };
    } | null;
    const first = j?.SMSMessageData?.Recipients?.[0];
    if (r.ok && first?.status === "Success") {
      return { ok: true, providerRef: first.messageId ?? "" };
    }
    console.error("SMS provider rejected", { status: r.status, body: j });
    return { ok: false, error: "SMS provider rejected the message." };
  } catch (e) {
    console.error("SMS send failed", e);
    return { ok: false, error: "SMS send failed." };
  }
}
