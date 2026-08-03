# Kiro Görevi — Ödeme Alırken Görülen “Sunucu Hatası”nı Düzelt

## Proje
- Repo: `https://github.com/yattaraadamd-lang/QR_MENU_PRODUCT`
- Branch: `main`
- Altyapı: Next.js 15, Prisma, Supabase PostgreSQL, Render

## Kullanıcının Gördüğü Hata
Garson veya admin ödeme almaya çalıştığında:

```text
Sunucu hatası
```

mesajı gösteriliyor.

## Koddan Doğrulanan Birincil Neden

`src/app/api/waiter/payments/[id]/complete/route.ts` içinde nakit doğrulama hataları `throw new Error(...)` ile fırlatılıyor. Ancak `catch` bloğu yalnız `"Ödeme bulunamadı"` hatasını özel ele alıyor; diğer tüm doğrulama ve iş kuralı hatalarını genel `500 Sunucu hatası` olarak döndürüyor.

Bu nedenle kullanıcıdaki mesaj gerçek bir altyapı hatası olmak zorunda değildir. Eksik/yetersiz nakit, kapalı adisyon, geçersiz yöntem veya Prisma hatası aynı mesajla gizlenmektedir.

## İkinci Doğrulanan Hata

`src/app/api/waiter/payments/collect/route.ts`, `receivedAmount` değerini request body’den alıp doğruluyor fakat `collectPayment()` fonksiyonuna göndermiyor.

Mevcut:

```ts
const result = await collectPayment(
  tableSessionId,
  businessId,
  amount,
  method,
  session!.user.id,
  session!.user.name,
  note || null
);
```

Doğru:

```ts
const result = await collectPayment(
  tableSessionId,
  businessId,
  amount,
  method,
  session!.user.id,
  session!.user.name || "Garson",
  note || null,
  method === "CASH" ? Number(receivedAmount) : null
);
```

## Üçüncü Doğrulanan Hata

Admin ödeme ekranı CASH seçildiğinde müşteriden alınan nakit tutarını istemiyor ve endpoint’e `receivedAmount` göndermiyor. Bu nedenle nakit ve para üstü akışı tutarlı çalışmıyor.

---

# Görev

Önce gerçek runtime hatasını logdan belirle, sonra ödeme akışını tek ve tutarlı transaction üzerinden düzelt.

## 1. Hata logunu ayrıntılandır

Şu endpointlerin `catch` bloklarını güncelle:

```text
src/app/api/waiter/payments/[id]/complete/route.ts
src/app/api/waiter/payments/collect/route.ts
src/app/api/admin/pending-payments/[id]/pay/route.ts
src/app/api/admin/payments/[id]/complete/route.ts
```

Log:

```ts
console.error("[PAYMENT_COMPLETE_FAILED]", {
  endpoint: request.nextUrl.pathname,
  code: error?.code,
  name: error?.name,
  message: error?.message,
  meta: error?.meta,
  paymentId: params?.id,
});
```

Secret, cookie, session tokenu, kart bilgisi veya bağlantı adresi loglama.

## 2. Doğru HTTP hata sınıflandırması

```text
Nakit tutar eksik              → 400 CASH_RECEIVED_AMOUNT_REQUIRED
Alınan nakit yetersiz          → 400 CASH_AMOUNT_INSUFFICIENT
Ödeme bulunamadı               → 404 PAYMENT_NOT_FOUND
Ödeme zaten PAID               → 409 PAYMENT_ALREADY_COMPLETED
Adisyon kapalı                 → 409 BILL_ALREADY_CLOSED
Aktif masa oturumu yok         → 409 TABLE_SESSION_NOT_ACTIVE
Kalan borç sıfır               → 409 BILL_ALREADY_PAID
Geçersiz ödeme yöntemi         → 400 INVALID_PAYMENT_METHOD
Prisma P2021/P2022             → 503 DATABASE_SCHEMA_OUTDATED
Prisma P2002                   → 409 DUPLICATE_PAYMENT
Prisma P2025                   → 409 PAYMENT_STATE_CHANGED
```

Bilinmeyen hata yalnız o zaman `500 PAYMENT_INTERNAL_ERROR` dönsün.

## 3. PaymentError sınıfı ekle

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

Endpointler bu sınıfı yakalayıp `statusCode` ve `code` değerlerini döndürsün.

## 4. Garson ödeme endpointini düzelt

`PATCH /api/waiter/payments/[id]/complete` transaction başlamadan body doğrulaması yapsın:

```ts
const allowedMethods = ["CASH", "CARD", "ONLINE", "OTHER"] as const;

if (!allowedMethods.includes(method)) {
  throw new PaymentError(
    "Geçersiz ödeme yöntemi.",
    "INVALID_PAYMENT_METHOD",
    400
  );
}
```

Nakit için:

```ts
const normalizedReceivedAmount =
  method === "CASH" ? Number(receivedAmount) : null;

if (
  method === "CASH" &&
  (!Number.isFinite(normalizedReceivedAmount) ||
    normalizedReceivedAmount <= 0)
) {
  throw new PaymentError(
    "Nakit ödeme için alınan tutarı girin.",
    "CASH_RECEIVED_AMOUNT_REQUIRED",
    400
  );
}
```

Transaction içinde Payment kaydını şu kapsamla bul:

```ts
where: {
  id: params.id,
  businessId,
  status: "PENDING",
}
```

