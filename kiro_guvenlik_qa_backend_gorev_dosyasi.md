# QR Menü Projesi — Güvenlik, Backend/Supabase, QA ve Eksik Özellikler Kiro Görev Dosyası

> **Hedef:** Bu dosya Kiro'ya verilecek geliştirme talimatıdır. Amaç; QR Menü projesindeki güvenlik açıklarını kapatmak, iş mantığı hatalarını düzeltmek, Supabase/PostgreSQL tarafını sağlamlaştırmak, QA testlerini tamamlamak ve restoran/cafe ortamında kullanılabilir MVP seviyesine getirmektir.

---

## 0. Proje Bağlamı

Repository:

```txt
https://github.com/yattaraadamd-lang/QR_MENU_PRODUCT
```

Proje tipi:

```txt
QR Menü / restoran-cafe sipariş ve masa yönetim sistemi
```

Teknoloji yapısı:

```txt
Next.js 14
TypeScript
Prisma ORM
PostgreSQL / Supabase
NextAuth
Socket.IO
Tailwind CSS
```

Projede bulunan ana roller:

```txt
SUPER_ADMIN
ADMIN
WAITER
CUSTOMER / QR müşterisi
```

Temel iş akışı:

```txt
Müşteri QR okutur → Menü görür → Sepete ürün ekler → Sipariş gönderir
Garson siparişi görür → Onaylar/hazırlar/servis eder
Müşteri ödeme ister → Garson/Admin ödeme alır
Masa/adisyon kapanır → Eski QR/session ile tekrar işlem yapılamaz
```

---

## 1. Kiro İçin Genel Talimat

Kiro, bu projede sadece yüzeysel frontend düzenlemesi yapmasın. Aşağıdaki alanları birlikte ele al:

1. **Backend güvenliği**
2. **Supabase/PostgreSQL veri bütünlüğü**
3. **Yetkilendirme ve rol kontrolü**
4. **QR/session güvenliği**
5. **Masa, sipariş, ödeme ve adisyon iş mantığı**
6. **Spam/rate limit koruması**
7. **Gerçek restoran kullanımı için QA testleri**
8. **Mobil kullanıcı deneyimi**
9. **Garson/Admin panel bildirim sistemi**
10. **Deployment öncesi güvenlik checklist’i**

Kod değiştirirken mevcut çalışan akışı bozma. Özellikle şu dosyaları dikkatli incele:

```txt
src/app/api/customer/session/route.ts
src/app/api/customer/orders/route.ts
src/app/api/customer/service-requests/route.ts
src/app/api/customer/payment-requests/route.ts
src/lib/services/table-flow.service.ts
src/lib/auth.ts
src/lib/rate-limit.ts
src/middleware.ts
src/app/api/admin/**
src/app/api/waiter/**
prisma/schema.prisma
TEST_CHECKLIST.md
```

---

## 2. Kritik Güvenlik Açıkları ve Düzeltilecek Noktalar

### 2.1. QR / CustomerSession Güvenliği

#### Problem

Müşteri QR kodu okuttuktan sonra oluşan oturum token'ı kötüye kullanılabilir. Müşteri restorandan ayrıldıktan sonra eski QR/session ile tekrar sipariş, garson çağırma veya ödeme talebi göndermemelidir.

#### Mevcut Durum

Projede `CustomerSession`, `TableSession`, `Bill`, `Payment` modelleri var. `CustomerSession` içinde şu alanlar mevcut:

```txt
sessionToken
status: ACTIVE / EXPIRED / CLOSED
expiresAt
businessId
tableId
```

Bu iyi bir temel fakat tüm müşteri API endpointlerinde aynı güvenlik standardı uygulanmalı.

#### Yapılacaklar

- Tüm müşteri endpointlerinde `x-session-token` zorunlu olsun.
- Token sadece `sessionStorage` içinde tutulmalı, `localStorage` kullanılmamalı.
- Token doğrulaması şu şartların tamamını kontrol etmeli:
  - `sessionToken` var mı?
  - `businessId` eşleşiyor mu?
  - `tableId` eşleşiyor mu?
  - `CustomerSession.status === ACTIVE` mi?
  - `expiresAt > now` mı?
  - Masa aktif mi?
  - Masa silinmemiş mi?
  - İşletme aktif mi?
