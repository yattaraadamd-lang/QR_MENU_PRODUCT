# Antigravity Görevi — Sipariş İptali Sonrası Masa Durumu ve Otomatik Stok Güncellemesi

## Proje

- Repository: `https://github.com/yattaraadamd-lang/QR_MENU_PRODUCT`
- Branch: `main`
- Teknoloji: Next.js, TypeScript, Prisma, Supabase PostgreSQL, Render

## Amaç

Aşağıdaki iki problemi mevcut masa, sipariş ve ödeme akışını bozmadan çöz:

1. Müşterinin siparişi iptal/reddedildiğinde, servis edilmiş başka ödenmemiş sipariş olmadığı halde masa `SERVED` görünüyor.
2. Garson iptal/red nedeni olarak **“Ürün stokta yok”** seçtiğinde, ilgili siparişteki ürünler otomatik olarak stokta yok ve satışa kapalı yapılmıyor.

Analiz raporu bırakma. Kod, migration, API, UI ve testleri uygula.

---

# Mevcut Kodda Doğrulanan Sorunlar

## 1. İptal işlemleri farklı kurallar kullanıyor

Aşağıdaki endpointler masa durumunu birbirinden farklı hesaplıyor:

```text
PUT    /api/waiter/orders/[id]/status
PUT    /api/admin/orders/[orderId]/cancel
PATCH  /api/orders/[orderId]
DELETE /api/orders/[orderId]
```

Bazı yollar iptalden sonra `EMPTY`, bazıları `OCCUPIED`, bazıları da başka `SERVED` kayıtları nedeniyle `SERVED` yapıyor.

Kontroller çoğunlukla `tableId` üzerinden yapıldığı için önceki masa oturumlarındaki siparişler de hesaba katılabilir.

## 2. Masa durumu Bill güncellenmeden önce belirleniyor

Garson endpointinde önce masa durumu değiştiriliyor, ardından iptal edilen siparişin tutarı Bill'den düşülüyor. Bu sıra yanlış/eskimiş durum üretmeye açıktır.

## 3. Aktif masa oturumu varken masa `EMPTY` yapılabiliyor

Masa açılmış ve müşteri hâlâ oturuyorsa, bütün siparişler iptal edilse bile aktif `TableSession` devam eder.

Bu durumda doğru masa durumu:

```text
OCCUPIED
```

olmalıdır.

`EMPTY` yalnız masa oturumu gerçekten kapatıldığında kullanılmalıdır.

## 4. İptal nedeni yalnız metin olarak tutuluyor

Frontend şu metni gönderiyor:

```text
Ürün stokta yok
```

Backend serbest metni iş kuralı olarak güvenli şekilde ayıramıyor. Yazım veya dil değişikliği otomatik stok güncellemesini bozabilir.

## 5. Menü kategorileri stok filtresini tam uygulamıyor

Kategori ürünleri şu anda yalnız `isDeleted: false` ile getiriliyor. Ürün `OUT_OF_STOCK` olsa bile müşteriye normal ürün gibi gösterilebilir.

Sipariş endpointi stok kontrolü yapıyor; fakat müşteri deneyimi için ürün menüde de pasif görünmelidir.

---

# Hedef İş Akışı

## Normal iptal/red

1. Garson siparişi iptal eder veya reddeder.
2. Sipariş `CANCELLED` ya da `REJECTED` olur.
3. Siparişin `paymentStatus` değeri `CANCELLED` olur.
4. Açık Bill, aktif masa oturumundaki ödenebilir siparişlerden yeniden hesaplanır.
5. Masa durumu aynı aktif oturumdaki kalan siparişlere göre belirlenir.
6. Bütün siparişler iptal edilmişse ve masa oturumu hâlâ aktifse masa `OCCUPIED` olur.
7. Masa ancak TableSession kapatıldığında `EMPTY` olur.

## “Ürün stokta yok” iptal/red nedeni

1. Garson `OUT_OF_STOCK` nedenini seçer.
2. İptal edilen siparişin ürünleri backend tarafından bulunur.
3. Seçilen ürünler aynı transaction içinde:

```text
stockStatus = OUT_OF_STOCK
isAvailable = false
```

yapılır.
4. Ürün müşteri menüsünde “Stokta yok” görünür ve sepete eklenemez.
5. Admin ürün ekranında ürün stokta yok olarak görünür.
6. Admin daha sonra ürünü tekrar `IN_STOCK` ve `isAvailable=true` yapabilir.