## 5. `receivedAmount` aktarım hatasını düzelt

`/api/waiter/payments/collect` çağrısına son parametreyi ekle:

```ts
method === "CASH" ? Number(receivedAmount) : null
```

`collectPayment()` içinde CASH doğrulamasını yeniden server-side yap.

## 6. Admin nakit ödeme ekranını düzelt

`src/app/admin/pending-payments/page.tsx` içine:

```ts
const [receivedAmount, setReceivedAmount] = useState("");
```

ekle.

CASH seçildiğinde:
- alınan nakit tutarı alanı göster,
- `receivedAmount >= amount` doğrula,
- para üstünü göster,
- body’ye `receivedAmount` ekle.

```ts
body: JSON.stringify({
  amount: amountNum,
  paymentMethod,
  receivedAmount:
    paymentMethod === "CASH"
      ? Number(receivedAmount)
      : null,
})
```

## 7. Admin endpointini düzelt

`POST /api/admin/pending-payments/[id]/pay` body:

```ts
const {
  amount,
  paymentMethod,
  receivedAmount,
  note,
} = await request.json();
```

CASH için alınan tutarı zorunlu kıl.

Bir adet eski `PAID` Payment bulunmasını tüm yeni ödemeler için engel olarak kullanma. Bu kontrol kısmi ödemeyi bozuyor.

Doğru hesap:

```text
serverTotalAmount - paidAmount = remainingDue
```

Kurallar:
- `remainingDue <= 0` ise reddet,
- `amount <= remainingDue`,
- aynı ödeme ikinci kez tamamlanamaz,
- tam ödeme değilse Bill açık kalır.

## 8. Tek merkezî ödeme servisi kullan

Şu endpointlerin finansal işlemlerini tek serviste birleştir:

```text
/api/waiter/payments/[id]/complete
/api/waiter/payments/collect
/api/admin/pending-payments/[id]/pay
/api/admin/payments/[id]/complete
```

Merkez servis tek `prisma.$transaction()` içinde:

1. Payment, Bill ve TableSession durumunu kontrol eder.
2. Sunucuda toplam borcu hesaplar.
3. Önceki PAID ödemeleri düşer.
4. Tahsil edilecek gerçek tutarı doğrular.
5. Payment kaydını tamamlar.
6. Bill toplamlarını günceller.
7. Tam ödeme ise sipariş, adisyon, oturum, masa ve müşteri oturumunu kapatır.
8. Kısmi ödemede masa ve oturum açık kalır.
9. Aynı ödeme iki kez işlenmez.

## 9. Prisma şema kontrolü

```bash
npx prisma validate
npx prisma generate
npx prisma migrate status
npx prisma migrate diff   --from-url "$DATABASE_URL_UNPOOLED"   --to-schema-datamodel prisma/schema.prisma   --script
```

Özellikle kontrol et:

```text
customer_access_blocks.revokedById
customer_access_blocks.revocationNote
payments.receivedAmount
payments.changeAmount
payments.idempotencyKey
```

Kod bu alanları kullanacaksa Prisma modeline ve veri kaybetmeyen migration’a birlikte ekle. `migrate reset`, `DROP`, `TRUNCATE` veya `--accept-data-loss` kullanma.

---

# Fonksiyonel Testler

## PAY-01 Kart ödeme
- [ ] PENDING ödeme CARD ile tamamlanıyor.
- [ ] HTTP 200/201.
- [ ] Payment PAID.
- [ ] Bill paidAmount artıyor.
- [ ] Genel “Sunucu hatası” görülmüyor.

## PAY-02 Nakit ödeme
- [ ] Alınan tutar alanı görünür.
- [ ] Boş bırakılırsa HTTP 400.
- [ ] Eksik tutarda HTTP 400.
- [ ] Yeterli tutarda başarılı.
- [ ] Para üstü doğru.
- [ ] Ciroya yalnız borç tutarı eklenir.

## PAY-03 Kısmi ödeme
- [ ] İlk kısmi ödeme başarılı.
- [ ] Bill PARTIALLY_PAID.
- [ ] İkinci ödeme alınabilir.
- [ ] Eski PAID kayıt nedeniyle engellenmez.

## PAY-04 Çift tıklama
- [ ] Aynı ödeme iki kere PAID olmaz.
- [ ] İkinci işlem 409 veya idempotent cevap verir.
- [ ] Ciro iki kez artmaz.

## PAY-05 Tam ödeme
- [ ] Bill CLOSED/PAID.
- [ ] Siparişler PAID.
- [ ] TableSession CLOSED.
- [ ] Table EMPTY.
- [ ] CustomerSession CLOSED/REVOKED.
- [ ] PAYMENT_REQUEST talepleri tamamlanır.

## PAY-06 Log
Aşağıdakiler kalmamalı:

```text
P2021
P2022
42703
PAYMENT_INTERNAL_ERROR
Ödeme tamamlama hatası
```

---

# Teslim Raporu

```text
Hata veren endpoint:
HTTP durum kodu:
Render gerçek hata mesajı:
Prisma hata kodu:
Kök neden:
Değiştirilen dosyalar:
Migration:
CARD test sonucu:
CASH test sonucu:
Kısmi ödeme sonucu:
Çift tıklama sonucu:
Tam ödeme sonucu:
```

Gerçek ödeme testi başarılı olmadan “düzeltildi” deme.