- Masa kapatılınca ilgili tüm aktif `CustomerSession` kayıtları `CLOSED` yapılmalı.
- Ödeme tamamlanınca ilgili tüm aktif `CustomerSession` kayıtları `CLOSED` yapılmalı.
- Süresi dolan session `EXPIRED` yapılmalı.
- Eski token ile sipariş, ödeme isteği, garson çağırma kesinlikle başarısız olmalı.

#### Kabul Kriterleri

- Eski token ile `/api/customer/orders` isteği `401` veya `403` döndürür.
- Eski token ile `/api/customer/service-requests` isteği başarısız olur.
- Eski token ile `/api/customer/payment-requests` isteği başarısız olur.
- Masa kapandıktan sonra yeni sipariş oluşmaz.
- Garson/Admin paneline sahte bildirim düşmez.
- Veritabanında yanlışlıkla yeni `Order`, `Payment`, `ServiceRequest`, `Notification` oluşmaz.

---

### 2.2. QR Token Tahmin Edilebilirliği ve Yenileme

#### Problem

Masa QR linkleri sabit kalırsa fotoğrafı çekilen veya paylaşılan QR kötüye kullanılabilir.

#### Yapılacaklar

- Her masanın `qrToken` değeri uzun, rastgele ve tahmin edilemez olmalı.
- `qrToken` kısa ID veya masa numarasından türetilmemeli.
- Masa kapandığında opsiyonel olarak yeni `qrToken` üretilebilmeli.
- Admin panelinde "QR Kodunu Yenile" butonu olmalı.
- Eski QR token ile açılan link view-only moda düşmeli veya geçersiz olmalı.
- `qrTokenExpiresAt` alanı gerçekten kullanılmalı veya kullanılmayacaksa kaldırılmamalı; mantığı tamamlanmalı.

#### Kabul Kriterleri

- Eski QR linkiyle yeni müşteri session açılamaz.
- Admin isterse masa QR kodunu yenileyebilir.
- QR token collision ihtimali pratikte yoktur.
- QR token asla frontend içinde kolay tahmin edilebilir biçimde oluşturulmaz.

---

### 2.3. Sipariş Oluşturma Güvenliği

#### Problem

Müşteri request body üzerinden `businessId`, `tableId`, `items`, `quantity`, `note` gönderiyor. Bu alanlar manipüle edilebilir.

#### Yapılacaklar

- `businessId` ve `tableId`, session token ile çapraz kontrol edilmeli.
- Sipariş toplam tutarı sadece server-side hesaplanmalı.
- Frontend’den gelen fiyat bilgisine asla güvenilmemeli.
- `quantity` için minimum ve maksimum limit olmalı.
  - Minimum: 1
  - Maksimum: örneğin 20 veya işletme ayarı
- Negatif, sıfır, ondalıklı veya çok büyük quantity reddedilmeli.
- `note` ve `customerNote` uzunluğu sınırlandırılmalı.
- Ürün doğrulaması yapılmalı:
  - Ürün aynı işletmeye ait mi?
  - Ürün silinmiş mi?
  - Ürün aktif mi?
  - Stokta mı?
- Tek transaction içinde sipariş + orderItems + notification oluşturulmalı.
- Hata olursa partial data kalmamalı.

#### Kabul Kriterleri

- `quantity: -1`, `quantity: 0`, `quantity: 99999` reddedilir.
- Başka işletmenin ürün ID’si ile sipariş verilemez.
- Silinmiş veya stokta olmayan ürün sipariş edilemez.
- Client fiyat manipülasyonu toplam tutarı değiştirmez.
- Transaction rollback testi başarılı olur.

---

### 2.4. Ödeme ve Adisyon Çift Ciro Hatası

#### Problem

Garson ödeme aldıktan sonra admin panelinde adisyon hâlâ açık görünürse admin de tekrar "ödendi" yapabilir. Bu durumda ciro iki kere artabilir.

#### Yapılacaklar

- Ödeme alma işlemleri tek merkezi servis üzerinden yürümeli.
- `collectPayment` / `payBill` benzeri tek authoritative ödeme fonksiyonu olmalı.
- Admin ve garson ayrı ayrı ödeme oluşturuyorsa bile aynı `billId` için çift `PAID` payment oluşmamalı.
- Aynı adisyon için tekrar ödeme alınmaya çalışılırsa `409 Conflict` dönmeli.
- Tam ödeme sonrası:
  - `Bill.paymentStatus = PAID`
  - `Bill.status = CLOSED`
  - `TableSession.status = CLOSED`
  - `Table.status = EMPTY` veya iş akışına göre `CLEANING_NEEDED`
  - `CustomerSession.status = CLOSED`
  - Bekleyen `Payment` kayıtları iptal edilmeli
  - Bekleyen `ServiceRequest` kayıtları tamamlanmalı/iptal edilmeli
