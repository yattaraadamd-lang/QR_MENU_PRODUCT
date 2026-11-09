/**
 * Müşteri oturumunun tarayıcı depoları tek yerde (FE-ARCH-2.4). localStorage'da masa bazlı oturum
 * token'ı; sessionStorage'da QR sayfasının bıraktığı tarama kanıtı, taze okutma işareti ve önceki
 * sayfadan kalan engel metni. Eski sürümün global anahtarı okunur, token benimsenince temizlenir.
 */

const LEGACY_TOKEN_KEY = "qr_session_token";
const QR_PROOF_KEY = "qr_token";
const FRESH_SCAN_KEY = "qr_fresh_scan";
const BLOCKED_HINT_KEY = "qr_order_blocked_msg";

export interface TableTokenStore {
  /** Masa anahtarındaki token, yoksa eski global anahtardaki */
  readonly stored: () => string | null;
  /** Token benimsendi: masa anahtarına yazılır; eski anahtar ve engel metni temizlenir */
  readonly adopt: (token: string) => void;
  readonly forget: () => void;
}

export function tableTokenStore(businessId: string, tableId: string): TableTokenStore {
  const key = `qr_session_${businessId}_${tableId}`;
  return {
    stored: () => localStorage.getItem(key) || sessionStorage.getItem(LEGACY_TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY),
    adopt: (token) => {
      localStorage.setItem(key, token);
      localStorage.removeItem(LEGACY_TOKEN_KEY);
      sessionStorage.removeItem(LEGACY_TOKEN_KEY);
      sessionStorage.removeItem(BLOCKED_HINT_KEY);
    },
    forget: () => localStorage.removeItem(key),
  };
}

/** QR sayfasının bıraktığı tarama kanıtı: oturum ancak bununla açılır */
export const qrProof = (): string | null => sessionStorage.getItem(QR_PROOF_KEY);

/** QR az önce bu masa için okutulduysa işareti tüketir ve true döner */
export function takeFreshScan(tableId: string): boolean {
  if (sessionStorage.getItem(FRESH_SCAN_KEY) !== tableId) return false;
  sessionStorage.removeItem(FRESH_SCAN_KEY);
  return true;
}

/** Önceki sayfadan kalan sipariş engeli metni */
export const blockedHint = (): string | null => sessionStorage.getItem(BLOCKED_HINT_KEY);
