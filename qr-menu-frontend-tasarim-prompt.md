# QR Menü Projesi Front-End Yenileme Promptu

Profesyonel bir front-end developer gibi davran. Bu proje restoran ve kafeler için geliştirilmiş QR menü, sipariş, masa, garson paneli, admin paneli ve ödeme yönetim sistemidir.

Amacın projedeki ilk giriş ekranı, demo deneyim sayfası, login ekranı, müşteri arayüzü, garson paneli ve admin panelini modern, responsive, hızlı ve kullanıcı dostu hale getirmektir.

Mevcut backend, auth, Supabase bağlantıları, ödeme akışı, masa durumu ve sipariş yönetimi bozulmadan sadece front-end, UI/UX ve kullanıcı akışları iyileştirilmelidir.

---

## 1. Genel Tasarım Hedefleri

- Mobile-first tasarım uygulanmalıdır.
- Müşteri QR menü arayüzü telefonda hızlı, sade ve kolay kullanılabilir olmalıdır.
- Garson paneli operasyon odaklı olmalı, siparişler kolay takip edilmelidir.
- Admin paneli profesyonel dashboard görünümünde olmalıdır.
- Landing page, demo ekranı ve login ekranı modern SaaS ürün sayfası gibi tasarlanmalıdır.
- Tüm butonlar, kartlar, tablolar, formlar ve bildirimler tutarlı bir design system ile yeniden düzenlenmelidir.
- Gereksiz karmaşa kaldırılmalıdır.
- Loading, empty state, error state ve success state tasarımları eklenmelidir.
- Dark mode desteği opsiyonel olabilir fakat tasarım buna uygun kurulmalıdır.
- Sayfa yenilenmeden veri güncellemeleri kullanıcıya net gösterilmelidir.
- Kullanıcı yanlış işlem yaptığında teknik hata mesajı yerine anlaşılır hata mesajı görmelidir.

---

## 2. Kullanılabilecek Teknolojiler

Mevcut proje yapısına uygun olmak şartıyla şu teknolojiler tercih edilebilir:

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- Lucide React Icons
- React Hook Form
- Zod
- Sonner Toast
- TanStack Table
- Recharts
- Framer Motion

Gereksiz yeni bağımlılık eklenmemelidir. Mevcut projede kullanılan kütüphaneler varsa öncelik onlara verilmelidir.

---

## 3. Landing Page / İlk Giriş Ekranı Tasarımı

Projeye ilk girildiğinde açılan “Demoyu Deneyin” ve “Giriş Yapın” ekranı profesyonel, modern ve güven veren bir SaaS landing page görünümüne dönüştürülmelidir.

Bu ekran restoran ve kafeler için geliştirilmiş QR menü, sipariş, masa ve ödeme yönetim sisteminin tanıtım vitrini gibi tasarlanmalıdır.

### 3.1 Genel Amaç

Kullanıcı siteye ilk girdiğinde şu mesajı net şekilde anlamalıdır:

> Bu sistem restoran ve kafeler için QR menü, sipariş takibi, garson paneli, admin paneli, masa yönetimi, ödeme takibi ve ciro raporlama sunar.

Sayfa sade, modern, responsive ve güven veren bir yapıda olmalıdır.

### 3.2 Hero Alanı

İlk ekranda büyük ve dikkat çekici bir başlık olmalıdır:

```text
Restoran ve Kafeler İçin Modern QR Menü Sistemi
```

Alt açıklama:

```text
Müşteriler QR kod ile menüyü görüntüler, sipariş verir; garsonlar siparişleri yönetir, admin paneliyle masa, ürün, ödeme ve ciro takibi kolayca yapılır.
```

Hero alanında iki ana buton bulunmalıdır:

- Demoyu Deneyin
- Giriş Yapın

Buton davranışları:

- “Demoyu Deneyin” butonu primary renk olmalıdır.
- “Giriş Yapın” butonu secondary veya outline tarzında olmalıdır.
- Butonlar mobilde alt alta, desktopta yan yana görünmelidir.
- Butonlarda loading state bulunmalıdır.
- Hover ve focus durumları belirgin olmalıdır.

### 3.3 Demo Seçim Alanı

“Demoyu Deneyin” butonuna basıldığında kullanıcıya demo rolleri gösterilmelidir.

Demo rolleri:

- Müşteri Demo
- Garson Demo
- Admin Demo

Her demo kartı açıklamalı olmalıdır.

#### Müşteri Demo

```text
QR menüyü görüntüleyin, ürünleri sepete ekleyin ve sipariş akışını test edin.
```

#### Garson Demo

```text
Gelen siparişleri yönetin, masa durumlarını takip edin ve ödeme taleplerini görün.
```

