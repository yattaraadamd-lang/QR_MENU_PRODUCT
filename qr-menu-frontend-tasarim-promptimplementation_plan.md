# QR Menü Platformu — Front-End Yenileme Planı

Projedeki mevcut backend, auth, Supabase bağlantıları, ödeme akışı, masa durumu ve sipariş yönetimi korunarak **sadece frontend, UI/UX ve kullanıcı akışları** iyileştirilecek.

---

## Mevcut Durum Analizi

### Proje Yapısı
- **Framework:** Next.js 14, TypeScript, Tailwind CSS 3.4
- **Auth:** next-auth (credentials)
- **DB:** Prisma (Supabase)
- **Realtime:** Socket.IO
- **Font:** Inter (Google Fonts — already configured)
- **Routing:** App Router (`/admin`, `/waiter`, `/menu/[businessId]/[tableNumber]`, `/auth/signin`, `/auth/register`)

### Mevcut Sorunlar
1. Landing page dark-theme, SaaS ürün tanıtımı yerine generic bir "Geleceğin Dijital Menü Platformu" hero var
2. Demo akışı yok — "Demoyu Deneyin" butonu `/auth/register`'a yönlendiriyor
3. Login sayfası temel çalışıyor ama profesyonel yönetim paneli hissi yok
4. Müşteri menüsü çalışıyor ama Tailwind utility class'larıyla CSS karışmış
5. Garson/Admin panelleri işlevsel ama component tekrarı fazla, toast/modal/badge tutarsız
6. Renk şeması **Bordo/Kırmızı** — prompt **Amber/Turuncu** istiyor
7. Reusable UI component'ler (`Button`, `Card`, `Badge`, `Modal`, `Toast`, `Input`, `Table`) yok — her sayfa inline style ile tekrar tekrar tanımlıyor

---

## User Review Required

> [!IMPORTANT]
> **Renk Şeması Değişikliği:** Mevcut tema bordo/kırmızı (primary: #B91C1C). Prompt amber/turuncu (primary: #D97706) istiyor. Bu değişiklik tüm butonlar, kartlar ve vurgu renklerini etkileyecektir. **Onaylıyor musunuz?** Yoksa mevcut bordo tema mı korunsun?

> [!IMPORTANT]
> **Yeni Bağımlılıklar:** Prompt'ta `shadcn/ui`, `Framer Motion`, `Sonner Toast`, `Recharts`, `React Hook Form`, `TanStack Table` gibi kütüphaneler önerilmiş. Mevcut projede sadece `zod` var. Gereksiz bağımlılık eklenmemeli diyor ama bazıları ciddi fayda sağlar. Şu yaklaşımı öneriyorum:
> - ✅ **Lucide React Icons** — emoji yerine tutarlı ikonlar (hafif)
> - ✅ **Sonner** — toast bildirimleri için (küçük, kaliteli)
> - ❌ shadcn/ui, Framer Motion, Recharts, TanStack Table, React Hook Form — **eklenmeyecek** (mevcut yapıda gereksiz karmaşıklık yaratır)
>
> **Bu yaklaşımı onaylıyor musunuz?**

---

## Open Questions

> [!IMPORTANT]
> **Demo Akışı:** Prompt'ta `/demo`, `/customer-demo`, `/waiter-demo`, `/admin-demo` sayfaları istenmiş. Ancak mevcut middleware sadece `/admin` ve `/waiter` rotalarını auth ile koruyor. Demo sayfaları **mevcut auth yapısını bypass** etmeli mi, yoksa demo kullanıcı hesaplarıyla giriş yapılarak mı demo gösterilmeli? Önerim: Demo butonları doğrudan login sayfasındaki "Demo" bilgilerini otomatik doldurup giriş yapsın.

> [!IMPORTANT]
> **Ödeme Ekranı Para Üstü:** Prompt'ta garson ödeme ekranında "Müşteriden Alınan Para" ve "Para Üstü" alanları istenmiş. Mevcut backend'de bu alanlar var mı kontrol edilmeli. Eğer yoksa sadece frontend'de hesaplama yapılabilir (backend'e sadece gerçek tutar gider).

---

## Proposed Changes

### Faz 1: Design System & Reusable Components

Bu faz tüm diğer fazların temelini oluşturur. Tutarlı bir design system ve tekrar kullanılabilir component'ler oluşturulacak.

---

