# GÖREV: QR Menü SaaS Projesini Production / Pazarlanabilir Ürün Seviyesine Getir

İnceleyeceğin proje:

GitHub Repository:
`https://github.com/yattaraadamd-lang/QR_MENU_PRODUCT`

Bu proje restoran/kafe işletmeleri için geliştirilmiş multi-tenant bir QR Menü + Sipariş + Garson + Admin + Masa Yönetimi sistemidir.

Amacın yalnızca kod hatalarını düzeltmek değildir.

Ana hedef:

> Bu projeyi gerçek restoranlarda kullanılabilecek, güvenli, stabil, test edilebilir, veri kaybına ve tenant ihlallerine karşı dayanıklı, production ortamına uygun bir SaaS ürünü haline getirmek.

---

# 1. ÇALIŞMA KURALI

Öncelikle tüm repository'yi analiz et.

Doğrudan rastgele kod değiştirmeye başlama.

Şunları incele:

- `package.json`
- Prisma schema
- API route'ları
- authentication sistemi
- authorization sistemi
- customer session sistemi
- waiter authentication
- admin authentication
- middleware
- tenant izolasyonu
- Socket.IO
- sipariş akışı
- masa yönetimi
- ödeme/adisyon sistemi
- subscription sistemi
- security utilities
- rate limiting
- idempotency sistemi
- audit log sistemi
- Render deployment
- environment variables
- GitHub Actions
- Next.js configuration
- security headers
- mevcut `.md` güvenlik/test raporları

Önce mevcut mimariyi anlamadan büyük çaplı refactor yapma.

Mevcut çalışan özellikleri bozma.

---

# 2. ÖNCELİK SINIFLANDIRMASI

Bulduğun sorunları şu şekilde sınıflandır:

## P0 — Production Blocker

Gerçek müşteriye sunulmadan önce kesinlikle çözülmesi gereken problemler.

Örneğin:

- tenant izolasyonu ihlali
- authentication bypass
- authorization bypass
- başka restorana ait verilere erişim
- ödeme manipülasyonu
- sipariş kaybı
- duplicate order
- masa durumunun bozulması
- veri kaybı
- kritik race condition
- kritik security vulnerability

## P1 — Production Öncesi Önemli

- otomatik test eksikliği
- monitoring eksikliği
- audit log eksikleri
- CSP eksikleri
- rate limit problemleri
- hata yönetimi
- deployment güvenliği
- subscription limit enforcement
- logging
- database consistency

## P2 — Ürün Kalitesi

- UX problemleri
- performans iyileştirmeleri
- kod temizliği
- teknik borç
- developer experience
- onboarding
- yönetim kolaylığı

Önce P0'ları çöz.

Ardından P1.

P2 için çalışan sistemi gereksiz yere yeniden yazma.

---

# 3. MULTI-TENANT GÜVENLİĞİ

Bu sistemdeki EN KRİTİK güvenlik konusu tenant izolasyonudur.

Her işletmenin verileri diğer işletmelerden tamamen ayrılmış olmalıdır.

Özellikle şu ID'leri kullanan bütün endpointleri incele:

- `businessId`
- `productId`
- `categoryId`
- `tableId`
- `orderId`
- `orderItemId`
- `paymentId`
- `billId`
- `waiterId`
- `serviceRequestId`
- `tableSessionId`
- `subscriptionId`

Şu saldırıyı sistematik olarak test et:

Örneğin:

Anadolu Restaurant admin hesabıyla login ol.

Daha sonra request içerisindeki:

`productId`

veya

`tableId`

veya

`businessId`

veya

`orderId`

değerini Moka Restaurant'a ait bir ID ile değiştir.

Sunucu:

`403`

veya

`404`

döndürmeli.

ASLA başka tenant'a ait veriyi:

- göstermemeli
- değiştirmemeli
- silememeli
- sipariş oluşturamamalı
- ödeme değiştirememeli

Sadece frontend kontrolüne güvenme.

Tenant doğrulaması SERVER-SIDE olmak zorunda.

Bütün API endpointlerini bu açıdan audit et.

---

# 4. MASS ASSIGNMENT / BODY MANIPULATION

Client'tan gelen hiçbir kritik alanı doğrudan Prisma'ya geçirme.

