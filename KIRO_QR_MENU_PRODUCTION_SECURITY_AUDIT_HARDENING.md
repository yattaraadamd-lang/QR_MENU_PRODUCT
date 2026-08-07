# Kiro Ana Görevi — QR Menü Platformu Üretim Güvenlik Denetimi ve Sertleştirme

## 0. Proje ve hedef

Repository:

```text
https://github.com/yattaraadamd-lang/QR_MENU_PRODUCT
```

Branch:

```text
main
```

Teknoloji:

```text
Next.js 15
TypeScript
NextAuth 4
Prisma 5
PostgreSQL / Supabase
Socket.IO
Render
```

Amaç:

```text
Sistemi gerçek restoran/kafe müşterilerine sunulabilecek güvenlik seviyesine getirmek.
```

Bu görev yalnız rapor üretme görevi değildir. Kodu incele, açıkları kanıtla, önceliklendir, düzelt, migration oluştur, testleri çalıştır ve sonuçları raporla.

Hiçbir otomatik tarama “tüm açıkları buldu” garantisi vermez. Bu nedenle:

1. SAST ve bağımlılık taraması,
2. manuel kod incelemesi,
3. yetki/tenant matrisi,
4. kötüye kullanım testleri,
5. eşzamanlı işlem testleri,
6. canlıya yakın staging testi

birlikte uygulanmalıdır.

---

# 1. Kesin çalışma kuralları

## Güvenli çalışma

- Önce ayrı bir güvenlik branch’i oluştur.
- Production veritabanında saldırı testi yapma.
- Yerel/test/staging ortamı kullan.
- Production verisini sıfırlama.
- `prisma migrate reset`, `DROP TABLE`, `TRUNCATE` ve `--accept-data-loss` kullanma.
- Secret, cookie, parola, QR tokenı, müşteri session tokenı veya veritabanı bağlantısını loglama.
- `npm audit fix --force` çalıştırma.
- Major dependency yükseltmelerini test etmeden uygulama.
- Çalışan sipariş, masa, ödeme ve bildirim akışlarını gereksiz yere yeniden yazma.
- Her kritik düzeltmeden sonra build ve regresyon testlerini çalıştır.
- Güvenlik düzeltmelerini küçük ve anlaşılır commitlere böl.

## Tamamlandı deme şartı

Şunlar birlikte sağlanmadan “güvenlik tamamlandı” deme:

```text
P0 açık kalmadı
P1 açıklar kapatıldı veya açık risk kabulü yazıldı
Yetki matrisi testleri geçti
Cross-tenant/IDOR testleri geçti
Socket tenant izolasyonu geçti
Login ve invite brute-force testi geçti
CustomerSession replay testi geçti
Ödeme çift işlem testi geçti
Dependency audit kabul seviyesine geldi
Build, TypeScript, Prisma ve migration testleri geçti
```

---

# 2. Önce mevcut durumu dondur

Aşağıdaki bilgileri raporla:

```text
Git commit SHA
Node sürümü
npm sürümü
Next.js sürümü
NextAuth sürümü
Prisma sürümü
PostgreSQL/Supabase ortamı
Render build ve start komutları
Mevcut migration durumu
```

Çalıştır:

```bash
git status
git rev-parse HEAD
node --version
npm --version
npm ci
npx prisma format
npx prisma validate
npx prisma generate
npx prisma migrate status
npx tsc --noEmit
npm run build
```

Mevcut başarısızlıkları güvenlik değişikliğinden önce kaydet.

## Deployment bütünlüğü

Özellikle kontrol et:

- `render.yaml` içindeki build komutu `package.json` içinde gerçekten var mı?
- Migration dosyaları Git tarafından takip ediliyor mu?
- `.gitignore` içinde `prisma/migrations/` yanlışlıkla ignore edilmiş mi?
- Render deploy sırasında `prisma migrate deploy` gerçekten çalışıyor mu?
- Migration başarısız olduğunda deployment duruyor mu?
- Render’ın aktif branch’i ve commit SHA’sı GitHub `main` ile aynı mı?

`prisma/migrations/` kalıcı olarak Git’e eklenmelidir. Şema değişikliklerinin yalnız `schema.prisma` içinde kalmasına izin verme.

---

# 3. Mevcut koddan doğrulanan P0 açıklar

Aşağıdaki bulguları yeniden doğrula ve öncelikle düzelt.

