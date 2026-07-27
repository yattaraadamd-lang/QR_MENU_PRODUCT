# QR Menü — İptal Edilen Sipariş Talebinde Masanın Dolu Kalması

## Amaç
Garson, henüz onaylanmamış bir `ORDER_REQUEST` talebini iptal ettiğinde masa hiç açılmamışsa admin ve garson panellerinde masa `EMPTY` görünmelidir.

Mevcut müşteri yetkilendirme/güvenlik davranışını değiştirme. Yalnızca masa yaşam döngüsü ve ekran senkronizasyonu hatasını düzelt.

## Hatanın Kaynağı
Dosya:

`src/app/api/waiter/service-requests/[id]/status/route.ts`

Mevcut kodda `COMPLETED` veya `CANCELLED` sonrasında başlangıç değeri şu şekilde seçiliyor:

```ts
let newStatus: TableStatus = TableStatus.OCCUPIED;
```

Bu nedenle masa hiç açılmamış ve aktif sipariş bulunmasa bile iptal sonrasında `OCCUPIED` kalıyor.

## Beklenen Akış

1. Müşteri `ORDER_REQUEST` oluşturur.
2. Bu aşamada masa henüz açılmış sayılmaz.
3. Garson `İptal` butonuna basar.
4. Talep `CANCELLED` yapılır.
5. Masa için aktif `TableSession`, açık adisyon veya gerçek sipariş yoksa masa `EMPTY` yapılır.
6. Admin ve garson panelleri değişikliği anında göstermelidir.

## Uygulama

### 1. İşlemi transaction içine al
Talep güncellemesi ve masa durumunun yeniden hesaplanması aynı `prisma.$transaction` içinde yapılmalı.

### 2. Masa durumunu gerçek kayıtlardan hesapla
`CANCELLED` ve `COMPLETED` işlemlerinde varsayılan olarak `OCCUPIED` atama.

Transaction içinde ilgili masa için şunları kontrol et:

- `TableSession.status === "ACTIVE"`
- `Bill.status === "OPEN"`
- Sipariş durumları
- Aktif hizmet/ödeme talepleri

Temel karar kuralı:

```text
Aktif TableSession yok
+ açık Bill yok
+ gerçek aktif/ödenmemiş sipariş yok
= EMPTY
```

Aktif `TableSession` varsa masa boşaltılmamalı. Durum mevcut verilere göre korunmalı/hesaplanmalı:

```text
PREPARING sipariş varsa       -> PREPARING
PENDING veya ACCEPTED varsa   -> HAS_ORDER
PAYMENT_REQUEST aktifse       -> PAYMENT_REQUESTED
Servis edilmiş açık hesap varsa -> SERVED
Bunların hiçbiri yoksa        -> OCCUPIED
```

### 3. ORDER_REQUEST için özel kural
İptal edilen talep `ORDER_REQUEST` ise ve bu talep için masa daha önce açılmamışsa:

- Yeni `TableSession` oluşturma.
- Yeni `Bill` oluşturma.
- Masayı `OCCUPIED` yapma.
- Başka gerçek aktif oturum yoksa masayı `EMPTY` yap.
- Mevcut müşteri oturumu iptal/revoke güvenlik davranışını kaldırma veya gevşetme.

### 4. Başka müşterinin açık masasını yanlışlıkla boşaltma
Aynı masada gerçek bir aktif `TableSession` varsa, sonradan oluşmuş başka bir `ORDER_REQUEST` iptal edildiğinde masa `EMPTY` yapılmamalı.

Masa durumunu yalnız talebin türüne göre değil, veritabanındaki aktif oturum/adisyon/siparişlere göre belirle.

### 5. Socket güncellemesi
İşlem başarıyla tamamlandıktan sonra mevcut `request_status_update` olayına ek olarak masa ekranlarının dinlediği mevcut olayı kullanarak masa durumunu yayınla. Mevcut ortak event varsa onu kullan; yeni ve yinelenen event sistemi kurma.

Örnek payload:

```ts
{
  tableId,
  status: calculatedTableStatus,
  requestId,
  requestType: "ORDER_REQUEST"
}
```

Admin ve garson masa listeleri socket olayı geldiğinde ilgili listeyi yeniden çekmeli veya yerel durumu güncellemelidir. Mevcut polling sistemi yedek olarak korunmalı.

### 6. İdempotency
Aynı iptal isteği iki kez gönderilirse:

- İkinci çağrı hata veya yanlış masa durumu üretmemeli.
- Masa tekrar `OCCUPIED` yapılmamalı.
- Talep `CANCELLED` olarak kalmalı.

## Önerilen Kod Organizasyonu
Masa durumunu farklı endpointlerde tekrar tekrar hesaplama.

Projede mevcut bir masa akış servisi varsa onu genişlet. Yoksa aşağıdaki gibi tek bir yardımcı fonksiyon oluştur:

```ts
recalculateTableStatus(tx, {
  businessId,
  tableId,
}): Promise<TableStatus>
```

Fonksiyon:

1. Yetkili kayıtları sorgular.
2. Doğru `TableStatus` değerini belirler.
3. Masayı transaction içinde günceller.
4. Hesaplanan durumu döndürür.

Bu yardımcıyı en azından talep iptali endpointinde kullan. Sistemin çalışan diğer akışlarını gereksiz yere yeniden yazma.

## Dokunulacak Ana Dosya

- `src/app/api/waiter/service-requests/[id]/status/route.ts`

Gerekirse:

- mevcut masa durum servis dosyası
- admin/garson masa listelerinin socket listener dosyaları
- ilgili test dosyaları

## Değiştirilmemesi Gerekenler

- QR oluşturma ve okuma sistemi
- `open-table` onay akışı
- müşteri doğrulama kodu
- ürün/sepet sistemi
- müşteri oturumunun iptal sonrası mevcut güvenlik kısıtlaması
- ödeme sistemi
- Prisma şeması; bu düzeltme için migration gerekmemeli

## Kabul Testleri

1. **Boş masa + bekleyen ORDER_REQUEST + iptal**
   - Talep: `CANCELLED`
   - Aktif TableSession: yok
   - Açık Bill: yok
   - Masa: `EMPTY`
   - Admin ve garson ekranı: boş

2. **İptal edilmiş müşteri tekrar aynı QR'ı açar**
   - Mevcut güvenlik kısıtlaması korunur.
   - Masa yanlışlıkla `OCCUPIED` olmaz.

3. **Gerçekten açık masa + başka ORDER_REQUEST iptali**
   - Aktif TableSession korunur.
   - Masa `EMPTY` yapılmaz.

4. **Aktif sipariş bulunan açık masa**
   - `PENDING/ACCEPTED` -> `HAS_ORDER`
   - `PREPARING` -> `PREPARING`

5. **Servis edilmiş ve hesabı açık masa**
   - Masa `SERVED` kalır.

6. **Aynı talebi iki kez iptal etme**
   - İşlem idempotent olur.
   - Masa durumu bozulmaz.

7. **İki garsonun eşzamanlı işlem yapması**
   - Transaction nedeniyle hayalet `OCCUPIED` durumu oluşmaz.

8. `npm run build`, TypeScript kontrolü ve mevcut testler başarılı olmalı.

## Tamamlama Raporu
İşlem sonunda yalnızca şunları raporla:

- Değiştirilen dosyalar
- Hatanın kesin nedeni
- Uygulanan masa durumu karar kuralı
- Çalıştırılan testler ve sonuçları
- Migration gerekip gerekmediği

Uzun açıklama, alternatif mimari veya konu dışı refactor üretme.
