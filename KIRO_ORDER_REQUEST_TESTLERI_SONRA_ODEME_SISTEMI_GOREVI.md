# Kiro Görevi — Önce ORDER_REQUEST Fonksiyonel Testleri, Sonra Ödeme Sistemi

## Proje
- Repo: `https://github.com/yattaraadamd-lang/QR_MENU_PRODUCT`
- Branch: `main`
- Ortam: Render + Supabase PostgreSQL
- Son incelenen commit: `fc0937de062cc2404a2531437f04c4b59f10b0cd`

## Çalışma Sırası

1. `ORDER_REQUEST` canlı fonksiyonel testlerini tamamla.
2. Test kapısı geçmeden ödeme sistemi değişikliklerini production'a deploy etme.
3. `ORDER_REQUEST` bütün kritik testleri geçince ödeme sistemi görevine devam et.
4. İki aşama için ayrı commit oluştur.

---

# AŞAMA 1 — ORDER_REQUEST FONKSİYONEL TESTİ

## Mevcut Test Sonucu

### Kritik test: ORDER_REQUEST oluşturma
**Sonuç: FAIL / BLOCKED**

Canlı Render logu:

```text
P2022
modelName: CustomerAccessBlock
column: customer_access_blocks.revokedById
endpoint: /api/customer/service-requests
```

Sipariş talebi, cihaz engeli kontrolünde kesiliyor. `ServiceRequest` oluşturma aşamasına ulaşamıyor.

## Önce Düzeltilecek Şema Uyumsuzluğu

Canlı veritabanında ve `prisma/schema.prisma` içinde aynı alanlar bulunmalı:

```prisma
model CustomerAccessBlock {
  id              String    @id @default(cuid())
  businessId      String
  deviceKeyHash   String
  reason          String
  sourceRequestId String?
  createdById     String?
  createdAt       DateTime  @default(now())
  revokedAt       DateTime?
  revokedById     String?
  revocationNote  String?

  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)

  @@index([businessId, deviceKeyHash, revokedAt])
  @@index([businessId, revokedAt])
  @@map("customer_access_blocks")
}
```

`Payment` modelinde migration'ın eklediği alanlar da şemada bulunmalı:

```prisma
receivedAmount Decimal? @db.Decimal(10, 2)
changeAmount   Decimal? @db.Decimal(10, 2)
idempotencyKey String?  @unique
```

## Migration Kontrolü

Şu migration'ın güncel checkout içinde gerçekten bulunduğunu doğrula:

```text
prisma/migrations/20260802_sync_secure_customer_order_flow/migration.sql
```

Migration commit geçmişinde oluşturulmuş görünüyor; fakat canlı log kolonun uygulanmadığını kanıtlıyor.

Migration'ı kontrol et:

```sql
ALTER TABLE "customer_access_blocks"
  ADD COLUMN IF NOT EXISTS "revocationNote" TEXT,
  ADD COLUMN IF NOT EXISTS "revokedById" TEXT;

ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "changeAmount" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
  ADD COLUMN IF NOT EXISTS "receivedAmount" DECIMAL(10,2);

CREATE UNIQUE INDEX IF NOT EXISTS
  "payments_idempotencyKey_key"
ON "payments"("idempotencyKey");
```

Mevcut migration `IF NOT EXISTS` içermiyorsa güvenli hale getir. Daha önce elle eklenmiş bir kolon deployment'ı durdurmamalı.

## Render'da Uygulama

```bash
npx prisma validate
npx prisma generate
npx prisma migrate status
npx prisma migrate deploy
npx prisma migrate status
```

Render build sırası:

```yaml
buildCommand: npm install && npm run db:deploy && npm run build
```

Migration başarısızsa deployment başarısız olmalı.

## Veritabanı Doğrulaması

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'customer_access_blocks'
  AND column_name IN ('revokedById', 'revocationNote');
```

İki satır dönmeli.

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'payments'
  AND column_name IN ('receivedAmount', 'changeAmount', 'idempotencyKey');
```

Üç satır dönmeli.

---

## ORDER_REQUEST Canlı Testleri

Test için yeni/gizli tarayıcı ve boş bir test masası kullan.

### OR-01 Talep oluşturma
1. QR okut.
2. Sepete geçerli ürün ekle.
3. `Sipariş Talebi Oluştur` butonuna bas.

