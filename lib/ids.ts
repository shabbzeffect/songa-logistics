import { randomBytes } from "node:crypto";

const REF_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function newOrderRef(): string {
  const b = randomBytes(6);
  let s = "";
  for (const byte of b) s += REF_ALPHABET[byte % REF_ALPHABET.length];
  return `SG-${s}`;
}

export function newParcelRef(): string {
  const b = randomBytes(6);
  let s = "";
  for (const byte of b) s += REF_ALPHABET[byte % REF_ALPHABET.length];
  return `PC-${s}`;
}

/** High-entropy tracking token (URL-safe). */
export function newTrackingToken(): string {
  return randomBytes(24).toString("base64url");
}

export function newIdempotencyKey(): string {
  return randomBytes(16).toString("hex");
}
