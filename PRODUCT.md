# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Birincil alıcı:** Türkiye'de tek şubeli, küçük-orta ölçekli (yaklaşık 5–30 masalı) kafe ve restoranların sahibi ya da yöneticisi. Ürünü kendisi dener ve kurar; abonelik kararını o verir. Panelde "Yönetici" rolüdür. İşi: menüyü, masaları ve ekibi kurmak; servis boyunca siparişi, ödemeyi ve ciroyu tek yerden izlemek.

**Günlük kullanıcılar:**

- **Garson:** Servis sırasında, yoğun saatte, telefondan ya da tabletten çalışır. Yeni sipariş, garson çağrısı ve hesap isteği ona sesli ve görsel olarak, canlı düşer. Misafirin ilk siparişini onay koduyla doğrular, masaları ve ödemeleri yönetir, nakit tahsil eder. Yönetici onu davet koduyla ekibe katar.
- **Misafir:** Masadaki QR'ı kendi telefonuyla okutur; uygulama indirmez, hesap açmaz. Menüye bakar, sepetini kurar, sipariş gönderir, garson çağırır, hesap ister.

**Platform işletmecisi:** Süper admin. İşletmeleri, kullanıcıları, abonelikleri, ödemeleri ve platform ayarlarını yönetir.

## Product Purpose

Kafe ve restoranlar için QR kod tabanlı dijital menü, masadan sipariş ve servis yönetimi platformu (SaaS). Misafirin masadaki QR'ı okutmasından işletmenin cirosuna kadar her adım tek üründe ve canlı akar: menü → sepet → sipariş → garson ekranı → servis → hesap → ciro.

**Başarı:** Bir işletme kendi başına kaydolup menüsünü, masalarını ve ekibini kurar. Servis boyunca sipariş, çağrı ve ödeme, sayfa yenilemeden tek akıştan yönetilir. Yönetici ciroyu gün sonunu beklemeden görür. Sahte ya da troll sipariş masa düzenini bozamaz.

**Aşama:** Canlıda çalışan bir demo. Hedef önce gerçek restoranlarda pilot, sonra ticari SaaS.

## Positioning

İki iddia, birlikte:

1. **Masadan ciroya tek canlı akış.** Menü, masadan sipariş, garson ekranı, masa haritası, ödeme takibi ve ciro raporu ayrı araçlar değil, tek ürün. Olaylar ilgili ekranlara anında düşer. Yalnız menü gösteren QR ürünleri bunu söyleyemez.
2. **Sahte siparişe kapalı masa.** Misafir masa durumunu yazamaz, yalnız sinyal üretir; durum kayıtlardan tek bir hesaplayıcıyla çıkar. QR okutmadan sipariş yok; oturum yalnız görüntüleme yetkisiyle başlar, ilk sipariş garsonun onay koduyla yetkilenir. Oturum başına bekleyen talep ve IP/masa başına istek sınırlıdır. Yönetici cihaz engelleyebilir, masanın QR'ını yenileyebilir ve masa geçmişini görebilir.

"Uygulamasız, birkaç dakikada kurulum" bir yetenek, fark iddiası değil: kategoride yaygın.

## Operating Context

