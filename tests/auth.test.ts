import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { expiryDate, generateCode, hashCode, isExpired, verifyCode } from "../lib/otp";
import { hashPassword, passwordMeetsPolicy, verifyPassword } from "../lib/password";

describe("one-time passcodes", () => {
  it("generates 6-digit numeric codes", () => {
    for (let i = 0; i < 20; i++) {
      const c = generateCode();
      assert.match(c, /^\d{6}$/);
    }
  });
  it("verifies a code against its hash and rejects anything else", () => {
    const h = hashCode("482910");
    assert.equal(verifyCode("482910", h), true);
    assert.equal(verifyCode("482911", h), false);
    assert.equal(verifyCode("48291", h), false);
    assert.equal(verifyCode("abcdef", h), false);
    assert.equal(verifyCode("", h), false);
  });
  it("expires codes after the TTL", () => {
    const exp = expiryDate(1_000_000);
    assert.equal(isExpired(exp, 1_000_000 + 5_000), false);
    assert.equal(isExpired(exp, 1_000_000 + 11 * 60_000), true);
  });
});

describe("staff passwords", () => {
  it("hashes and verifies with scrypt", async () => {
    const h = await hashPassword("correct-horse-99");
    assert.match(h, /^scrypt\$v1\$/);
    assert.equal(await verifyPassword("correct-horse-99", h), true);
    assert.equal(await verifyPassword("correct-horse-98", h), false);
    assert.equal(await verifyPassword("anything", "not-a-hash"), false);
  });
  it("salts identical passwords differently", async () => {
    const a = await hashPassword("same-password-1");
    const b = await hashPassword("same-password-1");
    assert.notEqual(a, b);
  });
  it("enforces a 10+ character policy", () => {
    assert.equal(passwordMeetsPolicy("short-123"), false);
    assert.equal(passwordMeetsPolicy("long-enough-1"), true);
  });
});