#### [MODIFY] [globals.css](file:///c:/Users/Vatan/Desktop/QR_Menu_Platform/ANTIGRAVITY/QR_MENU_PRODUCT%20Mantıklı%20olan/qr-menu-platform/src/app/globals.css)

CSS değişken sistemi güncellenecek:
- Primary renk → Amber/Orange (#D97706) olarak değiştirilecek (kullanıcı onayı ile)
- Accent renk → bordo olarak korunabilir veya teal/blue
- Landing page için açık tema değişkenleri eklenecek
- Yeni animation'lar (float, gradient-shift) eklenecek
- Toast, empty-state, error-state utility class'ları eklenecek
- Mobile-first responsive helper class'ları genişletilecek
- `min-height: 44px` mobil buton kuralı global yapılacak

#### [MODIFY] [tailwind.config.ts](file:///c:/Users/Vatan/Desktop/QR_Menu_Platform/ANTIGRAVITY/QR_MENU_PRODUCT%20Mantıklı%20olan/qr-menu-platform/tailwind.config.ts)

- Primary renk skalası amber/orange'a güncellenecek
- Coffee palette korunacak (admin/garson dark theme için)
- Yeni `animation` ve `keyframes` tanımları eklenecek

---

#### [NEW] `src/components/ui/Button.tsx`
Reusable buton component'i:
- Variants: `primary`, `accent`, `success`, `danger`, `warning`, `ghost`, `subtle`
- Sizes: `sm`, `md`, `lg`, `xl`, `icon`
- Loading state (spinner + disabled)
- TypeScript props: `variant`, `size`, `loading`, `disabled`, `leftIcon`, `rightIcon`

#### [NEW] `src/components/ui/Card.tsx`
- Variants: `default`, `flat`, `stat`, `glass`
- Hover efekti opsiyonel

#### [NEW] `src/components/ui/Badge.tsx`
- Variants: `primary`, `accent`, `success`, `danger`, `warning`, `info`, `purple`, `neutral`
- Size: `sm`, `md`
- Dot prefix opsiyonel

#### [NEW] `src/components/ui/Modal.tsx`
- Overlay + content wrapper
- `onClose` callback
- `title` prop
- Bottom-sheet variant (mobil)
- Confirm modal variant (silme/iptal/ödeme işlemleri için)

#### [NEW] `src/components/ui/Input.tsx`
- Label, placeholder, error message
- Password show/hide toggle
- `leftIcon`, `rightIcon` props

#### [NEW] `src/components/ui/Toast.tsx`
- Context-based toast provider
- `useToast()` hook
- Variants: `success`, `error`, `warning`, `info`
- Auto-dismiss timer
- Tüm sayfalar için tek toast sistemi (mevcut her sayfa kendi toast'ını yönetiyor)

#### [NEW] `src/components/ui/EmptyState.tsx`
- Icon, title, description, action button
- Tüm boş liste durumlarında kullanılacak

#### [NEW] `src/components/ui/Skeleton.tsx`
- Loading placeholder
- Variants: `text`, `card`, `table-row`

#### [NEW] `src/components/ui/ConfirmDialog.tsx`
- Silme/iptal işlemleri için onay modalı
- `title`, `description`, `confirmText`, `cancelText`, `variant` (danger, warning)

---

### Faz 2: Landing Page & Login Ekranı

---

#### [MODIFY] [page.tsx](file:///c:/Users/Vatan/Desktop/QR_Menu_Platform/ANTIGRAVITY/QR_MENU_PRODUCT%20Mantıklı%20olan/qr-menu-platform/src/app/page.tsx)

Mevcut dark-theme hero tamamen yeniden yazılacak. Yeni yapı:

1. **Navbar** — Logo + "Demoyu Deneyin" + "Giriş Yapın" butonları, sticky, glassmorphism
2. **Hero Section** — Açık arka plan, amber vurgu renkli başlık, iki CTA butonu
   - Başlık: "Restoran ve Kafeler İçin Modern QR Menü Sistemi"
   - Alt açıklama: Kısa ve net
   - CTA: "Demoyu Deneyin" (primary) + "Giriş Yapın" (outline)
3. **Özellikler Grid** — 8 özellik kartı (ikonlu, kısa açıklamalı)
   - QR Menü, Online Sipariş, Garson Paneli, Admin Paneli, Masa Yönetimi, Ödeme Takibi, Ciro Raporlama, Ürün Yönetimi
4. **Demo Seçim Alanı** — 3 demo kartı (Müşteri, Garson, Admin)
5. **Nasıl Çalışır** — 3 adımlı anlatım
6. **Footer** — Minimal, güven veren kapanış

Tasarım dili:
- Açık arka plan (slate-50)
- Beyaz kartlar
- Amber/turuncu vurgu rengi
- Soft shadow, rounded-2xl
- Smooth scroll animasyonları

#### [MODIFY] [signin/page.tsx](file:///c:/Users/Vatan/Desktop/QR_Menu_Platform/ANTIGRAVITY/QR_MENU_PRODUCT%20Mantıklı%20olan/qr-menu-platform/src/app/auth/signin/page.tsx)

- Açık tema, profesyonel yönetim paneli giriş hissi
- Logo/sistem adı
- Email + Şifre alanları (yeni Input component'i ile)
- Şifre göster/gizle
- Loading state
- Kullanıcı dostu hata mesajları
- Demo bilgileri hint alanı korunacak ama daha şık
- "Kayıt Ol" linki korunacak

---

### Faz 3: Müşteri QR Menü Arayüzü

---

#### [MODIFY] [menu/[businessId]/[tableNumber]/page.tsx](file:///c:/Users/Vatan/Desktop/QR_Menu_Platform/ANTIGRAVITY/QR_MENU_PRODUCT%20Mantıklı%20olan/qr-menu-platform/src/app/menu/%5BbusinessId%5D/%5BtableNumber%5D/page.tsx)

Bu 618 satırlık dev dosya parçalanacak ve yeniden düzenlenecek:

#### [NEW] `src/components/customer/MenuHeader.tsx`
- İşletme adı, logo, masa numarası
- Gradient header

#### [NEW] `src/components/customer/CategoryTabs.tsx`
- Yatay kaydırılabilir kategori filtreleri
- Aktif kategori vurgusu

#### [NEW] `src/components/customer/ProductCard.tsx`
- Ürün fotoğrafı (placeholder), ad, açıklama, fiyat
- Stok durumu badge
- Alerjen bilgisi
- "Sepete Ekle" butonu
- Touch-friendly (44px min)

#### [NEW] `src/components/customer/CartDrawer.tsx`
- Mobil: Bottom sheet
- Desktop: Sidebar
- Ürün listesi, miktar +/-, toplam, not alanı
- "Siparişi Gönder" butonu (loading state)

#### [NEW] `src/components/customer/OrderStatusCard.tsx`
- Sipariş durumu gösterimi
- Animasyonlu durum geçişleri

#### [NEW] `src/components/customer/ServiceMenu.tsx`
- Garson çağır, ödeme iste, yardım butonları
- Spam engelleme (disable + cooldown)
- Aktif talep durumu gösterimi

Ana sayfa dosyası bu component'leri import edecek ve state yönetimini yapacak. Dosya boyutu ~618 → ~200 satıra düşecek.

---

### Faz 4: Garson Paneli

---

#### [MODIFY] [waiter/layout.tsx](file:///c:/Users/Vatan/Desktop/QR_Menu_Platform/ANTIGRAVITY/QR_MENU_PRODUCT%20Mantıklı%20olan/qr-menu-platform/src/app/waiter/layout.tsx)

- Yeni UI component'ler kullanılacak
- Bildirim paneli `NotificationPanel` component'ine taşınacak
- Bottom nav badge'ları yeni Badge component'i ile

#### [MODIFY] [waiter/page.tsx](file:///c:/Users/Vatan/Desktop/QR_Menu_Platform/ANTIGRAVITY/QR_MENU_PRODUCT%20Mantıklı%20olan/qr-menu-platform/src/app/waiter/page.tsx)

- Sipariş kartları `OrderCard` component'ine taşınacak
- Reject/Cancel modaller `ConfirmDialog` ile yapılacak
- Toast bildirimleri merkezi Toast sistemi ile

#### [NEW] `src/components/waiter/OrderCard.tsx`
- Masa numarası büyük ve net
- Sipariş kalemleri
- Renkli durum badge'ı (Sarı/Mavi/Yeşil/Kırmızı/Turuncu)
- Aksiyon butonları (ikon + metin)
- Per-card loading state

#### [NEW] `src/components/waiter/TableStatusCard.tsx`
- Masa durumu kartı

#### [NEW] `src/components/waiter/PaymentCard.tsx`
- Ödeme talebi kartı
- Tutar gösterimi
- "Ödemeyi Al" butonu

#### [NEW] `src/components/waiter/NotificationPanel.tsx`
- Bildirim kartları (okundu/okunmadı)
- Öncelik rengi
- Masa numarası + zaman
- Aksiyon butonu

#### [MODIFY] [waiter/payments/page.tsx](file:///c:/Users/Vatan/Desktop/QR_Menu_Platform/ANTIGRAVITY/QR_MENU_PRODUCT%20Mantıklı%20olan/qr-menu-platform/src/app/waiter/payments/page.tsx)

- Ödeme ekranı detaylandırılacak:
  - Ödenmesi gereken tutar
  - Müşteriden alınan para input'u
  - Para üstü (otomatik hesaplama)
  - Ciroya yansıyacak tutar açıklaması
  - Ödeme yöntemi seçimi
  - "Ödemeyi Onayla" butonu (loading + confirm)
- `alert()` yerine Toast + ConfirmDialog

---

### Faz 5: Admin Paneli

---

#### [MODIFY] [admin/layout.tsx](file:///c:/Users/Vatan/Desktop/QR_Menu_Platform/ANTIGRAVITY/QR_MENU_PRODUCT%20Mantıklı%20olan/qr-menu-platform/src/app/admin/layout.tsx)

- Sidebar yeni UI component'ler ile
- Brand alanı profesyonelleştirilecek
- Mobile topbar iyileştirilecek

#### [MODIFY] [admin/page.tsx](file:///c:/Users/Vatan/Desktop/QR_Menu_Platform/ANTIGRAVITY/QR_MENU_PRODUCT%20Mantıklı%20olan/qr-menu-platform/src/app/admin/page.tsx)

- Dashboard kartları `DashboardStatCard` component'i ile
- Son siparişler tablosu iyileştirilecek
- Quick links grid iyileştirilecek
- Emoji ikonlar → Lucide ikonlar

#### [NEW] `src/components/admin/DashboardStatCard.tsx`
- İkon, başlık, değer, renk
- Accent bar
- Hover efekti

#### [MODIFY] [admin/products/page.tsx](file:///c:/Users/Vatan/Desktop/QR_Menu_Platform/ANTIGRAVITY/QR_MENU_PRODUCT%20Mantıklı%20olan/qr-menu-platform/src/app/admin/products/page.tsx)

- Ürün tablosu yeni Table component'i ile
- `confirm()` → ConfirmDialog
- Toast → merkezi Toast
- Arama ve filtre alanı iyileştirilecek
- Empty state → EmptyState component'i

#### Admin Sub-Pages (aynı pattern)
Aşağıdaki sayfalar da aynı şekilde yeni component'ler ile güncellenecek:
- `admin/categories/page.tsx`
- `admin/orders/page.tsx`
- `admin/staff/page.tsx`
- `admin/payments/page.tsx`
- `admin/pending-payments/page.tsx`
- `admin/tables/page.tsx`
- `admin/requests/page.tsx`
- `admin/settings/page.tsx`

---

### Faz 6: Polish & Verification

---

#### Global Kontroller
- Tüm `confirm()` çağrıları → ConfirmDialog
- Tüm inline toast → merkezi Toast
- Tüm `alert()` çağrıları → Toast
- Tüm emoji ikonlar → Lucide ikonlar (opsiyonel, ikonların tutarlılığı için)
- Loading state her işlem sırasında doğru çalışıyor mu?
- Empty state tüm listelerde var mı?
- Error state tüm fetch çağrılarında var mı?
- Mobilde butonlar 44px minimum mi?

---

## Verification Plan

### Automated Tests
```bash
# TypeScript hata kontrolü
npx tsc --noEmit

# Build kontrolü
npm run build

# Lint kontrolü
npm run lint
```

### Manual Verification
- [ ] Landing page açık tema, modern SaaS görünümü
- [ ] Demo butonları doğru çalışıyor
- [ ] Login sayfası profesyonel, hata mesajları kullanıcı dostu
- [ ] Müşteri menüsü mobilde hızlı ve dokunmatik dostu
- [ ] Sepet ve sipariş akışı bozulmamış
- [ ] Garson paneli siparişleri doğru gösteriyor
- [ ] Garson ödeme ekranı net ve açık
- [ ] Admin dashboard KPI kartları doğru
- [ ] Admin ürün/kategori/personel CRUD bozulmamış
- [ ] Socket.IO bildirimleri çalışıyor
- [ ] Responsive: 375px, 768px, 1024px, 1440px test
