/**
 * Sözleşme katmanı (FE-ARCH-3.1): API ile ekranın ortak tipleri. Yalnız tip içerir, istemci
 * paketine girmez (lint zorlar). Sunucu Prisma satırını bu tiplere src/lib/api/*.dto.ts'te eşler.
 * Enum'ların Prisma şemasıyla aynı kaldığını src/lib/api/contracts-sync.ts derleme anında denetler.
 */

/** Prisma Decimal JSON'da metin olarak gelir ("120.5") */
export type DecimalString = string;

/** Date JSON'da ISO 8601 metni olarak gelir */
export type IsoDateTime = string;

/** Ödeme, sipariş ve talep kayıtlarındaki masa özeti */
export interface TableRefDTO {
  readonly tableNumber: string;
  readonly tableName: string | null;
}
