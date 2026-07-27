# Antigravity — Sabotaj Koruması ve Admin Kontrollü Ödeme

Repo: `https://github.com/yattaraadamd-lang/QR_MENU_PRODUCT/tree/main`

## Talimat

Kod değişikliklerini doğrudan uygula; uzun analiz yazma. Önce yalnız şu alanları ve doğrudan bağımlılıklarını incele:

- `prisma/schema.prisma`
- `src/app/api/customer/session/route.ts`
- `src/app/api/customer/service-requests/route.ts`
- `src/app/api/waiter/service-requests/[id]/status/route.ts`
- `src/app/waiter/requests/page.tsx`
- `src/app/api/waiter/payments/**`
- `src/app/waiter/payments/page.tsx`
- `src/app/api/admin/pending-payments/**`
- `src/app/admin/pending-payments/page.tsx`
- `src/lib/services/table-flow.service.ts`
- mevcut auth, rate-limit ve Socket.IO yardımcıları

Kurallar:

- Mevcut `VIEW_ONLY → PENDING → AUTHORIZED` QR/masa açma akışını bozma.
- GPS, fingerprint kütüphanesi, ücretli servis veya gereksiz bağımlılık ekleme.
- Finans ve güvenlik kararlarını frontend'e bırakma.
- Migration geriye uyumlu olsun; veri silme/genel refactor yapma.
- Mevcut sipariş, adisyon, menü ve bildirim akışlarını koru.

---

# A. İşletme Geneli Sabotaj Koruması

## Mevcut hata

`CANCELLED` işlemi iptal nedenini ayırmıyor, bağlı `CustomerSession` durumunu doğru düzeltmiyor ve aynı tarayıcı farklı masa QR'larından yeniden `ORDER_REQUEST` gönderebiliyor. Ayrıca aktif `TableSession` yokken iptal edilen talep masayı `OCCUPIED` yapmamalı.

## İptal nedenleri

Ekle:

```prisma
enum RequestResolutionCode {
  CUSTOMER_CANCELLED
  WRONG_TABLE
  DUPLICATE
  NO_CUSTOMER_AT_TABLE
  ABUSE_SUSPECTED
  EXPIRED
}
```

`ServiceRequest` alanları:

```prisma
resolutionCode RequestResolutionCode?
resolvedById  String?
```

Garson `status=CANCELLED` gönderirken `resolutionCode` zorunlu olsun.

## İşletme bazlı cihaz kimliği

Ekle:

```prisma
enum CustomerDeviceStatus {
  ACTIVE
  BLOCKED
}

model CustomerDevice {
  id           String @id @default(cuid())
  businessId   String
  tokenHash    String
  status       CustomerDeviceStatus @default(ACTIVE)
  strikeCount  Int @default(0)
  blockedUntil DateTime?
  lastSeenAt   DateTime @default(now())
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  business     Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  sessions     CustomerSession[]
  @@unique([businessId, tokenHash])
  @@index([businessId, status, blockedUntil])
  @@map("customer_devices")
}
```

İlişkiler:

```prisma
// Business
customerDevices CustomerDevice[]

// CustomerSession
deviceId String?
device   CustomerDevice? @relation(fields: [deviceId], references: [id], onDelete: SetNull)
@@index([deviceId, status])
```

`POST /api/customer/session`:

1. `qr_device` HttpOnly cookie oku; yoksa `crypto.randomBytes(32)` ile üret.
2. Cookie: `Path=/`, `SameSite=Lax`, production'da `Secure`, `Max-Age=30 gün`.
3. Ham tokenı loglama/DB'ye yazma/body'den kabul etme.
4. `HMAC-SHA256(DEVICE_TOKEN_SECRET, rawToken)` üret.
5. `businessId + tokenHash` ile `CustomerDevice` bul/oluştur.
6. Her yeni `CustomerSession.deviceId` alanını bağla.
7. `.env.example` içine `DEVICE_TOKEN_SECRET=` ekle.

