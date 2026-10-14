import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PROHIBITED_ITEMS, quoteParcel } from "../lib/parcels";

describe("parcel quotes (estimates)", () => {
  it("grows with size and weight", () => {
    const a = quoteParcel("nairobi", "small", 1);
    const b = quoteParcel("nairobi", "large", 10);
    assert.ok(b > a);
    assert.equal(quoteParcel("nairobi", "small", 1), 150 + 40 * 1);
  });
  it("clamps weight to 0.5–20kg", () => {
    assert.equal(quoteParcel("nairobi", "small", 0.01), quoteParcel("nairobi", "small", 0.5));
    assert.equal(quoteParcel("nairobi", "small", 99), quoteParcel("nairobi", "small", 20));
  });
  it("always returns integer KES", () => {
    assert.equal(Number.isInteger(quoteParcel("kisumu", "medium", 2.3)), true);
  });
  it("publishes a prohibited-items list", () => {
    assert.ok(PROHIBITED_ITEMS.length >= 5);
  });
});
