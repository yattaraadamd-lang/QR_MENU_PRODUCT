# Kiro Görevi — QR Menü Ödeme Alma Sistemini Düzelt

## Proje
- Repo: https://github.com/yattaraadamd-lang/QR_MENU_PRODUCT
- Branch: main
- Altyapı: Next.js 15, Prisma, Supabase PostgreSQL, Render

## Tespit Edilen Kök Sorunlar

### 1. Eksik servis dışa aktarımı
`src/app/api/waiter/payments/collect/route.ts` şu öğeleri içe aktarıyor:

```ts
import { processAdminPayment, PaymentError } from "@/lib/services/table-flow.service";
```

Fakat güncel `src/lib/services/table-flow.service.ts` içinde bu iki export bulunmuyor. Bu durum build/type hatasına, ilgili endpointin çalışmamasına veya Render'ın eski deploy'u çalıştırmasına neden olabilir.

### 2. Birbiriyle çelişen ödeme endpointleri
Aynı işi farklı kurallarla yapan endpointler var:

```text
PATCH /api/waiter/payments/[id]/complete
POST  /api/waiter/payments/collect
PATCH /api/admin/payments/[id]/complete
POST  /api/admin/pending-payments/[id]/pay
```

Sorunlar:
- Garson ödeme kaydını doğrudan `PAID` yapabiliyor.
- Admin payment endpointi Bill, TableSession ve Order kayıtlarını tam kapatmıyor.
- Pending-payments endpointi mevcut `PENDING` kaydı tamamlamak yerine yeni `PAID` Payment oluşturuyor.
- Bir eski `PAID` ödeme varsa sonraki ödeme tamamen engelleniyor; kısmi ödeme bozuluyor.

### 3. Müşteri ödeme talebinde yanlış tutar
`requestPayment()` tüm aktif sipariş toplamını Payment.amount olarak yazıyor. Önceki kısmi ödemeler düşülmediği için Payment.amount kalan borç yerine toplam borç olabiliyor.

### 4. Canlı şema ön koşulu
Önceki canlı log:
```text
P2022 customer_access_blocks.revokedById does not exist
```
`POST /api/customer/payment-requests` müşteri oturum doğrulaması kullandığı için bu eksik kolon ödeme talebini de engeller.

Ödeme testinden önce Supabase'de şunları doğrula:
```text
customer_access_blocks.revokedById
customer_access_blocks.revocationNote
```

---

# Hedef Mimari

- Müşteri yalnız ödeme talebi oluşturur.
- Garson ödeme yöntemi ve alınan tutarı girerek admin onayı ister.
- Yalnız ADMIN finansal olarak `PAID` işlemi yapabilir.
- Tüm ödeme kapatma işlemleri tek servis üzerinden geçer: `processAdminPayment()`.

---

# Yapılacaklar

## 1. PaymentError ekle
`src/lib/services/table-flow.service.ts`:

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

## 2. processAdminPayment() oluştur
Parametreler:

```ts
type ProcessAdminPaymentInput = {
  billId: string;
  amount: number;
  method: "CASH" | "CARD" | "ONLINE" | "OTHER";
  receivedAmount?: number | null;
  note?: string | null;
  adminId: string;
  adminName: string;
  businessId: string;
  pendingPaymentId?: string | null;
};
```

Tek `prisma.$transaction()` içinde:
1. Açık Bill'i işletme kapsamında getir.
2. Aktif TableSession ve Table'ı getir.
3. İptal/reddedilmiş olmayan siparişlerden toplamı yeniden hesapla.
4. `PAID` ödemeleri topla.
5. Kalan borcu hesapla.
6. `amount > 0` ve `amount <= remainingDue` doğrula.
7. CASH ise `receivedAmount` zorunlu ve `receivedAmount >= amount` olsun.
8. `pendingPaymentId` varsa aynı işletme/bill için PENDING kaydı PAID yap.
9. Yoksa yeni PAID Payment oluştur.
10. Bill toplamlarını güncelle.
11. Tam ödeme ise:
   - Order.paymentStatus = PAID
   - Bill CLOSED
   - TableSession CLOSED
   - Table EMPTY
   - CustomerSession CLOSED + REVOKED
   - PAYMENT_REQUEST talepleri COMPLETED
   - diğer PENDING Payment kayıtları CANCELLED
12. Kısmi ödeme ise Bill ve TableSession açık kalsın.
13. `payment`, `bill`, `table`, `changeAmount` dön.

## 3. Çift ödeme korumasını düzelt
Şu mantığı kaldır:
```ts
if (existingPaidPayment) return 409;
```

Doğru kurallar:
- Kalan borç 0 ise yeni ödeme reddedilir.
- Aynı PENDING ödeme iki kez tamamlanamaz.
- Transaction içinde durum tekrar kontrol edilir.
- Aynı işleme iki admin basarsa yalnız biri başarılı olur.