- **Misafir:** Kendi telefonu, çoğu zaman mobil veri; orta segment cihaz ve 4G varsayılır. QR masaya özeldir (`/qr/<token>`), menü uygulamasız açılır. Yetki durumları: yalnız görüntüleme → onay bekliyor → yetkili ya da geri alındı.
- **Garson:** Gürültülü, yoğun servis; tek elle, bir bakışta karar. Bildirim sesi tarayıcı kilidi yüzünden bir kez açılmalıdır; ses tek başına yeterli sayılmaz, her bildirimin görsel karşılığı vardır.
- **Yönetici:** Masaüstü ya da tablet. Ürün, kategori ve stok; masalar ve QR kodları; ekip ve davetler; siparişler; ödemeler ve onay bekleyen ödemeler; talepler; engellenen cihazlar; ayarlar; abonelik.
- **Masa QR kodları** panelden üretilip masaya konur; yönetici QR'ı yenileyebilir.
- **Para:** Türk lirası (₺), Türkçe biçim. Hesap açma, bölme ve kapama; nakitte para üstü; bazı ödemeler yönetici onayına düşer.
- **Abonelik:** 14 günlük deneme, ardından plan (Başlangıç / Profesyonel / Kurumsal). Planlar masa, garson ve ürün sınırlarını, rapor ve ödeme özelliklerini belirler. Ödeme altyapısı iyzico abonelik API'si.
- **Demo:** Landing'den misafir olarak `/demo`, garson ve yönetici olarak demo girişleri. Demoda garson 20 sn içinde onaylamazsa sistem onaylar; boşta kalan masa 30 dk sonra kapanır.

## Capabilities and Constraints

**Yetenekler (main):** QR menü; masadan sipariş; canlı ve sesli garson ekranı; masa haritası; hizmet talepleri (garson çağrısı, sipariş talebi, ürün bilgisi, ödeme, temizlik, yardım, şikâyet/öneri); sipariş durumu ve gerekçeli iptal ya da ret; ödeme takibi ve onay akışı; ciro raporu; ürün, kategori ve stok; ekip daveti ve role göre erişim; cihaz engelleme; süper admin paneli.

**Terimler (arayüzdeki adlarıyla):**

- Roller: Misafir, Garson, Yönetici, Süper admin.
- Masa durumları: Boş, Dolu, Sipariş Var, Hazırlanıyor, Servis Edildi, Garson Bekleniyor, Ödeme İsteniyor, Temizlik.
- Hesap durumları: Ödendi, Kısmi ödendi.
- Diğer: sipariş talebi, garson çağrısı, hesap isteği, onay kodu, adisyon, ciro, stokta yok.

**Kısıtlar:**

- Yalnız Türkiye ve yalnız Türkçe (`lang="tr"`, `tr_TR`). Hitap "siz". Hata mesajı teknik değildir ve ne yapılacağını söyler ("Lütfen QR kodu tekrar okutun.").
- Mobil önce; 320 px genişlikte yatay kaydırma yok.
- Performans bütçesi CI'da: her rotada ilk yük JS ≤ 200 KB gzip; müşteri menüsü hedefi ≤ 160 KB; ilk ekran JS'yi beklemeden görünür. Yeni bağımlılık bu bütçeye karşı tartılır.
- Ücretli satış henüz açık değil, iyzico sandbox'ta. Açık kayıt da ticari satış başlayana kadar kapatılacak (bayraklı kapı henüz main'de değil). Yüzeyler satın alma ya da kesin fiyat vaadi vermez.

**Açık kararlar:**

- Marka adı (bkz. Brand Commitments).
- Plan fiyatları kodda örnek (299 / 599 / 1199 ₺ aylık); süper admin değiştirebilir, kesinleşmedi.
- Konum kilidi yalnız plan bayrağı (`hasLocationLock`); özellik uygulanmadı.
- Hukuki sayfalar (koşullar, gizlilik, çerez, iade) henüz yayında değil. Yüzeyler var olmayan bir sayfaya bağlantı vermez, uyumluluk iddia etmez.
- Alan adı alınmadı; canlı adres geçici: `qr-menu-product.onrender.com`.

## Brand Commitments

- **Ad: açık karar.** Geçici ad "QR Menü Platformu" (site başlığı, OG adı); logo kelime işareti "QRMenü". Ana fikir "Dijital Dönüşüm + Vizyon". Yeni ad Türkçede akıcı olmalı: açık heceler, ünsüz yığılması ve yan yana ünlü yok. Ad seçilince bu bölüm güncellenir.
- **Kişilik:** Ürün hem işletme sahibine hem misafire vizyoner ve yenilikçi hissettirmeli; "sıradan bir QR menü" gibi değil.
- **Ses:** Kısa, somut, Türkçe; teknik jargon yok; "siz" hitabı.
- **Varlıklar:** Logo bileşenleri `src/components/brand/` (BrandLogo, BrandMark, QrGlyph); masa QR kartı `public/brand/qr-card.svg`.

