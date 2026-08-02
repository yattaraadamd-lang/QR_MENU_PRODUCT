# QR Menü — Sipariş Talebi 500 Hatası Düzeltmesi

## Amaç
Müşteri `Sipariş Talebi Oluştur` butonuna bastığında dönen `Talep oluşturulurken bir hata oluştu` hatasını kalıcı olarak düzelt.

## Muhtemel kök neden
Kod ile PostgreSQL/Supabase şeması eşit değil. `POST /api/customer/service-requests` artık aşağıdaki alanları kullanıyor:

- `customerSessionId`
- `expiresAt`
- `verificationCode`
- `idempotencyKey`
- `orderPreview`
- `resolvedAt`
- `completedAt`
- `ServiceRequestType.ORDER_REQUEST`

Projede `prisma/migrations` bulunmuyor. Render build yalnız `prisma generate && next build` çalıştırıyor; şema değişiklikleri veritabanına uygulanmıyor.

## Görev

### 1. Gerçek hatayı doğrula
Render loglarında `Hizmet talebi oluşturma hatası:` kaydını incele.
Özellikle Prisma `P2021`, `P2022`, `P2003`, `P2002` ve PostgreSQL enum/sütun hatalarını kontrol et.
Tahminle düzeltme yapma; logdaki hata kodunu raporla.

### 2. Veritabanını veri kaybetmeden eşitle
Önce Supabase yedeği al.

Aşağıdaki değişkenlerin doğru olduğundan emin ol:

```env
DATABASE_URL=<Supabase pooled URL>
DATABASE_URL_UNPOOLED=<Supabase direct connection URL>
```

Ardından:

```bash
npx prisma validate
npx prisma generate
npx prisma db push
```

Kurallar:

- `--accept-data-loss` kullanma.
- Prisma veri kaybı uyarısı verirse işlemi durdur.
- Mevcut tabloları silme veya yeniden oluşturma.
- Yalnız eksik enum değerleri, sütunlar, ilişkiler ve indeksleri ekle.
- İşlem sonrasında `npx prisma db pull` ile canlı şemayı doğrula; `schema.prisma` dosyasını istemeden bozma.

### 3. Kalıcı migration düzeni kur
Tek seferlik şema eşitlemesinden sonra `prisma/migrations` tabanlı dağıtım düzeni oluştur.

- Mevcut canlı veritabanını baseline kabul et.
- Bundan sonraki değişiklikleri migration dosyalarıyla yönet.
- Production komutu `prisma migrate deploy` olmalı.
- Render build sırasında her dağıtımda kontrolsüz `prisma db push` çalıştırma.
- Migration başarısızsa uygulama yeni kodla başlamamalı.

Önerilen script:

```json
{
  "scripts": {
    "db:deploy": "prisma migrate deploy",
    "build": "prisma generate && next build"
  }
}
```

Render için migration adımını build/start işleminden önce güvenli deploy adımı olarak yapılandır. Mevcut veri tabanını sıfırlama.

### 4. API hata yönetimini düzelt
Dosya:

```text
src/app/api/customer/service-requests/route.ts
```

Catch bloğunda güvenli ve teşhis edilebilir hata yönetimi uygula:

- Server loguna `error.code`, `error.meta`, endpoint ve `requestType` yaz.
- Token, doğrulama kodu, cookie veya kişisel veri loglama.
- `P2021/P2022` için:
  - HTTP `503`
  - `code: "DATABASE_SCHEMA_OUTDATED"`
  - kullanıcı mesajı: `Sistem güncellemesi tamamlanamadı. Lütfen işletme personeline bildirin.`
- `P2002` idempotency çakışmasında mevcut kaydı bulup tekrar oluşturmak yerine başarılı/idempotent cevap döndür.
- Diğer hatalarda genel `500` mesajını koru; ham veritabanı hatasını kullanıcıya gönderme.

### 5. İşlemi atomik yap
`ORDER_REQUEST` oluşturma ile `CustomerSession.authorizationStatus = PENDING` güncellemesini tek `prisma.$transaction` içine al.

Transaction içinde:

1. Bekleyen talep kontrolü
2. `ServiceRequest` oluşturma
3. `CustomerSession` durum güncelleme

Bildirim ve socket yayını transaction başarılı olduktan sonra çalışsın.

### 6. Girdi doğrulaması
`ORDER_REQUEST` için:

- `items` boşsa `400 EMPTY_ORDER_PREVIEW` döndür.
- En az bir geçerli ve işletmeye ait ürün bulunmalı.
- Hiçbir ürün doğrulanamazsa veritabanına talep yazma.
- `idempotencyKey` formatını ve uzunluğunu doğrula.
- `businessId`, `tableId` ve müşteri oturumu eşleşmesini koru.

### 7. Testler
Aşağıdaki testleri tamamla:

1. `VIEW_ONLY` müşteri geçerli ürünle talep oluşturur → `201`.
2. Doğrulama kodu cevapta gelir.
3. Garsonun Talepler ekranında ürün özeti görünür.
4. `CustomerSession` durumu `PENDING` olur.
5. Aynı idempotency anahtarıyla tekrar istek → ikinci kayıt oluşmaz.
6. Bekleyen talep varken tekrar istek → mevcut talep döner.
7. Geçersiz/başka işletmeye ait ürün → talep oluşmaz.
8. Eksik şema simülasyonunda API `DATABASE_SCHEMA_OUTDATED` döndürür ve log hata kodunu içerir.
9. `npm run build` başarılı olur.
10. Mevcut ödeme, cihaz engeli, masa açma ve reddetme akışları bozulmaz.

## Teslim raporu
Yalnız şunları raporla:

- Render logunda bulunan gerçek hata kodu ve sebebi
- Uygulanan migration/şema değişiklikleri
- Değiştirilen dosyalar
- Test sonuçları
- Çalıştırılması gereken production komutu

Gereksiz dosya oluşturma, mevcut iş akışlarını yeniden tasarlama ve kapsam dışı refactor yapma.