Örneğin tehlikeli kullanım:

```ts
prisma.order.update({
  data: req.body
})
```

gibi yapıları tespit et.

Kullanıcı tarafından değiştirilememesi gereken alanları server belirlemeli.

Örneğin:

- `businessId`
- `paid`
- `paidAt`
- `paymentStatus`
- `role`
- `tenantId`
- `totalAmount`
- `createdBy`
- `approvedBy`
- `tableStatus`

istemciden doğrudan kabul edilmemeli.

Explicit allowlist kullan.

---

# 5. SİPARİŞ AKIŞI

Aşağıdaki gerçek restoran akışını eksiksiz test et.

## Senaryo A

1. Müşteri QR okutur.
2. Menü açılır.
3. Ürün sepete eklenir.
4. Sipariş talebi oluşturulur.
5. Garson panelinde masa açma talebi görünür.
6. Garson masayı doğrular/açar.
7. Müşteri sipariş verir.
8. Sipariş garson paneline düşer.
9. Garson siparişi işleme alır.
10. Sipariş hazırlanır.
11. Teslim edilir.
12. Masa açık kalır.

Her state transition server tarafında doğrulanmalı.

---

# 6. İKİNCİ SİPARİŞ

Masa zaten açıkken müşteri ikinci sipariş verebilmeli.

Tekrar masa açma talebi oluşturmamalı.

İkinci sipariş:

aynı aktif `tableSession`

üzerinden devam etmeli.

---

# 7. SİPARİŞ İPTALİ

Garson siparişi reddettiğinde veya iptal ettiğinde:

müşteri kalıcı olarak kilitlenmemeli.

Masa yanlış şekilde:

`OCCUPIED`

veya

`PENDING`

durumunda takılı kalmamalı.

İptal sonrası sistemin state transition'larını incele.

Dead state oluşmamalı.

---

# 8. MASA SESSION STATE MACHINE

Masa durumlarını merkezi ve anlaşılır bir state machine mantığına getir.

Örneğin:

```text
AVAILABLE
↓
PENDING_OPEN
↓
OCCUPIED
↓
PAYMENT_REQUESTED
↓
CLOSING
↓
AVAILABLE
```

İptal senaryolarını da belirle.

Örneğin:

```text
PENDING_OPEN → AVAILABLE
PAYMENT_REQUESTED → OCCUPIED
```

Geçersiz transition'ları backend reddetmeli.

Frontend'in gönderdiği state'e körü körüne güvenme.

---

# 9. RACE CONDITION TESTLERİ

Aynı anda iki request geldiğinde sistemi test et.

Özellikle:

- iki kez Sipariş Ver butonuna basılması
- aynı ödeme talebinin iki kez gönderilmesi
- iki garsonun aynı siparişi alması
- iki kişinin aynı masayı açmaya çalışması
- aynı masa için iki session oluşturulması
- aynı bill'in iki kere kapatılması

Database transaction veya unique constraint gereken yerleri belirle.

---

# 10. IDEMPOTENCY

Kritik POST işlemlerinde idempotency sistemini kontrol et.

Özellikle:

- order creation
- payment request
- payment completion
- table opening
- table closing
- service requests

Aynı request iki kez gönderildiğinde iki ayrı kayıt oluşmamalı.

---

# 11. PAYMENT / ADİSYON GÜVENLİĞİ

Ödeme sistemini özellikle güvenlik açısından incele.

Garson şu işlemleri yapamamalı:

- geçmiş ödemeyi gizlice değiştirmek
- ödeme tutarını değiştirmek
- ödenmiş hesabı tekrar açmak
- ödeme kaydını silmek
- başka masaya ödeme yazmak
- farklı business ödeme kaydını değiştirmek

Para ile ilgili kritik işlemler transaction kullanmalı.

Backend ödeme tutarını client'tan gelen değerden belirlememeli.

Tutar:

SERVER-SIDE

order/bill verileri kullanılarak hesaplanmalı.

---

# 12. AUDIT LOG

Aşağıdaki olayların loglanmasını kontrol et:

- sipariş iptali
- ödeme
- ödeme iptali
- masa açılması
- masa kapatılması
- garson işlemleri
- admin değişiklikleri
- ürün fiyat değişimi
- kullanıcı rol değişimi
- subscription değişikliği