- Admin panelindeki açık adisyon listesi sadece gerçekten `OPEN` olan ve `remainingAmount > 0` olan kayıtları göstermeli.

#### Kabul Kriterleri

- Garson ödeme aldıktan sonra admin panelinde aynı adisyon "açık" görünmez.
- Aynı `billId` için ikinci ödeme isteği `409` döner.
- Ciro hesaplamasında sadece `Payment.status = PAID` ve benzersiz işlem kayıtları kullanılır.
- Kısmi ödeme varsa `PARTIALLY_PAID` doğru çalışır.
- Tam ödeme varsa masa ve session kapanır.

---

### 2.5. Garson ve Admin Yetki Kontrolü

#### Problem

Sadece frontend route koruması yeterli değildir. Her API endpoint kendi içinde rol ve işletme kontrolü yapmalıdır.

#### Yapılacaklar

Tüm admin ve garson endpointlerini tek tek incele:

```txt
src/app/api/admin/**
src/app/api/waiter/**
src/app/api/super-admin/**
```

Her endpointte şu kontroller olmalı:

- Kullanıcı giriş yapmış mı?
- Kullanıcı aktif mi?
- Kullanıcının rolü endpoint için uygun mu?
- Kullanıcının `businessId` değeri işlem yapılan verinin `businessId` değeriyle aynı mı?
- `SUPER_ADMIN` sadece kendi yetki alanındaki işlemleri yapmalı.
- `WAITER`, admin işlemleri yapamamalı.
- `ADMIN`, super admin işlemleri yapamamalı.
- Başka işletmenin:
  - masası,
  - siparişi,
  - ödemesi,
  - ürünü,
  - kategorisi,
  - garsonu,
  - adisyonu
  görülememeli ve değiştirilememeli.

#### Kabul Kriterleri

- Garson token’ıyla admin endpoint çağrısı `403` döner.
- Admin A, Business B’nin verisini göremez.
- IDOR testi geçer: URL’de başka işletmeye ait ID değiştirilince veri dönmez.
- Tüm mutation endpointleri backend tarafında rol kontrolü yapar.

---

### 2.6. Login Güvenliği

#### Problem

`src/lib/auth.ts` içinde login rate limiting için TODO notu var. Bu production ortamı için risklidir.

#### Yapılacaklar

- Login endpointine production-grade rate limiting ekle.
- In-memory rate limit production için kullanılmasın.
- Vercel/Render/Supabase ortamında çalışacak şekilde Redis tabanlı çözüm kullanılabilir:
  - Upstash Redis + `@upstash/ratelimit`
  - veya başka kalıcı store
- Başarısız login denemeleri takip edilmeli.
- Aynı IP + aynı email için brute force engellenmeli.
- Hata mesajları kullanıcı var/yok bilgisini açık etmemeli.
  - "Kullanıcı bulunamadı" yerine genel mesaj:
    - "E-posta veya şifre hatalı"
- `NEXTAUTH_SECRET` güçlü olmalı.
- Production `.env` dosyasında default örnek secret kullanılmamalı.

#### Kabul Kriterleri

- 5 başarısız login denemesinden sonra geçici engel uygulanır.
- Hata mesajı email enumeration yaptırmaz.
- Rate limit server restart ile sıfırlanmamalı.
- Production ortamında in-memory store kullanılmaz.

---

### 2.7. Spam ve Rate Limit Koruması

#### Problem

Aynı masadan çok sayıda "Yardım İste", "Garson Çağır", "Ödeme İste" talebi gönderilirse garson paneli kilitlenebilir.

#### Yapılacaklar

- Customer API’lerine kalıcı rate limit ekle.
- Sadece aktif request var mı kontrolü yetmez; IP + session + tableId bazlı rate limit olmalı.
- Şu endpointler korunmalı:
  - `/api/customer/session`
  - `/api/customer/orders`
  - `/api/customer/service-requests`
  - `/api/customer/payment-requests`
