# QR Menü Projesi - 1 Numaralı Kritik Problem: Masa / Oturum / Adisyon Akışının Düzeltilmesi

## Proje

GitHub Repo:

https://github.com/yattaraadamd-lang/QR_MENU_PRODUCT

Bu proje restoran ve kafelerde kullanılmak üzere geliştirilen bir QR Menü, sipariş, garson paneli ve masa yönetim sistemidir.

Müşteri QR kodu okutarak menüyü görür, sipariş verir, garson çağırır ve ödeme talebi gönderebilir. Garson ise kendi panelinden masa durumlarını, siparişleri, hizmet taleplerini ve ödeme taleplerini takip eder.

---

## Düzeltilmesi Gereken 1 Numaralı Kritik Problem

Projede en kritik sorunlardan biri **masa / oturum / adisyon akışının net ve tek merkezden yönetilmemesidir**.

Şu anda masa durumu, müşteri oturumu, sipariş, ödeme talebi, adisyon ve masa kapatma işlemleri birbirinden kopuk veya tutarsız çalışabiliyor.

Bu nedenle aşağıdaki problemler oluşabiliyor:

- Garson panelinden masa açıldığında müşteri tarafında masa hâlâ aktif değil görünebiliyor.
- Müşteri QR kodu okuttuğunda masa aktif değil uyarısı alabiliyor.
- Masa açık görünse bile sipariş verme kilidi kalkmayabiliyor.
- Masa kapatma işlemi tam çalışmayabiliyor.
- Ödeme talebi gönderildiğinde masa durumu, ödeme durumu ve talepler kısmı birbirine karışabiliyor.
- Bir masada yapılan işlem başka masaların arayüz durumunu etkileyebiliyor.
- Masa dolu, boş, ödeme bekliyor, servis edildi gibi durumlar her zaman doğru senkronize olmayabiliyor.
- Aktif `TableSession`, masa durumu ve adisyon bilgisi bazen birbirinden kopuk kalabiliyor.

Bu sorunlar restoran/kafe ortamında gerçek kullanım için kritiktir. Çünkü masa akışı hatalı olursa sistem güvenilir çalışmaz.

---

## Beklenen Hedef

Masa, oturum, sipariş, adisyon ve ödeme akışı net bir yaşam döngüsüne bağlanmalıdır.

Her masa için yalnızca bir aktif oturum olmalıdır.

Her aktif oturum bir adisyon/bill ile ilişkilendirilmelidir.

Siparişler doğrudan aktif masa oturumuna bağlanmalıdır.

Ödeme talebi, ödeme alındı işlemi ve masa kapatma işlemleri aynı akış üzerinden yönetilmelidir.

Masa kapatıldığında ilgili masaya ait tüm açık işlemler kontrollü şekilde kapatılmalıdır.

---

## İstenen Doğru Masa Yaşam Döngüsü

Aşağıdaki akış net şekilde uygulanmalıdır:

### 1. Masa Boş Durumda Başlar

Masa başlangıçta şu durumda olur:

```ts
Table.status = "EMPTY"
```

Bu durumda:

- Aktif `TableSession` olmamalıdır.
- Aktif adisyon/bill olmamalıdır.
- Müşteri QR okuttuğunda sistemin davranışı proje kararına göre net olmalıdır:
  - Ya müşteri sadece menüyü görür, sipariş veremez.
  - Ya da QR okutunca otomatik masa oturumu açılır.
- Bu karar kodda tutarlı şekilde uygulanmalıdır.

---

### 2. Masa Açılır

Masa iki yöntemden biriyle açılabilir:

1. Garson panelinden "Masayı Aç" butonuna basılır.
2. Eğer sistemde otomatik açılış isteniyorsa müşteri QR kodu okuttuğunda masa oturumu açılır.

Masa açılınca yapılması gerekenler:

```ts
Table.status = "OCCUPIED"
```

Yeni bir `TableSession` oluşturulmalıdır:

```ts
TableSession.status = "ACTIVE"
TableSession.tableId = ilgili masa
TableSession.businessId = ilgili işletme
```

Ayrıca bu oturuma bağlı bir adisyon/bill oluşturulmalıdır:

```ts
Bill.status = "OPEN"
Bill.tableSessionId = aktif oturum
Bill.businessId = ilgili işletme
```

Önemli:

- Aynı masa için aynı anda birden fazla aktif `TableSession` oluşturulmamalıdır.
- Masa zaten açıksa tekrar yeni session açılmamalıdır.
- Masa açma işlemi idempotent olmalıdır.
- Yani butona iki kez basılsa bile sistem bozulmamalıdır.

---

### 3. Müşteri Sipariş Verir

Müşteri sipariş verdiğinde sistem şu kontrolleri yapmalıdır:

