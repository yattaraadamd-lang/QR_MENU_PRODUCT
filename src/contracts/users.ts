/** Kullanıcı. Kullanıcı DTO'ları şimdilik özellik klasörlerinde. */

export type UserRole = "SUPER_ADMIN" | "ADMIN" | "WAITER";

/**
 * Hesap şifresi uzunluğu (kayıt, davetle katılma, personel, süper adminin açtığı işletme).
 * Üst sınır bcrypt'ten: 72 bayttan sonrasını yok sayar. Harf + rakam kuralı sunucuda ayrıca denetlenir.
 */
export const PASSWORD_LIMITS = { min: 12, max: 72 } as const;

/** Ad soyad uzunluğu (kayıt ve davetle katılma) */
export const PERSON_NAME_LIMITS = { min: 2, max: 100 } as const;
