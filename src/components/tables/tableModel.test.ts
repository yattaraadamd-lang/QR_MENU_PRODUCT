import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { countPendingActions, hasUnpaidBill, TABLE_STATUS, tableStatusMeta } from "./tableModel";
import type { TableBillDTO, TableDTO, TableStatus } from "./types";

const table = (overrides: Partial<TableDTO> = {}): TableDTO => ({
  id: "t1",
  tableNumber: "4",
  tableName: null,
  status: "OCCUPIED",
  activeSession: null,
  bill: null,
  orders: [],
  serviceRequests: [],
  ...overrides,
});

const bill = (remainingAmount: string): TableBillDTO => ({
  id: "b1",
  totalAmount: "100.00",
  paidAmount: "0.00",
  remainingAmount,
  paymentStatus: "UNPAID",
});

describe("tableStatusMeta", () => {
  test("bilinen durumun etiketi", () => {
    assert.equal(tableStatusMeta("PAYMENT_REQUESTED").label, "Ödeme İsteniyor");
  });

  test("bilinmeyen durum Boş gibi gösterilir", () => {
    assert.deepEqual(tableStatusMeta("SOMETHING_NEW" as TableStatus), TABLE_STATUS.EMPTY);
  });
});

describe("countPendingActions", () => {
  test("bekleyen sipariş, bekleyen talep ve ödeme isteği toplanır", () => {
    const busy = table({
      status: "PAYMENT_REQUESTED",
      orders: [
        { id: "o1", status: "PENDING" },
        { id: "o2", status: "SERVED" },
        { id: "o3", status: "PENDING" },
      ],
      serviceRequests: [
        { id: "r1", status: "PENDING", requestType: "CALL_WAITER" },
        { id: "r2", status: "COMPLETED", requestType: "HELP_REQUEST" },
      ],
    });
    assert.equal(countPendingActions(busy), 4);
  });

  test("boş masada sıfır", () => {
    assert.equal(countPendingActions(table()), 0);
  });
});

describe("hasUnpaidBill", () => {
  test("kalan tutar sıfırdan büyükse ödenmemiş adisyon var", () => {
    assert.equal(hasUnpaidBill(table({ bill: bill("25.50") })), true);
    assert.equal(hasUnpaidBill(table({ bill: bill("0.00") })), false);
    assert.equal(hasUnpaidBill(table()), false);
  });
});
