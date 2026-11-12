/**
 * Sözleşme katmanı (FE-ARCH-3.1): API ile ekranın ortak tipleri ve alan sınırları. Tipler istemci
 * paketine girmez. İzin verilen tek değer alan sınırıdır (`*_LIMITS`, FE-ARCH-3.4): sunucu şeması
 * ve form alanı aynı sabiti okur. Başka değer giremez (lint zorlar).
 * Sunucu Prisma satırını bu tiplere src/lib/api/*.dto.ts'te eşler. Enum'ların Prisma şemasıyla
 * aynı kaldığını src/lib/api/contracts-sync.ts derleme anında denetler.
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