#### Admin Demo

```text
Ciro, ürün, masa, kategori ve personel yönetimini deneyimleyin.
```

Bu alan modal olarak veya ayrı bir demo seçim sayfası olarak tasarlanabilir.

Demo kartları ikonlu, açıklamalı, responsive ve hover efektli olmalıdır.

### 3.4 Giriş Yap Alanı

“Giriş Yapın” butonu kullanıcıyı login sayfasına yönlendirmelidir.

Login ekranı sade ve modern olmalıdır.

Login ekranında bulunması gerekenler:

- Logo veya sistem adı
- E-posta alanı
- Şifre alanı
- Giriş yap butonu
- Şifre göster/gizle butonu
- Loading state
- Hata mesajı alanı
- Kullanıcı dostu doğrulama mesajları

Login sayfası müşteri menüsü gibi değil, profesyonel yönetim paneli giriş ekranı gibi görünmelidir.

Örnek hata mesajları:

```text
E-posta veya şifre hatalı. Lütfen bilgilerinizi kontrol edin.
```

```text
Giriş yapılırken bir sorun oluştu. Lütfen tekrar deneyin.
```

### 3.5 Landing Page Bölümleri

İlk giriş ekranında aşağıdaki bölümler bulunabilir:

1. Hero Alanı
2. Özellikler Alanı
3. Demo Rolleri Alanı
4. Nasıl Çalışır Alanı
5. Güven Veren Kapanış Alanı

### 3.6 Özellikler Alanı

Kart yapısında şu özellikler gösterilmelidir:

- QR Menü
- Online Sipariş
- Garson Paneli
- Admin Paneli
- Masa Yönetimi
- Ödeme Takibi
- Ciro Raporlama
- Ürün ve Kategori Yönetimi

Kartlar ikonlu, kısa açıklamalı ve modern görünmelidir.

### 3.7 Nasıl Çalışır Alanı

3 adımlı basit bir anlatım yapılmalıdır:

1. Müşteri QR kodu okutur.
2. Menüden ürün seçip sipariş verir.
3. Garson ve admin panelinden tüm süreç yönetilir.

### 3.8 Görsel Tasarım

Tasarım dili şu şekilde olmalıdır:

- Modern SaaS landing page görünümü
- Açık arka plan
- Amber/turuncu ana renk
- Beyaz kartlar
- Soft shadow
- Rounded-xl veya rounded-2xl yapılar
- Temiz spacing
- Mobil uyumlu düzen
- Profesyonel restoran/kafe sistemi hissi

### 3.9 Teknik Beklenti

Mevcut Next.js proje yapısına uygun şekilde landing page ve login ekranı düzenlenmelidir.

Mevcut routing yapısı bozulmamalıdır.

Mümkünse şu sayfa yapısı korunmalı veya uygun şekilde düzenlenmelidir:

```text
/              -> Landing Page
/login         -> Giriş Yap sayfası
/demo          -> Demo rol seçimi veya modal
/customer-demo -> Müşteri demo
/waiter-demo   -> Garson demo
/admin-demo    -> Admin demo
```

Tasarım mevcut proje temasına uygun olmalı ve müşteri, garson, admin panelleriyle görsel bütünlük sağlamalıdır.

---

## 4. Müşteri QR Menü Arayüzü

Müşteri tarafında sade, hızlı ve dokunmatik dostu bir yapı olmalıdır.

### 4.1 Olması Gereken Sayfalar

- Ana menü sayfası
- Kategori filtreleri
- Ürün detay sayfası
- Sepet
- Sipariş durumu
- Hizmetler / ödeme iste / garson çağır

### 4.2 Menü Sayfası

Müşteri menü sayfası mobile-first tasarlanmalıdır.

Üst alanda bulunması gerekenler:

- İşletme adı
- Masa numarası
- Arama kutusu
- Aktif kategori filtreleri

Ürünler kart şeklinde gösterilmelidir.

Ürün kartlarında şunlar net görünmelidir:

- Ürün fotoğrafı
- Ürün adı
- Kısa açıklama
- Fiyat
- Stokta var/yok durumu
- Alerjen bilgisi
- Sepete ekle butonu

Örnek ürün kartı yapısı:

```text
[Ürün Fotoğrafı]
Çay
Kısa açıklama
20 TL
[Sepete Ekle]
```

### 4.3 Sepet ve Sipariş

Mobilde sepet butonu alt sabit bar olarak gösterilmelidir.

Örnek:

```text
[Sepet - 120 TL]
```

Sipariş onaylandıktan sonra:

- Buton disable edilmelidir.
- Loading state gösterilmelidir.
- Aynı siparişin tekrar gönderilmesi engellenmelidir.
- Kullanıcıya başarı toast bildirimi gösterilmelidir.

