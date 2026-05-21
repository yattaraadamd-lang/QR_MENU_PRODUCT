# 🍽️ QR Menü Platformu

QR kod tabanlı modern dijital menü ve hizmet yönetim sistemi. Müşteriler QR kod okutarak menüye erişir, sipariş verir ve hizmet talep eder. Garsonlar ve yöneticiler siparişleri ve talepleri gerçek zamanlı takip eder.

[![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)](https://github.com/yourusername/qr-menu-platform)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)

## ✨ Özellikler

### 👥 Müşteri Tarafı
- 📱 QR kod ile anında menüye erişim
- 🔒 **Güvenli oturum sistemi (QR token ile)**
- 🍽️ Kategorilere ayrılmış ürün listeleme
- 📦 **Stok durumu gösterimi ("Stokta yok" etiketi)**
- 🛒 Sepete ekleme ve sipariş verme
- 📝 **Özel not ve istenmeyen malzeme bildirimi**
- 🙋 Garson çağırma
- 💳 Ödeme talebi
- ℹ️ Detaylı ürün bilgileri (içerik, alerjen)

### 👨‍🍳 Garson Paneli
- 📋 Gerçek zamanlı sipariş takibi
- 🔔 **Anlık bildirimler (tekrar etmeyen, farklı seslerle)**
- 🪑 Masa durumu görüntüleme
- ✅ Sipariş ve talep durumu güncelleme
- 🔄 **Sipariş durumu değiştiğinde masa durumu otomatik güncellenir**
- 📊 Aktif/tamamlanan filtreleme
- 📝 Müşteri notlarını görüntüleme

### 👔 Admin Paneli
- 📊 Dashboard ve istatistikler
- 🍽️ **Ürün yönetimi (ekleme, düzenleme, silme, stok durumu)**
- 📂 Kategori yönetimi
- 🪑 **Masa yönetimi (ekleme, silme)**
- 👥 **Personel yönetimi (ekleme, silme, aktif/pasif yapma)**
- ❌ **Sipariş iptal etme**
- 🎫 Garson davet kodu oluşturma
- 📋 Tüm siparişleri görüntüleme

### 🔒 Güvenlik Özellikleri
- 🎫 **QR token tabanlı oturum sistemi**
- ⏱️ **Token süresi kontrolü (4 saat)**
- 🚫 **İşletme dışından sipariş engelleme**
- 🔐 Bcrypt ile şifre hashleme
- 🛡️ NextAuth.js ile güvenli session yönetimi
- 🔑 Rol tabanlı yetkilendirme
- 🛡️ SQL injection koruması (Prisma)
- 🛡️ XSS koruması (React)

## 🚀 Kurulum

### Gereksinimler

- Node.js 18+ ([nodejs.org](https://nodejs.org))
- PostgreSQL 14+ ([postgresql.org](https://www.postgresql.org/download/))
- npm veya yarn

### 1. Projeyi İndirin

```bash
cd c:\Users\Vatan\PROJELER\qr-menu-platform
```

### 2. Bağımlılıkları Yükleyin

```bash
npm install
```

### 3. PostgreSQL Veritabanı Oluşturun

PostgreSQL'e bağlanın ve veritabanı oluşturun:

```sql
CREATE DATABASE qr_menu_db;
```

### 4. Ortam Değişkenlerini Ayarlayın

`.env.local` dosyasını düzenleyin:

```env
# PostgreSQL bağlantı bilgilerinizi girin
DATABASE_URL="postgresql://kullanici:sifre@localhost:5432/qr_menu_db"

# NextAuth için güvenli bir secret key oluşturun
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="buraya-guclu-bir-secret-key-girin"

# Uygulama URL'i
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

**Secret key oluşturmak için:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**⚠️ GÜVENLİK UYARISI:**
- `.env`, `.env.local`, `.env.production` dosyaları **ASLA** git'e commit edilmemelidir
- Production secret'ları sadece hosting platformunda (Vercel, AWS, vb.) environment variables olarak saklayın
- Her ortam için farklı secret'lar kullanın
- Secret'ları düzenli olarak rotate edin

### 5. Veritabanını Hazırlayın

```bash
# Prisma client oluştur
npm run db:generate

# Veritabanı şemasını oluştur
npm run db:push

# Demo verileri yükle
npm run db:seed
```

### 6. Uygulamayı Başlatın

```bash
npm run dev
```

Uygulama [http://localhost:3000](http://localhost:3000) adresinde çalışacak.

## 🎯 Demo Hesaplar

Seed işleminden sonra kullanabileceğiniz demo hesaplar:

### Admin
- **E-posta:** admin@demo.com
- **Şifre:** admin123

### Garson
- **E-posta:** garson@demo.com
- **Şifre:** garson123

### Garson Davet Kodu
- **Kod:** DEMO2024

## 📱 Kullanım

### Müşteri Olarak Test

1. Tarayıcıda şu adresi açın: `http://localhost:3000/menu/demo-business-id/1`
2. Bu Masa 1'in menüsünü gösterir
3. Ürünleri sepete ekleyin ve sipariş verin
4. Garson çağırma veya ödeme butonlarını test edin

### Garson Olarak Test

1. `http://localhost:3000/auth/signin` adresine gidin
2. Garson hesabıyla giriş yapın
3. Siparişler ve talepler gerçek zamanlı görünecek
4. Sipariş durumlarını güncelleyin

### Admin Olarak Test

1. `http://localhost:3000/auth/signin` adresine gidin
2. Admin hesabıyla giriş yapın
3. Dashboard'da istatistikleri görün
4. Ürün, masa ve personel yönetimi yapın

## 🗂️ Proje Yapısı

```
qr-menu-platform/
├── prisma/
│   ├── schema.prisma      # Veritabanı şeması
│   └── seed.ts            # Demo veri
├── src/
│   ├── app/
│   │   ├── api/           # API route'ları
│   │   ├── auth/          # Giriş/kayıt sayfaları
│   │   ├── menu/          # Müşteri menü sayfası
│   │   ├── admin/         # Admin paneli
│   │   └── waiter/        # Garson paneli
│   ├── components/        # Yeniden kullanılabilir bileşenler
│   ├── lib/               # Yardımcı fonksiyonlar
│   └── types/             # TypeScript tipleri
├── public/                # Statik dosyalar
└── package.json
```

## 🔧 Teknolojiler

- **Frontend:** Next.js 14, React, Tailwind CSS
- **Backend:** Next.js API Routes
- **Veritabanı:** PostgreSQL + Prisma ORM
- **Auth:** NextAuth.js
- **TypeScript:** Tip güvenliği

## 📋 Önemli Özellikler

### 🔒 QR Token Güvenlik Sistemi
- Her QR kod okutulduğunda benzersiz token oluşturulur
- Token 4 saat geçerlidir
- İşletme dışından sipariş verme engellenir
- Güvenli oturum yönetimi

### 📦 Stok Yönetimi
- Ürünlerde 3 stok durumu: Stokta var, Stokta yok, Geçici olarak mevcut değil
- Stokta olmayan ürünler "Stokta yok" etiketi ile gösterilir
- Stokta olmayan ürünler sepete eklenemez
- Admin stok durumunu kolayca güncelleyebilir

### 🔄 Sipariş ve Masa Senkronizasyonu
Sipariş durumu değiştiğinde masa durumu otomatik güncellenir:
- **PENDING/ACCEPTED** → Masa: Sipariş Var
- **PREPARING** → Masa: Hazırlanıyor
- **SERVED** → Masa: Servis Edildi
- **CANCELLED** → Masa: Dolu

### 📝 Müşteri Notları
- Müşteri sipariş verirken özel not ekleyebilir
- İstenmeyen malzemeler bildirilebilir
- Notlar garson ve mutfak ekranında görünür
- Örnek: "Soğansız olsun", "Acısız", "Alerjim var"

### ❌ Sipariş İptal Sistemi
- Admin siparişleri iptal edebilir
- İptal nedeni kaydedilir
- İptal edilen siparişler raporlardan düşer
- Masa durumu otomatik güncellenir

### 👥 Gelişmiş Personel Yönetimi
- Admin yeni garson ekleyebilir
- Garson silinebilir (soft delete)
- Garson aktif/pasif yapılabilir
- Silinen garsonların geçmiş sipariş kayıtları korunur
- E-posta benzersizlik kontrolü

### 🪑 Gelişmiş Masa Yönetimi
- Admin yeni masa ekleyebilir
- Masa silinebilir
- Aktif siparişi olan masalar silinemez
- Her masa için benzersiz QR token

### 🔔 Akıllı Bildirim Sistemi
- Yeni sipariş: Yüksek ton ses
- Garson çağrısı: Orta ton ses
- Ödeme talebi: Çift bip ses
- **Eski bildirimlerin tekrar tetiklenmemesi**
- **Sekme değiştirme sonrası ses tekrarı yok**
- Bildirim okundu/ses çalındı takibi

### Gerçek Zamanlı Güncelleme
- Siparişler ve talepler her 5 saniyede otomatik güncellenir
- Yeni sipariş/talep geldiğinde ses bildirimi çalar
- Masa durumları anlık güncellenir

### Masa Durumları
Masa durumları gerçek işlemlere göre otomatik güncellenir (random değil!):
- **Boş (EMPTY):** Kullanılabilir
- **Dolu (OCCUPIED):** Müşteri oturdu
- **Sipariş Var (HAS_ORDER):** Sipariş verildi
- **Hazırlanıyor (PREPARING):** Sipariş hazırlanıyor
- **Servis Edildi (SERVED):** Sipariş teslim edildi
- **Garson Bekleniyor (WAITING_WAITER):** Garson çağrıldı
- **Ödeme İstendi (PAYMENT_REQUESTED):** Ödeme talebi var
- **Temizlik Gerekli (CLEANING_NEEDED):** Temizlenmeli

## 🚀 Production Deployment

### Vercel (Önerilen)

Bu proje Next.js 14 ile yapıldı ve Vercel'e deploy için optimize edildi.

**Hızlı Deployment (5 dakika):**

1. GitHub'a yükle
2. https://vercel.com → Import Project
3. Environment variables ekle
4. Deploy!

**Detaylı Rehber:** [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md)  
**Hızlı Rehber:** [HIZLI_VERCEL_DEPLOYMENT.md](HIZLI_VERCEL_DEPLOYMENT.md)

### Gerekli Environment Variables

```env
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
NEXTAUTH_SECRET=your-secret-key-32-chars-min
NEXTAUTH_URL=https://your-project.vercel.app
NEXT_PUBLIC_APP_URL=https://your-project.vercel.app
```

### Ücretsiz Veritabanı Seçenekleri

- **Neon** (3 GB) - Önerilen ⭐
- **Vercel Postgres** (256 MB)
- **Supabase** (500 MB)
- **Railway** ($5 kredi/ay)

---

## 🛠️ Geliştirme Komutları

```bash
# Geliştirme sunucusu
npm run dev

# Production build
npm run build

# Production sunucusu
npm start

# Prisma Studio (veritabanı GUI)
npm run db:studio

# Veritabanı migration
npm run db:migrate

# Linting
npm run lint
```

## 📝 Yapılacaklar (Gelecek Özellikler)

### Kısa Vadeli (v1.2.0)
- [ ] Mutfak/Aşçı ekranı (siparişlerin mutfağa düşmesi)
- [ ] QR kod yenileme sistemi
- [ ] Ürün görselleri yükleme
- [ ] Gelişmiş raporlama ve analitik
- [ ] Dashboard istatistikleri iyileştirmeleri

### Orta Vadeli (v2.0.0)
- [ ] Online ödeme entegrasyonu (Stripe, iyzico)
- [ ] WhatsApp bildirim entegrasyonu
- [ ] E-posta bildirimleri
- [ ] Kampanya ve indirim yönetimi
- [ ] Müşteri yorumları ve puanlama
- [ ] Çoklu dil desteği (TR, EN, DE)

### Uzun Vadeli (v3.0.0)
- [ ] Çoklu işletme desteği (SaaS)
- [ ] Gelişmiş stok yönetimi
- [ ] Personel performans takibi
- [ ] Müşteri sadakat programı
- [ ] Rezervasyon sistemi
- [ ] Mobil uygulama (React Native)

## 📚 Dokümantasyon

- 📖 [PROJE_OZETI.md](PROJE_OZETI.md) - Detaylı proje özeti
- 🔧 [API_DOCUMENTATION.md](API_DOCUMENTATION.md) - API endpoint'leri
- 🔒 [SECURITY.md](SECURITY.md) - Güvenlik dokümantasyonu
- 📝 [CHANGELOG.md](CHANGELOG.md) - Değişiklik günlüğü
- 🔄 [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) - Migrasyon rehberi
- 📋 [KURULUM.md](KURULUM.md) - Detaylı kurulum talimatları

## 🆕 v1.1.0 Yenilikleri

### Güvenlik
- ✅ QR token tabanlı oturum sistemi
- ✅ İşletme dışından sipariş engelleme
- ✅ Token süresi kontrolü (4 saat)

### Özellikler
- ✅ Stok yönetimi sistemi
- ✅ Sipariş iptal etme
- ✅ Müşteri notları ve istenmeyen malzeme bildirimi
- ✅ Personel ekleme/silme
- ✅ Masa ekleme/silme
- ✅ Sipariş-masa durumu senkronizasyonu
- ✅ Bildirim tekrar tetiklenme sorunu düzeltildi

Detaylı değişiklikler için [CHANGELOG.md](CHANGELOG.md) dosyasına bakın.

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit yapın (`git commit -m 'feat: Add amazing feature'`)
4. Push edin (`git push origin feature/amazing-feature`)
5. Pull Request açın

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır.

## 💡 Destek

Sorularınız için:
- Issue açın
- E-posta gönderin

---

**Not:** Bu proje production-ready durumdadır. Gerçek işletmelerde kullanılabilir. Production ortamında kullanmadan önce [SECURITY.md](SECURITY.md) dosyasını inceleyin ve gerekli güvenlik ayarlarını yapın.

**Versiyon:** 1.1.0  
**Son Güncelleme:** 2024-05-13  
**Durum:** ✅ Production Ready