Mümkünse:
```prisma
idempotencyKey String? @unique
```
alanını Payment modeline veri kaybetmeyen migration ile ekle.

## 4. Müşteri ödeme talebini düzelt
`requestPayment()`:
- Açık Bill zorunlu.
- Server-side sipariş toplamını hesapla.
- PAID ödemeleri düş.
- Payment.amount = kalan borç.
- Kalan borç 0 ise talep oluşturma.
- Bekleyen ödeme kontrolü `tableSessionId + status=PENDING` üzerinden olsun.
- Payment, ServiceRequest, Table ve Notification aynı transaction içinde güncellensin.

## 5. Garson akışını admin onaylı yap
`PATCH /api/waiter/payments/[id]/complete` garsonun Payment'ı PAID yapmamalı.

Garson yalnız:
- yöntem,
- nakit alınan tutar,
- not
girip admin onayına gönderebilsin.

Gerekirse enum:
```prisma
enum PaymentStatus {
  PENDING
  AWAITING_ADMIN_APPROVAL
  PAID
  CANCELLED
  FAILED
}
```

## 6. Admin endpointlerini tekleştir
Tercih edilen endpoint:
```text
POST /api/admin/pending-payments/[paymentId]/approve
```

Body:
```json
{
  "method": "CASH",
  "amount": 250,
  "receivedAmount": 300,
  "note": "300 TL alındı"
}
```

Bu endpoint yalnız `processAdminPayment()` çağırmalı.

Eski endpointleri bu servise yönlendir veya kaldır:
```text
/api/admin/payments/[id]/complete
/api/admin/pending-payments/[id]/pay
/api/waiter/payments/[id]/complete
/api/waiter/payments/collect
```

`billId` ile `paymentId` karışıklığını bitir.

## 7. Admin ekranını düzelt
Admin ekranında:
- masa
- toplam
- ödenen
- kalan
- talep tutarı
- yöntem
- garson adı
- talep zamanı
gösterilsin.

CASH seçilince `receivedAmount` zorunlu olsun ve para üstü canlı hesaplansın. Ciroya yalnız `amount` yazılsın.

## 8. Bildirim ve talep kapanışı
Admin onayı sonrası:
```ts
emitToBusinessRoom(businessId, "payment_collected", ...)
```
çalışsın.

Tam ödeme halinde PAYMENT_REQUEST ServiceRequest kayıtları COMPLETED olsun. Kısmi ödemede eski talep tamamlanmalı ve kalan borç için yeni talebe izin verilmeli.

## 9. Hata logları
```ts
console.error("[PAYMENT_FLOW_FAILED]", {
  endpoint,
  code: error?.code,
  message: error?.message,
  meta: error?.meta,
  paymentId,
  billId,
});
```

Prisma P2021/P2022 için HTTP 503:
```json
{
  "error": "Veritabanı güncellemesi tamamlanmamış.",
  "code": "DATABASE_SCHEMA_OUTDATED"
}
```

---

# Kabul Testleri

## Müşteri
- [ ] Ödeme talebi HTTP 201.
- [ ] Bir PENDING Payment oluşuyor.
- [ ] PAYMENT_REQUEST ServiceRequest oluşuyor.
- [ ] Talep garson ekranında en geç 5 saniyede görünüyor.
- [ ] Tutar Bill.remainingAmount ile eşit.
- [ ] Aynı oturum ikinci aktif talep oluşturamıyor.

## Garson
- [ ] Garson doğrudan PAID yapamıyor.
- [ ] Admin onay talebi oluşturabiliyor.
- [ ] Nakit alınan tutar borçtan düşükse hata.
- [ ] Kartta receivedAmount zorunlu değil.

## Admin
- [ ] Bekleyen ödeme görünüyor.
- [ ] CASH çalışıyor.
- [ ] CARD çalışıyor.
- [ ] Para üstü doğru.
- [ ] Kısmi ödeme çalışıyor.
- [ ] İkinci kısmi ödeme çalışıyor.
- [ ] Tam ödeme Bill ve TableSession'ı kapatıyor.
- [ ] Masa EMPTY oluyor.
- [ ] Çift tıklama çift ciro oluşturmuyor.

## Regresyon
- [ ] Sipariş akışı çalışıyor.
- [ ] Cihaz engeli sistemi çalışıyor.
- [ ] Render logunda P2021/P2022/42703 yok.
- [ ] npm run build başarılı.
- [ ] npx prisma validate başarılı.
- [ ] npx prisma migrate status başarılı.

# Teslim Raporu
```text
Ödeme hatasının gerçek logu:
Kök nedenler:
Tekleştirilen endpointler:
Merkezi servis:
Prisma migration:
CASH test sonucu:
CARD test sonucu:
Kısmi ödeme testi:
Çift ödeme testi:
Müşteri → garson → admin testi:
Render deploy commit:
```

Canlı müşteri ödeme talebi, garson görünürlüğü ve admin CASH/CARD tahsilatı test edilmeden “düzeltildi” deme.
