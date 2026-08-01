# Antigravity — Ödeme Talebi ve Masa Onay Akışı Düzeltmesi

Repo: `https://github.com/yattaraadamd-lang/QR_MENU_PRODUCT/tree/main`

## Çalışma talimatı

Aşağıdaki hataları doğrudan kodda düzelt. Uzun analiz/rapor üretme; yalnız gerekli dosyaları ve doğrudan bağımlılıklarını incele. Geniş refactor, tasarım değişikliği veya gereksiz paket ekleme.

Öncelikli dosyalar:

- `src/app/menu/[businessId]/[tableNumber]/page.tsx`
- `src/app/api/customer/payment-requests/route.ts`
- `src/app/api/customer/service-requests/route.ts`
- `src/lib/services/table-flow.service.ts`
- `src/app/api/waiter/payments/route.ts`
- `src/app/waiter/payments/page.tsx`
- `src/app/api/waiter/service-requests/[id]/status/route.ts`
- `src/app/api/waiter/service-requests/[id]/open-table/route.ts`
- `src/app/waiter/requests/page.tsx`
- ilgili badge/socket yardımcıları

Mevcut güvenli QR akışını koru:

`VIEW_ONLY → PENDING → AUTHORIZED`

Önceki sabotaj korumasını ve admin ağırlıklı ödeme mimarisini bozma.

---

# 1. Ödeme talebinin garson paneline düşmemesi

## Kök neden

Müşteri arayüzündeki `sendRequest("PAYMENT_REQUEST")`, yanlışlıkla genel:

```text
POST /api/customer/service-requests
```

endpointini çağırıyor. Bu yol yalnız `ServiceRequest` oluşturuyor; `Payment` kaydı oluşturmuyor.

Garsonun hizmet talepleri API'si `PAYMENT_REQUEST` kayıtlarını özellikle filtreliyor. Garsonun ödeme ekranı ise yalnız `Payment.status=PENDING` kayıtlarını okuyor. Sonuç olarak ödeme talebi hiçbir doğru ekranda görünmüyor.

## Zorunlu düzeltme

### A. Müşteri frontend

`src/app/menu/[businessId]/[tableNumber]/page.tsx` içindeki `sendRequest` fonksiyonunda endpointi talep tipine göre ayır:

```ts
const isPaymentRequest = type === "PAYMENT_REQUEST";
const endpoint = isPaymentRequest
  ? "/api/customer/payment-requests"
  : "/api/customer/service-requests";

const payload = isPaymentRequest
  ? {
      businessId: business.id,
      tableId: table.id,
      note: note || null,
    }
  : {
      businessId: business.id,
      tableId: table.id,
      requestType: type,
      reason: reason || null,
      note: note || null,
    };
```

Aynı `x-session-token` başlığını kullan.

Kurallar:

- Ödeme isteğini yalnız `/api/customer/payment-requests` endpointine gönder.
- Başarılı HTTP yanıtından sonra başarı mesajı göster.
- `checkActiveRequests()` çağır.
- Çift tıklamayı/loading durumuyla engelle.
- `409` veya mevcut bekleyen ödeme cevabında yeni kayıt üretme; kullanıcıya `Ödeme talebiniz zaten bekliyor.` göster.
- Hata yanıtını başarı gibi gösterme.

### B. Genel hizmet talebi endpointini korumalı yap

`src/app/api/customer/service-requests/route.ts` içinde `PAYMENT_REQUEST` kabul edilmesin.

Frontend ileride yanlış endpointi tekrar çağırırsa:

```json
{
  "code": "USE_PAYMENT_REQUEST_ENDPOINT",
  "error": "Ödeme talebi özel ödeme endpointi üzerinden gönderilmelidir."
}
```

ile `400` döndür.

`PAYMENT_REQUEST` için burada `ServiceRequest` oluşturma ve tablo durumunu değiştirme.

### C. Özel ödeme endpointi ve servis

`POST /api/customer/payment-requests` mevcut merkezi `requestPayment(...)` servisini kullanmaya devam etsin.

Tek transaction içinde şunları doğrula/sağla:

1. İşletmeye ve masaya ait aktif, yetkili müşteri oturumu var.
2. Açık `TableSession` ve açık adisyon var.
3. En az bir sipariş/ödenecek tutar var.
4. Aynı masa/adisyon için aktif ödeme talebi yok.
5. Tam olarak bir `ServiceRequest(requestType=PAYMENT_REQUEST)` oluşur.
6. Tam olarak bir aktif `Payment` oluşur.
7. İki kayıt doğru masa, işletme ve mümkünse müşteri oturumuyla ilişkilidir.
8. Socket olayı transaction başarılı olduktan sonra gönderilir.

