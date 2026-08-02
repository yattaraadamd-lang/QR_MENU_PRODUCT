# Kiro Görevi — QR Menü Sipariş Talebi “Sistem Güncellemesi Tamamlanmadı” Hatası

## Proje

- Repository: `https://github.com/yattaraadamd-lang/QR_MENU_PRODUCT`
- Dal: `main`
- Altyapı: Next.js 15, Prisma 5, PostgreSQL/Supabase, Render
- Hatalı endpoint: `POST /api/customer/service-requests`
- Hatalı işlem: `requestType: "ORDER_REQUEST"`

## Kullanıcının Gördüğü Hata

Müşteri QR kodunu okutup sepete ürün ekledikten sonra **Sipariş Talebi Oluştur** butonuna bastığında:

> Sistem güncellemesi tamamlanmadı.

Sipariş talebi oluşturulmuyor, doğrulama kodu gösterilmiyor ve talep garson paneline düşmüyor.

---

## Tespit Edilen Birincil Kök Neden

Uygulama kodu ile canlı Supabase veritabanı şeması eşit değil.

`src/app/api/customer/service-requests/route.ts`, `service_requests` tablosuna aşağıdaki yeni alanlarla kayıt yazıyor:

- `customerSessionId`
- `expiresAt`
- `verificationCode`
- `idempotencyKey`
- `orderPreview`
- `requestType = ORDER_REQUEST`

Bu alanlar `prisma/schema.prisma` içinde tanımlı. Ancak repoda şu anda `prisma/migrations` klasörü bulunmuyor.

`render.yaml` dosyası `npm run db:deploy` çalıştırıyor ve bu komut `prisma migrate deploy` çağırıyor. Fakat migration dosyası bulunmadığında Prisma canlı Supabase şemasına yeni kolonları veya enum değerini ekleyemez. Uygulama derlenir fakat ilk `serviceRequest.create()` sorgusunda canlı veritabanı hata verir.

Muhtemel Prisma/PostgreSQL hataları:

- `P2021`: tablo bulunamadı
- `P2022`: kolon bulunamadı
- PostgreSQL `42703`: column does not exist
- PostgreSQL `22P02`: enum için geçersiz değer
- `ORDER_REQUEST` enum değerinin canlı veritabanında bulunmaması

Bu sonucu tahmin ederek geçme. Render çalışma logundaki gerçek hata kodu ve `error.meta` bilgisiyle doğrula.


## İkinci Kritik Bulguyu Doğrula: Deploy Edilen Kod ile `main` Aynı mı?

GitHub'daki güncel `main` dalında ilgili endpointin genel hata yanıtı:

```text
Talep oluşturulurken bir hata oluştu
```

Canlı sistemde ise:

```text
Sistem güncellemesi tamamlanmadı
```

mesajı görülüyor. Bu nedenle Render'ın farklı bir branch, eski commit veya başarısız deploy sonrası eski sürümü çalıştırma ihtimali vardır.

Render ayarlarında ve deploy logunda şunları doğrula:

- Branch gerçekten `main` mi?
- Son başarılı deploy commit SHA'sı GitHub `main` HEAD ile aynı mı?
- Son deploy sırasında `npm run db:deploy` başarılı mı?
- Migration/build başarısız olduğu için Render eski deploy'u çalıştırmaya devam ediyor mu?
- Render Dashboard'da manuel girilmiş Build Command, repodaki `render.yaml` değerini eziyor mu?

Sunucu loguna secret içermeden deploy revision eklenebilir:

```ts
const deployRevision =
  process.env.RENDER_GIT_COMMIT ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  "unknown";
```

Hata logunda bu revision'ı göster. Client'a gönderme.

Canlı commit `main` ile aynı değilse önce branch/deploy bağlantısını düzelt; ardından veritabanı migration işlemini uygula.

---

## Görev

Sorunu geçici olarak gizleme. Canlı veritabanını veri kaybetmeden Prisma şemasıyla eşitle, kalıcı migration düzeni kur ve sipariş talebi akışını uçtan uca çalışır hale getir.

## Kesinlikle Yapılmayacaklar

- Veritabanını resetleme.
- Tabloları silme.
- Supabase projesini yeniden oluşturma.
- `prisma migrate reset` çalıştırma.
- `--accept-data-loss` kullanma.
- Üretim verilerini seed ile ezme.
- Hata mesajını değiştirip sorunu çözülmüş gibi gösterme.
- Yeni kolonları koddan kaldırarak güvenlik akışını geri alma.
- `prisma db push` komutunu incelemeden otomatik production çözümü olarak ekleme.

---