## Evidence on Hand

- **Canlı demo:** `qr-menu-product.onrender.com`. Demo işletmesinde (10 masa, 16 ürün) misafir, garson ve yönetici akışları gerçek ürünle denenebilir. Ürün görseli gerektiğinde bu demonun gerçek ekranları kullanılır.
- **Kalite kanıtı (iç):** CI kapıları (paket bütçesi, axe ile WCAG 2.2 AA, Lighthouse, Web Vitals), jsx-a11y lint kapısı, kiracı yalıtımı ve masa eşzamanlılığı testleri. Bunlar mühendislik kanıtıdır, pazarlama iddiası değil.
- **Örnek veri:** Demo menüsü ve `prisma/seed-mesela-coffe.ts`. İkisi de demo ve geliştirme verisidir, müşteri kanıtı değildir.
- **Yok, üretilmez:** 2026-11-07 itibarıyla canlıda gerçek işletme yok; yalnız demo ve test hesapları var. Gerçek müşteri, pilot sonucu, yorum, müşteri logosu, kullanım sayısı, puan ya da basın yok. Landing'deki "5 dk kurulum" ölçülmedi; ölçülene kadar kanıt gibi öne çıkarılmaz.

## Product Principles

1. **Tek akışa bağlan.** Her yeni özellik masadan ciroya uzanan canlı akışın bir halkası olur. Yenileme ya da elle eşitleme isteyen ayrı bir ekran açılmaz.
2. **Misafir sinyal üretir, durumu kayıtlar belirler.** Misafir eylemi masa ya da sipariş durumunu doğrudan değiştirmez. Güven adımları (QR kanıtı, onay kodu) akışın görünür ve anlaşılır bir parçasıdır, engel gibi hissettirilmez.
3. **Servis anına göre tasarla.** Garson ekranı yoğun saatte bir bakışta okunur ve az adımla iş görür. Misafir akışı orta segment telefonda, mobil veriyle, uygulamasız çalışır.
4. **Küçük işletme kendi başına kurar.** Kayıt, menü, masa ve ekip kurulumu eğitim ya da kurulum görüşmesi gerektirmeden tamamlanır; her metin sade Türkçedir.
5. **Vizyoner his, hızlı teslim.** Fark yaratan, geleceğe dönük dokunuşlar seçilir, ama yalnız mevcut altyapıyla kısa sürede teslim edilebilenler. Uzun soluklu ya da riskli fikirler sonraya kalır.

## Accessibility & Inclusion

- Hedef WCAG 2.2 AA. CI'da axe (landing, giriş, menü, yönetici ve garson ekranları) ve jsx-a11y kapısı build'i kırar.
- Semantik HTML; her alanın görünür ve programatik olarak bağlı etiketi; görünür `:focus-visible`; yalnız klavyeyle, tuzaksız kullanım; modallar yerel `<dialog>`.
- Durum ve hatalar `aria-live` ya da `role="alert"` ile duyurulur. Anlam yalnız renkle ya da yalnız sesle verilmez.
- AA kontrast; `prefers-reduced-motion` ve zorunlu renk modu desteklenir; 5 sn'den uzun otomatik hareket yok.
- Dokunma hedefi en az 24 px, ideal 44 px; metin rem; %200 yakınlaştırmada ve 320 px'de yatay kaydırma yok.
- Sayfa başına tek `h1`, atlanmayan başlık seviyeleri; ilk odaklanabilir öğe "Ana içeriğe geç" bağlantısı.