## ORDER_REQUEST engel kontrolü

`src/app/api/customer/service-requests/route.ts` içinde `ORDER_REQUEST` oluşturmadan önce:

- Device `BLOCKED` ve `blockedUntil > now`: `403 DEVICE_TEMPORARILY_BLOCKED`.
- Mesaj: `Bu cihazdan yeni sipariş talebi geçici olarak durduruldu. Personelle görüşün.`
- Menü açık kalsın; işlem butonları kapansın.
- Süre geçmişse device atomik olarak `ACTIVE`, `blockedUntil=null` yapılsın.

İkincil rate-limit:

- Anahtar: `businessId + deviceId`.
- 10 dakikada en fazla 3 farklı masadan `ORDER_REQUEST`.
- Aşılırsa 30 dakika cooldown ve `429 TABLE_HOPPING_DETECTED`.
- IP yalnız ikincil sinyal; IP'yi kalıcı engelleme için kullanma.

## İptal transactionı

`PUT /api/waiter/service-requests/[id]/status`:

- Auth ve işletme sahipliği korunacak.
- `CANCELLED` işlemini tek transaction içinde yap.
- `resolvedById=session.user.id`, `resolvedAt=now`, `resolutionCode` yaz.

Normal nedenler (`CUSTOMER_CANCELLED`, `WRONG_TABLE`, `DUPLICATE`, `NO_CUSTOMER_AT_TABLE`):

- Talep `CANCELLED`.
- `ORDER_REQUEST` ise bağlı aktif session `authorizationStatus=VIEW_ONLY`.
- Aktif masa oturumu yoksa `tableSessionId=null` ve masa `EMPTY`.
- Aktif masa oturumu varsa tablo durumunu merkezi `syncTableStatus` ile hesapla.
- Session'ı `REVOKED` yapma; müşteri yeniden deneyebilsin.

`ABUSE_SUSPECTED`:

- Talep `CANCELLED`.
- Bağlı `CustomerSession`: `status=REVOKED`, `authorizationStatus=REVOKED`, `closedAt=now`.
- Bağlı device: `status=BLOCKED`, `strikeCount += 1`.
- `blockedUntil`: 1. olay 2 saat, 2. olay 12 saat, 3+ olay 24 saat.
- Aynı `deviceId + businessId` kaynaklı diğer `PENDING/SEEN ORDER_REQUEST` kayıtlarını iptal et.
- Farklı device kayıtlarına dokunma.
- `customer_device_blocked` Socket olayı gönder.

## Garson UI

`src/app/waiter/requests/page.tsx`:

- `✕` doğrudan iptal etmesin; neden modalı açsın.
- `ABUSE_SUSPECTED` için kırmızı uyarı: `Cihaz işletmenin tüm masalarında geçici engellenecek.`
- Çift tıklamayı/loading durumunu yönet.
- Başarıda toast göster ve listeyi yenile.

## Admin güvenlik ekranı

Ekle:

- `GET /api/admin/security/customer-devices`
- `POST /api/admin/security/customer-devices/[id]/unblock`
- `src/app/admin/security/customer-devices/page.tsx`

Yalnız `ADMIN/SUPER_ADMIN`. Ham token/cookie/IP gösterme. Durum, strike, engel bitişi ve son görülmeyi göster. Unblock: `status=ACTIVE`, `blockedUntil=null`.

> Statik QR + tarayıcı sisteminde cookie silme/başka cihaz kullanma tamamen engellenemez. Donanım veya rotating QR zorunlu yapma; hedef tekrar saldırı maliyetini ve garson yükünü azaltmaktır.

---

# B. Admin Kontrollü Ödeme

## Mevcut hata

Garson endpointleri `Payment.status=PAID`, Bill/ciro ve masa durumunu doğrudan değiştirebiliyor. Admin ve garson ödeme algoritmaları ayrı olduğu için kapanış davranışları tutarsız.