---

# Merkezi Servis Oluştur

Yeni dosya:

```text
src/lib/services/order-cancellation.service.ts
```

Tek servis:

```ts
cancelOrderAndSyncState(input)
```

Önerilen input:

```ts
type CancelOrderInput = {
  orderId: string;
  businessId: string;
  actorId: string;
  actorRole: "WAITER" | "ADMIN" | "SUPER_ADMIN";
  targetStatus: "CANCELLED" | "REJECTED";
  reasonCode:
    | "OUT_OF_STOCK"
    | "CUSTOMER_CANCELLED"
    | "WRONG_ORDER"
    | "TABLE_NOT_VERIFIED"
    | "BUSINESS_NOT_ACCEPTING"
    | "OTHER";
  reasonText?: string | null;
  outOfStockProductIds?: string[];
};
```

Bütün sipariş iptal/red endpointleri aynı servisi kullanmalıdır. Aynı iş mantığını endpointlerde kopyalama.

---

# Prisma Değişiklikleri

## Order alanları

Mevcut alanları koru ve ekle:

```prisma
cancelReasonCode       String?
stockUpdatedProductIds Json?
cancelledById          String?
```

İstersen String yerine enum kullan:

```prisma
enum OrderCancelReasonCode {
  OUT_OF_STOCK
  CUSTOMER_CANCELLED
  WRONG_ORDER
  TABLE_NOT_VERIFIED
  BUSINESS_NOT_ACCEPTING
  OTHER
}
```

Migration veri kaybetmeden oluşturulmalıdır.

Yasak:

```text
prisma migrate reset
DROP TABLE
TRUNCATE
--accept-data-loss
production verisini seed ile ezmek
```

---

# Transaction İçindeki Zorunlu Adımlar

```ts
return prisma.$transaction(
  async (tx) => {
    // yalnız tx.*
  },
  {
    maxWait: 10_000,
    timeout: 15_000,
  }
);
```

Transaction içinde Socket.IO, fetch veya `$disconnect()` kullanma.

## 1. Siparişi getir

Şu alanlarla ve işletme izolasyonuyla getir:

```ts
const order = await tx.order.findFirst({
  where: {
    id: orderId,
    businessId,
  },
  include: {
    items: {
      select: {
        productId: true,
        productName: true,
      },
    },
    table: {
      select: {
        id: true,
        status: true,
        tableNumber: true,
        tableName: true,
      },
    },
  },
});
```

## 2. Durum geçişini doğrula

Yalnız şu durumlar iptal/reddedilebilir:

```text
PENDING
ACCEPTED
PREPARING
```

`SERVED`, `CANCELLED` ve `REJECTED` kayıtları normal garson işlemiyle değiştirilemez.

Eşzamanlı çift tıklamaya karşı koşullu `updateMany` kullan:

```ts
const result = await tx.order.updateMany({
  where: {
    id: orderId,
    businessId,
    status: {
      in: ["PENDING", "ACCEPTED", "PREPARING"],
    },
  },
  data: {
    status: targetStatus,
    paymentStatus: "CANCELLED",
    cancelReason: reasonText,
    cancelReasonCode: reasonCode,
    cancelledAt: new Date(),
    cancelledById: actorId,
  },
});

if (result.count !== 1) {
  throw new OrderCancellationError(
    "Siparişin durumu başka bir işlem tarafından değiştirilmiş.",
    "ORDER_STATE_CHANGED",
    409
  );
}
```

## 3. Stokta yok ürünlerini güncelle

Yalnız `reasonCode === "OUT_OF_STOCK"` durumunda çalıştır.

Siparişteki benzersiz ürün ID'lerini çıkar:

```ts
const orderProductIds = [
  ...new Set(order.items.map(item => item.productId)),
];
```

Kurallar:

- `outOfStockProductIds` gönderilmişse her ID siparişin içinde bulunmalıdır.
- Başka siparişe veya başka işletmeye ait ürün değiştirilemez.
- Bir ürünlü siparişte ID gönderilmemişse o ürün otomatik seçilir.
- Çok ürünlü siparişte frontend ürün seçimi göndermelidir.
- Geriye uyumluluk için eski frontend ID göndermiyorsa tüm sipariş ürünlerini seçebilirsin; fakat UI'yi aynı deploy içinde seçilebilir hale getir.

Güvenli update:

```ts
await tx.product.updateMany({
  where: {
    businessId,
    id: {
      in: selectedProductIds,
    },
    isDeleted: false,
  },
  data: {
    stockStatus: "OUT_OF_STOCK",
    isAvailable: false,
  },
});
```

Güncellenen ID'leri siparişte sakla:

```ts
stockUpdatedProductIds: selectedProductIds
```

Siparişteki ürün sayısıyla güncellenen ürün sayısı uyuşmuyorsa transaction'ı hata ile geri al.

## 4. Bill'i baştan hesapla

İptal edilen tutarı mevcut Bill toplamından körlemesine çıkartma.

Aktif `tableSessionId` içindeki bütün ödenebilir siparişleri yeniden topla:

```ts
const payableOrders = await tx.order.findMany({
  where: {
    tableSessionId: order.tableSessionId,
    status: {
      notIn: ["CANCELLED", "REJECTED"],
    },
  },
  select: {
    totalPrice: true,
  },
});
```

Hesap:

```text
totalAmount = ödenebilir sipariş toplamı
remainingAmount = max(0, totalAmount - paidAmount)
```

Bill durumu:

```text
totalAmount = 0 ve paidAmount = 0 → UNPAID, OPEN
remainingAmount > 0 ve paidAmount = 0 → UNPAID, OPEN
remainingAmount > 0 ve paidAmount > 0 → PARTIALLY_PAID, OPEN
remainingAmount = 0 ve totalAmount > 0 → PAID
```

İptal nedeniyle total `0` oldu diye aktif masa oturumunu kapatma.

## 5. Masa durumunu aktif oturuma göre belirle

Kontrolleri `tableId` yerine mümkün olduğunca:

```text
tableSessionId
```

üzerinden yap. Önceki oturumların siparişlerini hesaba katma.

Merkezi yardımcı fonksiyon oluştur:

```ts
deriveTableStatusAfterOrderChange(tx, {
  tableId,
  tableSessionId,
  businessId,
})
```

Karar sırası:

```text
1. Aktif TableSession yoksa:
   Table = EMPTY

2. Aktif oturumda PREPARING sipariş varsa:
   Table = PREPARING

3. Aktif oturumda PENDING veya ACCEPTED sipariş varsa:
   Table = HAS_ORDER

4. Aktif oturumda SERVED ve ödenmemiş sipariş varsa
   veya Bill.remainingAmount > 0 ise:
   Table = SERVED

5. Aktif oturum var fakat ödenebilir sipariş kalmadıysa:
   Table = OCCUPIED
```

Kritik kural:

```text
Bütün siparişler CANCELLED/REJECTED
+ TableSession ACTIVE
= OCCUPIED
```

Bu senaryoda `SERVED` ve `EMPTY` kullanma.

`PAYMENT_REQUESTED` durumundaki Bill, iptal sonrası `remainingAmount = 0` olduysa açık Payment/PAYMENT_REQUEST taleplerini `CANCELLED` yap ve masa durumunu `OCCUPIED` olarak düzelt.

`WAITING_WAITER` için açık garson çağrısı varsa bu özel durumu gereksiz yere ezme.

## 6. CustomerSession'ı koru

Siparişin normal nedenlerle iptal edilmesi:

- müşteri oturumunu kapatmamalı,
- müşteri yetkisini iptal etmemeli,
- cihazı engellememeli.

Cihaz engeli yalnız sabotaj için kullanılan ayrı sipariş-talebi reddetme akışında kalmalıdır.

“Ürün stokta yok” müşterinin kötüye kullanımı değildir.

---

# Frontend Değişiklikleri

## Garson paneli

Mevcut iptal/red nedenlerini machine-readable hale getir:

```ts
const CANCEL_REASONS = [
  {
    code: "OUT_OF_STOCK",
    label: "Ürün stokta yok",
  },
  {
    code: "CUSTOMER_CANCELLED",
    label: "Müşteri vazgeçti",
  },
  {
    code: "WRONG_ORDER",
    label: "Yanlış sipariş",
  },
  {
    code: "TABLE_NOT_VERIFIED",
    label: "Masa doğrulanamadı",
  },
  {
    code: "BUSINESS_NOT_ACCEPTING",
    label: "İşletme sipariş almıyor",
  },
  {
    code: "OTHER",
    label: "Diğer",
  },
];
```

Payload:

```json
{
  "status": "REJECTED",
  "reasonCode": "OUT_OF_STOCK",
  "reasonText": "Ürün stokta yok",
  "outOfStockProductIds": ["product-id"]
}
```