- Aynı masa + aynı requestType için aktif talep varsa yeni talep oluşturulmasın.
- Cooldown süreleri uygulanmalı:
  - Garson çağır: 60 sn
  - Yardım iste: 60 sn
  - Ödeme iste: 120 sn
  - Temizlik iste: 120 sn
  - Sipariş gönderme: 10-20 sn
- UI tarafında butonlar cooldown süresince disabled olmalı.
- Backend tarafında da kesin kontrol olmalı.

#### Kabul Kriterleri

- 10-20 kişi aynı QR üzerinden spam yapsa bile panel çökmez.
- Aynı request 2. kez gönderilirse `409` veya `429` döner.
- Bildirim tablosuna duplicate kayıt yağmaz.
- Socket.IO bildirimleri duplicate üretmez.

---

### 2.8. Socket.IO Güvenliği ve Bildirim Sistemi

#### Problem

Bildirim sistemi hem güvenlik hem UX açısından kritik. Garson panelinde bildirim karmaşası oluşabilir.

#### Yapılacaklar

- Socket event isimleri standartlaştırılmalı.
- Her event `businessId` bazlı room’a gönderilmeli.
- Başka işletmenin bildirimleri başka işletmeye gitmemeli.
- Socket bağlantısında mümkünse auth/business doğrulaması yapılmalı.
- Bildirimler şu şekilde gruplanmalı:
  - Yeni sipariş
  - Garson çağrısı
  - Yardım talebi
  - Ödeme talebi
  - Temizlik talebi
  - Sipariş durum güncellemesi
- Garson panelinde bildirime tıklayınca ilgili masa/sipariş/talep açılmalı.
- Okundu/çözüldü/işleme alındı durumları net olmalı.
- Aynı masa için duplicate bildirimler birleşmeli.
- Ses sadece gerçekten yeni ve önemli bildirimde çalmalı.
- Bildirim listesi mobilde ve masaüstünde düzgün görünmeli.

#### Kabul Kriterleri

- Business A bildirimi Business B panelinde görünmez.
- Aynı masa için 10 yardım talebi tek aktif kart olarak görünür.
- "Okundu" ve "Tamamlandı" durumları doğru çalışır.
- Yeni sipariş ve ödeme talebi görsel olarak ayırt edilir.

---

## 3. Supabase/PostgreSQL ve Prisma Veri Bütünlüğü

### 3.1. Transaction Zorunluluğu

Aşağıdaki işlemler mutlaka transaction içinde yapılmalı:

```txt
Sipariş oluşturma
Sipariş onaylama
Sipariş iptal etme
Bill güncelleme
Ödeme alma
Masa kapatma
Masa açma/session oluşturma
QR token yenileme
Garson davet kodu kullanma
```

#### Kabul Kriterleri

- İşlemin bir adımı başarısız olursa hiçbir partial kayıt kalmaz.
- Aynı anda iki garson aynı ödemeyi almaya çalışırsa sadece biri başarılı olur.
- Race condition testleri geçer.

---

### 3.2. Database Index ve Unique Constraint Kontrolü

#### Yapılacaklar

Aşağıdaki alanlarda index/constraint yeterliliğini kontrol et:

```txt
CustomerSession(sessionToken)
CustomerSession(tableId, status)
TableSession(tableId, status)
Bill(tableSessionId)
Payment(billId, status)
Payment(tableSessionId, status)
ServiceRequest(tableId, requestType, status)
Order(tableSessionId, status)
Order(businessId, status, createdAt)
Table(businessId, tableNumber)
Table(qrToken)
```

Eklenmesi mantıklı olabilecek constraint’ler:

```txt
Bir TableSession için tek OPEN Bill
Bir masa için aynı anda tek ACTIVE TableSession
Bir session için aynı anda tek PENDING Payment
Bir tableId + businessId + requestType için tek aktif ServiceRequest
```

Prisma tek başına partial unique indexleri her zaman kolay yönetemeyebilir. Gerekirse SQL migration kullan.

#### Kabul Kriterleri

- Aynı masada aynı anda iki aktif table session oluşmaz.
- Aynı table session için iki açık adisyon oluşmaz.
- Aynı bill için duplicate ödeme engellenir.
- Concurrency testleri geçer.

---

### 3.3. Soft Delete Tutarlılığı

#### Problem

Bazı modellerde `isDeleted`, `deletedAt`, `isActive` var. Tüm sorgularda bunlar tutarlı kullanılmalı.

#### Yapılacaklar

