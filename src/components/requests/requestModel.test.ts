import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { isExpired, isOpenRequest, nextRequestStep, REQUEST_STATUS, requestStatusMeta, requestTypeMeta } from "./requestModel";
import type { RequestStatus, ServiceRequestDTO } from "./types";

const NOW = Date.parse("2026-11-08T12:00:00Z");

const request = (overrides: Partial<ServiceRequestDTO> = {}): ServiceRequestDTO => ({
  id: "r1",
  tableId: "t1",
  table: { tableNumber: "4", tableName: null },
  requestType: "ORDER_REQUEST",
  status: "PENDING",
  note: null,
  createdAt: "2026-11-08T11:55:00Z",
  expiresAt: null,
  orderPreview: null,
  ...overrides,
});

describe("requestTypeMeta", () => {
  test("bilinen tür", () => {
    assert.equal(requestTypeMeta("CALL_WAITER").label, "Garson Çağrısı");
  });

  test("bilinmeyen tür adıyla gösterilir", () => {
    assert.deepEqual(requestTypeMeta("NEW_TYPE"), { label: "NEW_TYPE", icon: "📌", tone: "neutral" });
  });
});

describe("requestStatusMeta", () => {
  test("bilinmeyen durum Bekliyor gibi gösterilir", () => {
    assert.deepEqual(requestStatusMeta("ARCHIVED" as RequestStatus), REQUEST_STATUS.PENDING);
  });
});

describe("isExpired", () => {
  test("süresiz talep dolmaz", () => {
    assert.equal(isExpired(request(), NOW), false);
  });

  test("süresi geçen dolar, gelecekteki dolmaz", () => {
    assert.equal(isExpired(request({ expiresAt: "2026-11-08T11:59:59Z" }), NOW), true);
    assert.equal(isExpired(request({ expiresAt: "2026-11-08T12:00:01Z" }), NOW), false);
  });
});

describe("isOpenRequest", () => {
  test("bekleyen, görülen ve işlemdeki açık; tamamlanan ve iptal kapalı", () => {
    const open: readonly RequestStatus[] = ["PENDING", "SEEN", "IN_PROGRESS"];
    const closed: readonly RequestStatus[] = ["COMPLETED", "CANCELLED"];
    for (const status of open) assert.equal(isOpenRequest(request({ status })), true, status);
    for (const status of closed) assert.equal(isOpenRequest(request({ status })), false, status);
  });
});

describe("nextRequestStep", () => {
  test("bekleyen işleme alınır, görülen ve işlemdeki tamamlanır", () => {
    assert.deepEqual(nextRequestStep("PENDING"), { next: "IN_PROGRESS", label: "▶ İşleme Al" });
    assert.equal(nextRequestStep("SEEN")?.next, "COMPLETED");
    assert.equal(nextRequestStep("IN_PROGRESS")?.next, "COMPLETED");
  });

  test("kapanmış talebin adımı yok", () => {
    assert.equal(nextRequestStep("COMPLETED"), null);
    assert.equal(nextRequestStep("CANCELLED"), null);
  });
});