- Masa var mı?
- İşletme var mı?
- QR token geçerli mi?
- Masa aktif mi?
- Aktif `TableSession` var mı?
- Açık `Bill` var mı?
- Ürünler gerçekten bu işletmeye mi ait?
- Ürün fiyatları client tarafından değil server tarafından mı hesaplanıyor?

Sipariş oluşturulurken sipariş mutlaka aktif oturuma bağlanmalıdır:

```ts
Order.tableSessionId = activeTableSession.id
Order.tableId = table.id
Order.businessId = business.id
```

Sipariş sonrası masa durumu güncellenmelidir:

```ts
Table.status = "HAS_ORDER"
```

veya proje akışına göre:

```ts
Table.status = "PREPARING"
```

---

### 4. Sipariş Hazırlanır ve Servis Edilir

Garson veya mutfak sipariş durumunu güncellediğinde masa durumu da buna göre değişmelidir.

Örnek:

```ts
Order.status = "PREPARING"
Table.status = "PREPARING"
```

Sipariş servis edildiğinde:

```ts
Order.status = "SERVED"
Table.status = "SERVED"
```

Ancak masada hâlâ açık adisyon olduğu için masa boş sayılmamalıdır.

---

### 5. Müşteri Ödeme Talebi Gönderir

Müşteri ödeme talebi gönderdiğinde sistem şu kontrolleri yapmalıdır:

- QR token geçerli mi?
- Masa aktif mi?
- Aktif `TableSession` var mı?
- Açık adisyon var mı?
- Bu masaya ait ödenmemiş sipariş var mı?

Ödeme talebi oluştuğunda:

```ts
Table.status = "PAYMENT_REQUESTED"
Bill.status = "PAYMENT_REQUESTED"
```

Ayrıca açık bir service request veya notification oluşturulabilir.

Ancak ödeme talebi sistemi dağınık olmamalıdır. Yani ödeme talebi hem `ServiceRequest`, hem `Payment`, hem `Notification`, hem `Table.status` içinde birbirinden kopuk ilerlememelidir.

Ödeme talebi için tek bir ana kaynak belirlenmelidir.

Öneri:

- Masa durumu için `Table.status`
- Adisyon durumu için `Bill.status`
- Garsona bildirim için `Notification`
- Müşteri talebi için gerekirse `ServiceRequest`

Bu kayıtlar transaction içinde birlikte oluşturulmalı veya güncellenmelidir.

---

### 6. Garson Ödemeyi Alır

Garson ödeme alındı dediğinde:

```ts
Payment.status = "COMPLETED"
Bill.status = "PAID"
```

Toplam tutar doğru hesaplanmalıdır:

- Sipariş kalemlerinden server tarafında hesaplanmalı.
- Client tarafından gelen toplam tutara güvenilmemelidir.

Ödeme alınınca masa hemen boşaltılmayabilir. Proje kararına göre iki seçenek vardır:

1. Ödeme alındıktan sonra masa otomatik kapanır.
2. Garson ayrıca "Masayı Kapat" butonuna basar.

Bu projede restoran kullanımına daha uygun olan yöntem:

- Ödeme alındıktan sonra adisyon kapansın.
- Masa durumu `CLEANING_NEEDED` veya `SERVED` olabilir.
- Garson "Masayı Kapat" dediğinde masa tamamen boşaltılsın.

---

### 7. Masa Kapatılır

Garson masayı kapattığında aşağıdaki işlemler tek transaction içinde yapılmalıdır:

```ts
Table.status = "EMPTY"
TableSession.status = "CLOSED"
Bill.status = "CLOSED" veya "PAID"
```

Ayrıca:

- Açık service request kayıtları kapatılmalıdır.
- Açık notification kayıtları çözüldü olarak işaretlenmelidir.
- Açık sipariş kalmamalıdır.
- QR token yenilenmeli veya eski token geçersiz hale getirilmelidir.
- Müşteri eski QR session ile tekrar sipariş verememelidir.
- Masa kapanınca müşteri tarafındaki aktif sipariş verme yetkisi kalkmalıdır.

Önemli:

Masa kapatma işlemi sistemdeki tüm ilişkili verileri tutarlı hale getirmelidir.

---

## Teknik Beklentiler

Aşağıdaki teknik düzenlemeleri yap:

### 1. Tek Merkezli Masa Akışı Servisi Oluştur

Masa durumlarını farklı API route’larında dağınık şekilde güncellemek yerine mümkünse merkezi bir servis oluştur:

Örnek dosya:

```txt
src/lib/services/table-flow.service.ts
```

Bu servis şu işlemleri içerebilir:

```ts
openTable()
createOrGetActiveSession()
createOrGetOpenBill()
addOrderToSession()
requestPayment()
markPaymentCompleted()
closeTable()
syncTableStatus()
```

