import type { ZodIssue, ZodIssueOptionalMessage } from "zod";

/**
 * Doğrulama hatasını alan bazında anlatır (FE-ARCH-3.4): form, mesajı ilgili alanın altında
 * gösterir (contracts/errors.ts `fieldErrors`). Saf işlevler; handler.ts kullanır.
 */

/** Tek yanıtta en fazla bu kadar alan hatası döner (çok büyük geçersiz gövdeye karşı) */
const MAX_FIELD_ERRORS = 20;

/** Uzunluk/sayı sınırının nedeni: `kind` sorunun hangi tür değerde olduğunu söyler */
function describeLimit(kind: string, limit: number | bigint, bound: "min" | "max", inclusive: boolean): string {
  if (kind === "string") {
    if (bound === "max") return `En fazla ${limit} karakter olabilir.`;
    return limit <= 1 ? "Bu alan gerekli." : `En az ${limit} karakter olmalı.`;
  }
  if (kind === "array" || kind === "set") {
    return bound === "max" ? `En fazla ${limit} öğe olabilir.` : `En az ${limit} öğe olmalı.`;
  }
  if (kind === "number" || kind === "bigint") {
    if (bound === "max") return `En fazla ${limit} olabilir.`;
    return inclusive ? `En az ${limit} olmalı.` : `${limit} değerinden büyük olmalı.`;
  }
  return "Geçersiz değer.";
}

/**
 * Şemada mesajı olmayan Zod sorununun kısa nedeni. Alanın altında okunduğu için alan adını
 * içermez. Şemada verilen mesajlar (ör. "Kategori adı gereklidir") buraya hiç gelmez.
 */
export function describeIssue(issue: ZodIssueOptionalMessage): string {
  switch (issue.code) {
    case "invalid_type":
      return issue.received === "undefined" || issue.received === "null" ? "Bu alan gerekli." : "Geçersiz değer.";
    case "too_small":
      return describeLimit(issue.type, issue.minimum, "min", issue.inclusive);
    case "too_big":
      return describeLimit(issue.type, issue.maximum, "max", issue.inclusive);
    case "invalid_string":
      if (issue.validation === "email") return "Geçerli bir e-posta adresi girin.";
      if (issue.validation === "url") return "Geçerli bir bağlantı girin.";
      return "Geçersiz biçim.";
    case "invalid_enum_value":
    case "invalid_literal":
    case "invalid_union":
    case "invalid_union_discriminator":
      return "Geçersiz seçim.";
    case "not_multiple_of":
      return issue.multipleOf === 0.01 ? "En fazla iki ondalık basamak olabilir." : "Geçersiz değer.";
    case "not_finite":
      return "Geçerli bir sayı girin.";
    default:
      return "Geçersiz değer.";
  }
}

/**
 * Alan yolu → o alanın ilk mesajı. Anahtar istek gövdesindeki yoldur ("name", "items.0.quantity").
 * Yolu olmayan sorunlar (gövdenin kendisi geçersiz) yer almaz; hiç alan hatası yoksa undefined.
 */
export function toFieldErrors(issues: readonly ZodIssue[]): Record<string, string> | undefined {
  const errors = new Map<string, string>();
  for (const issue of issues) {
    if (issue.path.length === 0) continue;
    const field = issue.path.join(".");
    if (!errors.has(field)) errors.set(field, issue.message);
    if (errors.size === MAX_FIELD_ERRORS) break;
  }
  return errors.size > 0 ? Object.fromEntries(errors) : undefined;
}