## P0-01 — Kimlik doğrulamasız garson davet kodu oluşturma

Dosya:

```text
src/app/api/staff/invite/route.ts
```

Mevcut endpoint kullanıcı doğrulaması olmadan request body’den:

```text
businessId
inviteCode
```

alıp davet oluşturuyor.

Bu endpoint yalnız ilgili işletmenin `ADMIN` kullanıcısına açık olmalıdır.

Yapılacaklar:

- Endpointi `/api/admin/staff/invites` altında admin-only yap.
- `businessId` body’den alınmamalı; session’dan türetilmeli.
- Client’ın kendi `inviteCode` değerini belirlemesine izin verme.
- En az 128 bit CSPRNG entropy ile kod üret.
- Veritabanında mümkünse kodun kendisini değil hash’ini sakla.
- Davet süresi zorunlu olsun.
- Tek kullanımlık olsun.
- Oluşturma, tüketme ve kullanıcı oluşturma transaction içinde olsun.
- Davet tüketiminde koşullu update kullan; iki eşzamanlı kayıt yalnız bir hesap oluşturabilsin.
- Invite oluşturma/kullanma endpointlerine Redis tabanlı rate limit uygula.
- Audit log oluştur.

## P0-02 — Herkese açık kayıt ve davet kodu yarışı

Dosya:

```text
src/app/api/auth/register/route.ts
```

Düzelt:

- Input için strict Zod şeması kullan.
- Email normalize et: trim + lowercase.
- Genel hata mesajı kullan; email enumeration yapma.
- `invite.expiresAt` kontrolü zorunlu.
- Kullanılmış, iptal edilmiş veya süresi dolmuş davet reddedilmeli.
- Kullanıcı oluşturma ve daveti tüketme tek transaction olmalı.
- Daveti `isUsed=false` koşuluyla atomik tüket.
- Parola politikasını güçlendir.
- Başarısız kayıt denemelerini kalıcı rate-limit store ile sınırla.
- Response içinde gereksiz kullanıcı veya işletme bilgisi dönme.

## P0-03 — Socket.IO işletme odaları kimlik doğrulamasız

Dosya:

```text
server.js
```

Mevcut istemci istediği `businessId` değerini göndererek:

```text
join_business
```

odasına katılabiliyor. Bu, başka işletmenin sipariş, ödeme ve müşteri bildirimlerinin izlenmesine yol açabilir.

Düzelt:

- Socket handshake zorunlu kimlik doğrulaması kullanmalı.
- Staff socket için NextAuth JWT veya kısa ömürlü imzalı socket token doğrula.
- Token içinden `userId`, `role`, `businessId` çıkar.
- Kullanıcının aktif ve silinmemiş olduğunu DB’den doğrula.
- Client’tan gelen `businessId` değerini yetki kaynağı olarak kullanma.
- Room yalnız:

```ts
business_${socket.data.businessId}
```

olmalı.
- Müşteri socketleri staff room’una girememeli.
- Müşteri için gerekiyorsa yalnız tahmin edilemez, kısa ömürlü session room kullan.
- Event payloadlarını Zod ile doğrula.
- Socket connection ve event rate-limit ekle.
- Origin allowlist birebir eşleşmeli.
- Production’da localhost origin ekleme.
- Yetkisiz socket bağlantısı `connect_error` ile kapanmalı.
- Cross-tenant socket entegrasyon testi yaz.

## P0-04 — Customer device HMAC için bilinen fallback secret

Dosya:

```text
src/lib/security/device-block.ts
```

Şu davranış production’da yasak:

```ts
process.env.CUSTOMER_DEVICE_HMAC_SECRET || "default-dev-secret-change-in-production"
```

Düzelt:

- Production başlangıcında secret yoksa uygulama fail-fast etsin.
- Placeholder veya kısa secret reddedilsin.
- En az 32 rastgele byte zorunlu olsun.
- Secret loglanmasın.
- `.env.example` yalnız placeholder içersin.
- Render env listesine `CUSTOMER_DEVICE_HMAC_SECRET` ekle.
- Secret değiştirme/rotasyon planı oluştur.
- Eski hashlerin rotasyonda nasıl ele alınacağını belgeleyin.

## P0-05 — VIEW_ONLY oturumla ödeme talebi gönderilebilmesi

Dosyalar:

```text
src/lib/security/validate-customer-session.ts
src/app/api/customer/payment-requests/route.ts
```