## Uygulama Adımları

### 1. Gerçek hatayı görünür hale getir

`src/app/api/customer/service-requests/route.ts` içindeki `catch` bloğunda sunucu loguna aşağıdakileri yaz:

```ts
console.error("[ORDER_REQUEST_CREATE_FAILED]", {
  code: error?.code,
  message: error?.message,
  meta: error?.meta,
  name: error?.name,
});
```

Client'a tablo/kolon adı, SQL veya bağlantı bilgisi gönderme.

Prisma şema hatalarında şu yanıtı döndür:

```json
{
  "error": "Sistem güncellemesi tamamlanmadı. Lütfen yöneticiye bildirin.",
  "code": "DATABASE_SCHEMA_OUTDATED"
}
```

HTTP durum kodu `503` olsun. Diğer beklenmeyen hatalar `500` dönsün.

### 2. Canlı Supabase şemasını karşılaştır

`DATABASE_URL_UNPOOLED` doğrudan Supabase PostgreSQL bağlantısı olmalı. Pooler adresini migration için kullanma.

Önce:

```bash
npx prisma validate
npx prisma generate
npx prisma db pull --print > .tmp/live-schema.prisma
npx prisma migrate diff \
  --from-url "$DATABASE_URL_UNPOOLED" \
  --to-schema-datamodel prisma/schema.prisma \
  --script > .tmp/live-to-target.sql
```

`.tmp/live-to-target.sql` dosyasını incele.

Beklenen eksikler özellikle şunlardır:

```text
service_requests.customerSessionId
service_requests.expiresAt
service_requests.verificationCode
service_requests.idempotencyKey
service_requests.orderPreview
ServiceRequestType.ORDER_REQUEST
```

Ayrıca gerekli foreign key ve index farklarını kontrol et.

SQL içinde `DROP TABLE`, veri kaybettiren `DROP COLUMN`, kontrolsüz kolon tipi değişimi veya tabloyu yeniden oluşturan riskli işlem varsa otomatik uygulama. Önce güvenli ve eklemeli SQL'e dönüştür.

### 3. Migration geçmişini doğru şekilde başlat

Canlı veritabanı dolu ve repoda eski migration geçmişi yoksa Prisma baseline uygulanmalıdır.

#### `_prisma_migrations` veya migration geçmişi yoksa

1. Canlı şemadan baseline migration üret:

```bash
mkdir -p prisma/migrations/00000000000000_baseline

npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel .tmp/live-schema.prisma \
  --script > prisma/migrations/00000000000000_baseline/migration.sql
```

2. Baseline'ı canlı veritabanında **bir kez**, SQL çalıştırmadan uygulanmış olarak işaretle:

```bash
npx prisma migrate resolve \
  --applied 00000000000000_baseline
```

3. Canlı şema ile hedef Prisma şeması arasındaki güvenli farkı yeni migration olarak ekle:

```bash
mkdir -p prisma/migrations/20260802130000_fix_order_request_schema
cp .tmp/live-to-target.sql \
  prisma/migrations/20260802130000_fix_order_request_schema/migration.sql
```

4. Migration SQL'ini tekrar kontrol et ve uygula:

```bash
npx prisma migrate deploy
```

#### Migration geçmişi zaten varsa

Yeni baseline oluşturma. Mevcut migration zincirine yalnızca eksik şema değişikliklerini içeren yeni migration ekle ve:

```bash
npx prisma migrate deploy
```

çalıştır.

### 4. Migration'ın güvenli içeriğini doğrula

Migration aşağıdaki işlemleri veri kaybetmeden yapmalıdır:

- Eksik kolonları nullable olarak eklemek.
- `ORDER_REQUEST` enum değerini yoksa eklemek.
- `customerSessionId` foreign key'ini mevcut bozuk kayıtları silmeden eklemek.
- `idempotencyKey` için unique yapı eklemeden önce tekrar eden dolu değerleri kontrol etmek.
- Gerekli indexleri eklemek.
- Mevcut sipariş, ödeme, kullanıcı, masa, adisyon ve ürün verilerine dokunmamak.

PostgreSQL enum eklemesi idempotent veya kontrollü olmalı. Aynı değer zaten varsa migration başarısız olmamalıdır.

### 5. Render deploy zincirini düzelt

`package.json` içinde şu komut korunmalı:

```json
"db:deploy": "prisma migrate deploy"
```

`render.yaml` build komutu migration'ı build'den önce çalıştırmalı:

```yaml
buildCommand: npm ci && npm run db:deploy && npm run build
```

Render ortamında ikisi de tanımlı olmalı:

```text
DATABASE_URL
DATABASE_URL_UNPOOLED
```

- `DATABASE_URL`: uygulama bağlantısı
- `DATABASE_URL_UNPOOLED`: Prisma migration için doğrudan bağlantı

Secret değerlerini repoya veya loglara yazma.

Migration başarısızsa Render deploy da başarısız olmalı; eski şemayla yeni uygulamanın yayına çıkmasına izin verme.

### 6. Sipariş talebi işlemini transaction içine al

Ürün doğrulaması tamamlandıktan sonra şu işlemleri tek `prisma.$transaction()` içinde gerçekleştir:

1. `ServiceRequest` oluştur.
2. `CustomerSession.authorizationStatus = PENDING` yap.
3. `Notification` oluştur.

Bir işlem başarısız olursa diğerleri de geri alınmalı. Socket yayını transaction başarılı olduktan sonra çalışmalı.

Transaction içinde tekrar kontrol et:

- Aynı müşteri oturumunda süresi dolmamış `PENDING/SEEN ORDER_REQUEST` var mı?
- Aynı `idempotencyKey` daha önce kullanılmış mı?
- Masa başka aktif oturuma bağlanmış mı?

Eşzamanlı iki istek iki farklı bekleyen talep oluşturmamalı.

### 7. Frontend hata yönetimi

`src/app/menu/[businessId]/[tableNumber]/page.tsx` içinde:

- `DATABASE_SCHEMA_OUTDATED` alınırsa müşteriye teknik ayrıntı gösterme.
- Sepeti silme.
- `authStatus` değerini yanlışlıkla `PENDING` yapma.
- Tekrar deneme butonu gösterebilirsin.
- Başarılı olmayan yanıtta doğrulama kodu üretme veya saklama.

---

## Kabul Testleri

Aşağıdaki testlerin tamamı geçmeden görevi tamamlandı sayma.

### Veritabanı

- [ ] `npx prisma migrate status` hata vermiyor.
- [ ] Bekleyen migration kalmıyor.
- [ ] Supabase `service_requests` tablosunda gerekli kolonlar var.
- [ ] Canlı enum içinde `ORDER_REQUEST` var.
- [ ] Mevcut veriler korunuyor.
- [ ] İkinci `prisma migrate deploy` çalıştırması değişiklik yapmadan başarılı oluyor.

### Sipariş talebi

- [ ] QR okutuluyor ve müşteri oturumu oluşuyor.
- [ ] Sepete geçerli ürün ekleniyor.
- [ ] `Sipariş Talebi Oluştur` isteği HTTP `201` dönüyor.
- [ ] `service_requests` kaydı oluşuyor.
- [ ] `customerSessionId` doğru oturumu gösteriyor.
- [ ] Altı haneli `verificationCode` dönüyor.
- [ ] `expiresAt` dolu.
- [ ] `orderPreview` ürün, adet ve toplamı içeriyor.
- [ ] Müşteri durumu `PENDING` oluyor.
- [ ] Talep garsonun Talepler ekranında görünüyor.
- [ ] Aynı butona çift basmak ikinci kayıt oluşturmuyor.
- [ ] Süresi dolmamış talep varsa mevcut talep dönüyor.
- [ ] Render logunda `P2021`, `P2022` veya kolon/enum hatası kalmıyor.
- [ ] Render'ın çalıştırdığı commit SHA, GitHub `main` HEAD ile aynı.
- [ ] Render'ın aktif branch'i `main`.
- [ ] Son deploy migration ve build adımlarının ikisini de başarıyla tamamlıyor.

### Regresyon

- [ ] Normal sipariş gönderme çalışıyor.
- [ ] Garson masa açma ve kod doğrulama akışı çalışıyor.
- [ ] Reddetme ve cihaz engelleme korunuyor.
- [ ] Ödeme talebi akışı bozulmuyor.
- [ ] Admin ve garson panelleri açılıyor.
- [ ] `npm run build` başarılı.
- [ ] TypeScript hatası yok.

---

## Teslim Formatı

Görev sonunda kısa bir rapor oluştur:

```text
Kök hata:
Render logundaki gerçek Prisma/PostgreSQL hata kodu:

Eksik tablo/kolon/enum:
Oluşturulan migration:
Baseline uygulandı mı:
Canlı migration sonucu:
Değiştirilen dosyalar:
Yapılan testler:
Başarısız kalan test:
```

“Hata düzeltildi” deme; yalnız canlı Supabase migration'ı uygulanmış, Render deploy başarılı olmuş ve gerçek QR sipariş talebi testi `201` dönmüşse tamamlandı olarak raporla.