Beklenen:

```text
HTTP 201
code = ORDER_REQUEST_PENDING
6 haneli verificationCode
expiresAt dolu
```

Veritabanı:

```text
ServiceRequest.requestType = ORDER_REQUEST
ServiceRequest.status = PENDING
CustomerSession.authorizationStatus = PENDING
Notification kaydı oluşmuş
```

### OR-02 Garson görünürlüğü
Garson `Talepler` ekranında kayıt görünmeli.

Kartta:

```text
masa numarası
ürün adı
adet
tahmini toplam
doğrulama kodu giriş alanı
Masayı Aç
Reddet
```

`İşleme Al` ve `Tamamla` görünmemeli.

### OR-03 Yanlış kod
Yanlış 6 haneli kod:

```text
HTTP 400
code = INVALID_VERIFICATION_CODE
masa açılmaz
CustomerSession PENDING kalır
```

### OR-04 Doğru kod
Doğru kod:

```text
TableSession ACTIVE
Bill OPEN
Table OCCUPIED
CustomerSession AUTHORIZED
ServiceRequest COMPLETED
```

### OR-05 Çift gönderim
Aynı müşteri talep beklerken butona tekrar basar.

Beklenen:

```text
HTTP 200 veya 409 kontrollü idempotent cevap
ikinci ORDER_REQUEST oluşmaz
```

### OR-06 Aktif masa koruması
Başka cihaz aynı masadan talep göndermeye çalışır.

Beklenen:

```text
HTTP 409
code = TABLE_ALREADY_CLAIMED
```

### OR-07 Reddetme
Garson `Reddet` seçer.

Beklenen:

```text
ServiceRequest CANCELLED
CustomerSession REVOKED
CustomerAccessBlock oluşur
Table EMPTY
aynı cihaz işletmenin başka masasında talep oluşturamaz
```

### OR-08 Log kontrolü
Aşağıdakilerin hiçbiri kalmamalı:

```text
P2021
P2022
42703
DATABASE_SCHEMA_OUTDATED
ORDER_REQUEST_CREATE_FAILED
```

## ORDER_REQUEST Geçiş Kriteri

Aşağıdakilerin tümü geçmeden Aşama 2'yi production'a alma:

- [ ] OR-01
- [ ] OR-02
- [ ] OR-03
- [ ] OR-04
- [ ] OR-05
- [ ] OR-06
- [ ] OR-07
- [ ] OR-08
- [ ] `npm run build`
- [ ] `npx prisma migrate status`

---

# AŞAMA 2 — ÖDEME SİSTEMİ GÖREVİ

Aşama 1 geçince ödeme kodunu ayrı committe düzelt.

## Doğrulanan Ödeme Sorunları

### 1. Nakit tutarı servise iletilmiyor

`/api/waiter/payments/collect` endpointi `receivedAmount` değerini doğruluyor fakat `collectPayment()` çağrısına göndermiyor.

Mevcut çağrı:

```ts
collectPayment(
  tableSessionId,
  businessId,
  amount,
  method,
  userId,
  userName,
  note
);
```

Düzeltme:

```ts
collectPayment(
  tableSessionId,
  businessId,
  amount,
  method,
  userId,
  userName,
  note,
  receivedAmount ?? null
);
```

### 2. collectPayment alınan nakdi kaydetmiyor

`collectPayment()` içinde:

```ts
receivedAmount
changeAmount
idempotencyKey
```

Payment kaydına yazılmalı.

Nakit için:

```ts
if (method === "CASH") {
  if (receivedAmount == null || receivedAmount < actualPaymentAmount) {
    throw new PaymentError(...);
  }
}

const changeAmount =
  method === "CASH"
    ? receivedAmount! - actualPaymentAmount
    : null;
```

### 3. Müşteri ödeme talebi toplam borcu kullanıyor

`requestPayment()` şu anda tüm sipariş toplamını `Payment.amount` yapıyor. Önceki PAID ödemeleri düşerek kalan borcu hesapla:

```text
serverTotalAmount
- alreadyPaidAmount
= remainingDue
```

`Payment.amount = remainingDue`.

### 4. Bekleyen ödeme kontrolü masa bazlı

Şu kontrol:

```ts
where: { tableId, businessId, status: "PENDING" }
```

