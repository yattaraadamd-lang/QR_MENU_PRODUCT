# Antigravity Görevi — Admin Kontrollü ve Kullanılabilir Ödeme Sistemi

## Proje

- Repository: `https://github.com/yattaraadamd-lang/QR_MENU_PRODUCT`
- Branch: `main`
- Altyapı: Next.js, TypeScript, Prisma, Supabase PostgreSQL, Render
- Amaç: Garson ve admin ödeme ekranlarını tek, güvenli ve **admin kontrollü** ödeme sistemi altında birleştirmek.

Bu görevi yalnız analiz edip bırakma. Gerekli kodu, Prisma şemasını, migration'ı, API'leri ve arayüzleri uygula; build ve fonksiyonel testleri tamamla.

---

# Zorunlu İş Akışı

## Müşteri

1. Müşteri ödeme talebi gönderir.
2. Sistem açık adisyonun gerçek kalan borcu kadar bir `Payment` kaydı oluşturur.
3. Talep garson ve admin panelinde görünür.

## Garson

Garson:

- ödeme yöntemini seçebilir,
- tahsil edilecek tutarı girebilir,
- CASH ise müşterinin verdiği nakit tutarı girebilir,
- not ekleyebilir,
- ödeme bilgisini **admin onayına gönderebilir**.

Garson kesinlikle:

- Payment kaydını `PAID` yapamaz,
- ciroyu değiştiremez,
- Bill'i kapatamaz,
- TableSession'ı kapatamaz,
- masayı `EMPTY` yapamaz,
- müşteri oturumlarını kapatamaz.

Garson ekranındaki **Ödemeyi Tamamla** işlemini **Admin Onayına Gönder** olarak değiştir.

## Admin

Admin:

- müşteri ödeme taleplerini görür,
- garsonun girdiği yöntem, tutar, alınan nakit ve notu görür,
- talebi onaylar, düzenler veya reddeder,
- kendi panelinden doğrudan ödeme alabilir.

Yalnız admin onayı şu finansal sonuçları oluşturabilir:

- Payment `PAID`,
- Bill ve ciro güncellemesi,
- tam ödeme halinde adisyon, masa ve oturum kapanışı.

---

# Güncel Kodda Doğrulanan Sorunlar

1. `PATCH /api/waiter/payments/[id]/complete` garson yetkisiyle Payment kaydını doğrudan `PAID` yapıyor.
2. `POST /api/waiter/payments/collect` hem garson hem admin için açık ve doğrudan ödeme oluşturuyor.
3. `receivedAmount` endpointte doğrulanmasına rağmen `collectPayment()` fonksiyonuna aktarılmıyor.
4. Admin CASH ekranı `receivedAmount` göndermiyor.
5. `requestPayment()` önceki `PAID` ödemeleri düşmeden toplam sipariş tutarını Payment.amount yapıyor.
6. Bekleyen ödeme kontrolü TableSession yerine yalnız masa üzerinden yapılıyor.
7. Admin endpointi herhangi bir eski `PAID` ödeme bulunca ikinci kısmi ödemeyi engelliyor.
8. Aynı ödeme işi birden fazla endpointte farklı kurallarla uygulanıyor.
9. Canlı ortamda Prisma `Transaction not found` / muhtemel `P2028` hatası oluşuyor.
10. Payment modelinde nakit, para üstü, idempotency ve admin onay audit alanları eksik.

---

# Prisma Modeli

## PaymentStatus

Veri kaybetmeden genişlet:

```prisma
enum PaymentStatus {
  PENDING
  AWAITING_ADMIN_APPROVAL
  PROCESSING
  PAID
  REJECTED
  CANCELLED
  FAILED
}
```

## Payment alanları

Mevcut alanları koru ve ekle:

```prisma
receivedAmount      Decimal? @db.Decimal(10, 2)
changeAmount        Decimal? @db.Decimal(10, 2)
idempotencyKey      String?  @unique

requestedById       String?
requestedByName     String?
approvalRequestedAt DateTime?

approvedById        String?
approvedByName      String?
approvedAt          DateTime?

rejectedById        String?
rejectedAt          DateTime?
rejectionReason     String?

@@index([billId, status])
@@index([tableSessionId, status])
```

