# Antigravity Görevi — CASH Ödeme Payload ve Prisma Transaction Hatasını Düzelt

## Proje

- Repo: `https://github.com/yattaraadamd-lang/QR_MENU_PRODUCT`
- Branch: `main`
- Ortam: Next.js + Prisma + Supabase + Render

## Hatalı İstek

Frontend şu payload'ı gönderiyor:

```json
{
  "tableSessionId": "cmscx8xmn000c13j28fv2xw9b",
  "amount": 200,
  "method": "CASH",
  "note": null
}
```

Nakit ödeme için zorunlu olan `receivedAmount` alanı eksik.

Doğru örnek:

```json
{
  "tableSessionId": "cmscx8xmn000c13j28fv2xw9b",
  "amount": 200,
  "method": "CASH",
  "receivedAmount": 200,
  "note": null
}
```

Müşteri 250 TL verirse:

```json
{
  "tableSessionId": "cmscx8xmn000c13j28fv2xw9b",
  "amount": 200,
  "method": "CASH",
  "receivedAmount": 250,
  "note": null
}
```

Bu durumda `changeAmount = 50` olmalıdır.

---

## Tespit Edilen Kod Hatası

`src/app/api/waiter/payments/collect/route.ts`:

- `receivedAmount` değerini request body'den alıyor.
- CASH için doğruluyor.
- Fakat `collectPayment()` fonksiyonuna göndermiyor.

Mevcut çağrı:

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

Doğru çağrı:

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

`collectPayment()` zaten sekizinci parametre olarak `receivedAmount` kabul ediyor. Ancak Payment kaydına `receivedAmount` ve `changeAmount` yazılmıyor.

---

# Görevler

## 1. Frontend payload'ını düzelt

Ödeme formunda CASH seçilince:

- `receivedAmount` inputu göster.
- Bu alan zorunlu olsun.
- Sayısal ve sıfırdan büyük olsun.
- `receivedAmount >= amount` olmalı.
- Para üstünü canlı göster.

Örnek:

```ts
const received = Number(receivedAmount);

if (
  method === "CASH" &&
  (!Number.isFinite(received) || received < amount)
) {
  setError("Alınan nakit tutarı ödeme tutarından az olamaz.");
  return;
}

const payload = {
  tableSessionId,
  amount,
  method,
  note: note || null,
  receivedAmount:
    method === "CASH"
      ? received
      : null,
};
```

CARD/ONLINE ödemelerde `receivedAmount: null` gönder.

## 2. API çağrısını düzelt

`src/app/api/waiter/payments/collect/route.ts` içinde `receivedAmount` değerini `collectPayment()` fonksiyonuna aktar.

Ayrıca şu doğrulamayı kullan:

```ts
const normalizedAmount = Number(amount);
const normalizedReceivedAmount =
  method === "CASH"
    ? Number(receivedAmount)
    : null;

if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
  return NextResponse.json(
    {
      error: "Geçersiz ödeme tutarı.",
      code: "INVALID_PAYMENT_AMOUNT",
    },
    { status: 400 }
  );
}

if (
  method === "CASH" &&
  (!Number.isFinite(normalizedReceivedAmount) ||
    normalizedReceivedAmount <= 0)
) {
  return NextResponse.json(
    {
      error: "Nakit ödeme için alınan tutarı girin.",
      code: "CASH_RECEIVED_AMOUNT_REQUIRED",
    },
    { status: 400 }
  );
}

if (
  method === "CASH" &&
  normalizedReceivedAmount! < normalizedAmount
) {
  return NextResponse.json(
    {
      error: "Alınan nakit ödeme tutarından az olamaz.",
      code: "CASH_AMOUNT_INSUFFICIENT",
    },
    { status: 400 }
  );
}
```

## 3. Merkezi ödeme servisini düzelt

`src/lib/services/table-flow.service.ts` içindeki `collectPayment()`:

```ts
export async function collectPayment(
  tableSessionId: string,
  businessId: string,
  amount: number,
  method: string,
  handledById: string,
  handledByWaiterName: string,
  note: string | null = null,
  receivedAmount: number | null = null
)
```

CASH doğrulamasını serviste tekrar yap:

```ts
if (method === "CASH") {
  if (
    receivedAmount === null ||
    !Number.isFinite(receivedAmount) ||
    receivedAmount < actualPaymentAmount
  ) {
    throw new PaymentError(
      "Alınan nakit tutarı geçersiz.",
      "CASH_AMOUNT_INSUFFICIENT",
      400
    );
  }
}
```

Para üstü:

```ts
const changeAmount =
  method === "CASH" && receivedAmount !== null
    ? receivedAmount - actualPaymentAmount
    : null;
```