- Silinmiş ürün sipariş edilememeli.
- Silinmiş masa QR ile açılamamalı.
- Pasif işletme menüsü sipariş alamamalı.
- Pasif kullanıcı giriş yapamamalı.
- Soft delete yapılan kayıtlar admin listelerinde uygun filtreyle görünmeli/görünmemeli.

#### Kabul Kriterleri

- Soft delete edilen ürün müşteri menüsünde çıkmaz.
- Eski linkten silinmiş masaya erişim engellenir.
- Silinen işletme/masa/ürün ile yeni işlem yapılamaz.

---

## 4. Eksik veya İyileştirilmesi Gereken Özellikler

### 4.1. Garson Paneli Bildirim UX İyileştirmesi

#### Yapılacaklar

Garson paneli bildirim sistemi yeniden düzenlensin:

- Üstte özet kartlar:
  - Bekleyen sipariş
  - Ödeme isteyen masa
  - Garson çağıran masa
  - Acil yardım
- Bildirimler öncelik sırasına göre listelensin:
  1. Acil yardım
  2. Ödeme talebi
  3. Yeni sipariş
  4. Garson çağrısı
  5. Temizlik
- Her bildirim kartında:
  - Masa adı/numarası
  - Talep tipi
  - Geçen süre
  - Durum
  - Aksiyon butonu
- Duplicate bildirimler gruplanmalı.
- Yeni bildirim geldiğinde görsel highlight olmalı.
- Ses ayarı aç/kapat seçeneği olmalı.
- Mobilde tek elle kullanılabilir olmalı.

---

### 4.2. Masa Yaşam Döngüsü Netleştirme

Önerilen net akış:

```txt
EMPTY
→ QR okutuldu / session oluşturuldu
→ OCCUPIED
→ Sipariş geldi
→ HAS_ORDER
→ Hazırlanıyor
→ PREPARING
→ Servis edildi
→ SERVED
→ Ödeme istendi
→ PAYMENT_REQUESTED
→ Ödeme alındı
→ EMPTY veya CLEANING_NEEDED
```

Kiro bu akışı merkezi servis içinde netleştirsin.

#### Kabul Kriterleri

- Masa durumu frontend state yüzünden yanlış değişmez.
- Aynı anda birden fazla masada işlem yapılırken loading state sadece ilgili masada çalışır.
- Masa kapatma, ödeme alma, sipariş onaylama aynı merkezi akışa uyar.

---

### 4.3. Admin Panel Raporları

Eklenmesi önerilen raporlar:

- Günlük ciro
- Haftalık ciro
- Aylık ciro
- En çok satan ürünler
- Masa başı ortalama hesap
- Garson performansı
- İptal edilen siparişler
- Ödeme yöntemi dağılımı
- Açık adisyonlar
- Şüpheli tekrar işlemler

#### Güvenlik Notu

Ciro raporu sadece kesinleşmiş ödeme kayıtlarından hesaplanmalı:

```txt
Payment.status = PAID
```

İptal, bekleyen veya failed ödemeler ciroya eklenmemeli.

---

### 4.4. Audit Log Sistemi

#### Neden Gerekli?

Restoran sisteminde "kim ne yaptı?" bilinmeli.

#### Eklenmesi Önerilen Model

```prisma
model AuditLog {
  id          String   @id @default(cuid())
  businessId String?
  userId     String?
  action     String
  entityType String
  entityId   String?
  oldValue   Json?
  newValue   Json?
  ipAddress  String?
  userAgent  String?
  createdAt  DateTime @default(now())
}
```

#### Loglanacak İşlemler

- Admin login
- Garson login
- Ürün ekleme/silme/güncelleme
- Masa ekleme/silme/güncelleme
- Sipariş onaylama/reddetme/iptal
- Ödeme alma
- Masa kapatma
- QR token yenileme
- Garson ekleme/silme
- Zorla masa kapatma

#### Kabul Kriterleri

- Kritik işlemler audit log’a yazılır.
- Admin panelinden audit log listesi görülebilir.
- Log kayıtları geriye dönük incelenebilir.

---

### 4.5. Garson Davet Kodu Güvenliği

#### Yapılacaklar

- Davet kodları tek kullanımlık olmalı.
- Süresi dolmalı.
- Kullanıldıktan sonra tekrar kullanılamamalı.
- Aynı email ile tekrar tekrar hesap açılması engellenmeli.
- Davet kodu brute force’a karşı rate limitlenmeli.
- Davet kodu hangi işletmeye aitse kullanıcı o işletmeye bağlanmalı.

