/** Hesap sayfalarının marka paneli metinleri (AuthShell) */

export interface AuthAside {
  readonly eyebrow: string;
  /** İtalik vurgulu ikinci kısım */
  readonly title: string;
  readonly accent: string;
  readonly points: readonly string[];
}

export const SIGNIN_ASIDE: AuthAside = {
  eyebrow: "Yönetim paneli",
  title: "Mutfağınızın ritmi,",
  accent: "tek ekranda.",
  points: [
    "Siparişler ve garson çağrıları anında ekranınızda",
    "Masa, ürün ve stok yönetimi tek panelde",
    "Günlük ciro ve ödemeler canlı takipte",
  ],
};

export const SIGNUP_ASIDE: AuthAside = {
  eyebrow: "14 gün ücretsiz",
  title: "Menünüzü bugün",
  accent: "dijitale taşıyın.",
  points: [
    "Kredi kartı gerekmez",
    "Menü, masa ve ekip tek panelde",
    "Misafirleriniz uygulama indirmeden sipariş verir",
  ],
};

export const STAFF_ASIDE: AuthAside = {
  eyebrow: "Ekibe katılın",
  title: "Servisin nabzı",
  accent: "elinizde.",
  points: [
    "Yeni siparişler sesli ve canlı gelir",
    "Masa durumları tek bakışta",
    "Hesap ve ödeme talepleri anında",
  ],
};
