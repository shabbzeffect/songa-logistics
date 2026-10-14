import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  darajaTimestamp,
  parseCallbackMetadata,
  resultLabel,
  stkPassword,
  toDarajaPhone,
} from "../lib/mpesa";

describe("Daraja helpers", () => {
  it("formats EAT wall time as YYYYMMDDHHmmss", () => {
    // 2026-01-01T00:00:00Z is 03:00 in Africa/Nairobi.
    assert.equal(darajaTimestamp(new Date("2026-01-01T00:00:00Z")), "20260101030000");
    assert.match(darajaTimestamp(), /^\d{14}$/);
  });
  it("builds the STK password as base64(shortcode+passkey+timestamp)", () => {
    // Decodes to 174379 + bfb279f9…2c919 + 20160216165627 — order matters to Daraja.
    assert.equal(
      stkPassword(
        "174379",
        "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919",
        "20160216165627",
      ),
      "MTc0Mzc5YmZiMjc5ZjlhYTliZGJjZjE1OGU5N2RkNzFhNDY3Y2QyZTBjODkzMDU5YjEwZjc4ZTZiNzJhZGExZWQyYzkxOTIwMTYwMjE2MTY1NjI3",
    );
  });
  it("accepts +254 numbers for PartyA and rejects the rest", () => {
    assert.equal(toDarajaPhone("+254712345678"), "254712345678");
    assert.equal(toDarajaPhone("+254112345678"), "254112345678");
    assert.equal(toDarajaPhone("0712345678"), null);
    assert.equal(toDarajaPhone("+255712345678"), null);
    assert.equal(toDarajaPhone("not-a-number"), null);
  });
  it("labels common ResultCodes", () => {
    assert.equal(resultLabel(0), "Paid");
    assert.equal(resultLabel(1032), "Cancelled on the phone");
    assert.equal(resultLabel(9999), "Payment did not complete");
  });
  it("reads amount + receipt from callback metadata", () => {
    const { amount, receipt } = parseCallbackMetadata([
      { Name: "Amount", Value: 1200 },
      { Name: "MpesaReceiptNumber", Value: "RCB123ABCD" },
      { Name: "PhoneNumber", Value: 254712345678 },
    ]);
    assert.equal(amount, 1200);
    assert.equal(receipt, "RCB123ABCD");
    assert.deepEqual(parseCallbackMetadata(undefined), { amount: null, receipt: "" });
  });
});