#### Kabul Kriterleri

- Kullanılmış invite code tekrar çalışmaz.
- Süresi dolmuş invite code reddedilir.
- Başka işletmeye ait invite code ile yanlış business’a kayıt olunamaz.

---

### 4.6. Menü ve Ürün Yönetimi

#### Yapılacaklar

- Ürünlerde stok durumu müşteri menüsüne doğru yansısın.
- Stokta olmayan ürün sepete eklenemesin.
- Ürün arama ve kategori filtreleme eklensin.
- Alerjen bilgisi daha görünür yapılsın.
- Ürün görselleri optimize edilsin.
- Admin ürün düzenlerken fiyat negatif/sıfır olamasın.
- Kategori sıralama düzgün çalışsın.

#### Kabul Kriterleri

- Stokta olmayan ürün sipariş edilemez.
- Silinmiş ürün menüde çıkmaz.
- Ürün fiyat manipülasyonu backend’de engellenir.

---

## 5. Frontend ve UX Düzeltmeleri

### 5.1. Müşteri Mobil Ekranı

#### Yapılacaklar

- Sepete ekleme deneyimi hızlandırılsın.
- Sipariş gönderirken loading state net olsun.
- Aynı sipariş iki kere gönderilmesin.
- Hata mesajları anlaşılır Türkçe olsun.
- Session süresi dolarsa kullanıcıya QR tekrar okutma mesajı verilsin.
- Masa kapandıysa sipariş butonu pasif olsun.
- Ödeme talebi butonu sadece sipariş varsa aktif olsun.
- Garson çağırma/y yardım butonları cooldown gösterimi yapsın.

#### Kabul Kriterleri

- iOS Safari ve Android Chrome testlerinden geçer.
- 320px genişlikte tasarım bozulmaz.
- Sipariş sırasında internet yavaşsa kullanıcı aynı isteği tekrar tekrar gönderemez.

---

### 5.2. Admin Paneli

#### Yapılacaklar

- Açık adisyonlar doğru listelensin.
- Ödenmiş adisyonlar açık görünmesin.
- Masa durumları canlı ve doğru güncellensin.
- Ürün/kategori/stok yönetimi sadeleştirilsin.
- Garson yönetimi net olsun.
- Admin ödeme aldığında hangi session/bill kapandığı net görünsün.
- Kritik işlemlerde onay modalı olsun:
  - Masa kapat
  - Zorla kapat
  - Ürün sil
  - Garson sil
  - QR yenile

---

### 5.3. Garson Paneli

#### Yapılacaklar

- Sipariş listesi daha okunabilir olsun.
- Sipariş kartında:
  - Masa
  - Ürünler
  - Notlar
  - Toplam
  - Süre
  - Durum
  - Aksiyonlar
- Ödeme talebi ayrı ve belirgin görünsün.
- "Servis edildi", "Hazırlanıyor", "Ödeme alındı" aksiyonları net olsun.
- Aynı aksiyona çift tıklama duplicate işlem oluşturmasın.
- Sadece ilgili butonda loading dönsün; tüm masa butonları loading olmasın.

---

## 6. QA Test Planı

Kiro, geliştirme sonrası aşağıdaki testleri yapmalı ve `TEST_CHECKLIST.md` dosyasını güncellemelidir.

### 6.1. Kritik Akış Testleri

```txt
1. QR okut
2. Menü açıldı mı?
3. Session oluştu mu?
4. Sepete ürün eklendi mi?
5. Sipariş gönderildi mi?
6. Garson paneline düştü mü?
7. Garson siparişi onayladı mı?
8. Sipariş hazırlanıyor/servis edildi akışı çalıştı mı?
9. Müşteri ödeme istedi mi?
10. Garson ödeme aldı mı?
11. Admin panelinde adisyon kapandı mı?
12. Masa EMPTY oldu mu?
13. Eski token ile sipariş engellendi mi?
```

---

### 6.2. Güvenlik Testleri

#### Test: Eski Session Token

```txt
1. QR okut ve token al
2. Sipariş ver
3. Ödeme al
4. Masa kapansın
5. Eski token ile tekrar sipariş dene
Beklenen: 401/403, sipariş oluşmaz
```

#### Test: Yanlış Masa ID