### Çok ürünlü sipariş

“Ürün stokta yok” seçildiğinde siparişteki ürünleri checkbox olarak göster.

- Varsayılan olarak tüm ürünler seçilebilir.
- Garson stokta olanları seçimden çıkarabilir.
- En az bir ürün seçilmeden onay verilemez.
- Miktar değil benzersiz `productId` gönder.

Onay metni:

```text
Seçilen ürünler stokta yok olarak işaretlenecek ve müşteri siparişine kapatılacaktır.
```

## Admin paneli

Admin iptal modalına aynı neden kodlarını ve ürün seçimini ekle.

Serbest metin “Ürün stokta yok” yazılmasına güvenme.

Geriye uyumluluk için backend şu eski metni geçici olarak map edebilir:

```text
"Ürün stokta yok" → OUT_OF_STOCK
```

Yeni frontend yalnız reasonCode kullanmalıdır.

---

# Müşteri Menüsü

## Menü API

Kategori ürünlerinde yalnız `isDeleted: false` filtresi kullanıp stok bilgisini görmezden gelme.

İki kabul edilebilir seçenekten birini tutarlı uygula:

### Tercih edilen

Ürün menüde görünür fakat:

```text
stockStatus = OUT_OF_STOCK
isAvailable = false
```

ise:

- “Stokta yok” rozeti göster,
- sepete ekle butonunu kapat,
- mevcut sepetteyse kullanıcıya uyarı verip ürünü sepetten çıkart.

### Alternatif

Ürünü müşteri menüsünden tamamen filtrele:

```ts
where: {
  isDeleted: false,
  isAvailable: true,
  stockStatus: "IN_STOCK",
}
```

Tercih edilen çözüm, müşteriye ürünün geçici olarak stokta olmadığını göstermektir.

## Sipariş API

Mevcut server-side kontroller korunmalı:

```text
isAvailable = true
stockStatus = IN_STOCK
```

Stok durumu sipariş oluşturma transaction'ında tekrar doğrulanmalı. Ürün garson tarafından stok dışı bırakıldıktan sonra eski sepette kalan ürün siparişe dönüşmemelidir.

---

# Socket ve UI Senkronizasyonu

Transaction başarılı olduktan sonra:

```text
order_status_update
table_status_update
product_stock_updated
bill_updated
```

olaylarını yayınla.

`product_stock_updated` payload'ı:

```json
{
  "businessId": "...",
  "productIds": ["..."],
  "stockStatus": "OUT_OF_STOCK",
  "isAvailable": false,
  "sourceOrderId": "..."
}
```

Müşteri menüsü, garson ve admin ürün ekranları bu olayı alınca veriyi yeniden yüklesin.

Socket hatası transaction'ı geri almamalıdır.

---

# API Hata Kodları

```text
ORDER_NOT_FOUND                  → 404
ORDER_NOT_CANCELLABLE            → 409
ORDER_STATE_CHANGED              → 409
INVALID_CANCEL_REASON            → 400
OUT_OF_STOCK_PRODUCT_REQUIRED    → 400
PRODUCT_NOT_IN_ORDER             → 400
PRODUCT_OWNERSHIP_MISMATCH       → 403
STOCK_UPDATE_FAILED              → 500
DATABASE_SCHEMA_OUTDATED         → 503
ORDER_CANCELLATION_INTERNAL      → 500
```

Teknik Prisma ayrıntılarını client'a gönderme.

---

# Zorunlu Testler

## CAN-01 Tek sipariş iptali

```text
TableSession ACTIVE
Order PENDING
```

Sipariş iptal edilir.

Beklenen:

- [ ] Order `CANCELLED`
- [ ] Order.paymentStatus `CANCELLED`
- [ ] Bill.totalAmount `0`
- [ ] Bill.remainingAmount `0`
- [ ] Table `OCCUPIED`
- [ ] Table `SERVED` değil
- [ ] Table `EMPTY` değil
- [ ] CustomerSession aktif/yetkili kalır
- [ ] Müşteri yeni sipariş verebilir

## CAN-02 Sipariş reddi

PENDING sipariş reddedilir.

- [ ] TableSession aktifse Table `OCCUPIED`
- [ ] Sabotaj nedeni değilse cihaz engellenmez

## CAN-03 Başka aktif sipariş var

Bir sipariş iptal edilir, diğer sipariş PREPARING durumundadır.

