/**
 * Beklenmeyen istemci hatası (FE-ARCH-2.6): yutulmaz, ama kullanıcıya teknik ayrıntı da
 * gösterilmez. Geliştirmede ayrıntıyla konsola yazılır; üretimde yalnız kapsam ve hata adı,
 * çünkü mesaj kişisel veri (e-posta, telefon) taşıyabilir. Uzak hata kaydı ayrı bir karardır
 * (KVKK, çerez politikası).
 */
export function reportClientError(scope: string, error: unknown): void {
  if (process.env.NODE_ENV !== "production") {
    console.error(`[${scope}]`, error);
    return;
  }
  const name = error instanceof Error ? error.name : typeof error;
  console.warn(`[${scope}] ${name}`);
}