```txt
1. Masa A için token al
2. Masa B tableId ile sipariş dene
Beklenen: 401/403, sipariş oluşmaz
```

#### Test: Başka Business Ürünü

```txt
1. Business A menüsündeyken Business B ürün ID’si ile sipariş dene
Beklenen: 400/403/404, sipariş oluşmaz
```

#### Test: Quantity Manipülasyonu

```txt
quantity = -1
quantity = 0
quantity = 999999
quantity = 1.5
Beklenen: reddedilir
```

#### Test: Duplicate Payment

```txt
1. Garson ödeme alsın
2. Admin aynı bill için tekrar ödeme almaya çalışsın
Beklenen: 409 Conflict
```

#### Test: IDOR

```txt
Admin A tokenıyla Business B order/payment/table ID’si çağır
Beklenen: 403 veya 404
```

---

### 6.3. Spam Testleri

```txt
Aynı masadan 20 defa garson çağır
Beklenen: 1 aktif talep, diğerleri 409/429

Aynı masadan 20 defa ödeme iste
Beklenen: 1 aktif payment request, diğerleri 409/429

Aynı masadan hızlı hızlı sipariş gönder
Beklenen: rate limit çalışır
```

---

### 6.4. Concurrency Testleri

```txt
İki garson aynı anda aynı ödemeyi almaya çalışır
Beklenen: sadece biri başarılı

İki müşteri aynı masa session'ı ile aynı anda sipariş verir
Beklenen: veri tutarlı kalır

Aynı masa için aynı anda session oluşturulur
Beklenen: tek aktif TableSession kalır
```

---

### 6.5. Mobil Testler

```txt
iOS Safari
Android Chrome
320px ekran
375px ekran
414px ekran
Tablet görünüm
Yavaş internet
Sayfa yenileme
Geri tuşu
Session süresi dolması
```

---

## 7. Deployment Öncesi Checklist

Kiro deployment öncesi şunları kontrol etsin:

```txt
[ ] .env production değerleri doğru
[ ] NEXTAUTH_SECRET güçlü
[ ] DATABASE_URL doğru
[ ] DATABASE_URL_UNPOOLED doğru
[ ] NEXTAUTH_URL production URL
[ ] NEXT_PUBLIC_APP_URL production URL
[ ] Supabase connection pooling doğru
[ ] Prisma migration uygulandı
[ ] Seed script production’da yanlışlıkla çalışmıyor
[ ] Super admin şifresi default değil
[ ] Test kullanıcıları production’dan temizlendi
[ ] Rate limit production store kullanıyor
[ ] Eski QR/session testleri geçti
[ ] Double payment testi geçti
[ ] IDOR testi geçti
[ ] Mobil testler geçti
[ ] Build hatasız
[ ] Lint hatasız
```

---

## 8. Güvenlik İçin Ek HTTP Header Önerileri

Middleware içinde bazı header’lar var. Bunları tamamla:

```txt
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy
Permissions-Policy
```

Özellikle `Content-Security-Policy` eklenmeli.

Örnek başlangıç:

```txt
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval';
style-src 'self' 'unsafe-inline';
img-src 'self' data: https:;
connect-src 'self' https: wss:;
frame-ancestors 'none';
```

Not: CSP production’da test edilerek sıkılaştırılmalı.

---

## 9. Kiro’dan Beklenen Çıktılar

Kiro geliştirme sonunda şunları teslim etsin:

```txt
1. Güvenlik açıkları düzeltilmiş kod
2. Migration dosyaları
3. Güncellenmiş Prisma schema
4. Güncellenmiş TEST_CHECKLIST.md
5. Yapılan değişiklikleri anlatan SECURITY_FIX_REPORT.md
6. Manual test sonuçları
7. Varsa bilinen kalan riskler
8. Deploy sonrası kontrol adımları
```

---

## 10. Kiro İçin Uygulanabilir Ana Prompt

Aşağıdaki prompt’u doğrudan Kiro’ya ver:

