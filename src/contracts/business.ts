/** İşletme. İşletme DTO'ları şimdilik özellik klasörlerinde. */

/** İşletme alanlarının azami uzunluğu (ayarlar formu ve süper adminin işletme açması) */
export const BUSINESS_LIMITS = { name: 200, description: 1000, phone: 30, address: 500 } as const;

/**
 * Self-servis kayıtta işletme adı. Ayarlar formu aynı alanı 1–200 karakter kabul eder
 * (BUSINESS_LIMITS.name): fark eskiden beri var, hangisinin doğru olduğu ürün kararı bekliyor.
 */
export const SIGNUP_BUSINESS_NAME_LIMITS = { min: 2, max: 100 } as const;
