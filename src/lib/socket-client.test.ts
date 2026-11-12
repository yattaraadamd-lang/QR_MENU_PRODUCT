import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createConnectGate } from "./socket-client";

const GRACE_MS = 2000;

/** Elle ilerletilen saat */
function clock(start = 1_000_000) {
  let current = start;
  return { now: () => current, advance: (ms: number) => (current += ms) };
}

describe("soket bağlantısında yenileme kapısı", () => {
  test("sayfa açılırken kurulan ilk bağlantı yenilemez; sonraki her bağlantı yeniler", () => {
    const time = clock();
    const refreshOnConnect = createConnectGate(false, GRACE_MS, time.now);
    time.advance(50);
    assert.equal(refreshOnConnect(), false, "ilk bağlantı");
    time.advance(60_000);
    assert.equal(refreshOnConnect(), true, "kopup yeniden bağlanma");
    assert.equal(refreshOnConnect(), true, "bir sonraki yeniden bağlanma");
  });

  test("bağlantı zaten varken abone olunduysa her bağlantı yeniden bağlanmadır", () => {
    const time = clock();
    const refreshOnConnect = createConnectGate(true, GRACE_MS, time.now);
    time.advance(50);
    assert.equal(refreshOnConnect(), true);
  });

  test("ilk bağlantı geç kurulursa (hata, yeniden deneme) yeniler: arada olay kaçmış olabilir", () => {
    const time = clock();
    const refreshOnConnect = createConnectGate(false, GRACE_MS, time.now);
    time.advance(GRACE_MS);
    assert.equal(refreshOnConnect(), true);
  });
});
