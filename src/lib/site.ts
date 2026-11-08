/**
 * Ürünün görünen adı: başlık şablonları, OG adı ve telif satırları buradan okur.
 * Ad henüz kesin değil (PRODUCT.md → Brand Commitments); değişince yalnız bu satır değişir.
 */
export const SITE_NAME = "QR Menü Platformu";

/** Sayfa başlığı şablonu: "<sayfa> | <ürün>" (layout şablonunda sayfa yerine "%s" verilir) */
export const siteTitle = (page: string) => `${page} | ${SITE_NAME}`;

/** Personel bölgesi başlığı: "<sayfa> · <bölge> | <ürün>" (WCAG 2.4.2, FE-ARCH-1.2) */
export const areaTitle = (page: string, area: string) => siteTitle(`${page} · ${area}`);
