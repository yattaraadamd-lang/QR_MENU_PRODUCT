# QR Menü — Sipariş Talebi Doğrulama ve Reddetme Akışı

## Görev
Mevcut sistemi bozmadan `ORDER_REQUEST` akışını aşağıdaki kurallara göre düzelt. Gereksiz refactor yapma. Ödeme, normal sipariş, admin ve diğer hizmet talebi akışlarını değiştirme.

## Hedef Akış
1. Müşteri masa QR kodunu okutur ve menüyü açar.
2. Ürünleri sepete ekleyip **Sipariş Talebi Oluştur** butonuna basar.
3. Garsonun **Talepler** ekranına masa, ürün özeti, toplam tutar ve talep zamanı düşer.
4. Müşteri ekranında 6 haneli doğrulama kodu gösterilir.
5. Garson masadaki müşteriden kodu ister, paneldeki alana girer ve **Masayı Aç** butonuna basar.
6. Kod doğruysa tek transaction içinde masa açılır, adisyon oluşturulur, yalnız bu müşteri oturumu yetkilendirilir ve talep tamamlanır.
7. Masada müşteri yoksa garson **Reddet** butonuna basar. Talep iptal edilir ve ilgili cihaz bu işletmede admin engeli kaldırana kadar yeni müşteri işlemi oluşturamaz. Menü yalnız görüntülenebilir.

---

## Mevcut Kritik Hatalar

- `src/app/waiter/requests/page.tsx` içindeki **Masayı Aç** işlemi yanlışlıkla `/api/table-sessions` endpointini çağırıyor. Bunun yerine yalnızca `/api/waiter/service-requests/{id}/open-table` kullanılmalı.
- `ORDER_REQUEST` kartında **İşleme Al** ve **Tamamla** butonları gösteriliyor.
- Genel status endpointi `ORDER_REQUEST` için `IN_PROGRESS` ve `COMPLETED` geçişlerine izin veriyor.
- Müşteri hizmet talebi oluşturulurken `customerSessionId` ve doğrulama kodu kayda bağlanmıyor.
- `open-table` endpointi doğrulama kodu almıyor/kontrol etmiyor.
- Garson talepleri API’si doğrulama kodunu gizlemeli; kod garsonun API cevabından okunamamalı.

---

## 1. Müşteri Sipariş Talebi

### Frontend
Dosya:
`src/app/menu/[businessId]/[tableNumber]/page.tsx`

Aktif masa oturumu yokken genel `sendRequest("ORDER_REQUEST", ...)` kullanma. Sepet içeriğini taşıyan özel bir `createOrderRequest()` fonksiyonu oluştur.

Gönderilecek veri:

```ts
{
  businessId,
  tableId,
  requestType: "ORDER_REQUEST",
  items: cart.map(item => ({
    productId: item.product.id,
    quantity: item.quantity,
    customerNote: item.customerNote ?? null
  })),
  orderNote: orderNote || null
}
```

Başarılı yanıtta gelen `verificationCode` değerini müşteriye belirgin şekilde göster:

- Başlık: `Masa Doğrulama Kodunuz`
- Kod örneği: `482913`
- Açıklama: `Garson masanıza geldiğinde bu kodu söyleyin.`
- Sayfa yenilendiğinde aynı aktif talebin kodu, yalnız talebi oluşturan müşteri oturumuna tekrar gösterilebilmeli.
- Sepeti masa açılana kadar silme.

Buton metni aktif masa yokken tam olarak:

`Sipariş Talebi Oluştur`

### Backend
Dosya:
`src/app/api/customer/service-requests/route.ts`

`ORDER_REQUEST` için:

1. Doğrulanmış `customerSession.id` değerini `customerSessionId` alanına kaydet.
2. Node `crypto.randomInt(100000, 1000000)` ile 6 haneli kod üret.
3. `verificationCode` alanına kaydet.
4. `expiresAt` değerini 5 dakika sonrası yap.
5. Ürünleri frontend fiyatına güvenmeden veritabanından doğrula.
6. Garson kartında gösterilecek ürün özetini oluştur.

Prisma modeline şu alanı ekle:

```prisma
orderPreview Json?
```

`orderPreview` örneği:

```json
{
  "items": [
    { "productId": "...", "name": "Burger", "quantity": 2, "unitPrice": 180, "note": null }
  ],
  "total": 360,
  "orderNote": null
}
```

`ORDER_REQUEST` cevabında kodu yalnız talebi oluşturan müşteri isteğine döndür. Garson listeleme API’sinde kodu döndürme.

Aynı müşteri oturumu için aktif `ORDER_REQUEST` varsa yeni kayıt oluşturma; mevcut talebi ve mevcut kodu döndür.

---

## 2. Garson Talepler Ekranı

Dosya:
`src/app/waiter/requests/page.tsx`

### ORDER_REQUEST kartında göster

