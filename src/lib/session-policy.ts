/**
 * Personel oturumunun geçerlilik kuralları. Oturum imzalı bir JWT olduğu için sunucu tarafında
 * silinecek bir kayıt yok; iptal, token'daki sürümün kullanıcının güncel sürümüyle
 * karşılaştırılmasıyla yapılır (auth.ts jwt callback'i her oturum okumasında çağırır).
 */

/** Boşta kalma: bu sürede oturum okunmazsa çerez düşer. Her okuma süreyi uzatır */
export const SESSION_IDLE_SECONDS = 8 * 60 * 60;

/**
 * Mutlak üst sınır: etkin kullanılsa da bu süre sonunda yeniden giriş gerekir. Çalınan bir çerez
 * süresiz kullanılamasın diye. OWASP ASVS 12 saati önerir; 8 saat garsonu vardiya ortasında atardı.
 */
export const SESSION_ABSOLUTE_SECONDS = 12 * 60 * 60;

/** Oturum geçersizken fırlatılır. NextAuth bu hatada çerezi siler ve boş oturum döner */
export const SESSION_REVOKED = "SESSION_REVOKED";

export interface SessionClaims {
  sv?: unknown;
  authTime?: unknown;
}

export interface SessionUserState {
  sessionVersion: number;
  isActive: boolean;
  deletedAt: Date | null;
}

/**
 * Sürüm alanı olmayan token (bu özellikten önce verilmiş oturum) geçersiz sayılır:
 * yayına alındığında herkes bir kez yeniden giriş yapar.
 */
export function isSessionCurrent(
  claims: SessionClaims,
  user: SessionUserState | null,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): boolean {
  if (!user || !user.isActive || user.deletedAt) return false;
  if (typeof claims.sv !== "number" || claims.sv !== user.sessionVersion) return false;
  if (typeof claims.authTime !== "number") return false;
  return nowSeconds - claims.authTime <= SESSION_ABSOLUTE_SECONDS;
}