yerine:

```ts
where: {
  tableSessionId: activeSession.id,
  businessId,
  status: "PENDING",
}
```

kullan.

### 5. Kısmi ödeme engelleniyor

Admin endpointi bir adet eski `PAID` Payment bulduğunda yeni ödemeyi tamamen reddediyor. Bu kontrolü kaldır.

Doğru kontrol:

```text
remainingDue <= 0 ise reddet
aynı pendingPayment/idempotencyKey ikinci kez tamamlanamaz
```

### 6. Garson doğrudan PAID yapabiliyor

Hedef akış:

```text
Müşteri ödeme talebi
→ Garson yöntem/tutar bilgisi girer
→ Admin onayı bekler
→ Yalnız admin PAID yapar
```

Garson endpointi Bill, ciro, masa veya oturum kapatmamalı.

Gerekirse:

```prisma
enum PaymentStatus {
  PENDING
  AWAITING_ADMIN_APPROVAL
  PAID
  CANCELLED
  FAILED
}
```

### 7. Tam ödeme yaşam döngüsü tutarsız

Tek admin transaction'ında:

```text
Payment PAID
Bill CLOSED + PAID
Order paymentStatus PAID
TableSession CLOSED
Table EMPTY
CustomerSession CLOSED + authorizationStatus REVOKED
PAYMENT_REQUEST ServiceRequest COMPLETED
diğer PENDING Payment CANCELLED
```

Kısmi ödemede masa ve oturum açık kalmalı.

---

## Merkezi Servis

Yeni veya mevcut tek servis:

```ts
processAdminPayment({
  pendingPaymentId,
  billId,
  businessId,
  amount,
  method,
  receivedAmount,
  note,
  adminId,
  adminName,
  idempotencyKey,
});
```

Bütün admin ödeme endpointleri yalnız bu servisi kullansın.

Eski çelişkili yolları tekleştir:

```text
/api/admin/payments/[id]/complete
/api/admin/pending-payments/[id]/pay
/api/waiter/payments/[id]/complete
/api/waiter/payments/collect
```

## Ödeme Kabul Testleri

### PAY-01 Müşteri talebi
- [ ] HTTP 201
- [ ] PENDING Payment
- [ ] PAYMENT_REQUEST ServiceRequest
- [ ] tutar = Bill.remainingAmount
- [ ] garson ekranında görünür

### PAY-02 Nakit
- [ ] receivedAmount zorunlu
- [ ] receivedAmount < amount ise 400
- [ ] changeAmount doğru
- [ ] ciroya yalnız borç tutarı eklenir

### PAY-03 Kart
- [ ] CARD çalışır
- [ ] receivedAmount gerekmez

### PAY-04 Kısmi ödeme
- [ ] ilk kısmi ödeme çalışır
- [ ] ikinci kısmi ödeme çalışır
- [ ] Bill PARTIALLY_PAID
- [ ] masa açık kalır

### PAY-05 Tam ödeme
- [ ] Bill CLOSED
- [ ] TableSession CLOSED
- [ ] Table EMPTY
- [ ] CustomerSession CLOSED/REVOKED
- [ ] siparişler PAID

### PAY-06 Yetki
- [ ] garson doğrudan PAID yapamaz
- [ ] admin onaylayabilir

### PAY-07 Çift tıklama
- [ ] iki Payment/ciro kaydı oluşmaz
- [ ] ikinci işlem kontrollü 409/idempotent cevap verir

### PAY-08 Regresyon
- [ ] ORDER_REQUEST testleri tekrar geçer
- [ ] cihaz engeli çalışır
- [ ] Render logunda P2021/P2022/42703 yok
- [ ] build ve migration başarılı

---

# Commit Planı

```text
Commit 1:
fix: apply customer access block schema and pass ORDER_REQUEST functional tests

Commit 2:
fix: centralize admin-controlled cash and card payment flow
```

# Teslim Raporu

```text
Aktif Render commit:
Migration sonucu:
ORDER_REQUEST test sonuçları:
Başarısız test:
Ödeme değiştirilen dosyalar:
CASH sonucu:
CARD sonucu:
Kısmi ödeme sonucu:
Tam ödeme sonucu:
Çift ödeme sonucu:
Render log hataları:
```

Canlı test kanıtı olmadan “tamamlandı” deme.