`validateCustomerActionSession()` gerçekte `validateViewSession()` çağırıyor. Ödeme endpointi bunu kullandığı için garson tarafından yetkilendirilmemiş VIEW_ONLY session ödeme talebi gönderebilir.

Düzelt:

- `validateCustomerActionSession` legacy aliasını kaldır.
- Ödeme, garson çağrısı, yardım, temizlik ve gerçek sipariş işlemleri yalnız:

```text
validateAuthorizedTableSession
```

kullanmalı.
- Yalnız `ORDER_REQUEST` VIEW_ONLY/PENDING kabul etsin.
- Test: QR fotoğrafıyla açılmış VIEW_ONLY session ödeme talebi gönderememeli.
- Test: başka aktif TableSession’a ait masa için talep gönderilememeli.

## P0-06 — Çalınan existingToken cihazla eşleştirilmiyor

Dosya:

```text
src/app/api/customer/session/route.ts
```

`existingToken` yeniden kullanılırken tokenın `deviceKeyHash` değeri mevcut cihazla karşılaştırılmıyor.

Düzelt:

- Mevcut token yalnız aynı device hash ile yeniden kullanılabilsin.
- Eski session’da device hash yoksa sessizce yeni cihaza bağlama; güvenli yeniden doğrulama uygula.
- Token-table-business-device bağlantısı zorunlu olsun.
- Session token rotasyonu ve replay detection ekle.
- Replay denemelerini audit logla.
- Farklı cihazdan aynı token testinde `403 SESSION_DEVICE_MISMATCH` dönmeli.

## P0-07 — Müşteri tokenının URL query’de taşınması

Dosya:

```text
src/app/api/customer/session/route.ts
```

Şu kullanım kaldırılmalı:

```text
GET /api/customer/session?token=...
```

Token query string’de:

- tarayıcı geçmişine,
- proxy/access loglarına,
- analytics sistemlerine,
- referrer bilgisine

sızabilir.

Düzelt:

- Token yalnız `x-session-token` header veya güvenli HttpOnly cookie ile taşınmalı.
- Hassas token endpointlerinde `Cache-Control: no-store`.
- Tokenları loglama.
- Eski GET endpointini kontrollü kaldır veya tokensız durum endpointine dönüştür.
- Mümkünse CustomerSession tokenını DB’de hashli sakla; raw token yalnız oluşturulurken döndürülmeli.

## P0-08 — Hardcoded demo ve super-admin parolaları

Dosyalar:

```text
prisma/seed.ts
prisma/seed-super-admin.ts
```

Hardcoded örnekler:

```text
admin123
garson123
```

Düzelt:

- Production’da bu seedlerin çalışması kesin engellenmeli.
- Super admin parolası environment variable’dan alınmalı.
- Eksik veya zayıf parola varsa seed fail etsin.
- Seed loglarında parola ve davet kodu yazma.
- Seed production kullanıcı parolasını her çalıştırmada sıfırlamamalı.
- Demo seed ayrı dosyada ve yalnız açıkça izin verilen local/test ortamında çalışmalı.
- Mevcut canlı ortamda bu hesaplar varsa parolaları rotate et ve aktifliklerini denetle.

## P0-09 — API yetki kapsamı yalnız middleware’e bırakılamaz

Middleware yalnız panel sayfalarını koruyor. Bütün API’ler kendi yetki ve tenant kontrolüne sahip olmalıdır.

Kiro tüm dosyaları envanterle:

```bash
find src/app/api -name route.ts -print | sort
```

Her HTTP method için tablo üret:

```text
Endpoint
Method
Public/Customer/Waiter/Admin/SuperAdmin
Kullanılan auth helper
businessId kaynağı
Ownership kontrolü
Zod validation
Rate limit
CSRF/origin kontrolü
Audit log
Sonuç
```

Kurallar:

- Admin/waiter/super-admin API’si auth’suz kalamaz.
- `businessId` staff endpointlerinde body/query’den alınamaz.
- Her resource query `businessId` ile scope edilmeli.
- IDOR testi: başka işletmeye ait ID ile `404` veya `403`.
- `SUPER_ADMIN`, `ADMIN`, `WAITER` kuralları merkezi ve açık olmalı.
- `src/lib/auth-helpers.ts` ve `src/lib/tenant.ts` içindeki iki farklı auth sistemi tek authoritative modülde birleştirilmeli.
- Kullanıcı JWT’de rol sahibi olsa bile DB’de `isActive=false` veya `deletedAt!=null` ise erişim kesilmeli.