Audit kaydı mümkünse şu bilgileri içermeli:

```text
businessId
userId
role
action
entityType
entityId
oldValue
newValue
timestamp
requestId
ip
```

Hassas bilgileri loglama:

- password
- token
- cookie
- authorization header

---

# 13. CUSTOMER SESSION SECURITY

QR kodunun fotoğrafını çeken kişinin restoran dışında sınırsız sipariş vermesini önleyecek mevcut sistemi incele.

Location/geolocation tabanlı çözüm KULLANMA.

Mevcut sistemde mümkünse:

- table session
- short-lived token
- one-time verification
- session binding
- expiry
- revoke
- server-side validation

kullan.

Eski/revoke edilmiş session ile sipariş verilememeli.

---

# 14. AUTH STATUS

Projede kullanılan tüm auth state'lerini merkezi hale getir.

Örneğin:

```ts
PENDING
VIEW_ONLY
AUTHORIZED
REVOKED
EXPIRED
```

Frontend ve backend aynı type/schema üzerinden ilerlesin.

Aynı state için farklı union type'lar oluşturulmasın.

TypeScript uyuşmazlıklarını kalıcı olarak gider.

---

# 15. SOCKET.IO SECURITY

Socket bağlantılarında:

client'ın gönderdiği `businessId`

tek başına güvenilir kabul edilmemeli.

Authenticated kullanıcının server-side business bilgisi kullanılmalı.

Test et:

Anadolu kullanıcısı socket üzerinden Moka `businessId` gönderirse:

Moka'nın:

- siparişlerini
- masa bildirimlerini
- ödeme taleplerini
- service request'lerini

alamamalı.

Socket room authorization server-side yapılmalı.

---

# 16. REAL-TIME RELIABILITY

Socket bağlantısı koparsa sistem tamamen bozulmamalı.

Reconnect sonrası:

- siparişler
- ödeme talepleri
- masa durumları

REST/API üzerinden yeniden senkronize edilmeli.

Socket sadece realtime notification mekanizması olsun.

Database source-of-truth olmalı.

---

# 17. AUTOMATED TEST ALTYAPISI

Projede kapsamlı otomatik test sistemi oluştur.

Tercihen:

### Unit / Integration

Vitest veya Jest

### E2E

Playwright

kullan.

Özellikle aşağıdaki E2E testlerini oluştur:

```text
customer-order-flow.spec.ts
second-order.spec.ts
order-cancel.spec.ts
payment-flow.spec.ts
table-close.spec.ts
tenant-isolation.spec.ts
duplicate-order.spec.ts
session-expiration.spec.ts
waiter-permission.spec.ts
socket-tenant-isolation.spec.ts
```

---

# 18. TENANT TEST FIXTURE

Test database içerisinde en az iki işletme oluştur:

```text
Anadolu Restaurant
Moka Cafe
```

Her ikisinde farklı:

- admin
- waiter
- table
- menu
- category
- product
- order

oluştur.

Tenant saldırı testlerinde bu iki işletmeyi kullan.

---

# 19. CI/CD

GitHub Actions workflow'larını incele.

Pipeline minimum olarak şunları çalıştırmalı:

```bash
npm ci

npx prisma validate

npm run lint

npm run typecheck

npm run test

npm run test:e2e

npm run build

npm audit
```

Eğer mevcut workflow içerisinde:

```bash
npm audit ... || true
```

gibi audit hatasını yok sayan kullanım varsa düzelt.

Critical vulnerability deployment'ı durdurmalı.

High için uygulanabilir güvenli politika belirle.

---

# 20. DEPENDENCY SECURITY

Çalıştır:

```bash
npm audit
npm outdated
```

Critical ve High açıkları incele.

Ancak:

`npm audit fix --force`

komutunu körü körüne kullanma.

Breaking change oluşturabilecek major dependency update'lerini analiz et.

Her düzeltmeden sonra:

```bash
npm run build
npm run typecheck
npm test
```

çalıştır.

---

# 21. SECURITY HEADERS

`next.config.*`

ve middleware'i incele.

Kontrol et:

- Content-Security-Policy
- HSTS
- X-Content-Type-Options
- Referrer-Policy
- Permissions-Policy
- frame-ancestors

CSP şu anda `Report-Only` ise nedenini analiz et.

Mümkünse production CSP enforcement'a geçiş planı oluştur.

Özellikle:

```text
unsafe-inline
unsafe-eval
```

kullanımını azalt.

Ancak Next.js uygulamasını bozacak kör bir CSP değişikliği yapma.

---

# 22. CSRF / COOKIE SECURITY

Authentication cookie'lerini kontrol et.

Production için uygun şekilde:

```text
HttpOnly
Secure
SameSite
```

ayarları kullanılmalı.

State-changing request'lerde CSRF riskini değerlendir.

---

# 23. RATE LIMIT

Aşağıdaki endpoint gruplarında rate limit kontrolü yap:

- login
- table verification
- customer session creation
- order
- service request
- payment request
- password reset benzeri işlemler

Rate limiting tenant/user/IP bağlamında doğru uygulanmalı.

---

# 24. INPUT VALIDATION

API inputlarını validation schema ile doğrula.

Tercihen:

`zod`

veya projede mevcut validation altyapısını kullan.

Kontrol et:

- UUID
- email
- price
- quantity
- strings
- enum
- table number
- IDs

Prisma hatalarının client'a raw şekilde dönmesini engelle.

---

# 25. ERROR HANDLING

Production response'larında şunları göstermeme:

```text
stack trace
database URL
Prisma internal error
filesystem path
secret
JWT
database query
```

Client'a güvenli hata mesajı dön.

Server logunda detay saklanabilir.

---

# 26. REQUEST ID

Her request için unique request ID oluştur.

Örneğin:

```text
x-request-id
```

Kritik log ve audit event'lerinde kullan.

Production hata incelemesini kolaylaştır.

---

# 27. OBSERVABILITY

Projeyi monitoring entegrasyonuna hazırla.

Minimum olarak:

- health endpoint
- structured logs
- request ID
- frontend exception capture
- backend exception capture
- unhandled rejection tracking

oluştur.

Sentry gibi harici servis credentials gerektiriyorsa secret uydurma.

Bunun yerine gerekli environment variable'ları ve entegrasyon kodunu hazırla.

---

# 28. HEALTH CHECK

`/api/health`

veya mevcut health endpoint'i kontrol et.

En azından:

- app status
- database connectivity

kontrol edilebilsin.

Fakat endpoint:

secret

veya sistem mimarisi hakkında gereksiz bilgi göstermesin.

---

# 29. DATABASE

Prisma schema'yı analiz et.

Kontrol et:

- foreign keys
- indexes
- unique constraints
- cascading delete
- monetary fields
- timestamps
- tenant relations

Para için floating point kullanımından kaçın.

Mümkünse Decimal / uygun integer representation kullan.

---

# 30. DATABASE TRANSACTIONS

Şu işlemler transaction gerektiriyor mu kontrol et:

```text
table open + session create

order + order items create

payment + bill update

table close + session close

subscription update
```

Yarım kalmış işlem sonucu inconsistent state oluşmamalı.

---

# 31. SUBSCRIPTION SECURITY

Projede bulunan subscription sistemini incele.

Plan limitlerinin sadece UI'da uygulanması kabul edilemez.

Örneğin:

```text
maxTables
maxWaiters
maxProducts
```

backend tarafından enforce edilmeli.

FREE/TRIAL işletmesi request'i elle değiştirerek premium limite erişememeli.

---

# 32. SUBSCRIPTION STATES

Şu durumları doğru işle:

```text
TRIAL
ACTIVE
PAST_DUE
CANCELLED
EXPIRED
```

Expired işletmenin davranışı açık şekilde tanımlı olsun.

Örneğin müşterilerin mevcut menüyü görebilmesi ile admin'in yeni ürün ekleyebilmesi farklı politikalar olabilir.

---

# 33. ADMIN / WAITER ROLE SECURITY

RBAC sistemini kontrol et.

Waiter:

- işletme ayarlarını değiştirememeli
- başka garson oluşturamamalı
- subscription değiştirememeli
- ürün fiyatı değiştirememeli
- audit log silememeli