Bu görev için zorunlu değilse yeni User relation'ları ekleyerek Prisma ilişki karmaşası oluşturma. Audit için scalar ID ve isim alanları yeterlidir.

## Migration güvenliği

Veri kaybetmeyen Prisma migration oluştur.

Yasak:

```text
prisma migrate reset
DROP TABLE
TRUNCATE
--accept-data-loss
production verisini seed ile ezmek
```

Canlı veritabanında önceki hatalar için şu kolonları da doğrula:

```text
customer_access_blocks.revokedById
customer_access_blocks.revocationNote
```

---

# API Mimarisi

## 1. Müşteri ödeme talebi

Endpoint:

```text
POST /api/customer/payment-requests
```

Tek transaction içinde:

1. Yetkili CustomerSession doğrula.
2. Aktif TableSession ve açık Bill bul.
3. İptal/reddedilmiş olmayan siparişleri topla.
4. `PAID` ödemeleri topla.
5. `remainingDue = orderTotal - paidTotal` hesapla.
6. Kalan borç sıfırsa talebi reddet.
7. Aynı TableSession için aktif Payment varsa ikinci kayıt oluşturma.
8. Payment `PENDING` oluştur.
9. PAYMENT_REQUEST ServiceRequest oluştur.
10. Table `PAYMENT_REQUESTED` yap.
11. Notification oluştur.

Payment.amount her zaman gerçek `remainingDue` olmalıdır.

Aktif ödeme kontrolü:

```text
businessId + tableSessionId + status in (PENDING, AWAITING_ADMIN_APPROVAL, PROCESSING)
```

## 2. Garsonun admin onayı istemesi

Yeni endpoint:

```text
POST /api/waiter/payments/[paymentId]/request-approval
```

Body:

```json
{
  "method": "CASH",
  "amount": 200,
  "receivedAmount": 250,
  "note": "250 TL alındı"
}
```

Kurallar:

- Payment aynı işletmeye ait olmalı.
- Bill açık ve TableSession aktif olmalı.
- `amount > 0` ve `amount <= remainingDue` olmalı.
- CASH için `receivedAmount` zorunlu ve `receivedAmount >= amount` olmalı.
- CARD/ONLINE için `receivedAmount = null` olmalı.
- Kalan borç server-side yeniden hesaplanmalı.
- Payment `AWAITING_ADMIN_APPROVAL` yapılmalı.
- Garson audit alanları doldurulmalı.
- Bu işlem ciro oluşturmaz ve masa kapatmaz.
- Admin'e bildirim/socket gönderilir.

## 3. Admin onayı

Tek nihai endpoint:

```text
POST /api/admin/payments/[paymentId]/approve
```

Yalnız `ADMIN` kullanabilir.

Body:

```json
{
  "amount": 200,
  "method": "CASH",
  "receivedAmount": 250,
  "note": "Onaylandı",
  "idempotencyKey": "unique-client-key"
}
```

Bu endpoint yalnız merkezi `processAdminPayment()` servisini çağırmalıdır.

## 4. Admin reddetme

```text
POST /api/admin/payments/[paymentId]/reject
```

Body:

```json
{
  "reason": "Tutar veya yöntem hatalı"
}
```

Sonuç:

- Payment `REJECTED`,
- ciro oluşmaz,
- Bill ve masa kapanmaz,
- garson sebebi görür,
- düzeltilmiş bilgi yeniden onaya gönderilebilir.

---

# Merkezi Ödeme Servisi

Yeni dosya:

```text
src/lib/services/payment.service.ts
```

Hata sınıfı:

```ts
export class PaymentError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "PaymentError";
  }
}
```

Ana servis:

```ts
processAdminPayment(input)
```