## P0-10 — Global idempotency key ile veri sızıntısı

Dosya:

```text
src/app/api/customer/orders/route.ts
```

Client kontrollü `idempotencyKey` global unique aranıyor ve bulunan sipariş tenant/customer scope kontrolü yapılmadan döndürülebiliyor.

Düzelt:

- Idempotency scope en az:

```text
businessId + customerSessionId + idempotencyKey
```

olmalı.
- Başka tenant/session’a ait key asla response dönmemeli.
- Key formatı/uzunluğu sınırlandırılmalı.
- Response body yalnız mevcut müşterinin güvenle görebileceği alanları içermeli.
- Database unique constraint composite scope ile uyumlu olmalı.
- P2002 recovery gerçek input key ile ve tenant scope içinde yapılmalı.

---

# 4. P1 güvenlik sertleştirmeleri

## 4.1 Login güvenliği

Dosya:

```text
src/lib/auth.ts
```

Mevcut farklı mesajlar:

```text
Kullanıcı bulunamadı
Geçersiz şifre
```

email enumeration oluşturur.

Düzelt:

- Her iki durumda aynı genel hata mesajı.
- Email normalize et.
- Parola karşılaştırma davranışını timing farkını azaltacak şekilde düzenle.
- Redis/kalıcı store ile IP + email hash tabanlı login rate limit.
- Exponential backoff veya geçici kilit.
- Başarılı login sonrası sayaç temizliği.
- Şüpheli login audit logu.
- NextAuth cookie ayarlarını production için doğrula:
  - Secure
  - HttpOnly
  - SameSite
  - doğru domain
- JWT için makul `maxAge`.
- Parola/rol/aktiflik değişince eski sessionları iptal etmek için `sessionVersion` veya eşdeğer yöntem ekle.
- `NEXTAUTH_SECRET` eksik/placeholder ise production fail-fast.

## 4.2 Parola politikası

Mevcut minimum 6 karakter kabul edilmemeli.

En az:

```text
12 karakter
yaygın parola reddi
email ile aynı parola reddi
maksimum uzunluk sınırı
```

bcrypt input truncation davranışını dikkate al.

Admin parola sıfırlama:

- Audit log,
- eski session invalidation,
- geçici parolada ilk girişte değiştirme

uygulamalı.

## 4.3 Production rate limit

Projede iki ayrı in-memory rate limiter var:

```text
src/lib/rate-limit.ts
src/lib/security/rate-limit.ts
```

Bunlar multi-instance ve restart durumunda güvenilir değildir.

Düzelt:

- Tek rate-limit servisi oluştur.
- Redis/Upstash veya başka kalıcı atomic store kullan.
- IP header değerlerine körü körüne güvenme; Render trusted proxy yapısına göre gerçek IP al.
- `unknown` değerindeki bütün kullanıcıları tek kovada toplama.
- Rate limit keylerinde ham email/token tutma; HMAC/hash kullan.
- Korunacak yüzeyler:
  - login
  - register
  - invite oluşturma/kullanma
  - customer session
  - ORDER_REQUEST
  - order create
  - service request
  - payment request
  - verification code
  - QR lookup
  - socket connection/event
- `Retry-After` ve rate-limit headerları ekle.
- Limitlerin restart ve iki instance arasında çalıştığını test et.

## 4.4 Doğrulama kodu güvenliği

ORDER_REQUEST 6 haneli kodu için:

- Kod DB’de plaintext yerine hashli saklansın.
- Sabit süreli karşılaştırma kullan.
- 5 dakikalık expiry.
- Talep + personel + IP bazlı deneme sınırı.
- Başarılı kullanımdan sonra tekrar kullanılamasın.
- Hata mesajı kodun ne kadar yaklaştığını açıklamasın.
- Socket ve log payloadlarına kod ekleme.
- Kod yalnız müşterinin kendi oturumunda gösterilsin.

## 4.5 CSRF ve Origin doğrulaması

Cookie tabanlı staff mutation endpointlerinde:

- `Origin` ve gerektiğinde `Referer` allowlist kontrolü.
- Cross-origin mutation reddi.
- CORS wildcard + credentials yasak.
- JSON `Content-Type` zorunluluğu.
- NextAuth’ın kendi CSRF korumasını bozma.
- Same-site subdomain saldırılarını dikkate al.
- GET endpointlerinde veri değiştirme yasak.

