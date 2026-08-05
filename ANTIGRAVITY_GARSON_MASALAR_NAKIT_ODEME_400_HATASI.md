# Antigravity Görevi — Garson Masalar Ekranındaki Nakit Ödeme 400 Hatasını Düzelt

## Proje

- Repo: `https://github.com/yattaraadamd-lang/QR_MENU_PRODUCT`
- Branch: `main`
- İlgili ekran: `src/app/waiter/tables/page.tsx`
- İlgili API: `src/app/api/waiter/payments/collect/route.ts`
- İlgili servis: `src/lib/services/table-flow.service.ts`

## Hata

Garson panelinde:

```text
Masalar → Masa Detayı → Ödeme Al → Nakit
```

akışında şu hata dönüyor:

```text
Nakit ödeme için müşteriden alınan tutar belirtilmelidir.
HTTP 400
```

## Kesin Kök Neden

`src/app/waiter/tables/page.tsx` içindeki `handlePay()` şu payload'ı gönderiyor:

```json
{
  "tableSessionId": "...",
  "amount": 200,
  "method": "CASH",
  "note": null
}
```

Nakit ödeme için gerekli `receivedAmount` alanı gönderilmiyor.

API, CASH için `receivedAmount` zorunlu tuttuğundan isteği `400` ile reddediyor.

İkinci hata: API `receivedAmount` değerini request body'den alsa bile `collectPayment()` çağrısına aktarmıyor.

---

# Hedef Davranış

## Nakit ödeme

Ödenecek tutar 200 TL, müşteri 250 TL verdiyse:

```json
{
  "tableSessionId": "...",
  "amount": 200,
  "method": "CASH",
  "receivedAmount": 250,
  "note": null
}
```

Beklenen:

```text
Tahsil edilen borç: 200 TL
Alınan nakit: 250 TL
Para üstü: 50 TL
```

Ciroya yalnız 200 TL eklenmelidir.

## Kart / online ödeme

`receivedAmount` zorunlu olmamalıdır:

```json
{
  "tableSessionId": "...",
  "amount": 200,
  "method": "CARD",
  "receivedAmount": null,
  "note": null
}
```

---

# Yapılacak Değişiklikler

## 1. Garson Masalar ekranına alınan nakit alanı ekle

`src/app/waiter/tables/page.tsx` içinde ödeme state'lerine ekle:

```ts
const [receivedAmount, setReceivedAmount] = useState("");
```

Ödeme yöntemi `CASH` olduğunda ödeme modalında şu alan gösterilsin:

```tsx
<label>
  Müşteriden Alınan Nakit
  <input
    type="number"
    min="0"
    step="0.01"
    value={receivedAmount}
    onChange={(event) => setReceivedAmount(event.target.value)}
    placeholder="Örn. 250"
  />
</label>
```

Nakit dışında alanı gizle ve değerini temizle.

```ts
useEffect(() => {
  if (payMethod !== "CASH") {
    setReceivedAmount("");
  }
}, [payMethod]);
```

## 2. Frontend doğrulaması ekle

`handlePay()` içinde:

```ts
const amount = Number(payAmount);
const received =
  payMethod === "CASH"
    ? Number(receivedAmount)
    : null;

if (!Number.isFinite(amount) || amount <= 0) {
  alert("Geçerli bir ödeme tutarı girin.");
  return;
}

if (
  payMethod === "CASH" &&
  (!Number.isFinite(received) || received! <= 0)
) {
  alert("Müşteriden alınan nakit tutarını girin.");
  return;
}

if (
  payMethod === "CASH" &&
  received! < amount
) {
  alert("Alınan nakit, ödeme tutarından az olamaz.");
  return;
}
```

Para üstünü modalda canlı göster:

```ts
const change =
  payMethod === "CASH" &&
  Number(receivedAmount) >= Number(payAmount)
    ? Number(receivedAmount) - Number(payAmount)
    : 0;
```

```tsx
{payMethod === "CASH" && change > 0 && (
  <div>
    Para üstü: {change.toFixed(2)} ₺
  </div>
)}
```

## 3. Payload'a `receivedAmount` ekle

`handlePay()` içindeki body:

```ts
body: JSON.stringify({
  tableSessionId: selectedTable.activeSession.id,
  amount,
  method: payMethod,
  receivedAmount:
    payMethod === "CASH"
      ? received
      : null,
  note: payNote || null,
}),
```

Başarılı işlemden sonra state'leri temizle:

```ts
setPayAmount("");
setReceivedAmount("");
setPayNote("");
setPayMethod("CASH");
```

Modal kapanırken de `receivedAmount` temizlenmelidir.

## 4. API'nin servis çağrısını düzelt

`src/app/api/waiter/payments/collect/route.ts` içindeki çağrı şu an eksik:

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

Şöyle değiştir:

```ts
const normalizedAmount = Number(amount);

const normalizedReceivedAmount =
  method === "CASH"
    ? Number(receivedAmount)
    : null;

const result = await collectPayment(
  tableSessionId,
  businessId,
  normalizedAmount,
  method,
  session!.user.id,
  session!.user.name || "Garson",
  note || null,
  normalizedReceivedAmount
);
```

Şu doğrulamayı `!receivedAmount` yerine `Number.isFinite()` ile yap. `0`, `NaN` ve string tiplerini doğru ayır:

```ts
if (
  method === "CASH" &&
  (
    !Number.isFinite(normalizedReceivedAmount) ||
    normalizedReceivedAmount! <= 0
  )
) {
  return NextResponse.json(
    {
      error: "Nakit ödeme için müşteriden alınan tutar belirtilmelidir.",
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

## 5. Serviste tekrar doğrula

`collectPayment()` client ve API doğrulamasına güvenmemeli.

```ts
if (
  method === "CASH" &&
  (
    receivedAmount === null ||
    !Number.isFinite(receivedAmount) ||
    receivedAmount < actualPaymentAmount
  )
) {
  throw new PaymentError(
    "Müşteriden alınan nakit tutarı geçersiz.",
    "CASH_AMOUNT_INSUFFICIENT",
    400
  );
}
```

Para üstü:

```ts
const changeAmount =
  method === "CASH" && receivedAmount !== null
    ? receivedAmount - actualPaymentAmount
    : null;
```

## 6. Payment kaydına nakit bilgilerini yaz

Prisma `Payment` modelinde varsa:

```ts
receivedAmount:
  method === "CASH"
    ? receivedAmount
    : null,

changeAmount:
  method === "CASH"
    ? changeAmount
    : null,
```

alanlarını Payment create/update işlemine ekle.

Modelde yoksa veri kaybetmeyen migration oluştur:

```prisma
receivedAmount Decimal? @db.Decimal(10, 2)
changeAmount   Decimal? @db.Decimal(10, 2)
```

Migration:

```sql
ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "receivedAmount" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "changeAmount" DECIMAL(10,2);
```

Yasak:

```text
prisma migrate reset
DROP TABLE
TRUNCATE
--accept-data-loss
```

## 7. Admin kontrollü ödeme mimarisini bozma

Projede admin onaylı ödeme akışı uygulanmışsa garson endpointi ödeme kaydını doğrudan `PAID` yapmamalıdır.

Bu durumda Masalar ekranındaki işlem:

```text
Ödeme Al
```

yerine:

```text
Admin Onayına Gönder
```

olarak çalışmalı ve aynı `receivedAmount` alanını:

```text
POST /api/waiter/payments/[paymentId]/request-approval
```

endpointine göndermelidir.

Garsonun girdiği:

```text
method
amount
receivedAmount
note
```

kaydedilir fakat ciro ve masa kapanışı yalnız admin onayında gerçekleşir.

Projede yeni admin-onay endpointi varsa eski `/api/waiter/payments/collect` akışını yeniden doğrudan tahsilata açma.

## 8. Hata gösterimini düzelt

Frontend yalnız `alert()` ile genel mesaj vermek yerine API'nin hata kodunu göstermeli:

```ts
const data = await res.json();

if (!res.ok) {
  const message =
    data.error ||
    "Ödeme işlemi gerçekleştirilemedi.";

  alert(message);
  return;
}
```

Beklenen hata kodları:

```text
CASH_RECEIVED_AMOUNT_REQUIRED → 400
CASH_AMOUNT_INSUFFICIENT      → 400
INVALID_PAYMENT_AMOUNT        → 400
TABLE_SESSION_NOT_ACTIVE      → 409
BILL_ALREADY_PAID             → 409
DATABASE_SCHEMA_OUTDATED      → 503
PAYMENT_TRANSACTION_EXPIRED   → 503
PAYMENT_INTERNAL_ERROR        → 500
```

---

# Zorunlu Testler

## CASH-01 Eksik alınan tutar

Payload:

```json
{
  "amount": 200,
  "method": "CASH",
  "receivedAmount": null
}
```

Beklenen:

- [ ] Frontend isteği göndermeden uyarır.
- [ ] API doğrudan çağrılırsa HTTP `400`.
- [ ] Hata kodu `CASH_RECEIVED_AMOUNT_REQUIRED`.

## CASH-02 Yetersiz alınan tutar

```json
{
  "amount": 200,
  "method": "CASH",
  "receivedAmount": 150
}
```

Beklenen:

- [ ] HTTP `400`.
- [ ] Hata kodu `CASH_AMOUNT_INSUFFICIENT`.
- [ ] Payment oluşmaz.
- [ ] Bill değişmez.

## CASH-03 Tam tutar

```json
{
  "amount": 200,
  "method": "CASH",
  "receivedAmount": 200
}
```

Beklenen:

- [ ] İşlem başarılı.
- [ ] `changeAmount = 0`.

## CASH-04 Para üstü

```json
{
  "amount": 200,
  "method": "CASH",
  "receivedAmount": 250
}
```

Beklenen:

- [ ] İşlem başarılı.
- [ ] `receivedAmount = 250`.
- [ ] `changeAmount = 50`.
- [ ] Ciroya yalnız `200` eklenir.

## CARD-01 Kart

```json
{
  "amount": 200,
  "method": "CARD",
  "receivedAmount": null
}
```

Beklenen:

- [ ] İşlem başarılı.
- [ ] Nakit alanı zorunlu değil.
- [ ] Para üstü oluşmaz.

## REG-01 Regresyon

- [ ] Masa detay modalı açılıyor.
- [ ] Adisyon tutarı doğru.
- [ ] Kısmi ödeme çalışıyor.
- [ ] Admin kontrollü ödeme akışı korunuyor.
- [ ] Çift tıklama çift ödeme oluşturmuyor.
- [ ] `npm run build` başarılı.
- [ ] `npx prisma validate` başarılı.
- [ ] `npx prisma migrate status` başarılı.
- [ ] Render logunda `P2021`, `P2022`, `P2028`, `42703` yok.

---

# Teslim Raporu

```text
Hata veren frontend dosyası:
Eksik payload alanı:
Frontend değişikliği:
API değişikliği:
collectPayment receivedAmount sonucu:
Prisma alanları:
Migration:
CASH tam tutar testi:
CASH para üstü testi:
CARD testi:
Admin onay akışı korundu mu:
Değiştirilen dosyalar:
Başarısız kalan testler:
```

Canlı ortamda Masalar ekranından CASH ödeme/ödeme-onay talebi başarılı olmadan “düzeltildi” deme.
