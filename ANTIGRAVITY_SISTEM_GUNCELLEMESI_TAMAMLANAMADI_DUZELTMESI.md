# QR Menü — `DATABASE_SCHEMA_OUTDATED` Düzeltmesi

## Sorun
Müşteri **Sipariş Talebi Oluştur** butonuna bastığında:

> Sistem güncellemesi tamamlanamadı. Lütfen işletme personeline bildirin.

mesajı görülüyor.

Bu mesaj frontend hatası değildir. `POST /api/customer/service-requests` içinde Prisma `P2021` veya `P2022` yakalandığında dönmektedir. Uygulama kodu güncel, Supabase/PostgreSQL şeması eski veya eksiktir.

## Hedef
Canlı verileri silmeden Supabase şemasını `prisma/schema.prisma` ile eşitle ve aynı problemin sonraki deploylarda tekrarlanmasını engelle.

## Kesin kurallar
- Veritabanını resetleme.
- Tablo veya mevcut kolon silme.
- `--accept-data-loss` kullanma.
- Seed çalıştırma.
- Mevcut sipariş, ödeme, adisyon, masa ve kullanıcı kayıtlarını değiştirme.
- Sorunu frontend mesajını gizleyerek çözmeye çalışma.
- Kapsam dışı refactor yapma.

## Görevler

### 1. Gerçek eksikliği doğrula
Render logunda aşağıdaki kaydı bul:

```text
[ServiceRequest] Database schema outdated
```

`error.code` ve `error.meta` içindeki eksik tablo/kolon adını teslim raporuna yaz. Özellikle `P2021` ve `P2022` kontrol edilecek.

### 2. Canlı şema farkını üret
`DATABASE_URL_UNPOOLED` doğrudan Supabase bağlantısı olmalı.

Önce:

```bash
npx prisma validate
npx prisma generate
npx prisma migrate diff --from-url "$DATABASE_URL_UNPOOLED" --to-schema-datamodel prisma/schema.prisma --script > prisma-production-diff.sql
```

Windows PowerShell gerekiyorsa ortam değişkenini uygun sözdizimiyle kullan.

Üretilen SQL'i incele:

- `DROP TABLE`, `DROP COLUMN`, veri silme veya enum yeniden oluşturma varsa uygulama.
- Yalnız eksik enum değerleri, kolonlar, foreign key'ler ve indeksler eklenmeli.
- Mevcut verilerle çakışabilecek `NOT NULL` kolon önce nullable/default değerli eklenmeli.
- Unique indeks öncesi çakışan kayıt olup olmadığı kontrol edilmeli.

### 3. Kalıcı, eklemeli production migration oluştur
Aşağıdaki klasörü oluştur:

```text
prisma/migrations/20260802_sync_secure_customer_order_flow/migration.sql
```

Migration, canlı şemada eksik olan alanları idempotent ve veri koruyan biçimde eklesin. Fark analizinde kontrol edilmesi gereken başlıca yapılar:

- `ServiceRequestType.ORDER_REQUEST`
- `service_requests.customerSessionId`
- `service_requests.expiresAt`
- `service_requests.verificationCode`
- `service_requests.idempotencyKey`
- `service_requests.orderPreview`
- `service_requests.resolvedAt`
- `service_requests.completedAt`
- `customer_sessions.tableSessionId`
- `customer_sessions.authorizationStatus`
- `customer_sessions.deviceKeyHash`
- `customer_access_blocks` tablosu ve ilişkili indeksler
- Güncel `schema.prisma` ile canlı veritabanı arasındaki sipariş güvenlik akışını etkileyen diğer **eksik, eklemeli** yapılar

Kolon ve enumların gerçek PostgreSQL adlarını tahmin etme; `prisma migrate diff` çıktısını esas al.

### 4. Migration'ı güvenli şekilde uygula
Önce Supabase yedeği alındığını doğrula. Ardından production ortamında:

```bash
npx prisma migrate deploy
```

Migration geçmişi olmadığı için deploy uygulanamıyorsa veritabanını resetleme. Additive SQL'i Supabase SQL Editor üzerinden uygula ve migration'ı baseline/resolve yöntemiyle kayıt altına al. Yapılan yöntemi raporla.

### 5. Render deploy zincirini düzelt
`package.json` içinde şu script bulunmalı:

```json
"db:deploy": "prisma migrate deploy"
```

Migration dosyası doğrulandıktan sonra `render.yaml` build komutunu şu sıraya getir:

```yaml
buildCommand: npm install && npm run db:deploy && npm run build
```

Migration başarısız olursa yeni uygulama sürümü başlamamalı.

### 6. API kodunu koru ve küçük hata düzeltmelerini yap
Dosya:

```text
src/app/api/customer/service-requests/route.ts
```

- `P2021/P2022 -> 503 DATABASE_SCHEMA_OUTDATED` davranışını koru.
- Ham veritabanı hatasını müşteriye gösterme.
- `ServiceRequest` oluşturma ve `CustomerSession.authorizationStatus=PENDING` işlemleri aynı transaction içinde kalmalı.
- Bildirim/socket yalnız transaction başarılı olduktan sonra çalışmalı.
- `P2002` idempotency yakalamasında anahtarı `error.meta.constraint` üzerinden arama. İstekten alınan `idempotencyKey`/`reqIdempotencyKey` ile mevcut kaydı bul.

### 7. Doğrulama
Aşağıdakileri çalıştır:

```bash
npx prisma validate
npx prisma generate
npm run build
```

Sonra gerçek akışı test et:

1. Yeni QR oturumu oluştur.
2. Sepete geçerli ürün ekle.
3. Sipariş talebi gönder.
4. API `201` dönmeli.
5. Müşteride 6 haneli doğrulama kodu görünmeli.
6. `service_requests` kaydı oluşmalı.
7. `customer_sessions.authorizationStatus` değeri `PENDING` olmalı.
8. Talep garson paneline düşmeli.
9. Render logunda `P2021/P2022` bulunmamalı.
10. Mevcut ödeme ve cihaz engelleme akışları bozulmamalı.

## Teslim raporu
Yalnız şunları yaz:

- Render'daki gerçek Prisma hata kodu ve eksik nesne
- Oluşturulan migration dosyası
- Uygulanan SQL değişikliklerinin özeti
- Değiştirilen dosyalar
- Production'da çalıştırılan komut
- Test sonuçları

Gereksiz açıklama veya yeni dokümantasyon dosyaları oluşturma.
