import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calcTotals, formatKES, percentOff, serviceFeeFor, toKES } from "../lib/money";

describe("KES money math (integers only)", () => {
  it("formats en-KE groupings", () => {
    assert.equal(formatKES(1500), "KSh 1,500");
    assert.equal(formatKES(1500, { code: true }), "KES 1,500");
  });
  it("rounds and clamps inputs", () => {
    assert.equal(toKES("12.6"), 13);
    assert.equal(toKES(-5), 0);
    assert.equal(toKES("abc"), 0);
  });
  it("percentOff respects caps", () => {
    assert.equal(percentOff(1000, 10), 100);
    assert.equal(percentOff(5000, 10, 300), 300);
    assert.equal(percentOff(0, 10), 0);
  });
  it("service fee is 5% capped at 250", () => {
    assert.equal(serviceFeeFor(1000), 50);
    assert.equal(serviceFeeFor(10000), 250);
    assert.equal(serviceFeeFor(0), 0);
  });
  it("checkout totals add up with free-delivery threshold", () => {
    const t = calcTotals({
      lines: [{ unitPrice: 380, qty: 2, modifierDelta: 50 }],
      discount: 100,
      deliveryFee: 120,
      tip: 50,
      freeDeliveryOver: 1500,
    });
    // subtotal 860, discount 100 → 760 < 1500 so fee applies; service 5% of 760 = 38
    assert.equal(t.subtotal, 860);
    assert.equal(t.deliveryFee, 120);
    assert.equal(t.serviceFee, 38);
    assert.equal(t.total, 860 - 100 + 120 + 38 + 50);
  });
  it("free delivery kicks in over the threshold", () => {
    const t = calcTotals({
      lines: [{ unitPrice: 1000, qty: 2, modifierDelta: 0 }],
      deliveryFee: 150,
      freeDeliveryOver: 1500,
    });
    assert.equal(t.deliveryFee, 0);
    assert.equal(t.total, 2000 + 100); // service 5% of 2000 = 100
  });
  it("discount can never exceed subtotal", () => {
    const t = calcTotals({ lines: [{ unitPrice: 200, qty: 1, modifierDelta: 0 }], discount: 999 });
    assert.equal(t.discount, 200);
    assert.equal(t.total, t.deliveryFee + t.serviceFee);
  });
});
