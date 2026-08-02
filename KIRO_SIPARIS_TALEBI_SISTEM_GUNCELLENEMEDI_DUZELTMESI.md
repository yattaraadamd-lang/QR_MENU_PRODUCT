# Kiro Görevi: Sipariş Talebi – “Sistem Güncellenemedi” Hatasını Kalıcı Olarak Düzelt

## Proje
- Repo: `https://github.com/yattaraadamd-lang/QR_MENU_PRODUCT/tree/main`
- Teknoloji: Next.js 15, Prisma 5, PostgreSQL/Supabase, Render
- Sorun: Müşteri **Sipariş Talebi Oluştur** butonuna bastığında talep oluşmuyor ve “Sistem güncellenemedi” / “Talep oluşturulurken bir hata oluştu” mesajı gösteriliyor.

## Amaç
Canlı verileri silmeden Prisma şeması, Supabase veritabanı ve Render deploy sürecini eşitle. Sipariş talebi oluşturma akışını tekrar çalışır hâle getir.

## Ön Tespitler
1. `src/app/api/customer/service-requests/route.ts`, `service_requests` tablosuna şu alanları yazıyor:
   - `customerSessionId`
   - `expiresAt`
   - `verificationCode`
   - `idempotencyKey`
   - `orderPreview`
   - `requestType = ORDER_REQUEST`
2. `prisma/schema.prisma` bu alanları içeriyor.
3. Repoda şu anda `prisma/migrations` klasörü görünmüyor.
4. `render.yaml` içinde şu komut var:
   ```yaml
   buildCommand: npm install && npm run db:deploy && npm run build
   ```
5. `package.json` içinde **`db:deploy` scripti tanımlı değil**. Bu nedenle yeni deploy başarısız olabilir veya Render eski çalışan sürümü sunmaya devam edebilir.

## Kesin Kurallar
- Veritabanını resetleme.
- `prisma migrate reset` çalıştırma.
- `prisma db push --accept-data-loss` kullanma.
- Tablo, kolon veya canlı kayıt silme.
- Sorunu frontend mesajını gizleyerek çözme.
- Sadece `try/catch` mesajını değiştirip görevi tamamlandı sayma.
- Supabase erişim bilgilerini koda veya GitHub’a yazma.

## Yapılacaklar

### 1. Gerçek hatayı doğrula
Render logunda sipariş talebi isteğinin gerçek Prisma/PostgreSQL hatasını bul.

Kontrol edilecek hata tipleri:
- `P2021`: tablo bulunamadı
- `P2022`: kolon bulunamadı
- `P2002`: unique ihlali
- `invalid input value for enum`
- `relation does not exist`
- `column does not exist`

Log yeterli değilse `service-requests/route.ts` içindeki catch bloğunda güvenli sunucu logu üret:

```ts
console.error("[ORDER_REQUEST_CREATE_FAILED]", {
  code: error?.code,
  meta: error?.meta,
  message: error?.message,
});
```

API cevabında SQL ayrıntısı, bağlantı adresi veya gizli bilgi gösterme.

### 2. Render deploy komutunu düzelt
`package.json` scripts bölümüne ekle:

```json
"db:deploy": "prisma migrate deploy"
```

`render.yaml` şu sırayı korusun:

```yaml
buildCommand: npm ci && npm run db:deploy && npm run build
```

`npm ci`, mevcut lock dosyası nedeniyle başarısız olursa nedeni düzelt; sessizce `npm install` yöntemine dönme.

### 3. Canlı şemayı Prisma şemasıyla karşılaştır
`DATABASE_URL_UNPOOLED` kullanarak canlı Supabase şemasını incele. Özellikle şunları kontrol et:

#### `service_requests`
- `customerSessionId` TEXT NULL
- `expiresAt` TIMESTAMP NULL
- `verificationCode` TEXT NULL
- `idempotencyKey` TEXT NULL + unique
- `orderPreview` JSONB NULL
- `seenAt`, `resolvedAt`, `completedAt`
- `customerSessionId` foreign key → `customer_sessions.id`
- `ServiceRequestType` enumunda `ORDER_REQUEST`

#### `customer_sessions`
Prisma modelindeki bütün kolonların canlı tabloda bulunup bulunmadığını kontrol et. Özellikle:
- `tableSessionId`
- `authorizationStatus`
- `deviceKeyHash`
- `authorizedAt`

