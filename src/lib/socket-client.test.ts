import { afterEach, beforeEach, describe, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createConnectGate, createPollingFallback, stopAllPolling } from "./socket-client";

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

describe("bağlantı yokken abonelik başına yedek yoklama", () => {
  const INTERVAL_MS = 5000;
  beforeEach(() => mock.timers.enable({ apis: ["setInterval"] }));
  afterEach(() => {
    stopAllPolling();
    mock.timers.reset();
  });

  /** Çağrı sayacı */
  function counter() {
    const calls = { count: 0 };
    return { calls, refresh: () => void calls.count++ };
  }

  test("başlayınca hemen, sonra her aralıkta bir kez yoklar; durunca biter", () => {
    const { calls, refresh } = counter();
    const polling = createPollingFallback(refresh, INTERVAL_MS);
    polling.start();
    assert.equal(calls.count, 1, "hemen");
    mock.timers.tick(INTERVAL_MS * 2);
    assert.equal(calls.count, 3, "iki aralık sonra");
    polling.stop();
    mock.timers.tick(INTERVAL_MS * 3);
    assert.equal(calls.count, 3, "durduktan sonra");
  });

  test("iki abonelik birbirini ezmeden yoklanır (eskiden yalnız sonuncusu)", () => {
    const tables = counter();
    const orders = counter();
    createPollingFallback(tables.refresh, INTERVAL_MS).start();
    createPollingFallback(orders.refresh, INTERVAL_MS).start();
    mock.timers.tick(INTERVAL_MS);
    assert.equal(tables.calls.count, 2);
    assert.equal(orders.calls.count, 2);
  });

  test("zaten yoklarken yeniden başlatmak ikinci zamanlayıcı kurmaz", () => {
    const { calls, refresh } = counter();
    const polling = createPollingFallback(refresh, INTERVAL_MS);
    polling.start();
    polling.start();
    mock.timers.tick(INTERVAL_MS);
    assert.equal(calls.count, 2);
  });

  test("oturum kapanınca bütün yoklamalar durur", () => {
    const first = counter();
    const second = counter();
    createPollingFallback(first.refresh, INTERVAL_MS).start();
    createPollingFallback(second.refresh, INTERVAL_MS).start();
    stopAllPolling();
    mock.timers.tick(INTERVAL_MS * 2);
    assert.equal(first.calls.count + second.calls.count, 2, "yalnız başlangıçtaki çağrılar");
  });
});
