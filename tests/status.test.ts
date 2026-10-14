import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canTransitionOrder, canTransitionParcel, orderStatusLabel, parcelStatusLabel,
} from "../lib/status";

describe("order state machine", () => {
  it("walks the happy path", () => {
    const path = ["placed", "accepted", "preparing", "ready", "picked_up", "on_the_way", "delivered"] as const;
    for (let i = 0; i < path.length - 1; i++) {
      assert.equal(canTransitionOrder(path[i], path[i + 1]), true, `${path[i]} → ${path[i + 1]}`);
    }
  });
  it("rejects jumps and backward moves", () => {
    assert.equal(canTransitionOrder("placed", "delivered"), false);
    assert.equal(canTransitionOrder("preparing", "accepted"), false);
    assert.equal(canTransitionOrder("delivered", "cancelled"), false);
    assert.equal(canTransitionOrder("cancelled", "placed"), false);
  });
  it("allows cancellation only before dispatch", () => {
    for (const s of ["placed", "accepted", "preparing", "ready"] as const)
      assert.equal(canTransitionOrder(s, "cancelled"), true);
    for (const s of ["picked_up", "on_the_way", "delivered"] as const)
      assert.equal(canTransitionOrder(s, "cancelled"), false);
  });
  it("labels every status", () => {
    for (const s of ["placed", "accepted", "preparing", "ready", "picked_up", "on_the_way", "delivered", "cancelled"] as const)
      assert.ok(orderStatusLabel(s).length > 2);
  });
});

describe("parcel state machine", () => {
  it("requires pickup confirmation before dispatch", () => {
    assert.equal(canTransitionParcel("requested", "assigned"), false);
    assert.equal(canTransitionParcel("requested", "confirmed"), true);
    assert.equal(canTransitionParcel("confirmed", "assigned"), true);
    assert.equal(canTransitionParcel("picked_up", "delivered"), false);
    assert.equal(canTransitionParcel("in_transit", "delivered"), true);
  });
  it("labels every status", () => {
    for (const s of ["requested", "confirmed", "assigned", "picked_up", "in_transit", "delivered", "cancelled"] as const)
      assert.ok(parcelStatusLabel(s).length > 2);
  });
});
