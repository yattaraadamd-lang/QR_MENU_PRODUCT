import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { ApiResult } from "../lib/api-client";
import { pickFieldErrors, readFieldErrors } from "./useFieldErrors";

const failed = (body: Record<string, unknown> | null): ApiResult<unknown> => ({
  ok: false,
  error: "Geçersiz alan: name. Bu alan gerekli.",
  status: 400,
  body,
  aborted: false,
});

describe("pickFieldErrors", () => {
  const FIELDS = ["name", "icon"] as const;

  test("formun gösterebildiği alanların hatalarını verir", () => {
    const result = failed({ fieldErrors: { name: "Bu alan gerekli.", sortOrder: "Geçersiz değer." } });
    assert.deepEqual(pickFieldErrors(result, FIELDS), { name: "Bu alan gerekli." });
  });

  test("hata yalnız formda olmayan alandaysa boştur: form özet mesajı gösterir", () => {
    assert.deepEqual(pickFieldErrors(failed({ fieldErrors: { sortOrder: "Geçersiz değer." } }), FIELDS), {});
    assert.deepEqual(pickFieldErrors(failed({ fieldErrors: { toString: "x" } }), ["name"]), {});
  });

  test("nesnenin kalıtsal özellikleri alan hatası sayılmaz", () => {
    assert.deepEqual(pickFieldErrors(failed({ fieldErrors: { name: "Bu alan gerekli." } }), ["toString", "constructor"]), {});
  });
});

describe("readFieldErrors", () => {
  test("hata yanıtındaki alan → mesaj eşlemesini verir", () => {
    const body = { error: "x", code: "VALIDATION_ERROR", fieldErrors: { name: "Bu alan gerekli.", email: "Geçerli bir e-posta adresi girin." } };
    assert.deepEqual(readFieldErrors(failed(body)), body.fieldErrors);
  });

  test("başarılı yanıtta ve alan hatası olmayan hatada boştur", () => {
    assert.deepEqual(readFieldErrors({ ok: true, data: {}, headers: new Headers() }), {});
    assert.deepEqual(readFieldErrors(failed({ error: "Masa bulunamadı" })), {});
    assert.deepEqual(readFieldErrors(failed(null)), {});
  });

  test("beklenmeyen biçim güvenle yok sayılır", () => {
    assert.deepEqual(readFieldErrors(failed({ fieldErrors: "name" })), {});
    assert.deepEqual(readFieldErrors(failed({ fieldErrors: ["name"] })), {});
    assert.deepEqual(readFieldErrors(failed({ fieldErrors: { name: "Bu alan gerekli.", price: 12, note: null } })), {
      name: "Bu alan gerekli.",
    });
  });
});