Customer API’leri session header ile korunmaya devam etmeli; body’deki tenant kimliği yetki kaynağı olmamalı.

## 4.6 Güvenlik headerları

Mevcut headerlar yalnız middleware kapsamındaki panel sayfalarında uygulanıyor. Global olarak uygula:

```text
Content-Security-Policy
Strict-Transport-Security (yalnız HTTPS production)
X-Content-Type-Options
Referrer-Policy
Permissions-Policy
frame-ancestors 'none'
Cross-Origin-Opener-Policy
```

CSP’yi Next.js ve Socket.IO ile uyumlu kur:

- önce report-only test edilebilir,
- gereksiz `unsafe-eval`/`unsafe-inline` kullanma,
- mümkünse nonce,
- yalnız gerekli `connect-src`,
- yalnız gerekli image originleri.

Private/auth/customer-session API response’larında:

```text
Cache-Control: no-store
```

## 4.7 Görsel URL ve SSRF/proxy kötüye kullanımı

`next.config.mjs` içinde bütün HTTPS hostlarına izin veren:

```text
hostname: "**"
```

ayarını kaldır.

- Güvenilir image CDN/Supabase Storage domain allowlist’i kullan.
- Admin ürün `image` URL inputunu aynı allowlist ile doğrula.
- `localhost`, private IP, metadata IP ve beklenmeyen protokolleri reddet.
- Mümkünse harici URL yerine kontrollü upload/storage akışı kullan.
- Dosya yükleme varsa MIME, magic bytes, boyut ve uzantı doğrulaması yap.

## 4.8 Müşteri session sertleştirmesi

- Token en az 256 bit CSPRNG.
- DB’de hashli token.
- Raw token loglanmaz.
- Kısa ve iş akışına uygun expiry.
- Masa kapanınca bütün sessionlar kapanır.
- Ödeme tamamlanınca bütün yetkiler revoke edilir.
- `lastSeenAt` güncellemesini her requestte write amplification oluşturmayacak şekilde throttle et.
- Session fixed/replay testleri.
- Başka table/business ile eşleşmeyen token kesin reddedilir.
- Pasif işletme, silinmiş/pasif masa ve kapalı TableSession reddedilir.
- Cihaz block sistemi cookie silme ile mutlak güvenlik sağlamaz; fiziksel doğrulama ve davranışsal limitler korunmalı.

## 4.9 QR token güvenliği

- QR token en az 128 bit entropy.
- Masa numarası/slug’dan tahmin edilemez.
- DB’de hashli saklama değerlendir.
- Admin QR rotate işlemi auth + tenant + audit gerektirir.
- Eski QR token geçersiz olmalı.
- QR lookup rate-limit.
- QR token response’larda veya loglarda gereksiz dönmemeli.
- QR fotoğrafının tek başına sipariş yetkisi vermemesi korunmalı.

## 4.10 Input validation ve mass assignment

Bütün endpointlerde:

- Zod `.strict()`,
- body boyutu limiti,
- ID format/uzunluk limiti,
- array max,
- string max,
- enum,
- pagination max,
- Decimal/para kuruş hassasiyeti,
- bilinmeyen alan reddi

uygula.

Özellikle:

```text
note
reason
customerNote
name
description
ingredients
allergens
phone
image URL
amount
receivedAmount
quantity
sortOrder
```

Client’tan gelen:

```text
price
total
paidAmount
remainingAmount
role
businessId
status
handledById
```

gibi alanlara güvenme.

## 4.11 XSS ve içerik güvenliği

- Kullanıcı/admin/garson metinlerini HTML olarak render etme.
- `dangerouslySetInnerHTML` kullanımını envanterle.
- Zorunlu HTML varsa sanitize et.
- CSV/Excel export varsa formula injection önle.
- Bildirim ve audit log metinleri escape edilerek gösterilmeli.

## 4.12 Hata ve log güvenliği

Client’a dönme:

```text
Prisma query
stack trace
SQL
env
filesystem path
token
cookie
full device hash
password
```

Structured log kullan:

```text
requestId
endpoint
errorCode
actorId
businessId
resourceId
```

Hassas değerleri redact et.

404/403 davranışı resource enumeration yapmayacak şekilde tutarlı olsun.