```ts
type ProcessAdminPaymentInput = {
  paymentId: string;
  businessId: string;
  adminId: string;
  adminName: string;
  amount: number;
  method: "CASH" | "CARD" | "ONLINE" | "OTHER";
  receivedAmount?: number | null;
  note?: string | null;
  idempotencyKey: string;
};
```

## Transaction ayarı

```ts
return prisma.$transaction(
  async (tx) => {
    // yalnız tx.*
  },
  {
    maxWait: 10_000,
    timeout: 20_000,
  }
);
```

Transaction içinde yasak:

```text
global prisma.*
fetch
Socket.IO
harici servis
setTimeout
$disconnect
transaction client'ı callback dışına çıkarmak
```

Socket transaction başarıyla tamamlandıktan sonra endpointte çalışmalıdır.

## Transaction adımları

1. Payment kaydını işletme izolasyonuyla getir.
2. Durum `AWAITING_ADMIN_APPROVAL` veya adminin doğrudan oluşturduğu `PENDING` olmalı.
3. Koşullu `updateMany` ile durumu `PROCESSING` yap.
4. Güncellenen satır sayısı 1 değilse `PAYMENT_STATE_CHANGED` dön.
5. Açık Bill ve aktif TableSession'ı transaction içinde oku.
6. Sipariş toplamını transaction içinde hesapla.
7. `PAID` ödeme toplamını transaction içinde hesapla.
8. Güncel kalan borcu hesapla.
9. Kalan borç sıfırsa reddet.
10. Tutar kalan borçtan fazlaysa `AMOUNT_EXCEEDS_REMAINING` dön; otomatik fazla ciro yazma.
11. CASH için alınan nakit tutarını doğrula.
12. `changeAmount = receivedAmount - amount` hesapla.
13. Payment `PAID` yap ve admin audit alanlarını kaydet.
14. Bill toplamlarını güncelle.
15. Kısmi ödemede masa ve oturum açık kalsın.
16. Tam ödemede bütün kapanışları aynı transaction içinde yap.

## Tam ödeme kapanışı

```text
Payment.status = PAID
Bill.paymentStatus = PAID
Bill.status = CLOSED
Bill.closedAt = now
Order.paymentStatus = PAID
TableSession.status = CLOSED
TableSession.endedAt = now
TableSession.closedById = adminId
Table.status = EMPTY
CustomerSession.status = CLOSED
CustomerSession.authorizationStatus = REVOKED
CustomerSession.closedAt = now
PAYMENT_REQUEST ServiceRequest.status = COMPLETED
diğer aktif Payment kayıtları = CANCELLED
```

## Kısmi ödeme

```text
Bill.status = OPEN
Bill.paymentStatus = PARTIALLY_PAID
TableSession.status = ACTIVE
Table kapanmaz
CustomerSession kapanmaz
```

Bir sonraki ödeme talebi kalan borç üzerinden oluşturulabilmelidir.

---

# Eski Endpointleri Tekleştir

Aşağıdaki endpointlerde bağımsız finansal işlem kodu bırakma:

```text
PATCH /api/waiter/payments/[id]/complete
POST  /api/waiter/payments/collect
PATCH /api/admin/payments/[id]/complete
POST  /api/admin/pending-payments/[id]/pay
```

Yapılacaklar:

1. Frontendleri yeni endpointlere geçir.
2. Garson endpointlerini yalnız `request-approval` akışına yönlendir.
3. Admin endpointlerini yalnız merkezi `approve` servisine yönlendir.
4. Garson rolüyle eski doğrudan tahsilat endpointlerini çağırınca `403` dön.
5. Aynı ödeme iş kuralını birden fazla dosyada kopyalama.

---

# Garson Paneli

Göster:

- masa,
- toplam hesap,
- ödenen,
- kalan,
- ödeme talebi zamanı,
- yöntem,
- tahsil edilecek tutar,
- CASH ise alınan nakit,
- para üstü,
- not.

Butonlar:

```text
Admin Onayına Gönder
Talebi İptal Et
```

Olmaması gerekenler:

```text
Ödemeyi Tamamla
PAID Yap
Masayı Kapat
```

Gönderimden sonra `Admin onayı bekleniyor` göster. Aynı talep tekrar gönderilememeli.

---

# Admin Paneli

## Admin Onayı Bekleyenler

Göster:

- masa,
- garson,
- adisyon toplamı,
- önceden ödenen,
- güncel kalan,
- talep tutarı,
- yöntem,
- alınan nakit,
- para üstü,
- not,
- talep zamanı.

Butonlar:

```text
Onayla ve Tahsil Et
Düzenle
Reddet
```

## Açık Adisyonlar

Admin talep olmadan da açık adisyondan doğrudan ödeme alabilir; ancak aynı `processAdminPayment()` servisini kullanmalıdır.

CASH seçilince:

- `receivedAmount` zorunlu,
- alınan tutar borçtan düşük olamaz,
- para üstü canlı hesaplanır,
- ciroya yalnız borçtan tahsil edilen `amount` yazılır.

---

# Hata Yönetimi

Genel “Sunucu hatası” mesajıyla bütün hataları gizleme.

```text
INVALID_PAYMENT_AMOUNT          → 400
INVALID_PAYMENT_METHOD          → 400
CASH_RECEIVED_AMOUNT_REQUIRED   → 400
CASH_AMOUNT_INSUFFICIENT        → 400
AMOUNT_EXCEEDS_REMAINING        → 400
PAYMENT_NOT_FOUND               → 404
BILL_NOT_FOUND                  → 404
BILL_ALREADY_PAID               → 409
BILL_ALREADY_CLOSED             → 409
PAYMENT_ALREADY_COMPLETED       → 409
PAYMENT_STATE_CHANGED           → 409
DUPLICATE_PAYMENT               → 409
TABLE_SESSION_NOT_ACTIVE        → 409
PAYMENT_TRANSACTION_EXPIRED     → 503
DATABASE_SCHEMA_OUTDATED        → 503
PAYMENT_INTERNAL_ERROR          → 500
```

Prisma eşlemesi:

```text
P2002 → DUPLICATE_PAYMENT
P2021/P2022 → DATABASE_SCHEMA_OUTDATED
P2025 → PAYMENT_STATE_CHANGED
P2028 veya "Transaction not found" → PAYMENT_TRANSACTION_EXPIRED
```

Log:

```ts
console.error("[PAYMENT_FLOW_FAILED]", {
  endpoint,
  code: error?.code,
  name: error?.name,
  message: error?.message,
  meta: error?.meta,
  paymentId,
  billId,
  tableSessionId,
});
```

Secret, cookie, token, bağlantı adresi veya kart verisi loglama.

---

# Deploy Kontrolleri

```bash
npx prisma format
npx prisma validate
npx prisma generate
npx prisma migrate status
npm run build
npx prisma migrate deploy
```

Migration için `DATABASE_URL_UNPOOLED` kullan. Migration başarısızsa Render deploy da başarısız olmalı.

Canlı veritabanında doğrula:

```text
payments.receivedAmount
payments.changeAmount
payments.idempotencyKey
payments.requestedById
payments.approvalRequestedAt
payments.approvedById
payments.approvedAt
payments.rejectionReason
PaymentStatus.AWAITING_ADMIN_APPROVAL
PaymentStatus.PROCESSING
PaymentStatus.REJECTED
```

---

# Zorunlu Fonksiyonel Testler

## PAY-01 Müşteri talebi

- [ ] HTTP `201`.
- [ ] Payment `PENDING`.
- [ ] Tutar gerçek kalan borca eşit.
- [ ] Garson ve admin ekranında görünür.
- [ ] Aynı TableSession ikinci aktif talebi oluşturamaz.

## PAY-02 Garson yetkisi

- [ ] Garson admin onayına gönderebilir.
- [ ] Payment `AWAITING_ADMIN_APPROVAL`.
- [ ] Garson doğrudan `PAID` yapamaz.
- [ ] Garson Bill, masa veya oturumu kapatamaz.
- [ ] API seviyesinde `403` koruması vardır.