Aynı masa/adisyon için ikinci aktif talepte ikinci `Payment` oluşturma. Mevcut kaydı döndür veya `409 PAYMENT_REQUEST_ALREADY_EXISTS` ver.

### D. Garson ödeme ekranı

Ödeme talebi finansal bir kayıt olduğundan genel `Talepler` listesine tekrar ekleme. `Ödemeler` ekranında göster.

`src/app/api/waiter/payments/route.ts` ve `src/app/waiter/payments/page.tsx` için:

- Garsonun kendi işletmesindeki aktif ödeme taleplerini getir.
- Önceki admin onaylı ödeme güncellemesi uygulanmışsa aktif durumlar arasında gerekli olanları kullan (`PENDING` ve gerekiyorsa `AWAITING_ADMIN_APPROVAL`).
- Müşterinin yeni talebi önce `PENDING` olarak görünmeli.
- Socket olayı kaçarsa polling ile en geç birkaç saniye içinde görünmeli.
- Kartta masa adı/numarası, tutar ve talep zamanı görünmeli.
- Menü/sidebar ödeme badge sayısı kullanılıyorsa aktif ödeme adedini doğru hesapla.
- Aynı ödeme kartını iki kez gösterme.

Garson finansal olarak `PAID` yapmamalı; önceki görevdeki gibi yalnız admin onayına gönderebilmeli.

---

# 2. “İşleme Al / Tamamla” sonrası müşterinin beklemede kalması

## Kök neden

`ORDER_REQUEST` normal hizmet talebi değildir.

Müşterinin sipariş verebilmesi için bağlı `CustomerSession.authorizationStatus` değerinin `AUTHORIZED` olması gerekir. Bunu doğru biçimde yapan işlem yalnız:

```text
POST /api/waiter/service-requests/[id]/open-table
```

akışıdır.

Genel status endpointindeki `IN_PROGRESS` veya `COMPLETED` işlemi yalnız talebin durumunu değiştiriyor; masa oturumu/adisyon oluşturmuyor ve müşteri oturumunu yetkilendirmiyor. Bu nedenle müşteri `PENDING` durumunda kalıyor.

## Zorunlu düzeltme

### A. Garson Talepler arayüzü

`src/app/waiter/requests/page.tsx` içinde butonları talep tipine göre kesin biçimde ayır.

`ORDER_REQUEST` ve `PENDING` için yalnız:

- `Masayı Aç`
- `İptal`

butonlarını göster.

`ORDER_REQUEST` kartında şunları hiçbir durumda gösterme:

- `İşleme Al`
- `Tamamla`

Normal hizmet taleplerinde (`CALL_WAITER`, `HELP_REQUEST`, `CLEANING_REQUEST`, `PRODUCT_INFO`, `COMPLAINT_SUGGESTION` vb.) mevcut akış devam etsin:

- `PENDING → IN_PROGRESS`
- `IN_PROGRESS → COMPLETED`
- gerektiğinde `CANCELLED`

Örnek render mantığı:

```tsx
{isOrder ? (
  isPending && !expired && (
    <>
      <button onClick={() => openTable(req)}>Masayı Aç</button>
      <button onClick={() => cancelRequest(req)}>İptal</button>
    </>
  )
) : (
  <>
    {req.status === "PENDING" && (
      <button onClick={() => updateStatus(req.id, "IN_PROGRESS")}>
        İşleme Al
      </button>
    )}
    {req.status === "IN_PROGRESS" && (
      <button onClick={() => updateStatus(req.id, "COMPLETED")}>
        Tamamla
      </button>
    )}
    <button onClick={() => cancelRequest(req)}>İptal</button>
  </>
)}
```

Mevcut iptal nedeni/sabotaj modalı varsa koru; eski doğrudan `CANCELLED` çağrısını geri getirme.

### B. Backend güvenlik bariyeri

`src/app/api/waiter/service-requests/[id]/status/route.ts` içinde talebi bulduktan sonra:

```ts
if (
  serviceRequest.requestType === "ORDER_REQUEST" &&
  ["SEEN", "IN_PROGRESS", "COMPLETED"].includes(status)
) {
  return NextResponse.json(
    {
      code: "USE_OPEN_TABLE_ENDPOINT",
      error: "Sipariş talebi yalnız Masayı Aç veya İptal işlemiyle sonuçlandırılabilir.",
    },
    { status: 409 }
  );
}
```