Payment oluştururken:

```ts
const payment = await tx.payment.create({
  data: {
    businessId,
    tableId: tableSession.tableId,
    tableSessionId,
    billId: bill.id,
    amount: actualPaymentAmount,
    method: method as any,
    note,
    status: "PAID",
    paidAt: new Date(),
    handledById,
    handledByWaiterName,
    receivedAmount:
      method === "CASH"
        ? receivedAmount
        : null,
    changeAmount,
  },
});
```

Prisma modelinde bu alanlar yoksa veri kaybetmeyen migration oluştur:

```prisma
receivedAmount Decimal? @db.Decimal(10, 2)
changeAmount   Decimal? @db.Decimal(10, 2)
```

## 4. Prisma transaction hatasını düzelt

Canlı logda şu hata görülüyor:

```text
Transaction not found.
Transaction ID is invalid or refers to an old closed transaction.
```

`collectPayment()` transaction'ını şu forma getir:

```ts
return prisma.$transaction(
  async (tx) => {
    // Yalnız tx.* sorguları kullan.
  },
  {
    maxWait: 10_000,
    timeout: 20_000,
  }
);
```

Transaction callback içinde:

- global `prisma.*` kullanma,
- `fetch` kullanma,
- socket emit yapma,
- `$disconnect()` çağırma,
- transaction client'ı callback dışına çıkarma.

Socket bildirimi transaction tamamlandıktan sonra endpointte çalışsın.

## 5. Hata yönetimini düzelt

Şu hatalar `500` olmamalı:

```text
receivedAmount eksik       → 400 CASH_RECEIVED_AMOUNT_REQUIRED
receivedAmount yetersiz    → 400 CASH_AMOUNT_INSUFFICIENT
aktif oturum yok           → 409 TABLE_SESSION_NOT_ACTIVE
adisyon yok                → 404 BILL_NOT_FOUND
kalan borç yok             → 409 BILL_ALREADY_PAID
P2028 transaction timeout  → 503 PAYMENT_TRANSACTION_EXPIRED
P2021/P2022                → 503 DATABASE_SCHEMA_OUTDATED
```

Örnek:

```ts
if (
  error?.code === "P2028" ||
  error?.message?.includes("Transaction not found")
) {
  return NextResponse.json(
    {
      error: "Ödeme işlemi zaman aşımına uğradı. Tekrar deneyin.",
      code: "PAYMENT_TRANSACTION_EXPIRED",
    },
    { status: 503 }
  );
}
```

## 6. Güvenlik kuralı

Client'tan gelen `amount` değerine tek başına güvenme.

Sunucuda:

```text
sipariş toplamı
- önceki PAID ödemeler
= kalan borç
```

hesapla.

Ciroya en fazla kalan borç kadar ekle.

---

# Kabul Testleri

## CASH

- [ ] CASH seçilince alınan nakit alanı görünür.
- [ ] `receivedAmount` payload'a eklenir.
- [ ] Boş değer HTTP 400 döndürür.
- [ ] 200 TL ödeme için 150 TL alınan tutar reddedilir.
- [ ] 200 TL ödeme için 200 TL başarılıdır.
- [ ] 200 TL ödeme için 250 TL başarılıdır.
- [ ] `changeAmount = 50` kaydedilir.
- [ ] Genel “Sunucu hatası” gösterilmez.

## CARD

- [ ] CARD ödeme `receivedAmount` olmadan çalışır.
- [ ] Para üstü oluşmaz.

## Transaction

- [ ] Render logunda `Transaction not found` kalmaz.
- [ ] Prisma `P2028` kalmaz.
- [ ] Transaction içinde yalnız `tx.*` kullanılır.
- [ ] Çift tıklama çift ödeme oluşturmaz.
- [ ] Ciro iki kere artmaz.

## Regresyon

- [ ] ORDER_REQUEST akışı çalışır.
- [ ] Garson paneli çalışır.
- [ ] Admin ödeme ekranı çalışır.
- [ ] `npm run build` başarılıdır.
- [ ] `npx prisma validate` başarılıdır.
- [ ] `npx prisma migrate status` başarılıdır.

---

# Teslim Raporu

```text
Hata veren frontend dosyası:
Hata veren endpoint:
receivedAmount payload'a eklendi mi:
collectPayment'a aktarıldı mı:
Payment.receivedAmount sonucu:
Payment.changeAmount sonucu:
Transaction timeout:
CASH test sonucu:
CARD test sonucu:
Render logunda P2028 kaldı mı:
Değiştirilen dosyalar:
```

Canlı CASH ve CARD testleri geçmeden “düzeltildi” deme.