## Yetki modeli

- **Garson:** ödeme yöntemini/nakit teslim tutarını bildirir ve admin onayına gönderir; finansal kayıt kapatamaz.
- **Admin:** onaylar/reddeder; yalnız admin onayı `PAID`, ciro, Bill ve masa oturumu kapanışı oluşturur.

## Prisma

`PaymentStatus`:

```prisma
enum PaymentStatus {
  PENDING
  AWAITING_ADMIN_APPROVAL
  PAID
  REJECTED
  CANCELLED
  FAILED
}
```

`Payment` alanları:

```prisma
receivedAmount    Decimal? @db.Decimal(10, 2)
changeAmount      Decimal? @db.Decimal(10, 2)
submittedById     String?
submittedByName   String?
submittedAt       DateTime?
approvedById      String?
approvedByName    String?
approvedAt        DateTime?
rejectedAt        DateTime?
rejectionReason   String?
idempotencyKey    String? @unique
activeApprovalKey String? @unique
```

Aktif süreçte `activeApprovalKey="bill:{billId}"`; `PAID/REJECTED/CANCELLED` olunca `null`. Böylece aynı adisyon için eşzamanlı iki onay kaydı oluşmasın.

## Tek merkezi ödeme servisi

`src/lib/services/table-flow.service.ts` içine ekle ve route'lardaki kopya finans kodunu kaldır:

```ts
submitPaymentForAdminApproval(...)
approvePaymentByAdmin(...)
rejectPaymentByAdmin(...)
```

### Garson gönderimi

`submitPaymentForAdminApproval` transactionı:

- Payment aynı işletmede, `PENDING`, açık Bill ve aktif TableSession'a bağlı olmalı.
- Gerçek toplamı server-side, `CANCELLED/REJECTED` olmayan siparişlerden hesapla.
- Kalan borcu yalnız `PAID` ödemelerden hesapla.
- Garsondan `amount` kabul etme; `payment.amount=remainingDue`.
- `method` enum doğrula.
- Nakit: `receivedAmount >= remainingDue`; `changeAmount=receivedAmount-remainingDue`.
- Kart: `receivedAmount/changeAmount=null`.
- `status=AWAITING_ADMIN_APPROVAL`, submitter alanları ve `activeApprovalKey` yaz.
- Bill/ciro/masa/TableSession değişmesin.

### Admin onayı

`approvePaymentByAdmin`:

- Strict admin auth.
- Serializable transaction veya PostgreSQL row lock.
- Payment yeniden okunmalı ve `AWAITING_ADMIN_APPROVAL` olmalı.
- Bill açık ve aynı işletmede olmalı.
- Toplam/kalan borç transaction içinde yeniden hesaplanmalı.
- Tutar değişmişse hiçbir kayıt değiştirmeden `409 PAYMENT_AMOUNT_CHANGED`.
- Payment: `PAID`, `paidAt/approvedAt`, admin alanları, `activeApprovalKey=null`.
- Bill tutarlarını yalnız `PAID` Payment kayıtlarından hesapla.
- Tam ödeme ise aynı transaction içinde:
  - Bill `PAID/CLOSED`, `closedAt=now`
  - Siparişler `paymentStatus=PAID`
  - TableSession `CLOSED`, `endedAt=now`, `closedById=adminId`
  - aktif CustomerSession kayıtları `CLOSED/REVOKED`
  - açık talepler `CANCELLED`
  - masa mevcut davranışla uyumlu `EMPTY`
- Kısmi ödemede Bill açık kalır.
- Tekrar onay idempotent olsun; ikinci ciro kaydı oluşmasın.

### Admin reddi

`rejectPaymentByAdmin`:

- `AWAITING_ADMIN_APPROVAL -> REJECTED`.
- `rejectionReason` zorunlu; `rejectedAt`, `activeApprovalKey=null`.
- Bill/ciro/masa değişmez.
- Garsona Socket bildirimi gönder.

