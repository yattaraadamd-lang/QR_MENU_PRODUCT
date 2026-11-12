import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { TABLE_LIMITS } from "../../contracts/tables";
import { PASSWORD_LIMITS } from "../../contracts/users";
import { describeIssue, toFieldErrors } from "./field-errors";

/** handler.ts'in yaptığı gibi: şemada mesajı olmayan sorunlar describeIssue ile anlatılır */
function fieldErrors(schema: z.ZodTypeAny, data: unknown) {
  const result = schema.safeParse(data, { errorMap: (issue) => ({ message: describeIssue(issue) }) });
  return result.success ? undefined : toFieldErrors(result.error.issues);
}

describe("alan hataları", () => {
  const table = z.object({
    tableNumber: z.string().min(1).max(TABLE_LIMITS.number),
    tableName: z.string().min(1).max(TABLE_LIMITS.name).optional(),
  });

  test("uzunluk sınırı ortak sabitten okunur ve mesajda yer alır", () => {
    assert.deepEqual(fieldErrors(table, { tableNumber: "9".repeat(TABLE_LIMITS.number + 1) }), {
      tableNumber: `En fazla ${TABLE_LIMITS.number} karakter olabilir.`,
    });
    assert.equal(fieldErrors(table, { tableNumber: "9".repeat(TABLE_LIMITS.number) }), undefined);
  });

  test("boş ya da eksik zorunlu alan", () => {
    assert.deepEqual(fieldErrors(table, { tableNumber: "" }), { tableNumber: "Bu alan gerekli." });
    assert.deepEqual(fieldErrors(table, {}), { tableNumber: "Bu alan gerekli." });
  });

  test("birden çok alan: her alan kendi mesajını alır", () => {
    assert.deepEqual(fieldErrors(table, { tableNumber: "", tableName: "x".repeat(TABLE_LIMITS.name + 1) }), {
      tableNumber: "Bu alan gerekli.",
      tableName: `En fazla ${TABLE_LIMITS.name} karakter olabilir.`,
    });
  });

  test("en az uzunluk, e-posta, sayı ve seçim nedenleri", () => {
    const schema = z.object({
      password: z.string().min(PASSWORD_LIMITS.min),
      email: z.string().email(),
      price: z.number().positive().multipleOf(0.01),
      role: z.enum(["ADMIN", "WAITER"]),
    });
    assert.deepEqual(fieldErrors(schema, { password: "kısa", email: "a@b", price: 0, role: "OWNER" }), {
      password: `En az ${PASSWORD_LIMITS.min} karakter olmalı.`,
      email: "Geçerli bir e-posta adresi girin.",
      price: "0 değerinden büyük olmalı.",
      role: "Geçersiz seçim.",
    });
    assert.deepEqual(fieldErrors(z.object({ price: z.number().multipleOf(0.01) }), { price: 12.345 }), {
      price: "En fazla iki ondalık basamak olabilir.",
    });
  });

  test("şemada verilen mesaj korunur; alanın yalnız ilk sorunu döner", () => {
    const schema = z.object({ name: z.string().trim().min(1, "Kategori adı gereklidir").max(3) });
    assert.deepEqual(fieldErrors(schema, { name: "  " }), { name: "Kategori adı gereklidir" });
    const password = z.object({ password: z.string().min(12, "Şifre en az 12 karakter olmalıdır").regex(/[0-9]/, "Rakam gerekli") });
    assert.deepEqual(fieldErrors(password, { password: "abc" }), { password: "Şifre en az 12 karakter olmalıdır" });
  });

  test("iç içe alanın anahtarı gövdedeki yoldur", () => {
    const schema = z.object({ items: z.array(z.object({ quantity: z.number().int().min(1) })) });
    assert.deepEqual(fieldErrors(schema, { items: [{ quantity: 1 }, { quantity: 0 }] }), {
      "items.1.quantity": "En az 1 olmalı.",
    });
  });

  test("gövdenin kendisi geçersizse alan hatası yoktur", () => {
    assert.equal(fieldErrors(table, "metin"), undefined);
    assert.equal(fieldErrors(table, null), undefined);
  });

  test("tek yanıtta en fazla 20 alan", () => {
    const keys = Array.from({ length: 30 }, (_, i) => `f${i}`);
    const schema = z.object(Object.fromEntries(keys.map((key) => [key, z.string()])));
    assert.equal(Object.keys(fieldErrors(schema, {}) ?? {}).length, 20);
  });
});
