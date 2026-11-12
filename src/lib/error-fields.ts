/**
 * Yakalanan değerin alanlarına güvenli erişim (FE-ARCH-3.6). `catch` değişkeni `unknown`'dır:
 * Error, Prisma hatası (code "P2002", meta.target) ya da fırlatılmış herhangi bir değer olabilir.
 * Nesne olmayan değerde alanlar undefined döner; önceki `error?.code` erişimiyle aynı. Alanlar
 * `unknown` kalır: metin işlemi (includes, startsWith) öncesi `typeof` ile daraltılır.
 */

export interface ErrorFields {
  readonly code?: unknown;
  readonly name?: unknown;
  readonly message?: unknown;
  readonly stack?: unknown;
  /** Prisma hata ayrıntısı: P2002'de ihlal edilen alanlar `target`'ta */
  readonly meta?: unknown;
}

/** Hatanın kendisi (kopya değil), alanları `unknown` olarak okunur */
export function errorFields(error: unknown): ErrorFields {
  return typeof error === "object" && error !== null ? error : {};
}

/** Prisma hata ayrıntısındaki hedef: Postgres'te ihlal edilen alan adları dizisi */
export function prismaTarget(error: unknown): unknown {
  const { meta } = errorFields(error);
  return typeof meta === "object" && meta !== null && "target" in meta ? meta.target : undefined;
}

/** Benzersizlik ihlali (Prisma P2002) verilen alanda mı */
export function isUniqueViolationOn(error: unknown, field: string): boolean {
  if (errorFields(error).code !== "P2002") return false;
  const target = prismaTarget(error);
  return (typeof target === "string" || Array.isArray(target)) && target.includes(field);
}