## PAY-03 Admin CASH

- [ ] `receivedAmount` zorunlu.
- [ ] 200 TL borç için 150 TL reddedilir.
- [ ] 200 TL borç için 200 TL başarılı.
- [ ] 200 TL borç için 250 TL başarılı.
- [ ] `changeAmount = 50`.
- [ ] Ciroya yalnız 200 TL eklenir.

## PAY-04 CARD

- [ ] CARD başarılı.
- [ ] `receivedAmount` gerekmez.
- [ ] Para üstü oluşmaz.

## PAY-05 Kısmi ödeme

- [ ] İlk kısmi ödeme başarılı.
- [ ] Bill `PARTIALLY_PAID`.
- [ ] Masa ve oturum açık kalır.
- [ ] İkinci kısmi ödeme başarılı.
- [ ] Eski `PAID` kayıt yeni ödemeyi engellemez.

## PAY-06 Tam ödeme

- [ ] Bill `PAID/CLOSED`.
- [ ] Order ödeme durumları `PAID`.
- [ ] TableSession `CLOSED`.
- [ ] Table `EMPTY`.
- [ ] CustomerSession `CLOSED/REVOKED`.
- [ ] PAYMENT_REQUEST talepleri `COMPLETED`.

## PAY-07 Reddetme

- [ ] Admin sebep girerek reddeder.
- [ ] Payment `REJECTED`.
- [ ] Ciro oluşmaz.
- [ ] Bill ve masa kapanmaz.
- [ ] Garson sebebi görür ve düzelterek yeniden gönderebilir.

## PAY-08 Eşzamanlı onay

- [ ] İki admin aynı anda onaylarsa yalnız biri başarılı.
- [ ] Çift Payment ve çift ciro oluşmaz.
- [ ] İkinci istek kontrollü `409` döner.

## PAY-09 Transaction

- [ ] Render logunda `Transaction not found` yok.
- [ ] Prisma `P2028` yok.
- [ ] Transaction içinde yalnız `tx.*` var.
- [ ] Socket transaction dışında.
- [ ] Request akışında `$disconnect()` yok.

## PAY-10 Regresyon

- [ ] ORDER_REQUEST çalışıyor.
- [ ] Masa açma doğrulama kodu çalışıyor.
- [ ] Siparişler garson paneline düşüyor.
- [ ] Cihaz engelleme ve admin engel kaldırma çalışıyor.
- [ ] Render logunda `P2021`, `P2022`, `42703` yok.
- [ ] Build ve migration başarılı.

---

# Kod Kalitesi

- Çalışan sipariş ve masa akışını gereksiz yere yeniden yazma.
- Finansal hesaplamalarda client değerine güvenme.
- Decimal hesaplarında kuruş hassasiyetini koru.
- Bütün sorgularda `businessId` izolasyonu uygula.
- Hata halinde yarım tahsilat veya yarım kapanış bırakma.
- Gereksiz bağımlılık ekleme.
- TypeScript ve Prisma tiplerini kullan.

---

# Teslim Raporu

```text
Tespit edilen ödeme hataları:
Tekleştirilen endpointler:
Merkezi ödeme servisi:
Prisma değişiklikleri:
Migration dosyası:
Garson yetki testi:
Admin onay testi:
CASH sonucu:
CARD sonucu:
Kısmi ödeme sonucu:
Tam ödeme sonucu:
Reddetme sonucu:
Çift onay/idempotency sonucu:
P2028 sonucu:
Render deploy commit:
Değiştirilen dosyalar:
Başarısız testler:
```

Şunlar canlı ortamda geçmeden “ödeme sistemi tamamlandı” deme:

1. Müşteri ödeme talebi.
2. Garsonun yalnız admin onayına gönderebilmesi.
3. Admin CASH tahsilatı.
4. Admin CARD tahsilatı.
5. Kısmi ve tam ödeme.
6. Çift ödeme koruması.
7. Transaction hatasının kaybolması.
