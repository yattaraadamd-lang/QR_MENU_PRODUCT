import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { ORDER_LIMITS } from "../../contracts/orders";
import { CANCEL_NOTE_MAX, CANCEL_REASONS, toCancelPayload, validateCancel } from "./cancelOrder";

describe("iptal/red nedeni", () => {
  test("en uzun açıklamayla da giden metin sunucu sınırını aşmaz", () => {
    const note = "a".repeat(CANCEL_NOTE_MAX);
    for (const { value } of CANCEL_REASONS) {
      const { cancelReason } = toCancelPayload({ reason: value, note, outOfStockIds: ["p1"] });
      assert.ok(cancelReason.length <= ORDER_LIMITS.cancelReason, `${value}: ${cancelReason.length}`);
    }
  });

  test("metin: Diğer'de açıklamanın kendisi, diğerlerinde etiket ve açıklama", () => {
    assert.equal(toCancelPayload({ reason: "OTHER", note: "  Mutfak kapandı ", outOfStockIds: [] }).cancelReason, "Mutfak kapandı");
    assert.equal(toCancelPayload({ reason: "WRONG_ORDER", note: "", outOfStockIds: [] }).cancelReason, "Yanlış sipariş");
    assert.equal(
      toCancelPayload({ reason: "WRONG_ORDER", note: "Masa 4'ündü", outOfStockIds: [] }).cancelReason,
      "Yanlış sipariş: Masa 4'ündü",
    );
  });

  test("stok dışı ürünler yalnız o nedende gönderilir", () => {
    assert.deepEqual(toCancelPayload({ reason: "OUT_OF_STOCK", note: "", outOfStockIds: ["p1"] }).outOfStockProductIds, ["p1"]);
    assert.equal(toCancelPayload({ reason: "OTHER", note: "x", outOfStockIds: ["p1"] }).outOfStockProductIds, null);
  });

  test("doğrulama: neden, stok dışı ürün ve Diğer açıklaması", () => {
    assert.equal(validateCancel({ reason: null, note: "", outOfStockIds: [] }), "Lütfen bir neden seçin.");
    assert.equal(
      validateCancel({ reason: "OUT_OF_STOCK", note: "", outOfStockIds: [] }),
      "Lütfen en az bir stok dışı kalacak ürün seçin.",
    );
    assert.equal(validateCancel({ reason: "OTHER", note: "   ", outOfStockIds: [] }), "Lütfen iptal nedeni açıklamasını yazın.");
    assert.equal(validateCancel({ reason: "CUSTOMER_CANCELLED", note: "", outOfStockIds: [] }), null);
  });
});