Amaç, masa durumunun farklı yerlerde rastgele değiştirilmesini engellemektir.

---

### 2. Prisma Transaction Kullan

Masa açma, sipariş oluşturma, ödeme talebi, ödeme alma ve masa kapatma işlemlerinde Prisma transaction kullanılmalıdır.

Örnek:

```ts
await prisma.$transaction(async (tx) => {
  // table update
  // session create/update
  // bill create/update
  // notification create
})
```

Bu sayede işlem yarım kalmaz.

---

### 3. Aktif Session Kontrolü Standartlaştır

Her masa için aktif session bulma işlemi tek helper ile yapılmalıdır.

Örnek:

```ts
getActiveTableSession(tableId, businessId)
```

Kurallar:

- Bir masa için sadece bir aktif session olmalı.
- Aktif session yoksa bazı işlemler reddedilmeli.
- Masa açılırken aktif session yoksa oluşturulmalı.
- Aktif session varsa tekrar oluşturulmamalı.

---

### 4. Açık Bill / Adisyon Kontrolü Standartlaştır

Her aktif masa oturumu için açık adisyon kontrolü yapılmalıdır.

Örnek:

```ts
getOpenBillBySession(tableSessionId)
```

Kurallar:

- Aktif session varsa bir açık bill olmalı.
- Bill yoksa masa açılışında oluşturulmalı.
- Siparişler bu bill veya session ile ilişkilendirilmeli.
- Ödeme talebi ve ödeme alma bill üzerinden yürümeli.

---

### 5. QR Token ve Session Kontrolü Güçlendir

Müşteri tarafındaki işlemlerde şu kontroller zorunlu olmalıdır:

- QR token geçerli mi?
- QR token süresi dolmuş mu?
- Masa bu QR token’a mı ait?
- Masa aktif mi?
- Aktif session var mı?
- Masa kapalıysa sipariş veya ödeme talebi oluşturulmasın.

Bu kontroller özellikle şu endpointlerde olmalıdır:

- Sipariş oluşturma endpoint’i
- Garson çağırma endpoint’i
- Ödeme talebi endpoint’i
- Service request endpoint’i

---

### 6. Masa Durumu Güncellemesini Tutarlı Yap

Masa durumları aşağıdaki mantıkla ilerlemelidir:

```txt
EMPTY
  ↓
OCCUPIED
  ↓
HAS_ORDER
  ↓
PREPARING
  ↓
SERVED
  ↓
PAYMENT_REQUESTED
  ↓
CLEANING_NEEDED veya EMPTY
```

Sistem bu durumlar arasında mantıksız geçişlere izin vermemelidir.

Örnek:

- `EMPTY` masadan direkt `PAYMENT_REQUESTED` durumuna geçilmemeli.
- Aktif session olmayan masa `HAS_ORDER` olmamalı.
- Açık bill olmayan masa ödeme bekliyor olmamalı.
- Kapanmış masaya sipariş eklenmemeli.

---

### 7. Frontend State Hatalarını Düzelt

Garson panelinde bir masada işlem yapılınca diğer masaların arayüzü etkilenmemelidir.

Özellikle şu hata düzeltilmelidir:

> Garson panelinde bir masanın "Masayı Aç" butonuna basınca diğer masalardaki butonlar da "Masa açılıyor" gibi görünmemelidir.

Çözüm:

Global loading state yerine masa bazlı loading kullanılmalıdır.

Örnek:

```ts
const [loadingTableId, setLoadingTableId] = useState<string | null>(null)
```

veya:

```ts
const [tableLoadingMap, setTableLoadingMap] = useState<Record<string, boolean>>({})
```

Buton render ederken sadece ilgili masa loading görünmelidir:

```ts
const isThisTableLoading = loadingTableId === table.id
```

---

### 8. API Response Sonrası UI Yeniden Senkronize Olsun

Masa açma, kapatma, ödeme talebi, ödeme alma, sipariş oluşturma gibi işlemlerden sonra frontend sadece local state tahmini yapmamalı.

Öneri:

- API işlemi başarılı olunca ilgili masa/sipariş/bill tekrar fetch edilsin.
- Ya da API güncel masa/session/bill bilgisini response olarak dönsün.
- Frontend bu response ile state’i güncellesin.

---

## Kontrol Edilecek Dosyalar

Lütfen özellikle şu dosyaları ve alanları kontrol et:

```txt
prisma/schema.prisma
src/app/api/table-sessions
src/app/api/tables
src/app/api/orders
src/app/api/service-requests
src/app/api/payments
src/app/api/bills
src/app/waiter
src/components
src/hooks
src/lib
```

Dosya isimleri projede farklıysa aynı işlevi yapan dosyaları bul ve düzelt.