Admin yetkileri server-side doğrulanmalı.

---

# 34. QR SECURITY

QR içerisinde:

secret

JWT

database ID gibi kalıcı hassas bilgi bulunmamalı.

QR mümkün olduğunca işletme/masa public identifier'ı içersin.

Gerçek authorization server-side session üzerinden yapılsın.

---

# 35. ENVIRONMENT VARIABLES

Repository içerisinde kontrol et:

```text
.env
.env.local
password
DATABASE_URL
JWT_SECRET
API keys
Supabase keys
Render secrets
```

gerçek secret yanlışlıkla commit edilmiş mi?

Secret bulunursa:

SADECE DOSYADAN SİLME.

Raporunda açıkça:

`ROTATE THIS SECRET`

olarak belirt.

Git history'nin de kontrol edilmesi gerektiğini belirt.

---

# 36. PRODUCTION VS DEVELOPMENT

Production davranışı ile development davranışını ayır.

Production'da:

- debug endpoint
- verbose logs
- test credentials
- seed endpoint
- dev bypass
- mock auth

açık kalmamalı.

---

# 37. RENDER DEPLOYMENT

`render.yaml`

ve Render konfigurasyonunu incele.

Production deployment için:

- health check
- restart behavior
- environment variables
- build command
- start command
- migration strategy

kontrol et.

Ücretsiz instance kullanımı varsa bunu production risk olarak raporla.

Ancak kullanıcının Render hesabında doğrudan ücretli plan değiştirme.

Sadece gerekli değişiklikleri/önerileri belirt.

---

# 38. PRISMA MIGRATION STRATEGY

Production'da:

`prisma db push`

gibi riskli yaklaşım varsa değerlendir.

Tercihen migration tabanlı deployment kullan.

Migration sırasında veri kaybı oluşturabilecek değişiklikleri otomatik uygulama.

---

# 39. BACKUP / RESTORE

Kod tarafından yapılabilecek hazırlıkları yap.

Ancak Supabase backup ayarlarını erişimin yoksa uydurma.

Dokümante et:

- backup politikası
- restore prosedürü
- staging restore testi

---

# 40. LOGGING SECURITY

Loglarda şunları maskala:

```text
password
token
authorization
cookie
session
secret
API key
```

PII loglamasını minimumda tut.

---

# 41. PERFORMANCE

Özellikle:

- menu page
- waiter requests
- admin dashboard
- orders
- payments

üzerindeki query'leri incele.

N+1 query ve gereksiz polling varsa düzelt.

Ancak güvenlik ve correctness'den önce performans optimizasyonu yapma.

---

# 42. FRONTEND STATE

Frontend state database gerçeğinden kopmamalı.

Özellikle:

- table status
- order status
- payment status
- auth status

server response ile reconcile edilmeli.

Optimistic update başarısız olduğunda rollback yapılmalı.

---

# 43. BUTTON / DOUBLE SUBMIT

Kritik butonlarda:

- loading
- disabled state
- duplicate submission protection

uygula.

Özellikle:

```text
Sipariş Ver
Masayı Aç
İşleme Al
Tamamla
Ödeme Al
Masayı Kapat
```

---

# 44. MOBILE EXPERIENCE

Garson panelini mobil kullanım açısından incele.

Minimum:

- responsive
- büyük dokunma alanları
- reconnect davranışı
- bildirim göstergeleri
- sipariş state görünürlüğü

iyileştir.

Ancak bu görev kapsamında native mobile app geliştirmeye başlama.

Öncelik mevcut web uygulamasının stabil olması.

---

# 45. TEST EDİLECEK NEGATIVE SENARYOLAR

Aşağıdaki durumların tamamını test et:

```text
invalid businessId
invalid productId
invalid tableId
foreign tenant ID
deleted product
inactive business
expired customer session
revoked customer session
expired subscription
unauthorized waiter
non-admin admin endpoint request
duplicate payment
duplicate order
closed table order
wrong table session
negative quantity
quantity = 0
huge quantity
negative price
modified total
invalid enum
malformed JSON
missing CSRF/auth data
```

---

# 46. ACCEPTANCE CRITERIA

Çalışma tamamlandığında aşağıdaki şartlar sağlanmalı.