- Masa adı/numarası
- Ürün adı, adet ve not özeti
- Toplam tahmini tutar
- Talep zamanı
- 6 haneli kod giriş alanı
- **Masayı Aç** butonu
- **Reddet** butonu

### ORDER_REQUEST kartından kaldır

- `İşleme Al`
- `Tamamla`
- Sadece `✕` simgesi olan belirsiz iptal butonu

Bu kaldırma yalnız `ORDER_REQUEST` için geçerli olsun. Diğer hizmet taleplerinin mevcut butonlarını bozma.

### Masayı Aç

Aşağıdaki endpointi çağır:

```ts
POST /api/waiter/service-requests/${requestId}/open-table
body: { verificationCode }
```

Kesinlikle `/api/table-sessions` çağırma ve ardından ayrı `COMPLETED` isteği gönderme.

Kod boşsa frontend isteği gönderme. Yanlış kodda kart açık kalsın ve `Doğrulama kodu yanlış` mesajı gösterilsin.

### Reddet

Butona basıldığında onay penceresi göster:

`Masada müşteri bulunmadığını ve bu cihazın işletmede engelleneceğini onaylıyor musunuz?`

Onaylanırsa:

```ts
POST /api/waiter/service-requests/${requestId}/reject-order-request
body: { reason: "EMPTY_TABLE_ABUSE" }
```

---

## 3. Güvenli Masa Açma Endpointi

Dosya:
`src/app/api/waiter/service-requests/[id]/open-table/route.ts`

Mevcut atomik masa açma yapısını koru ve şunları ekle:

1. JSON body içinden `verificationCode` al.
2. Yalnız `ORDER_REQUEST` ve `PENDING`/`SEEN` talebini kabul et.
3. Talep süresi dolmuşsa `410 OPEN_REQUEST_EXPIRED` döndür.
4. Girilen kod ile kayıttaki kodu backend’de karşılaştır.
5. Yanlış kodda `400 INVALID_VERIFICATION_CODE` döndür; masa veya oturum oluşturma.
6. Doğru kodda mevcut transaction içinde:
   - aktif masa oturumu yokluğunu doğrula,
   - `TableSession` oluştur,
   - `Bill` oluştur,
   - masayı `OCCUPIED` yap,
   - yalnız talebi oluşturan `CustomerSession` kaydını `AUTHORIZED` yap,
   - aynı masadaki diğer bekleyen oturumları `REVOKED` yap,
   - diğer bekleyen sipariş taleplerini iptal et,
   - bu talebi `COMPLETED` yap.
7. Aynı talebe çift tıklama/eşzamanlı istek durumunda idempotent veya `409 OPEN_REQUEST_ALREADY_HANDLED` yanıtı ver.
8. Başarılı işlemden sonra mevcut socket olaylarını yayınla.

Doğrulama kodunu loglama.

---

## 4. ORDER_REQUEST İçin Genel Status Endpointini Kapat

Dosya:
`src/app/api/waiter/service-requests/[id]/status/route.ts`

Talep türü `ORDER_REQUEST` ise:

- `IN_PROGRESS` isteğini reddet.
- `COMPLETED` isteğini reddet.
- Masa açma için `409 USE_OPEN_TABLE_ENDPOINT` döndür.
- Sabotaj reddi için `409 USE_REJECT_ORDER_REQUEST_ENDPOINT` döndür.

`ORDER_REQUEST` yalnız özel `open-table` veya `reject-order-request` endpointlerinden terminal duruma geçsin.

Diğer talep türlerinin mevcut status akışını değiştirme.

---

## 5. İşletme Düzeyinde Cihaz Engeli

IP adresini tek başına engelleme; ortak Wi-Fi/NAT nedeniyle masum müşteriler etkilenebilir.

### Kalıcı cihaz anahtarı

- Müşteri oturumu oluşturulurken sunucu tarafından rastgele bir `customer_device_id` üret.
- `HttpOnly`, `Secure`, `SameSite=Lax` cookie olarak sakla.
- Veritabanında ham değeri değil `HMAC-SHA256` özetini `deviceKeyHash` olarak sakla.
- Gerekli env: `CUSTOMER_DEVICE_HMAC_SECRET`.

`CustomerSession` modeline ekle:

```prisma
deviceKeyHash String?
```

Yeni model:

```prisma
model CustomerAccessBlock {
  id              String   @id @default(cuid())
  businessId      String
  deviceKeyHash   String
  reason          String
  sourceRequestId String?
  createdById     String?
  createdAt       DateTime @default(now())
  revokedAt       DateTime?

  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)

  @@index([businessId, deviceKeyHash, revokedAt])
  @@map("customer_access_blocks")
}
```

Business ilişkisini Prisma şemasına ekle.

### Reject endpoint

Yeni dosya:
`src/app/api/waiter/service-requests/[id]/reject-order-request/route.ts`

Garson/admin kimliğini ve işletme sahipliğini doğrula. Tek transaction içinde:

