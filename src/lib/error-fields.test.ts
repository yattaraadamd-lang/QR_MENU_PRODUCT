import assert from "node:assert/strict";
import { test } from "node:test";
import { errorFields, isUniqueViolationOn, prismaTarget } from "./error-fields";

/** Prisma'nın bilinen istek hatasının biçimi (sınıfı yüklemeden) */
function prismaError(code: string, target?: unknown) {
  return Object.assign(new Error(`Prisma ${code}`), { code, meta: target === undefined ? undefined : { target } });
}

test("errorFields: Error'ın alanlarını okur", () => {
  const error = new TypeError("bozuk");
  const fields = errorFields(error);
  assert.equal(fields.name, "TypeError");
  assert.equal(fields.message, "bozuk");
  assert.equal(typeof fields.stack, "string");
  assert.equal(fields.code, undefined);
});

test("errorFields: nesne olmayan değerde alanlar boş", () => {
  for (const value of [null, undefined, "metin", 42]) {
    const fields = errorFields(value);
    assert.equal(fields.code, undefined);
    assert.equal(fields.message, undefined);
  }
});

test("errorFields: Prisma kodu ve ayrıntısı", () => {
  const error = prismaError("P2003", ["tableId"]);
  assert.equal(errorFields(error).code, "P2003");
  assert.deepEqual(prismaTarget(error), ["tableId"]);
  assert.equal(prismaTarget(new Error("ayrıntısız")), undefined);
});

test("isUniqueViolationOn: P2002 ve ihlal edilen alan", () => {
  assert.equal(isUniqueViolationOn(prismaError("P2002", ["idempotencyKey"]), "idempotencyKey"), true);
  assert.equal(isUniqueViolationOn(prismaError("P2002", ["businessId", "slug"]), "idempotencyKey"), false);
  // Bazı sürücüler hedefi kısıt adı olarak verir: alan adı içinde aranır
  assert.equal(isUniqueViolationOn(prismaError("P2002", "orders_idempotencyKey_key"), "idempotencyKey"), true);
  assert.equal(isUniqueViolationOn(prismaError("P2002"), "idempotencyKey"), false);
  assert.equal(isUniqueViolationOn(prismaError("P2003", ["idempotencyKey"]), "idempotencyKey"), false);
  assert.equal(isUniqueViolationOn("P2002", "idempotencyKey"), false);
});
