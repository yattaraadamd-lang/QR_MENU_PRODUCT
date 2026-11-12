/** Eylem sonucunu kullanıcıya gösterme: toast mı pencere içi mi kararını bileşen verir */
export interface ActionNotifier {
  readonly success: (message: string) => void;
  readonly error: (message: string) => void;
  /** Yeni eylem başlarken önceki hata temizlenir */
  readonly clear: () => void;
}

/** Sipariş ve hizmet taleplerinin ortak hata metinleri */
export const BLOCKED_DEVICE_MESSAGE = "Bu cihazın bu işletmede işlem yapması engellendi.";
export const UNEXPECTED_ERROR_MESSAGE = "İşlem tamamlanamadı. Lütfen tekrar deneyin.";