---

# 5. Multi-tenant / IDOR denetimi

Bütün kaynaklar için iki işletmeli test verisi oluştur:

```text
Business A
Business B
Admin A
Admin B
Waiter A
Waiter B
```

Kaynaklar:

```text
Business
User
WaiterInvite
Category
Product
Table
Order
OrderItem
ServiceRequest
Notification
TableSession
Bill
Payment
CustomerSession
CustomerAccessBlock
Subscription
AuditLog
```

Her GET/POST/PATCH/PUT/DELETE için test:

- A kullanıcısı B kaynağını ID değiştirerek okuyamaz.
- A kullanıcısı B kaynağını değiştiremez.
- B kaynak varlığını gereksiz hata farkıyla öğrenemez.
- Nested relation sorgularında da `businessId` doğrulanır.
- Super admin işlemleri ayrı açık kurala sahiptir.

Resource ownership yalnız ön kontrol olarak kalmamalı; mutation query’sinin `where` koşulunda da tenant scope bulunmalıdır.

---

# 6. Ödeme ve finansal güvenlik

Mevcut admin kontrollü ödeme hedefini koru.

Kurallar:

- Garson finansal olarak `PAID` yapamaz.
- Yalnız admin nihai tahsilat yapabilir.
- Tek merkezi ödeme servisi.
- Client tutarına güvenme.
- Sipariş toplamı ve ödenen tutar server-side.
- Decimal/kuruş hassasiyeti.
- Idempotency.
- Koşullu status geçişi.
- Transaction içinde yalnız `tx.*`.
- Socket transaction dışında.
- Çift tıklama, iki admin ve retry çift ciro oluşturmamalı.
- Audit log zorunlu.
- Tam ödeme atomik olarak:
  - Payment PAID
  - Bill CLOSED/PAID
  - Order payment PAID
  - TableSession CLOSED
  - CustomerSession CLOSED/REVOKED
  - Table doğru duruma
- Kısmi ödeme masa ve oturumu kapatmamalı.
- Garsonun girip adminin onayladığı nakit tutarı ve para üstü kayıt altına alınmalı.
- Payment, refund/void ve düzeltme işlemleri silinmemeli; ters kayıt/audit yaklaşımı kullanılmalı.

Race-condition testleri:

```text
aynı payment iki admin
aynı bill iki endpoint
timeout sonrası retry
aynı idempotency key
kısmi ödeme sonrası ikinci ödeme
```

---

# 7. Veritabanı ve Supabase güvenliği

## 7.1 Migration bütünlüğü

- `schema.prisma` ile canlı DB diff çıkar.
- Veri kaybetmeyen migration üret.
- Migrationlar Git’e commit edilir.
- Deploy sırasında `prisma migrate deploy`.
- Drift tespit edilirse deploy başarısız.
- Schema eksikliği client’ta genel 500 olarak gizlenmemeli; server logunda güvenli hata kodu olmalı.

## 7.2 Constraint ve race koruması

Kontrol et ve gerekiyorsa SQL partial unique index ekle:

```text
masa başına tek ACTIVE TableSession
TableSession başına tek OPEN Bill
session başına tek aktif payment request
ORDER_REQUEST başına tek aktif işlem
tek kullanımlık invite atomik tüketim
payment idempotency
```

Uygulama kontrolü tek başına yeterli değildir; DB constraint ile destekle.

## 7.3 Supabase erişimi

- Browser bundle içinde DB URL veya service-role key bulunmamalı.
- Backend DB kullanıcısı minimum yetkili olmalı.
- Supabase REST/GraphQL açıksa private tablolar için RLS/revoke politikalarını kontrol et.
- `anon` ve `authenticated` rolleri payment, user, session ve audit tablolarını doğrudan okuyamamalı/yazamamalı.
- Storage bucket politikalarını incele.
- Database backup ve restore testi planla.

## 7.4 Tehlikeli bakım scriptleri

```text
prisma/reset-db.ts
scripts/cleanup*
seed*
```

- Production’da yanlışlıkla çalıştırılamasın.
- Environment guard, açık confirmation ve dry-run kullan.
- Build/deploy scripti bu dosyaları çağırmamalı.
- Silme scriptleri prod credentials ile çalışmayı reddetmeli.

---

# 8. Audit log

Append-only `AuditLog` veya eşdeğer model oluştur.

Loglanacak kritik işlemler:

```text
login success/failure/lockout
invite oluşturma/kullanma/iptal
kullanıcı oluşturma/deactivate/rol/parola
QR rotate
masa açma/zorla kapatma
ORDER_REQUEST onay/red
sipariş durum/iptal/stok değişimi
cihaz block/unblock
ödeme onay/red/tahsilat
adisyon kapatma
subscription ve işletme aktiflik değişimi
```

Alanlar:

```text
id
businessId
actorUserId
actorRole
action
entityType
entityId
requestId
ipHash
userAgent özeti
beforeJson (hassas alanlar redact)
afterJson (hassas alanlar redact)
createdAt
```

Audit kayıtları normal admin tarafından değiştirilememeli veya silinememeli.

---

# 9. Dependency ve supply-chain denetimi

Çalıştır ve çıktıları `artifacts/security/` altında sakla:

```bash
npm audit --json
npm audit --omit=dev --json
npm outdated
```

Mümkünse ayrıca:

```text
OSV-Scanner
Semgrep
CodeQL
Gitleaks
GitHub dependency review
GitHub secret scanning
```

Kurallar:

- Önce exact dependency tree ve reachable kullanım belirle.
- Kritik/yüksek açıkların exploitability durumunu yaz.
- Güvenli patch/minor upgrade tercih et.
- `npm audit fix --force` kullanma.
- Lockfile commit et.
- `npm ci` kullan.
- Dependency kaldırılabiliyorsa kaldır.
- GitHub Dependabot yapılandır.
- CI’ye production dependency security gate ekle.
- False positive/risk acceptance açıklamasız bırakma.

Secret taraması yalnız mevcut dosyaları değil Git geçmişini de kapsamalıdır. Secret bulunursa dosyadan silmek yetmez; secret rotate edilir.

---

# 10. CI güvenlik kapısı

`.github/workflows/security.yml` oluştur veya mevcut CI’ye ekle:

```text
npm ci
Prisma validate/generate
TypeScript
build
unit/integration tests
npm audit production gate
secret scan
SAST/CodeQL
migration status/diff check
```

Pull requestlerde:

- test başarısızsa merge yok,
- kritik/yüksek yeni dependency açığı varsa merge yok,
- migration bekleniyorsa schema-only değişiklik kabul edilmez,
- hardcoded secret pattern kabul edilmez.

CI loglarında secret maskelenmeli.

---

# 11. Zorunlu güvenlik testleri

## AUTH

- [ ] Kullanıcı var/yok login mesajı aynı.
- [ ] 5+ başarısız giriş rate-limit/lockout.
- [ ] Server restart rate limiti sıfırlamıyor.
- [ ] Deactivate edilen kullanıcının eski JWT’si çalışmıyor.
- [ ] Waiter admin endpointine erişemiyor.
- [ ] Admin super-admin endpointine erişemiyor.
- [ ] Password değişince eski session geçersiz.

## INVITE

- [ ] Auth’suz invite oluşturma `401`.
- [ ] Waiter invite oluşturma `403`.
- [ ] Admin yalnız kendi business’ına invite oluşturur.
- [ ] Kod tahmin edilemez.
- [ ] Süresi dolmuş kod reddedilir.
- [ ] Aynı kodla eşzamanlı iki kayıt yalnız bir hesap üretir.
- [ ] Invite brute force rate-limited.

## TENANT / IDOR

- [ ] Business A hiçbir Business B kaynağını okuyamaz/değiştiremez.
- [ ] Body/query businessId manipülasyonu işe yaramaz.
- [ ] Nested resources tenant-safe.
- [ ] Idempotency key başka tenant verisi döndürmez.

## SOCKET

- [ ] Auth’suz socket reddedilir.
- [ ] A kullanıcısı B room’una katılamaz.
- [ ] Client businessId değiştirerek room seçemez.
- [ ] Müşteri staff room’una giremez.
- [ ] Event spam rate-limited.
- [ ] Socket payloadları doğrulanır.

## CUSTOMER SESSION

- [ ] Token URL query’de taşınmıyor.
- [ ] Token log/cache/referrer’a sızmıyor.
- [ ] Aynı token farklı cihazda reddedilir.
- [ ] VIEW_ONLY ödeme talebi gönderemez.
- [ ] VIEW_ONLY gerçek sipariş gönderemez.
- [ ] ORDER_REQUEST VIEW_ONLY ile kontrollü çalışır.
- [ ] Masa kapanınca eski token çalışmaz.
- [ ] Başka masa/business için token çalışmaz.
- [ ] Block edilmiş cihaz yeni işlem oluşturamaz.