```txt
Sen kıdemli Full Stack Developer, Backend/Supabase uzmanı, QA Tester ve Siber Güvenlik uzmanısın.

Bu repository'yi incele:
https://github.com/yattaraadamd-lang/QR_MENU_PRODUCT

Bu proje restoran ve cafeler için QR menü, sipariş, garson paneli, admin paneli, masa yönetimi, adisyon ve ödeme sistemi olarak kullanılacak.

Görevin:
1. Projedeki güvenlik açıklarını bul ve düzelt.
2. Supabase/PostgreSQL + Prisma veri bütünlüğünü güçlendir.
3. QR/customer session güvenliğini sağlamlaştır.
4. Eski QR veya eski session token ile restorandan ayrıldıktan sonra işlem yapılmasını engelle.
5. Garson çağırma, yardım isteme, ödeme isteme ve sipariş oluşturma endpointlerine spam/rate limit koruması ekle.
6. Admin, garson ve super admin rollerinin API seviyesinde doğru yetkilendirildiğini kontrol et.
7. IDOR açıklarını kapat: başka işletmenin masa/sipariş/ödeme/ürün/adisyon verisi görülemesin ve değiştirilemesin.
8. Ödeme/adisyon tarafındaki çift ciro riskini tamamen kapat.
9. Aynı adisyon için ikinci kez ödeme alınmasını engelle.
10. Masa yaşam döngüsünü merkezi ve transaction tabanlı hale getir.
11. Bildirim sistemini garson paneli için daha kullanılabilir, gruplu ve spam korumalı hale getir.
12. Mobil müşteri ekranında session, ödeme isteği, garson çağırma ve sipariş gönderme UX’ini düzelt.
13. Geliştirme sonunda test checklist’i oluştur/güncelle ve tüm kritik akışları test et.

Dikkat:
- Sadece frontend düzenleme yapma.
- Sadece görünümü düzeltme.
- Backend, database, auth, API ve QA birlikte ele alınmalı.
- Fiyat, ödeme ve ciro hesaplamalarında frontend verisine güvenme.
- Tüm kritik işlemleri Prisma transaction ile yap.
- Eski session, eski QR, duplicate payment, duplicate notification, spam request ve rol yetkisi testlerini mutlaka yap.
- Production için in-memory rate limit kullanma; Redis/Upstash gibi kalıcı çözüm öner veya uygula.
- Hata mesajları Türkçe ve kullanıcı dostu olsun.
- Build/lint/test sonrası rapor hazırla.

Özellikle şu dosyaları incele:
src/app/api/customer/session/route.ts
src/app/api/customer/orders/route.ts
src/app/api/customer/service-requests/route.ts
src/app/api/customer/payment-requests/route.ts
src/lib/services/table-flow.service.ts
src/lib/auth.ts
src/lib/rate-limit.ts
src/middleware.ts
src/app/api/admin/**
src/app/api/waiter/**
prisma/schema.prisma
TEST_CHECKLIST.md

Teslim formatı:
- Kod değişiklikleri
- Migration gerekiyorsa migration
- SECURITY_FIX_REPORT.md
- Güncellenmiş TEST_CHECKLIST.md
- Yapılan testlerin sonucu
```

---

## 11. Önceliklendirme

Kiro işleri şu sırayla yapsın:

### P0 — Hemen Düzeltilmeli

```txt
[ ] Eski session/QR ile işlem yapılması
[ ] Double payment / çift ciro
[ ] API rol/yetki kontrolleri
[ ] IDOR açıkları
[ ] Sipariş ve ödeme transaction güvenliği
[ ] Login rate limit
[ ] Customer endpoint spam koruması
```

### P1 — MVP İçin Gerekli

```txt
[ ] Garson panel bildirim UX
[ ] Masa yaşam döngüsü tutarlılığı
[ ] Mobil müşteri UX
[ ] Ürün stok ve fiyat validasyonları
[ ] Admin açık adisyon ekranı
[ ] QR token yenileme
```

### P2 — Profesyonel Kullanım İçin

```txt
[ ] Audit log
[ ] Raporlar
[ ] Gelişmiş analytics
[ ] İşletme abonelik limitleri
[ ] Garson performans raporu
[ ] CSP ve güvenlik header iyileştirmeleri
```

---

## 12. Son Kontrol

Bu görev tamamlandığında aşağıdaki cümle doğru olmalı:

```txt
Müşteri QR okutarak sadece aktif masa oturumu içinde sipariş/hizmet/ödeme işlemi yapabilir; masa kapandıktan veya ödeme tamamlandıktan sonra eski QR/session ile hiçbir işlem yapılamaz. Garson ve admin işlemleri rol ve işletme bazlı korunur. Ödeme/adisyon kayıtları duplicate ciro üretmez. Sistem spam ve temel saldırı senaryolarına karşı korunur.
```