## Endpointler

Garson:

- `GET /api/waiter/payments` hem `PENDING` hem `AWAITING_ADMIN_APPROVAL` kayıtlarını döndürsün; garson UI durumu ayırsın.
- `PATCH /api/waiter/payments/[id]/complete` ödeme tamamlamasın; merkezi submit servisine yönlensin.
- Response: `202 Accepted`, `Ödeme admin onayına gönderildi.`
- `/api/waiter/payments/collect` WAITER için `403 WAITER_CANNOT_FINALIZE_PAYMENT`.
- Garsonun hiçbir endpointi `PAID` yazamamalı.

Admin:

- `GET /api/admin/payment-approvals?status=AWAITING_ADMIN_APPROVAL`
- `POST /api/admin/payment-approvals/[id]/approve`
- `POST /api/admin/payment-approvals/[id]/reject`
- Mevcut `/api/admin/pending-payments/[id]/pay` kalacaksa yalnız merkezi admin servisini kullansın.
- `/api/admin/pending-payments` yalnız `ADMIN/SUPER_ADMIN`; WAITER kendi API'sini kullansın.

## UI

Garson ödeme sayfası:

- `Ödemeyi Al` → `Ödeme Bilgisi Gir`.
- Son buton `Admin Onayına Gönder`.
- Manuel ödeme tutarı inputu yok; borç API'den gelir.
- Nakit için alınan tutar ve para üstü göster.
- Gönderim sonrası `Admin Onayı Bekleniyor`; tekrar gönderilemez.

Admin ödeme sayfası:

- Sekmeler: `Açık Adisyonlar`, `Onay Bekleyenler`, `Geçmiş`.
- Masa, kalan borç, yöntem, garson, alınan nakit, para üstü, saat göster.
- `Onayla` ve neden zorunlu `Reddet`.
- Loading/çift tıklama koruması.
- Socket: `payment_submitted_for_approval`, `payment_approved`, `payment_rejected`.

## Audit

Mevcut model yoksa minimal `AuditLog` ekle: `businessId`, `actorId`, `actorRole`, `action`, `entityType`, `entityId`, `metadata Json?`, `createdAt`; gerekli indexleri ekle.

Kaydet:

- `ORDER_REQUEST_CANCELLED`
- `CUSTOMER_DEVICE_BLOCKED/UNBLOCKED`
- `PAYMENT_SUBMITTED/APPROVED/REJECTED`

Token, cookie, parola veya kart verisi loglama.

---

# Kabul testleri

1. Normal iptal sonrası aynı müşteri tekrar talep oluşturabilir ve masa `EMPTY` kalır.
2. Sabotaj iptali sonrası aynı tarayıcı diğer masa QR'larından talep oluşturamaz.
3. Engellenen cihaz menüyü görür; farklı cihaz etkilenmez.
4. Device'ın diğer bekleyen ORDER_REQUEST kayıtları iptal edilir.
5. Engel süresi bitince otomatik, admin işlemiyle manuel açılır.
6. Garson hiçbir API üzerinden `PAID`, ciro veya Bill kapanışı yazamaz.
7. Garson gönderiminde Bill/ciro/masa değişmez.
8. Admin onayı ödemeyi yalnız bir kez ciroya ekler; eşzamanlı ikinci onay başarısız/idempotenttir.
9. Admin reddinde finansal kayıtlar değişmez.
10. Tam ödeme tek transaction içinde Bill, TableSession ve CustomerSession kayıtlarını kapatır.
11. Build/lint, `prisma generate` ve migration başarılıdır.
12. Mevcut QR, masa açma, sipariş, menü, Socket.IO akışları bozulmaz.

# Teslim raporu

Yalnız şunları yaz:

1. Değişen dosyalar
2. Migration adı
3. Çalıştırılan testler ve sonuçları
4. Kalan gerçek sınırlamalar
