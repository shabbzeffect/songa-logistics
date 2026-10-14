import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkoutSchema, nextRatingX10, parcelSchema, reviewSchema } from "../lib/validation";

const baseItem = { productId: "some-id", qty: 2, selections: {}, note: "" };

describe("checkout validation", () => {
  it("accepts a well-formed order", () => {
    const r = checkoutSchema.safeParse({
      merchantId: "m1", items: [baseItem], customerName: "Wanjiru Kamau",
      phone: "0712345678", city: "nairobi", area: "Kilimani",
      addressLine: "Rose Apartments B4", paymentMethod: "cash_on_delivery",
      idempotencyKey: "abcdefgh12345678",
    });
    assert.equal(r.success, true);
  });
  it("rejects bad phone, empty basket, unknown city", () => {
    const bad = checkoutSchema.safeParse({
      merchantId: "m1", items: [], customerName: "X",
      phone: "123", city: "eldoret", area: "K", addressLine: "12",
      paymentMethod: "cash_on_delivery", idempotencyKey: "short",
    });
    assert.equal(bad.success, false);
  });
});

describe("parcel validation", () => {
  it("requires the prohibited-items acknowledgement", () => {
    const r = parcelSchema.safeParse({
      senderName: "A", senderPhone: "0712345678", pickupArea: "Kilimani", pickupAddress: "Hse 1",
      recipientName: "B", recipientPhone: "0733445566", dropoffArea: "Westlands", dropoffAddress: "Hse 2",
      city: "nairobi", contents: "Docs", size: "small", weightKg: 1,
      prohibitedAck: false, idempotencyKey: "abcdefgh12345678",
    });
    assert.equal(r.success, false);
  });
});

describe("review validation", () => {
  it("accepts 1–5 stars with an optional comment", () => {
    assert.equal(reviewSchema.safeParse({ rating: 5, comment: "Great!" }).success, true);
    assert.equal(reviewSchema.safeParse({ rating: 1 }).success, true);
  });
  it("rejects out-of-range ratings and long comments", () => {
    assert.equal(reviewSchema.safeParse({ rating: 0 }).success, false);
    assert.equal(reviewSchema.safeParse({ rating: 6 }).success, false);
    assert.equal(reviewSchema.safeParse({ rating: 4, comment: "x".repeat(501) }).success, false);
  });
  it("blends a new rating into the x10 aggregate", () => {
    // Shop at 4.5 (45 x10) with 1 rating + a 5-star review → 48 x10, count 2.
    assert.deepEqual(nextRatingX10(45, 1, 5), { rating: 48, count: 2 });
    // First-ever review sets the rating directly.
    assert.deepEqual(nextRatingX10(45, 0, 3), { rating: 30, count: 1 });
  });
});