---

## Kabul Kriterleri

Bu problem çözülmüş sayılması için aşağıdaki testlerin geçmesi gerekir:

### Test 1 - Masa Açma

- Garson panelinde boş bir masaya "Masayı Aç" denir.
- Sadece ilgili masa loading durumuna geçer.
- Diğer masaların butonları etkilenmez.
- İşlem bitince sadece ilgili masa `OCCUPIED` olur.
- Aktif `TableSession` oluşur.
- Açık `Bill` oluşur.

### Test 2 - Müşteri QR ile Sipariş Verir

- Müşteri ilgili masanın QR linkinden girer.
- Masa aktifse sipariş verebilir.
- Sipariş aktif `TableSession` ile ilişkilendirilir.
- Masa durumu `HAS_ORDER` veya proje akışına göre doğru statüye geçer.
- Garson panelinde sadece ilgili masa güncellenir.

### Test 3 - Aktif Olmayan Masadan Sipariş Engellenir

- Masa `EMPTY` ise ve sistemde otomatik session açma kararı yoksa müşteri sipariş verememelidir.
- API güvenli şekilde hata dönmelidir.
- Client tarafında da doğru uyarı gösterilmelidir.

### Test 4 - Ödeme Talebi

- Müşteri ödeme talebi gönderir.
- Sadece ilgili masanın durumu `PAYMENT_REQUESTED` olur.
- Açık bill ödeme talebi bekliyor durumuna geçer.
- Garson panelinde sadece ilgili masa ödeme bekliyor görünür.
- Başka masaların ödeme alanı etkilenmez.

### Test 5 - Ödeme Alındı

- Garson ödeme alındı der.
- Payment kaydı `COMPLETED` olur.
- Bill `PAID` olur.
- Masa proje kararına göre `CLEANING_NEEDED`, `SERVED` veya kapanışa hazır duruma geçer.
- Toplam tutar server tarafında doğrulanır.

### Test 6 - Masa Kapatma

- Garson masayı kapatır.
- Aktif session kapanır.
- Açık bill kapanır veya paid olarak kalır.
- Açık service request ve notification kayıtları kapatılır.
- Masa `EMPTY` olur.
- Eski QR token/session ile yeni sipariş verilemez.
- Müşteri tarafı masanın artık aktif olmadığını görür.

### Test 7 - Tekrar Açma

- Aynı masa tekrar açıldığında yeni bir `TableSession` oluşur.
- Eski session tekrar kullanılmaz.
- Eski adisyon yeni siparişlerle karışmaz.
- Yeni adisyon temiz başlar.

---

## Önemli Kurallar

- Projeyi baştan yazma.
- Mevcut çalışan özellikleri bozma.
- Prisma şemasını gereksiz yere değiştirme.
- Değişiklikleri küçük, kontrollü ve anlaşılır yap.
- Tüm kritik veritabanı işlemlerinde transaction kullan.
- API tarafında businessId ve yetki kontrolü yap.
- Client’tan gelen toplam tutara güvenme.
- Masa, session, bill ve payment kayıtlarını tutarlı hale getir.
- Kod TypeScript hatası vermemeli.
- Build başarılı olmalı.

---

## Antigravity’den Beklenen Çıktı

Lütfen düzenleme sonunda bana şunları raporla:

1. Hangi dosyalar değiştirildi?
2. Masa yaşam döngüsü nasıl çalışıyor?
3. Aktif `TableSession` nasıl yönetiliyor?
4. Açık `Bill` nasıl yönetiliyor?
5. Masa açma/kapatma işlemleri hangi transaction ile yapılıyor?
6. Ödeme talebi ve ödeme alma işlemleri nasıl bağlandı?
7. QR token kontrolü hangi endpointlerde güçlendirildi?
8. Garson panelindeki masa bazlı loading state nasıl düzeltildi?
9. Localde nasıl test edeceğim?
10. Production’da dikkat etmem gereken environment variable veya deploy ayarı var mı?
11. Yukarıdaki kabul testlerinin hangileri geçti?

---

## Kısa Özet

Bu görevde amaç, projenin en kritik problemi olan **masa / oturum / adisyon akışını güvenilir hale getirmektir**.

Restoran ortamında sistemin güvenilir olması için her masanın yaşam döngüsü net olmalıdır:

```txt
Masa açılır
→ Aktif session oluşur
→ Açık adisyon oluşur
→ Siparişler bu session’a bağlanır
→ Ödeme talebi bu adisyona bağlanır
→ Ödeme alınır
→ Adisyon kapanır
→ Masa kapanır
→ Eski müşteri oturumu geçersiz olur
```

Bu akış düzgün çalışmadan proje gerçek restoran/kafe kullanımına hazır sayılmaz.