Böylece bozuk/eski frontend veya manuel API çağrısı müşteriyi yarım durumda bırakamaz.

Kurallar:

- Genel status endpointi `ORDER_REQUEST` için müşteri yetkilendirmesin.
- `ORDER_REQUEST` onayı yalnız `open-table` transactionı üzerinden yapılsın.
- `CANCELLED` işlemi izinli kalsın.
- Önceki normal iptal/sabotaj ayrımını koru.
- Normal iptalde bağlı `PENDING` müşteri oturumu tekrar deneyebileceği duruma dönsün.
- Sabotaj iptalinde önceki cihaz engelleme mantığı bozulmasın.

### C. `open-table` işlemini doğrula

`POST /api/waiter/service-requests/[id]/open-table` tek transaction içinde:

1. Garson/admin yetkisini ve işletme sahipliğini doğrular.
2. Talebin `ORDER_REQUEST`, aktif, süresi dolmamış ve doğru işletmeye ait olduğunu doğrular.
3. Eşzamanlı masa açmaya karşı koruma uygular.
4. Aktif `TableSession` oluşturur veya güvenli/idempotent biçimde mevcut doğru oturumu kullanır.
5. Açık `Bill` oluşturur/bulur.
6. Masayı doğru duruma getirir.
7. Yalnız talebi gönderen `CustomerSession` kaydını `AUTHORIZED` yapar ve `tableSessionId` bağlar.
8. Talebi `COMPLETED` yapar.
9. Aynı masadaki diğer yetkisiz bekleyen `ORDER_REQUEST` kayıtlarını önceki güvenlik kurallarına göre kapatır.
10. Transaction sonrası socket olaylarını gönderir.

Başarılı yanıttan sonra garson arayüzü listeyi yenilesin. Müşteri polling/socket ile en geç birkaç saniye içinde `AUTHORIZED` durumuna geçsin ve yeniden bastığında gerçek siparişi gönderebilsin.

---

# Kabul testleri

Aşağıdakileri uygula ve sonuçları kısa özetle:

1. Yetkili müşteri, siparişlerden sonra ödeme talebi gönderir.
   - Bir `PAYMENT_REQUEST ServiceRequest` ve bir aktif `Payment` oluşur.
   - Garsonun `Ödemeler` ekranında görünür.

2. Socket kapalıyken ödeme talebi polling ile görünür.

3. Aynı müşteri aynı adisyon için art arda iki ödeme talebi gönderir.
   - Tek aktif ödeme kaydı kalır.

4. Genel `/api/customer/service-requests` endpointine `PAYMENT_REQUEST` gönderilir.
   - `400 USE_PAYMENT_REQUEST_ENDPOINT` döner; kayıt oluşmaz.

5. Yeni `ORDER_REQUEST` kartında yalnız `Masayı Aç` ve `İptal` görünür.

6. `ORDER_REQUEST` için genel status endpointine `IN_PROGRESS`, `SEEN` veya `COMPLETED` gönderilir.
   - `409 USE_OPEN_TABLE_ENDPOINT` döner.
   - CustomerSession `PENDING` kalır; sahte onay oluşmaz.

7. Garson `Masayı Aç` der.
   - TableSession/Bill açılır.
   - İlgili müşteri `AUTHORIZED` olur.
   - Talep tamamlanır.
   - Müşteri gerçek sipariş gönderebilir.

8. Normal `CALL_WAITER` gibi taleplerde `İşleme Al` ve `Tamamla` çalışmaya devam eder.

9. Normal iptal müşteriyi tekrar deneyebilir hâle getirir; sabotaj iptali önceki engel kurallarını korur.

10. Garson ödeme kaydını doğrudan `PAID` yapamaz; önceki admin onay akışı korunur.

Son olarak mevcut proje komutlarına göre lint/type-check/build çalıştır. Hata varsa ilgili kodu düzelt. Bu görev Prisma şema değişikliği gerektirmemelidir; gerçekten zorunlu değilse migration üretme.

## Çıktı biçimi

Kod değişikliklerini uygula. Son mesajda yalnız:

- değiştirilen dosyalar,
- düzeltilen iki kök neden,
- çalıştırılan testler ve sonuçları,
- varsa kalan gerçek risk

başlıklarını kısa biçimde yaz.
