import { beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { blockedHint, qrProof, tableTokenStore, takeFreshScan } from "./sessionTokenStore";

/** Node'da tarayıcı deposu yok: testler bellek içi Storage ile çalışır */
class MemoryStorage implements Storage {
  private readonly items = new Map<string, string>();
  get length() {
    return this.items.size;
  }
  clear() {
    this.items.clear();
  }
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  key(index: number) {
    return [...this.items.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
}

const local = new MemoryStorage();
const session = new MemoryStorage();
Object.assign(globalThis, { localStorage: local, sessionStorage: session });

const TABLE_KEY = "qr_session_biz_t1";

beforeEach(() => {
  local.clear();
  session.clear();
});

describe("tableTokenStore", () => {
  test("masa anahtarı önceliklidir, yoksa eski global anahtar okunur", () => {
    const store = tableTokenStore("biz", "t1");
    assert.equal(store.stored(), null);
    local.setItem("qr_session_token", "eski-yerel");
    assert.equal(store.stored(), "eski-yerel");
    session.setItem("qr_session_token", "eski-oturum");
    assert.equal(store.stored(), "eski-oturum");
    local.setItem(TABLE_KEY, "masa");
    assert.equal(store.stored(), "masa");
  });

  test("benimseme masa anahtarına yazar; eski anahtarları ve engel metnini temizler", () => {
    local.setItem("qr_session_token", "eski");
    session.setItem("qr_session_token", "eski");
    session.setItem("qr_order_blocked_msg", "engel");
    tableTokenStore("biz", "t1").adopt("yeni");
    assert.equal(local.getItem(TABLE_KEY), "yeni");
    assert.equal(local.getItem("qr_session_token"), null);
    assert.equal(session.getItem("qr_session_token"), null);
    assert.equal(blockedHint(), null);
  });

  test("unutma yalnız bu masanın token'ını siler", () => {
    local.setItem(TABLE_KEY, "masa");
    local.setItem("qr_session_biz_t2", "diger");
    tableTokenStore("biz", "t1").forget();
    assert.equal(local.getItem(TABLE_KEY), null);
    assert.equal(local.getItem("qr_session_biz_t2"), "diger");
  });
});

describe("QR kanıtı ve taze okutma", () => {
  test("QR kanıtı sessionStorage'dan okunur", () => {
    assert.equal(qrProof(), null);
    session.setItem("qr_token", "qr_abc");
    assert.equal(qrProof(), "qr_abc");
  });

  test("taze okutma işareti yalnız aynı masa için ve bir kez tüketilir", () => {
    session.setItem("qr_fresh_scan", "t1");
    assert.equal(takeFreshScan("t2"), false);
    assert.equal(takeFreshScan("t1"), true);
    assert.equal(takeFreshScan("t1"), false);
  });
});
