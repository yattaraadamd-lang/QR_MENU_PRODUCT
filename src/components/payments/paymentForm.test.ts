import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { formatTRY } from "@/lib/format";
import {
  paymentSuccessMessage,
  summarizePayment,
  toAmountInputValue,
  toPaymentPayload,
  validatePayment,
  type PaymentFormValues,
} from "./paymentForm";

const form = (overrides: Partial<PaymentFormValues> = {}): PaymentFormValues => ({
  amount: "100",
  method: "CASH",
  received: "100",
  note: "",
  ...overrides,
});

describe("validatePayment", () => {
  test("geçersiz tutarı reddeder", () => {
    for (const amount of ["", "0", "-5", "abc"]) {
      assert.equal(validatePayment(form({ amount })), "Geçerli bir ödeme tutarı girin.", amount);
    }
  });

  test("kalan borcu aşan tahsilatı reddeder, tam kalanı kabul eder", () => {
    assert.equal(
      validatePayment(form({ amount: "150", received: "200" }), { maxAmount: 120 }),
      "Ödenen tutar kalan tutardan büyük olamaz.",
    );
    assert.equal(validatePayment(form({ amount: "120", received: "120" }), { maxAmount: 120 }), null);
  });

  test("kartta alınan nakit sorulmaz", () => {
    assert.equal(validatePayment(form({ method: "CARD", received: "" })), null);
  });

  test("nakitte alınan tutar zorunlu ve ödemeden az olamaz", () => {
    assert.equal(validatePayment(form({ received: "" })), "Müşteriden alınan nakit tutarını girin.");
    assert.equal(
      validatePayment(form({ amount: "100", received: "80" })),
      `Alınan nakit (${formatTRY(80)}) ödeme tutarından (${formatTRY(100)}) az olamaz.`,
    );
    assert.equal(validatePayment(form({ amount: "100", received: "150" })), null);
  });
});

describe("summarizePayment", () => {
  test("nakitte para üstünü hesaplar", () => {
    assert.deepEqual(summarizePayment(form({ amount: "85.5", received: "100" })), { due: 85.5, received: 100, change: 14.5 });
  });

  test("kartta alınan nakit sayılmaz; boş tutar sıfırdır", () => {
    assert.deepEqual(summarizePayment(form({ method: "CARD", amount: "40", received: "100" })), {
      due: 40,
      received: 0,
      change: -40,
    });
    assert.deepEqual(summarizePayment(form({ amount: "", received: "" })), { due: 0, received: 0, change: 0 });
  });
});

describe("toPaymentPayload", () => {
  test("nakitte alınan tutarı gönderir, notu kırpar", () => {
    assert.deepEqual(toPaymentPayload(form({ amount: "100", received: "150", note: "  masa 4  " })), {
      amount: 100,
      method: "CASH",
      receivedAmount: 150,
      note: "masa 4",
    });
  });

  test("kartta alınan tutar ve boş not null", () => {
    assert.deepEqual(toPaymentPayload(form({ method: "CARD", note: "   " })), {
      amount: 100,
      method: "CARD",
      receivedAmount: null,
      note: null,
    });
  });
});

describe("paymentSuccessMessage", () => {
  test("para üstü yalnız nakitte ve sıfırdan büyükse eklenir", () => {
    assert.equal(paymentSuccessMessage("Ödeme alındı.", "CASH", "10.5"), `Ödeme alındı. Para üstü: ${formatTRY(10.5)}`);
    assert.equal(paymentSuccessMessage("Ödeme alındı.", "CASH", 0), "Ödeme alındı.");
    assert.equal(paymentSuccessMessage("Ödeme alındı.", "CARD", 10), "Ödeme alındı.");
    assert.equal(paymentSuccessMessage("Ödeme alındı.", null, null), "Ödeme alındı.");
  });
});

describe("toAmountInputValue", () => {
  test("sayı alanı için iki ondalık; geçersizde boş", () => {
    assert.equal(toAmountInputValue(12.5), "12.50");
    assert.equal(toAmountInputValue("7"), "7.00");
    assert.equal(toAmountInputValue("abc"), "");
  });
});
