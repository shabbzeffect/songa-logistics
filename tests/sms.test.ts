import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { smsConfigured, toProviderPhone } from "../lib/sms";
import { orderCustomerMessage, parcelMessage, riderJobMessage } from "../lib/notify";
import { notifyOrder } from "../lib/notify";

describe("SMS addressing", () => {
  it("converts +254 numbers to provider format and rejects the rest", () => {
    assert.equal(toProviderPhone("+254712345678"), "254712345678");
    assert.equal(toProviderPhone("+254112345678"), "254112345678");
    assert.equal(toProviderPhone("0712345678"), null);
    assert.equal(toProviderPhone("+255712345678"), null);
  });
  it("stays unconfigured without credentials", () => {
    assert.equal(smsConfigured(), false);
  });
});

describe("order messages", () => {
  const base = { ref: "SG-ABC123", merchant: "Mama Kitchen", total: 1200 };
  it("covers the notified statuses", () => {
    assert.ok(orderCustomerMessage({ ...base, to: "placed" })?.includes("SG-ABC123"));
    assert.ok(orderCustomerMessage({ ...base, to: "accepted" })?.includes("accepted"));
    const way = orderCustomerMessage({ ...base, to: "on_the_way", riderName: "Brian" });
    assert.ok(way?.includes("Brian"));
    assert.ok(orderCustomerMessage({ ...base, to: "delivered" })?.includes("delivered"));
    const cx = orderCustomerMessage({ ...base, to: "cancelled", note: "Shop closed" });
    assert.ok(cx?.includes("Shop closed"));
  });
  it("stays quiet on intermediate kitchen steps", () => {
    for (const to of ["preparing", "ready", "picked_up", "confirmed"]) {
      assert.equal(orderCustomerMessage({ ...base, to }), null);
    }
  });
});

describe("parcel + rider messages", () => {
  it("texts the sender on request/cancel and the recipient on the way", () => {
    const args = { ref: "PC-XYZ", to: "requested", pickupArea: "Kilimani", dropoffArea: "Westlands", recipientName: "B", forRecipient: false };
    assert.ok(parcelMessage(args)?.includes("Kilimani"));
    assert.equal(parcelMessage({ ...args, to: "in_transit" }), null);
    const recip = parcelMessage({ ...args, to: "in_transit", forRecipient: true });
    assert.ok(recip?.includes("Westlands"));
    assert.ok(parcelMessage({ ...args, to: "delivered", forRecipient: true })?.includes("delivered"));
  });
  it("alerts riders with pickup and drop-off", () => {
    const m = riderJobMessage({ ref: "SG-1", kind: "order", pickup: "Mama Kitchen", dropoff: "Kilimani" });
    assert.ok(m.includes("Mama Kitchen") && m.includes("Kilimani"));
  });
});

describe("dispatch without a provider", () => {
  it("skips silently and never throws", async () => {
    await notifyOrder({
      phone: "+254712345678", ref: "SG-TEST", merchant: "Test", total: 100,
      orderId: "test-id", to: "accepted",
    });
  });
});