## ORDER / REQUEST

- [ ] Fiyat yalnız server-side.
- [ ] Başka tenant ürünü reddedilir.
- [ ] Stokta olmayan/silinmiş ürün reddedilir.
- [ ] Quantity ve body limitleri çalışır.
- [ ] Idempotency tenant/session scoped.
- [ ] Verification code brute-force korumalı.
- [ ] Duplicate notification oluşmaz.

## PAYMENT

- [ ] Garson PAID yapamaz.
- [ ] Admin-only finalization.
- [ ] İki admin çift ciro oluşturmaz.
- [ ] Retry çift ödeme oluşturmaz.
- [ ] Kısmi ve tam ödeme doğru.
- [ ] Client amount manipülasyonu işe yaramaz.
- [ ] Transaction timeout/retry güvenli.
- [ ] Audit log oluşur.

## HTTP / WEB

- [ ] CSP çalışıyor.
- [ ] Security headerlar public, customer ve API response’larında uygun.
- [ ] Private endpoint `no-store`.
- [ ] Cross-origin mutation reddedilir.
- [ ] Arbitrary image host kapalı.
- [ ] XSS payloadları text olarak görünür.
- [ ] Büyük body ve aşırı array reddedilir.

## DATABASE / DEPLOY

- [ ] Migrationlar Git’te.
- [ ] Drift yok.
- [ ] Render doğru build scripti çalıştırıyor.
- [ ] Production seed/reset engelli.
- [ ] P2021/P2022/42703 yok.
- [ ] Supabase private tablolara anon erişim yok.
- [ ] Backup/restore prosedürü belgeli.

---

# 12. Öncelik ve commit planı

Önerilen sıra:

```text
Commit 1  — deployment/migration güvenlik kapısı
Commit 2  — invite/register account takeover düzeltmesi
Commit 3  — socket authentication ve tenant rooms
Commit 4  — customer session/token/device binding
Commit 5  — merkezi staff auth + tenant/IDOR düzeltmeleri
Commit 6  — login/session invalidation/rate limit
Commit 7  — payment concurrency ve audit log
Commit 8  — CSP, headers, CORS, image allowlist
Commit 9  — dependency/CI/security tests
```

Her commit sonrası:

```bash
npx prisma validate
npx prisma generate
npx tsc --noEmit
npm run build
```

ve ilgili testler çalıştırılmalı.

---

# 13. Teslim dosyaları

Kiro görev sonunda üretmeli:

```text
SECURITY_AUDIT_REPORT.md
SECURITY_FIX_REPORT.md
SECURITY_TEST_MATRIX.md
SECURITY_RISK_ACCEPTANCE.md
SECURITY_DEPLOYMENT_CHECKLIST.md
artifacts/security/npm-audit-before.json
artifacts/security/npm-audit-after.json
```

`SECURITY_AUDIT_REPORT.md` her bulgu için:

```text
ID
Başlık
Severity
CWE / OWASP kategorisi
Etkilenen dosya/endpoint
Saldırı senaryosu
Kanıt
Düzeltme
Test
Durum
```

formatını kullanmalı.

---

# 14. Son rapor formatı

```text
İncelenen commit:
İncelenen API sayısı:
Public endpointler:
Customer endpointler:
Waiter endpointler:
Admin endpointler:
Super-admin endpointler:

P0 bulunan:
P0 kapatılan:
P1 bulunan:
P1 kapatılan:
Açık kalan riskler:

Invite/register testi:
Socket cross-tenant testi:
Login brute-force testi:
Customer token replay testi:
VIEW_ONLY yetki testi:
IDOR testi:
Ödeme concurrency testi:
Dependency audit sonucu:
Secret scan sonucu:
Migration sonucu:
Build sonucu:
Staging smoke test sonucu:

Değiştirilen dosyalar:
Oluşturulan migrationlar:
Rotate edilmesi gereken secretlar:
Production öncesi manuel adımlar:
```

Kiro yalnız kodun derlenmesine bakarak güvenli olduğunu iddia etmemeli. Negatif yetki testleri ve kötüye kullanım testleri kanıtlanmadan bu görev tamamlanmış sayılmaz.
