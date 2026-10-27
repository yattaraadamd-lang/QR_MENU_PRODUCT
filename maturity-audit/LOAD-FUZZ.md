# Yük (B) ve girdi fuzz (D) testleri

**Durum (2026-10-19): betikler hazır, staging kurulumu bekleniyor. Testler henüz çalıştırılmadı.**
Kurulum: [STAGING-SETUP.md](STAGING-SETUP.md). Betikler `maturity-audit/tests/load/*.js` (k6) ve
`maturity-audit/tests/fuzz-customer.mjs` (Node) dosyalarında. Hepsi canlı host'u reddeder.

## Kapsam

| Test | Betik | Durum |
|---|---|---|
| Normal yük | `load/normal.js` | ⏳ staging bekleniyor |
| 10x ani artış | `load/spike.js` | ⏳ staging bekleniyor |
| Karışık bot UA | `load/bots.js` | ⏳ staging bekleniyor |
| 429 + Retry-After, IP sahteciliği | `load/ratelimit.js` | ⏳ staging bekleniyor |
| `/api/customer/*` fuzz | `fuzz-customer.mjs` | ⏳ staging bekleniyor |
| Yavaş istemci (slowloris, yavaş gövde/okuma) | — | ❌ kapsam dışı. Betik yazılmadı. Render'ın önündeki edge bu tür bağlantıları tamponladığı için uygulamaya ulaşma olasılığı düşük; doğrulanmadı. |

## Kod okumasından beklenen bulgular (staging'de doğrulanacak)

| # | Bulgu | Yer | Ön değerlendirme |
|---|---|---|---|
| E1 | Bozuk JSON gövdesi (`{`, boş gövde, `text/plain`) `request.json()` içinde hata fırlatıyor ve catch bloğu **500** döndürüyor; 400 olmalı | `api/customer/session/route.ts:63`, `orders/route.ts:17`, `service-requests/route.ts:24`, `payment-requests/route.ts:12` | Orta: sızıntı yok, ama 5xx alarmlarını gürültüyle doldurur ve hata oranını şişirir |
| E2 | Gövde `null` olunca destructuring sırasında TypeError atılıyor ve **500** dönüyor | aynı dosyalar; `auth/invite/verify/route.ts:15` (`body.code`) | Orta |
| E3 | NUL karakteri (`\u0000`) içeren id'ler Postgres'te `invalid byte sequence` hatası verip **500** döndürüyor | `session/route.ts:72` (`businessId`/`tableId`), `orders/route.ts:165` (`productId`), `orders/route.ts:67` (`idempotencyKey`) | Orta |
| E4 | Tip denetimi yapılmayan alanlar Prisma `where` ifadesine nesne olarak giriyor (`idempotencyKey`, `items[].productId`); Prisma doğrulama hatası **500** döndürüyor | `service-requests/route.ts:206,262-272` | Orta: Prisma operatör nesnelerini `equals` dışına taşımadığından veri sızıntısı beklenmiyor |
| E5 | Müşteri tarafındaki 429 yanıtlarında `Retry-After` başlığı yok; bekleme süresi yalnızca Türkçe metnin içinde | `orders/route.ts:49-54`, `service-requests/route.ts:118-142`, `payment-requests/route.ts:47-52` | Düşük: istemciler ve botlar ne kadar bekleyeceklerini bilemez |
| E6 | Demo işletmesi yolunda rate limit yok; çerezsiz her istek yeni bir VIEW_ONLY oturum satırı yazıyor | `session/route.ts:175-370` | Düşük/Orta: yük testinde satır artışı izlenecek |
| E7 | IP tabanlı limit `CF-Connecting-IP` başlığına güveniyor; Render'ın edge katmanı bu başlığı üzerine yazmıyorsa istemci IP'sini kendisi seçebilir | `lib/unified-rate-limit.ts:152` | **Bilinmiyor**: `ratelimit.js` B bölümü ölçecek. Doğrulanırsa Yüksek |

Kritik veya yüksek seviye bir bulgu doğrulanırsa düzeltmesi bu dalda yapılacak ve aşağıya işlenecek.

## Sonuçlar

_Staging kurulduktan sonra doldurulacak: her betiğin özet metrikleri (istek sayısı, hata oranı,
p95, 5xx, 429 davranışı), fuzz'da hatalı yanıt veren uç ve girdi listesi, yapılan düzeltmeler._

### Yerel fuzz (2026-10-27)

Staging henüz kurulmadığı için `fuzz-customer.mjs` yerelde koşturuldu: `next build` +
`NODE_ENV=production node server.js`, seed edilmiş geçici Postgres 16. Yetkili sipariş
senaryolarının atlanmaması için boş bir demo masası kullanıldı (`FUZZ_TABLE_NUMBER=4`).

| Uç | Önce (main `0b08667`) | Sonra |
|---|---|---|
| `POST /api/customer/session` | 146 deneme, 12 × 500 | 146 deneme, 0 hata |
| `POST /api/customer/orders` | 292 deneme, 16 × 500 | 292 deneme, 0 hata |
| `POST /api/customer/service-requests` | 245 deneme, 6 × 500 | 245 deneme, 0 hata |
| `POST /api/customer/payment-requests` | 113 deneme, 6 × 500 | 113 deneme, 0 hata |

- **E1, E2 (bu dört uç), E3, E4 düzeltildi:** gövde route'a girmeden `parseJson` + zod
  şemasıyla doğrulanıyor (`src/lib/api/handler.ts`, `src/lib/validation.ts` → Customer API
  Schemas); hatalı girdi `{ error, code, requestId }` ile 400 dönüyor.
- **Ek bulgu:** eşi olmayan surrogate (`\ud800`) içeren id'ler de 500 veriyordu; aynı şemalar
  reddediyor. Serbest metin alanları (notlar) NUL ve eşsiz surrogate içeremez.
- **Açık kalan:** `GET /api/customer/active-requests` sorgudaki NUL'u Postgres'e iletiyor;
  hata yakalanıp 200 dönüyor ama Prisma hatasının tamamı loglanıyor. 100 KB'lık sorgu
  dizesinde bağlantı yanıtsız kapanıyor. `auth/invite/verify` (E2) bu dört ucun dışında.
