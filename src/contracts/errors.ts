/** Hata yanıtının zarfı (src/lib/api/handler.ts withApiHandler). Eski uçlar yalnız `error` döner. */
export interface ApiErrorResponse {
  /** Kullanıcıya gösterilebilir özet */
  readonly error: string;
  /** Makinenin okuduğu kod (ör. VALIDATION_ERROR) */
  readonly code?: string;
  /** Log kaydıyla eşleştirmek için */
  readonly requestId?: string;
  /**
   * Alan → mesaj (FE-ARCH-3.4). Anahtar istek gövdesindeki yoldur ("name", "items.0.quantity");
   * form bunu ilgili alanın altında gösterir (hooks/useFieldErrors).
   */
  readonly fieldErrors?: Readonly<Record<string, string>>;
}