Sadece yukarıdaki alanlarla sınırlı kalma. Canlı veritabanı ile `prisma/schema.prisma` arasındaki tüm farkları çıkar.

### 4. Veri kaybetmeyen migration oluştur
Repoya kalıcı migration ekle:

```text
prisma/migrations/<timestamp>_sync_secure_order_request/migration.sql
```

Migration şu özelliklere sahip olmalı:
- Eksik enum değerlerini eklemeli.
- Eksik kolonları nullable veya güvenli default ile eklemeli.
- Gerekli index, unique constraint ve foreign keyleri oluşturmalı.
- Var olan kayıtları korumalı.
- `DROP TABLE`, `DROP COLUMN`, `TRUNCATE` içermemeli.
- Mevcut constraint/index zaten varsa ikinci kez oluşturmamalı.

Migration SQL’ini oluşturmadan önce canlı şemayı gerçekten doğrula. Tahmine dayalı toplu SQL yazma.

Repoda migration geçmişi bulunmadığı için mevcut canlı tabloları yeniden oluşturmaya çalışma. Gerekirse mevcut şemayı Prisma migration sistemi için **baseline** kabul et ve yalnız eksik güvenli değişiklikleri ileri yönlü migration olarak ekle. `prisma migrate resolve --applied` kullanılacaksa yalnız gerçekten canlı şemada uygulanmış migration için kullan.

### 5. Sipariş talebi işlemini atomik yap
`ORDER_REQUEST` oluşturulurken şu işlemleri tek `$transaction` içinde çalıştır:
1. `ServiceRequest` oluştur.
2. `CustomerSession.authorizationStatus = PENDING` yap.
3. `Notification` oluştur.

Transaction başarısız olursa yarım kayıt kalmamalı.

Socket yayını transaction tamamlandıktan sonra yapılmalı. Socket hatası veritabanı işlemini başarısız saymamalı.

### 6. API hata cevaplarını düzelt
Aşağıdaki ayrımı yap:
- Şema uyumsuzluğu (`P2021`, `P2022`, enum eksikliği): HTTP `503`, kod `DATABASE_SCHEMA_OUTDATED`
- Aynı bekleyen talep: HTTP `409`, kod `ORDER_REQUEST_PENDING`
- Geçersiz ürün/sepet: HTTP `400`
- Beklenmeyen sunucu hatası: HTTP `500`, kod `ORDER_REQUEST_CREATE_FAILED`

Kullanıcı mesajı anlaşılır olsun; fakat SQL/Prisma ayrıntısı istemciye gönderilmesin.

### 7. Build ve migration doğrulaması
Şunları çalıştır ve hataları gider:

```bash
npm ci
npx prisma validate
npx prisma generate
npm run build
```

Uygun test veritabanında:

```bash
npm run db:deploy
```

Migration ikinci kez çalıştırıldığında hata vermemeli.

## Kabul Testleri
Aşağıdakilerin tamamı geçmeden görevi bitirme:

1. Boş masanın QR kodu okutulur.
2. Ürün sepete eklenir.
3. **Sipariş Talebi Oluştur** butonuna basılır.
4. API `201` veya mevcut idempotent talep için `200` döner.
5. Müşteriye doğrulama kodu gösterilir.
6. `service_requests` tablosunda `ORDER_REQUEST` kaydı oluşur.
7. `orderPreview`, `customerSessionId`, `verificationCode`, `expiresAt` kaydedilir.
8. Müşteri oturumu `PENDING` olur.
9. Garsonun **Talepler** ekranında talep görünür.
10. Aynı butona çift basılması iki talep oluşturmaz.
11. Render build logunda `Missing script: db:deploy` hatası oluşmaz.
12. `prisma migrate deploy` başarılı olur.
13. Mevcut işletme, ürün, masa, sipariş, ödeme ve kullanıcı kayıtları korunur.

## Teslimat
Görev sonunda kısa bir rapor oluştur:
- Gerçek kök neden
- Değiştirilen dosyalar
- Oluşturulan migration adı
- Render migration sonucu
- Kabul testlerinin sonucu
- Manuel yapılması gereken bir işlem varsa yalnız o işlem

Teşhisle yetinme; gerekli kodu ve migration dosyasını oluştur, build hatalarını düzelt ve uygulanabilir hâlde teslim et.