1. Talebin `ORDER_REQUEST` ve `PENDING`/`SEEN` olduğunu doğrula.
2. Talebi `CANCELLED` yap; `reason = "EMPTY_TABLE_ABUSE"`, `resolvedAt = now()`.
3. Bağlı `CustomerSession` kaydını `REVOKED` yap ve `closedAt` doldur.
4. Session üzerindeki `deviceKeyHash` ile işletme düzeyinde aktif `CustomerAccessBlock` oluştur; mevcut aktif blok varsa çoğaltma.
5. Masa için gerçekte aktif oturum/adisyon yoksa masa durumunu `EMPTY` olarak yeniden hesapla.
6. Socket ile talep ve masa durumu güncellemesini yayınla.

Başarılı cevap:

```json
{
  "message": "Sipariş talebi reddedildi ve cihaz bu işletmede engellendi.",
  "code": "ORDER_REQUEST_REJECTED_AND_BLOCKED"
}
```

### Blok kontrolü

Aşağıdaki müşteri aksiyonlarından önce aktif işletme/cihaz engelini kontrol et:

- müşteri oturumu oluşturma veya yenileme,
- `ORDER_REQUEST`,
- gerçek sipariş oluşturma,
- garson/hizmet çağrısı,
- ödeme talebi.

Engel varsa menü görüntülenebilsin fakat işlem endpointleri şu yanıtı versin:

```json
{
  "error": "Bu cihazın bu işletmede işlem yapması engellendi.",
  "code": "CUSTOMER_DEVICE_BLOCKED"
}
```

HTTP durum kodu: `403`.

Adminin yanlış engeli kaldırabilmesi için minimum bir admin API’si ekle:

- `GET /api/admin/customer-access-blocks`
- `DELETE /api/admin/customer-access-blocks/{id}`

Garson engeli kaldıramasın.

> Tarayıcı verisi silinirse veya başka cihaz kullanılırsa web tabanlı cihaz engeli mutlak değildir. IP yalnız ek rate-limit sinyali olarak kullanılabilir; ana engel ölçütü yapılmamalıdır.

---

## 6. Garson Listeleme API’si

Dosya:
`src/app/api/waiter/service-requests/route.ts`

`findMany` sonucunu açık `select` ile döndür. `verificationCode` alanını kesinlikle response içine koyma.

`orderPreview` alanını döndür; frontend ürünleri buradan göstersin.

---

## 7. Güvenlik ve Davranış Kuralları

- `businessId`, `tableId`, fiyat ve ürün adlarına frontend üzerinden güvenme.
- Her garson/admin endpointinde işletme sahipliğini doğrula.
- Doğrulama kodu 6 rakam ve 5 dakika geçerli olsun.
- Yanlış kod denemelerine request + user bazlı rate-limit uygula.
- Reject ve open-table işlemleri transaction içinde olsun.
- Kod doğru olmadan masa, adisyon veya müşteri yetkisi oluşturma.
- Reddedilen talep masayı `OCCUPIED` durumunda bırakmasın.
- Mevcut ödeme ve sipariş teslim akışlarını değiştirme.
- Eski `/api/table-sessions` endpointini müşteri veya garson taleplerinden masa açmak için kullanma.
- TypeScript hatası, Prisma relation hatası veya production build hatası bırakma.

---

## 8. Kabul Testleri

1. QR okutan müşteri ürün seçip sipariş talebi oluşturur; garson kartında ürün özeti görünür.
2. Müşteri ekranında 6 haneli kod görünür; garson API cevabında görünmez.
3. `ORDER_REQUEST` kartında yalnız **Masayı Aç** ve **Reddet** bulunur.
4. Yanlış kodla masa açılmaz, adisyon oluşmaz, müşteri yetkilendirilmez.
5. Doğru kodla masa/adisyon tek kez açılır ve yalnız ilgili müşteri yetkilendirilir.
6. Genel status endpointiyle `ORDER_REQUEST -> IN_PROGRESS/COMPLETED` yapılamaz.
7. Reddet işleminden sonra talep iptal edilir ve masa boş kalır.
8. Reddedilen cihaz aynı işletmenin başka masa QR kodunu okutsa bile yeni talep/sipariş oluşturamaz.
9. Reddedilen cihaz menüyü görüntüleyebilir.
10. Admin engeli kaldırınca cihaz yeniden işlem oluşturabilir.
11. Diğer hizmet talebi türlerinin mevcut butonları ve işleyişi bozulmaz.
12. `npm run build` başarılı olur.

---

## 9. Uygulama Sonu

Gerekli Prisma migration oluştur ve çalıştır:

```bash
npx prisma migrate dev --name order_request_verification_device_block
npx prisma generate
npm run build
```

İş bitince yalnız şu özeti ver:

1. Değiştirilen dosyalar
2. Oluşturulan migration
3. Uygulanan güvenlik kontrolleri
4. Çalıştırılan test/build sonucu
5. Manuel test adımları

Yeni özellik ekleme, tasarımı baştan yazma veya görev dışı dosyalarda refactor yapma.
