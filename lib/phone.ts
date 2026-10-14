/** Kenyan phone normalisation: accepts 07.., 01.., +254.., 254... → +254.........
 * Returns null when the number cannot be a valid KE mobile number. */

const MOBILE_RE = /^(?:\+?254|0)([17]\d{8})$/;

export function normalizeKEPhone(input: string): string | null {
  if (!input) return null;
  const digits = input.replace(/[\s\-().]/g, "");
  const m = digits.match(MOBILE_RE);
  if (!m) return null;
  return `+254${m[1]}`;
}

export function isValidKEPhone(input: string): boolean {
  return normalizeKEPhone(input) !== null;
}

export function maskPhone(e164: string): string {
  // +2547XXXXXX12 → +254 7** *** *12
  if (e164.length < 6) return "***";
  return `${e164.slice(0, 5)} *** *** ${e164.slice(-2)}`;
}
