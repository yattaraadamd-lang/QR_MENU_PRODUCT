# SEO ve tarama sağlığı

Canlı: `https://qr-menu-product.onrender.com` (Cloudflare → Render). 2026-10-19 tarihinde salt-okunur tarandı: 36 GET isteği, ≤1 istek/sn. Ham çıktı: `evidence/crawl-before.json`.

## Envanter
Bu bir SaaS paneli. Herkese açık ve indekslenmesi istenen tek sayfa ana sayfa (`/`). Diğer herkese açık rotalar:

| Tür | Örnek | Adet | İndeks politikası (sonra) |
|---|---|---|---|
| Pazarlama | `/` | 1 | index, sitemap'te |
| Hesap | `/auth/signin`, `/auth/signup`, `/auth/register`, `/auth/join/[code]` | 4 şablon | noindex, follow |
| Müşteri menüsü | `/menu/[businessId]/[tableNumber]` | masa sayısı kadar | noindex, nofollow |
| QR girişi | `/qr/[qrToken]` | masa sayısı kadar | robots.txt'de kapalı + noindex |
| Panel | `/admin/*`, `/waiter/*`, `/super-admin/*`, `/dashboard` | — | robots.txt'de kapalı; girişsiz istek 307 ile signin'e yönlenir |
| API | `/api/*` (78 route) | — | robots.txt'de kapalı |

Locale/para birimi: yalnızca `tr` / TRY. hreflang gerekmiyor (**UYGULANAMAZ**).

## Sitemap mutabakatı
| | Önce | Sonra |
|---|---|---|
| robots.txt | 404 | 200, 6 kapalı yol + Sitemap satırı |
| sitemap.xml | 404 | 200, 1 URL |
| Sitemap URL'lerinden 200 + self-canonical + indexable olanlar | — | 1/1 (%100), yerel build'de doğrulandı |
| Sitemap'te olmayan indexable sayfa | `/auth/*` dahil 7 | 0 (geri kalanların hepsi noindex) |

## Sayfa bazında (önce, Googlebot smartphone UA)
| Yol | Durum | Başlık | Canonical | robots meta | Metin |
|---|---|---|---|---|---|
| `/` | 200 | QR Menü Platformu | yok | yok | 2 211 kr. |
| `/auth/signin` | 200 | aynı | yok | yok | 34 kr. |
| `/auth/signup` | 200 | aynı | yok | yok | 17 kr. |
| `/auth/register` | 200 | aynı | yok | yok | 317 kr. |
| `/auth/signin?demo=admin` | 200 | aynı | yok | yok | — |
| `/menu/demo-business-id/1` | 200 | aynı | yok | yok | 45 kr. |

**Yinelenen başlık/açıklama:** 7/7 sayfa. **Sonra:** hesap sayfaları "Hesap | QR Menü Platformu", menü ve QR sayfaları "Menü | QR Menü Platformu" başlığını alıyor ve noindex. İndekslenen tek sayfa olan `/` başlığını koruyor.

## URL varyantları ve tuzaklar
| İstek | Sonuç | Değerlendirme |
|---|---|---|
| `//` | 308 → `/` | iyi |
| `/auth/signin/` | 308 → `/auth/signin` | iyi (sondaki eğik çizgi normalize ediliyor) |
| `/AUTH/SIGNIN` | 404 noindex | kabul edilebilir |
| `/index.html` | 404 noindex | iyi |
| `/?utm_source=audit` | 200, canonical yok → **sonra:** canonical `/` | düzeltildi |
| `/menu/yok/1` | 200 (soft 404) → **sonra:** noindex | azaltıldı (F-08) |
| `/qr/gecersiz-token` | 200 (soft 404) → **sonra:** robots'ta kapalı + noindex | azaltıldı |
| Gerçek 404 | 404 + `noindex` | iyi |

Faset, arama veya sonsuz takvim gibi parametre tuzağı yok. `?demo=` parametresi yalnızca auth sayfalarında, onlar da noindex.

## Render ve bot determinizmi
- Ana sayfa `"use client"`, ama Next ön-render ettiği için ham HTML 2 211 karakter metin ve H1 içeriyor. Kritik içerik yalnızca JS'e bağlı değil.
- Menü ve QR sayfalarının ham HTML'i boş iskelet (45 kr.); içerik istemcide geliyor. Zaten noindex olduğu için sorun değil.
- Aynı sayfa 3 kez istendi: metin hash'i 3/3 aynı (`a54b44937a83de06`).

## Bot erişimi (AI arama hazırlığı)
10 user-agent'ın hepsi `/` için **200** aldı, hepsine aynı içerik döndü, WAF challenge ya da 403/429 yok: Googlebot smartphone, bingbot, GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-User, PerplexityBot, CCBot, generic.
robots.txt tek bir `*` grubu kullanıyor; bot'a özel grup olmadığı için grup paritesi sorunu yok. **Karar sahibinde:** AI eğitim botlarını (GPTBot, CCBot, Google-Extended) engellemek isteniyorsa ayrı gruplar eklenmeli. Şu anki politika "her şeye açık" ve bilinçli seçilmiş değil. `llms.txt` yok; tek pazarlama sayfası olduğu için düşük öncelik.

## Yapısal veri
JSON-LD: 0 sayfada. Öneri: ana sayfaya `Organization` + `SoftwareApplication` (fiyatlar görünen plan fiyatlarıyla aynı olmalı). Değerlendirme/puan işaretlemesi yok, politika riski yok.

## Performans
Bkz. FINDINGS F-13. Lab ölçümünde CLS her sayfada 0. LCP 2,4–2,8 s (sınırda), TBT 250–470 ms. Saha verisi **ÇALIŞTIRILMADI** (Search Console erişimi verilmedi).

## Tekrar çalıştırma
```
node maturity-audit/tests/crawl.mjs --base https://qr-menu-product.onrender.com --out maturity-audit/evidence/crawl-after.json
node maturity-audit/tests/seo-static.mjs
```
"Sonra" taraması bu dal canlıya çıkınca yapılmalı. Şu an canlıda olan, düzeltme öncesi sürüm.