Örnek buton durumları:

```text
[Siparişi Onayla]
[Sipariş Gönderiliyor...]
[Sipariş Alındı]
```

### 4.4 Hizmetler Alanı

Hizmetler alanında bulunan “Garson Çağır” ve “Ödeme İste” butonları spam yapılmasını engelleyecek şekilde düzenlenmelidir.

Beklenen davranış:

- Butona basılınca loading state görünmelidir.
- İşlem tamamlandıktan sonra buton kısa süre disable kalmalıdır.
- Aynı işlem arka arkaya sürekli gönderilmemelidir.
- Kullanıcıya net bilgi verilmelidir.

Örnek:

```text
Garson çağırma isteğiniz iletildi. Lütfen bekleyiniz.
```

---

## 5. Garson Paneli Tasarımı

Garson paneli operasyon odaklı olmalıdır. Amaç garsonun siparişleri hızlı ve hatasız yönetmesidir.

### 5.1 Ana Bölümler

Garson panelinde şu bölümler bulunmalıdır:

- Aktif masalar
- Yeni siparişler
- Hazırlanan siparişler
- Servis edilen siparişler
- Ödeme bekleyen masalar
- Bildirimler

### 5.2 Sipariş Kartları

Siparişler kart yapısında gösterilmelidir.

Örnek:

```text
Masa 5
2x Çay
1x Tost

Durum: Yeni Sipariş

[Kabul Et] [İptal Et]
```

Kartlarda masa numarası büyük ve net görünmelidir.

### 5.3 Sipariş Durum Renkleri

Sipariş durumları renkli badge ile gösterilmelidir:

```text
Yeni Sipariş   -> Sarı
Hazırlanıyor   -> Mavi
Servis Edildi  -> Yeşil
İptal Edildi   -> Kırmızı
Ödeme Bekliyor -> Turuncu
```

### 5.4 Aksiyon Butonları

Garson panelindeki butonlar açık ve anlaşılır olmalıdır.

Kullanılabilecek butonlar:

- Kabul Et
- Hazırlanıyor
- Servis Edildi
- İptal Et
- Ödeme Al
- Masayı Kapat

Sadece ikon kullanılmamalıdır. İkon kullanılacaksa yanında metin de olmalıdır.

### 5.5 Bildirim Sistemi

Garson panelindeki bildirim sistemi profesyonel hale getirilmelidir.

Yeni sipariş, ödeme isteği veya garson çağırma isteği geldiğinde garson bunu kolayca fark etmelidir.

Beklenen özellikler:

- Bildirim kartları
- Okundu/okunmadı durumu
- Öncelik veya durum rengi
- Masa numarası
- Bildirim zamanı
- İlgili aksiyon butonu

### 5.6 Ödeme Ekranı

Ödeme ekranı çok net tasarlanmalıdır.

Garson ödeme alırken şu bilgiler ayrı ayrı gösterilmelidir:

```text
Ödenmesi Gereken Tutar: 20 TL
Müşteriden Alınan Para: 100 TL
Para Üstü: 80 TL
Ciroya Yansıyacak Tutar: 20 TL

[Ödemeyi Onayla]
```

Önemli kural:

- Kullanıcı müşteriden alınan para olarak 100 TL girse bile ciroya sadece gerçek hesap tutarı yansımalıdır.
- Front-end bu durumu kullanıcıya net açıklamalıdır.
- Backend tarafındaki güvenlik kontrolü bozulmamalıdır.

### 5.7 Loading State

Garson panelinde loading state sadece işlem yapılan kartta çalışmalıdır.

Örneğin bir masayı açarken veya siparişi kabul ederken tüm panel loading durumuna geçmemelidir.

---

## 6. Admin Paneli Tasarımı

Admin paneli profesyonel dashboard yapısında olmalıdır.

### 6.1 Ana Bölümler

Admin panelinde şu bölümler bulunmalıdır:

- Dashboard
- Siparişler
- Masalar
- Ürünler
- Kategoriler
- Personeller
- Ödemeler
- Raporlar
- Ayarlar

### 6.2 Dashboard Kartları

Dashboard üzerinde şu kartlar bulunmalıdır:

```text
Bugünkü Ciro
Toplam Sipariş
Aktif Masa
Ödeme Bekleyen Masa
```

Kartlar sade, ikonlu ve anlaşılır olmalıdır.

### 6.3 Yönetim Tabloları

Ürün, kategori, personel, sipariş ve ödeme yönetimi için modern tablolar kullanılmalıdır.

Örnek ürün tablosu:

```text
Ürün Adı | Kategori | Fiyat | Stok | Durum | İşlem
Çay      | İçecek   | 20 TL | Var  | Aktif | Düzenle / Sil
```

