import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isValidKEPhone, maskPhone, normalizeKEPhone } from "../lib/phone";

describe("Kenyan phone normalisation", () => {
  it("accepts 07.., 01.. and +254..", () => {
    assert.equal(normalizeKEPhone("0712345678"), "+254712345678");
    assert.equal(normalizeKEPhone("0112345678"), "+254112345678");
    assert.equal(normalizeKEPhone("+254712345678"), "+254712345678");
    assert.equal(normalizeKEPhone("254712345678"), "+254712345678");
    assert.equal(normalizeKEPhone("0712 345 678"), "+254712345678");
    assert.equal(normalizeKEPhone("0712-345-678"), "+254712345678");
  });
  it("rejects short, long and foreign numbers", () => {
    assert.equal(normalizeKEPhone("07123"), null);
    assert.equal(normalizeKEPhone("072234567890"), null);
    assert.equal(normalizeKEPhone("+14155552671"), null);
    assert.equal(normalizeKEPhone(""), null);
    assert.equal(isValidKEPhone("not a number"), false);
  });
  it("masks stored numbers for display", () => {
    assert.ok(!maskPhone("+254712345678").includes("123456"));
  });
});