- [ ] Table `PREPARING`

## CAN-04 Başka bekleyen sipariş var

Bir sipariş iptal edilir, diğer sipariş PENDING/ACCEPTED durumundadır.

- [ ] Table `HAS_ORDER`

## CAN-05 Başka servis edilmiş ödenmemiş sipariş var

Bir sipariş iptal edilir, aynı aktif oturumda başka SERVED ve ödenmemiş sipariş vardır.

- [ ] Table `SERVED`
- [ ] Bill kalan tutarı doğru
- [ ] Servis edilen ürün cirodan düşmez

## CAN-06 Eski oturum izolasyonu

Önceki kapalı oturumda SERVED kayıt vardır, yeni aktif oturumdaki tek sipariş iptal edilir.

- [ ] Eski oturumdaki sipariş hesaba katılmaz
- [ ] Table `OCCUPIED`
- [ ] Table yanlışlıkla `SERVED` olmaz

## STOCK-01 Tek ürün stokta yok

Garson `OUT_OF_STOCK` seçer.

- [ ] Order iptal/reddedilir
- [ ] Product.stockStatus `OUT_OF_STOCK`
- [ ] Product.isAvailable `false`
- [ ] Ürün menüde pasif veya filtreli
- [ ] Yeni sipariş API tarafından reddedilir
- [ ] Admin ürün ekranında stok durumu görünür

## STOCK-02 Çok ürünlü sipariş

- [ ] Ürün seçim listesi açılır
- [ ] Yalnız seçilen productId'ler stok dışı olur
- [ ] Seçilmeyen ürünler `IN_STOCK` kalır
- [ ] Başka işletmeye ait ürün güncellenemez

## STOCK-03 Normal iptal

Neden `CUSTOMER_CANCELLED` veya `WRONG_ORDER`.

- [ ] Hiçbir ürünün stok durumu değişmez

## STOCK-04 İdempotency

Aynı iptal isteğine iki kez basılır.

- [ ] Sipariş bir kez iptal edilir
- [ ] Stok işlemi tutarlı kalır
- [ ] İkinci istek kontrollü `409`
- [ ] Bill iki kez azalmaz

## REG-01 Regresyon

- [ ] ORDER_REQUEST çalışır
- [ ] Masa açma doğrulama kodu çalışır
- [ ] Normal sipariş oluşturma çalışır
- [ ] Ödeme sistemi çalışır
- [ ] Cihaz engeli sistemi çalışır
- [ ] Admin ürün stok açma/kapatma çalışır
- [ ] `npm run build` başarılı
- [ ] `npx prisma validate` başarılı
- [ ] `npx prisma migrate status` başarılı
- [ ] Render logunda `P2021`, `P2022`, `P2028`, `42703` yok

---

# Değiştirilmesi Beklenen Dosyalar

Mevcut yapıyı doğruladıktan sonra en az şu alanları incele:

```text
prisma/schema.prisma
prisma/migrations/*

src/lib/services/order-cancellation.service.ts
src/lib/services/table-flow.service.ts
src/lib/validation.ts

src/app/api/waiter/orders/[id]/status/route.ts
src/app/api/admin/orders/[orderId]/cancel/route.ts
src/app/api/orders/[orderId]/route.ts
src/app/api/customer/orders/route.ts
src/app/api/menu/[businessId]/[tableNumber]/route.ts

src/app/waiter/page.tsx
src/app/admin/orders/page.tsx
admin ürün yönetimi ekranı
müşteri menü ekranı
```

Artık kullanılmayan paralel iptal mantığını endpointlerde bırakma.

---

# Teslim Raporu

```text
Kök neden:
Merkezileştirilen iptal endpointleri:
Yeni servis:
Prisma değişiklikleri:
Migration:
Masa durumu karar tablosu:
Tek sipariş iptal testi:
Başka SERVED sipariş testi:
Eski oturum izolasyon testi:
Tek ürün stok testi:
Çok ürün stok testi:
Müşteri menüsü sonucu:
Bill sonucu:
Regresyon sonucu:
Render deploy commit:
Değiştirilen dosyalar:
Başarısız kalan testler:
```

Canlı ortamda şu iki sonuç görülmeden “tamamlandı” deme:

1. Aktif masa oturumundaki tek sipariş iptal edilince masa `OCCUPIED` oluyor.
2. “Ürün stokta yok” seçilince seçilen ürün müşteri siparişine otomatik kapanıyor.
