import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { initialSession, sessionReducer, type SessionEvent, type SessionState } from "./sessionMachine";

/** Bugünkü useCustomerSession davranışının geçiş tablosu (FE-ARCH-2.4) */

const run = (events: readonly SessionEvent[], from: SessionState = initialSession) => events.reduce(sessionReducer, from);

const pending: SessionState = { ...initialSession, token: "tok", status: "PENDING", verificationCode: "482193", hydrated: true };

describe("oturumun kurulması", () => {
  test("başlangıçta görüntüleme yetkisi, buton kapalı", () => {
    assert.deepEqual(initialSession, {
      token: null,
      status: "VIEW_ONLY",
      verificationCode: null,
      blockedMsg: null,
      demoAutoApprove: false,
      hydrated: false,
    });
  });

  test("benimsenen token engeli kaldırır, sunucu durumunu alır ve butonu açar", () => {
    const state = run([{ type: "hint", message: "eski engel" }, { type: "established", token: "tok", status: "AUTHORIZED" }]);
    assert.equal(state.token, "tok");
    assert.equal(state.status, "AUTHORIZED");
    assert.equal(state.blockedMsg, null);
    assert.equal(state.hydrated, true);
  });

  test("durum gelmezse mevcut durum korunur", () => {
    assert.equal(run([{ type: "established", token: "tok" }]).status, "VIEW_ONLY");
  });

  test("bekleyen sipariş talebi varsa sunucu durumu ne olursa olsun PENDING", () => {
    assert.equal(run([{ type: "established", token: "tok", status: "VIEW_ONLY", pendingRequest: true }]).status, "PENDING");
  });

  test("ağ hatasında kayıtlı token korunur, engel metni değişmez", () => {
    const state = run([{ type: "hint", message: "ipucu" }, { type: "offline", token: "kayitli" }]);
    assert.equal(state.token, "kayitli");
    assert.equal(state.blockedMsg, "ipucu");
    assert.equal(state.hydrated, true);
  });

  test("engel nedeni gösterilir ve buton durumu öğrenilmiş sayılır; ipucu butonu açmaz", () => {
    assert.equal(run([{ type: "hint", message: "ipucu" }]).hydrated, false);
    const blocked = run([{ type: "blocked", message: "QR okutun" }]);
    assert.equal(blocked.blockedMsg, "QR okutun");
    assert.equal(blocked.hydrated, true);
  });

  test("iptal edilen oturum REVOKED, doğrulama kodu dokunulmaz", () => {
    const state = run([{ type: "revoked" }], pending);
    assert.equal(state.status, "REVOKED");
    assert.equal(state.verificationCode, "482193");
  });
});

describe("garson onayı beklerken (PENDING yoklaması)", () => {
  test("onaylanınca AUTHORIZED ve kod temizlenir", () => {
    const state = run([{ type: "pendingResolved", status: "AUTHORIZED" }], pending);
    assert.equal(state.status, "AUTHORIZED");
    assert.equal(state.verificationCode, null);
  });

  test("talebin süresi dolunca VIEW_ONLY, kod ve demo geri sayımı temizlenir", () => {
    const state = run([{ type: "demoCountdown" }, { type: "pendingResolved", status: "VIEW_ONLY" }], pending);
    assert.equal(state.status, "VIEW_ONLY");
    assert.equal(state.verificationCode, null);
    assert.equal(state.demoAutoApprove, false);
  });

  test("reddedilince REVOKED, kod ekranda kalır", () => {
    const state = run([{ type: "pendingResolved", status: "REVOKED" }], pending);
    assert.equal(state.status, "REVOKED");
    assert.equal(state.verificationCode, "482193");
  });

  test("artık PENDING değilse yoklama sonucu yok sayılır", () => {
    const authorized: SessionState = { ...pending, status: "AUTHORIZED", verificationCode: null };
    assert.equal(sessionReducer(authorized, { type: "pendingResolved", status: "VIEW_ONLY" }), authorized);
  });

  test("demo geri sayımı bir kez işaretlenir", () => {
    const counting = run([{ type: "demoCountdown" }], pending);
    assert.equal(counting.demoAutoApprove, true);
    assert.equal(sessionReducer(counting, { type: "demoCountdown" }), counting);
  });
});

describe("odak senkronu ve eylemler", () => {
  test("durum değiştiyse uygulanır; AUTHORIZED kodu temizler", () => {
    const state = run([{ type: "synced", status: "AUTHORIZED" }], pending);
    assert.equal(state.status, "AUTHORIZED");
    assert.equal(state.verificationCode, null);
  });

  test("aynı durum senkronu durumu değiştirmez", () => {
    assert.equal(sessionReducer(pending, { type: "synced", status: "PENDING" }), pending);
  });

  test("sipariş talebi gidince PENDING ve kod gelir", () => {
    const state = run([{ type: "status", status: "PENDING" }, { type: "verificationCode", code: "713004" }], {
      ...initialSession,
      token: "tok",
      hydrated: true,
    });
    assert.equal(state.status, "PENDING");
    assert.equal(state.verificationCode, "713004");
  });

  test("masa başka cihazdaysa TABLE_ALREADY_CLAIMED", () => {
    assert.equal(run([{ type: "status", status: "TABLE_ALREADY_CLAIMED" }]).status, "TABLE_ALREADY_CLAIMED");
  });
});