Tablolarda bulunması gereken özellikler:

- Arama
- Filtreleme
- Sıralama
- Responsive görünüm
- Boş veri durumu
- Silme/düzenleme aksiyonları

### 6.4 Admin Ödeme ve Ciro Kontrolü

Admin panelinde ödeme ve ciro verileri net gösterilmelidir.

Özellikle çift ödeme, fazla ödeme, açık adisyon ve kapalı masa durumları karışmayacak şekilde UI düzenlenmelidir.

Açık adisyon, ödenmiş adisyon ve iptal edilmiş siparişler farklı etiketlerle gösterilmelidir.

---

## 7. Design System

Projeye tutarlı bir design system uygulanmalıdır.

### 7.1 Renkler

Önerilen tema:

```text
Primary: Amber / Orange
Background: Slate-50 veya Neutral-50
Card: White
Success: Emerald / Green
Danger: Red
Warning: Orange / Yellow
Info: Blue
```

### 7.2 Tipografi

- Font sade ve okunabilir olmalıdır.
- Inter veya sistem fontu kullanılabilir.
- Başlıklar, açıklamalar ve buton yazıları hiyerarşik olmalıdır.

### 7.3 Component Stili

- Border radius: rounded-xl veya rounded-2xl
- Soft shadow kullanılmalıdır.
- Kartlar arası boşluk düzenli olmalıdır.
- Butonlar dokunmatik cihazlara uygun olmalıdır.
- Mobilde buton yüksekliği en az 44px olmalıdır.

---

## 8. Component Yapısı

Mümkünse şu component yapısı oluşturulmalıdır:

```text
components/
  ui/
    Button.tsx
    Card.tsx
    Badge.tsx
    Modal.tsx
    Input.tsx
    Select.tsx
    Table.tsx
    Toast.tsx

  customer/
    ProductCard.tsx
    CategoryTabs.tsx
    CartDrawer.tsx
    OrderStatusCard.tsx

  waiter/
    OrderCard.tsx
    TableStatusCard.tsx
    PaymentRequestCard.tsx
    NotificationPanel.tsx

  admin/
    DashboardStatCard.tsx
    ProductTable.tsx
    RevenueChart.tsx
    StaffTable.tsx
```

Componentler tekrar kullanılabilir, temiz ve TypeScript uyumlu olmalıdır.

---

## 9. Kritik UX Kuralları

- Silme, iptal etme ve ödeme alma işlemlerinde confirm modal kullanılmalıdır.
- Başarılı işlemlerde toast bildirimi gösterilmelidir.
- Hatalarda teknik hata mesajı yerine kullanıcı dostu açıklama gösterilmelidir.
- Mobilde butonlar en az 44px yüksekliğinde olmalıdır.
- Aynı anda birden fazla kez tıklamayı önlemek için işlem sırasında buton disable edilmelidir.
- Loading state kullanıcıya net gösterilmelidir.
- Empty state ekranları eklenmelidir.
- Error state ekranları eklenmelidir.
- Mevcut backend işleyişi bozulmamalıdır.
- Responsive tasarım müşteri, garson ve admin tarafında test edilmelidir.

---

## 10. Öncelikli Yapılacaklar

Front-end iyileştirme sırası şu şekilde olmalıdır:

1. Landing page, demo seçim ekranı ve login ekranı düzenlenmelidir.
2. Müşteri QR menü ekranı mobile-first olacak şekilde iyileştirilmelidir.
3. Garson panelindeki sipariş, masa, bildirim ve ödeme ekranları düzenlenmelidir.
4. Admin dashboard ve yönetim tabloları profesyonelleştirilmelidir.
5. Loading, empty, error ve success state durumları tüm akışlara eklenmelidir.
6. Responsive görünüm test edilmelidir.
7. TypeScript ve build hataları kontrol edilmelidir.

---

## 11. Çıktı Beklentisi

Kodları doğrudan mevcut projeye uygun şekilde güncelle.

Mevcut dosya yapısını analiz et.

Gereksiz yeni bağımlılık ekleme.

Her değişiklikten sonra şunları kontrol et:

- TypeScript hatası var mı?
- Build alınıyor mu?
- Mobil görünüm düzgün mü?
- Müşteri sipariş akışı bozuldu mu?
- Garson sipariş yönetimi bozuldu mu?
- Admin ödeme ve ciro akışı bozuldu mu?
- Demo ve login akışı doğru çalışıyor mu?

Sonuç olarak proje, restoran ve kafelerde kullanılabilecek profesyonel, modern, hızlı ve güven veren bir QR menü platformu görünümüne sahip olmalıdır.
