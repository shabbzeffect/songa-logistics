import { createHash, randomInt, timingSafeEqual } from "node:crypto";

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const OTP_MAX_ATTEMPTS = 5;

/** Six-digit numeric code. Always transmitted to the user, never stored. */
export function generateCode(): string {
  return String(randomInt(100000, 1_000_000));
}

/** SHA-256 hex of a code — this is what the database holds. */
export function hashCode(code: string): string {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

/** Constant-time comparison of a candidate code against a stored hash. */
export function verifyCode(candidate: string, codeHash: string): boolean {
  if (!/^\d{6}$/.test(candidate)) return false;
  const a = hashCode(candidate);
  if (a.length !== codeHash.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(codeHash, "hex"));
  } catch {
    return false;
  }
}

export function expiryDate(now = Date.now()): Date {
  return new Date(now + OTP_TTL_MS);
}

export function isExpired(expiresAt: Date | string, now = Date.now()): boolean {
  return new Date(expiresAt).getTime() <= now;
}