## Build

```bash
npm run build
```

PASS

## TypeScript

```bash
npm run typecheck
```

PASS

## Prisma

```bash
npx prisma validate
```

PASS

## Automated tests

PASS

## E2E critical flows

PASS

## Tenant isolation

PASS

## Payment integrity

PASS

## Duplicate request protection

PASS

Critical veya High severity unresolved güvenlik açığı varsa açıkça belirt.

Test geçmiyorsa gizleme.

---

# 47. YAPMAMAN GEREKENLER

Şunları yapma:

- çalışan sistemi komple yeniden yazma
- authentication mimarisini sebepsiz değiştirme
- Prisma schema'yı gereksiz yere yeniden tasarlama
- package update'lerini körü körüne yapma
- `npm audit fix --force` komutunu analiz etmeden çalıştırma
- security check'i yalnızca frontend'e koyma
- TypeScript hatasını `any` kullanarak gizleme
- ESLint hatalarını disable ederek geçiştirme
- testleri silerek CI'ı yeşile çevirme
- hata veren kodu comment-out ederek problemi saklama
- production secret uydurma
- `.env` içerisine sahte production secret yazma

Özellikle:

```ts
as any
// @ts-ignore
// eslint-disable
```

gibi kaçış yollarını sadece gerçekten zorunlu ve gerekçeli durumlarda kullan.

---

# 48. HER DÜZELTME SONRASI

Mümkün olduğunca küçük değişiklikler yap.

Önemli değişikliklerden sonra çalıştır:

```bash
npm run typecheck
npm run build
```

Test sistemi kurulduktan sonra:

```bash
npm test
```

ve ilgili E2E testlerini çalıştır.

Bir problemi çözerken başka çalışan akışı bozmadığını doğrula.

---

# 49. SON RAPOR

Çalışma sonunda repository root'una şu dosyayı oluştur:

`PRODUCTION_READINESS_REPORT.md`

Dosyada şu bölümler olsun:

```markdown
# Production Readiness Report

## Genel Sonuç

## P0 Sorunlar

## P1 Sorunlar

## P2 Sorunlar

## Düzeltilen Güvenlik Açıkları

## Multi-Tenant Isolation Sonuçları

## Authentication / Authorization

## Sipariş Sistemi

## Masa Session Sistemi

## Payment / Adisyon Sistemi

## Socket.IO

## Subscription Sistemi

## Automated Tests

## CI/CD

## Dependency Security

## Database

## Monitoring / Logging

## Deployment

## Manuel Yapılması Gerekenler

## Production Öncesi Checklist

## Pilot Kullanıma Hazır mı?

## Genel Satışa Hazır mı?
```

---

# 50. SONUÇ DERECELENDİRMESİ

Raporun sonunda projeye aşağıdaki değerlendirmelerden birini ver:

### 🔴 PRODUCTION'A HAZIR DEĞİL

Critical/P0 problem mevcut.

### 🟠 SADECE KONTROLLÜ PİLOT İÇİN UYGUN

Temel güvenlik sağlanmış ancak gerçek kullanım doğrulaması gerekiyor.

### 🟢 PRODUCTION / MÜŞTERİ KULLANIMINA HAZIR

Critical akışlar otomatik test edilmiş, tenant izolasyonu doğrulanmış, ödeme bütünlüğü sağlanmış ve deployment güvenilir durumda.

Sonucu olduğundan iyi göstermeye çalışma.

Gerçek teknik durumu raporla.

---

# TEMEL PRENSİP

Bu projede en önemli sıralama:

```text
SECURITY
↓
DATA INTEGRITY
↓
TENANT ISOLATION
↓
ORDER CORRECTNESS
↓
PAYMENT CORRECTNESS
↓
RELIABILITY
↓
TESTING
↓
PERFORMANCE
↓
UX
```

Görsel iyileştirmeler uğruna kritik backend güvenliğini ikinci plana atma.

Amaç:

> QR_MENU_PRODUCT repository'sini yalnızca çalışan bir demo olmaktan çıkarıp gerçek restoranlarda pilot olarak kullanılabilecek ve ardından ticari SaaS ürünü olarak pazarlanabilecek güvenilir bir sisteme dönüştürmek.