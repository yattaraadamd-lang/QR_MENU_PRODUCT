# 🔧 RENDER MANUAL FIX - npm ci Sorunu Çözümü

## Problem
Render platformu `render.yaml` dosyasındaki buildCommand'ı görmezden geliyor ve otomatik olarak `npm ci` kullanıyor. Bu da package-lock.json olmadığı için başarısız oluyor.

## ✅ ÇÖZÜM: Render Dashboard'dan Manuel Ayar

### Adım 1: Render Dashboard'a Git
1. https://dashboard.render.com/ adresine git
2. Giriş yap
3. **qr-menu-platform** servisini seç

### Adım 2: Build Command'ı Manuel Olarak Ayarla
1. Sol menüden **Settings** sekmesine git
2. **Build & Deploy** bölümünü bul
3. **Build Command** alanını bul

### Adım 3: Build Command'ı Güncelle

**ESKİ** (Render'ın otomatik belirlediği):
```
npm ci && npm run build
```

**YENİ** (Manuel olarak şunu yaz):
```
npm run render-build
```

VEYA direkt:
```
npm install && npm run db:deploy && npm run build
```

### Adım 4: Değişiklikleri Kaydet
1. **Save Changes** butonuna bas
2. Render otomatik olarak yeni bir deployment başlatacak

### Adım 5: Manual Deploy (Opsiyonel)
Eğer otomatik başlamazsa:
1. Sağ üstteki **Manual Deploy** butonuna bas
2. **Deploy latest commit** seç
3. **Clear build cache & deploy** seçeneğini işaretle (önemli!)

---

## 🎯 Beklenen Sonuç

Build sequence şu olmalı:
```bash
✅ npm install                 # package.json'dan dependencies yükle
✅ npm run db:deploy          # Prisma migrations uygula
✅ npm run build              # Next.js production build
✅ npm start                  # Server başlat
```

## ⚠️ Dikkat Edilecekler

### Environment Variables
Build başlamadan önce şu env variable'ların tanımlı olduğundan emin ol:

```
✅ NODE_ENV=production
✅ DATABASE_URL (pooled connection)
✅ DATABASE_URL_UNPOOLED (direct connection - migrations için)
✅ NEXTAUTH_SECRET
✅ NEXTAUTH_URL (örn: https://qr-menu-platform.onrender.com)
✅ NEXT_PUBLIC_APP_URL (örn: https://qr-menu-platform.onrender.com)
```

**CRITICAL**: `DATABASE_URL_UNPOOLED` eksikse migration başarısız olur!

### Build Logs
Deployment sırasında logs'u takip et:
1. Render Dashboard → **Logs** sekmesi
2. Build başladığında şunları görmelisin:
   ```
   ==> Building...
   ==> Running 'npm run render-build'
   > npm install
   added XXX packages
   > npm run db:deploy
   Migration applied successfully
   > npm run build
   ✓ Compiled successfully
   ```

3. **Görmemen gereken**:
   ```
   ❌ npm ci can only install...
   ❌ Missing: fsevents@2.3.3...
   ```

---

## 🧪 Deployment Sonrası Test

### 1. Health Check
```bash
curl https://qr-menu-platform.onrender.com/api/health
```
**Beklenen**:
```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2026-08-04T..."
}
```

### 2. Schema Diagnostic
```bash
curl https://qr-menu-platform.onrender.com/api/diagnostics/schema
```
**Beklenen**: Tüm column checks `true`

### 3. Web Interface
- Admin dashboard: `/admin`
- Garson panel: `/waiter`
- Test QR code scan

---

## 🔄 Alternatif: render.yaml Kullanılmıyorsa

Eğer Render `render.yaml` dosyasını hiç okumuyorsa:

### Option A: Web Service Ayarları
1. Dashboard → Settings → Build & Deploy
2. **Auto-Deploy** → Enabled
3. **Build Command**: `npm run render-build`
4. **Start Command**: `npm start`

### Option B: Blueprint Mode
1. Dashboard → Settings
2. **Blueprint** veya **Infrastructure as Code** seçeneğini aktif et
3. Repository'deki `render.yaml` dosyasını kullanacak

---

## 📊 Commit Geçmişi

Bu fix için yapılan commitler:
```
b197b21 - fix: add render-build script to bypass npm ci issue
921b523 - docs: update deployment status - package-lock.json removed
b48a978 - temp: remove package-lock.json to fix Render build
```

---

## ❓ Sorun Devam Ederse

### Cache Temizle
1. Render Dashboard → Settings
2. **Clear Build Cache** butonuna bas
3. Yeni bir deploy başlat

### Build Command'ı Kontrol Et
```bash
# Render Dashboard → Settings → Build Command şöyle olmalı:
npm run render-build
```

### Logs'u İncele
```bash
# Build logs'da şunu arat:
"npm ci"

# Eğer görüyorsan, Build Command doğru ayarlanmamış demektir
```

### Destek
Render hala `npm ci` kullanıyorsa:
1. Render Support'a ticket aç
2. "Build command override not working" de
3. `render.yaml` dosyanızı ve ayarlarınızı göster

---

## ✅ Başarı Kriterleri

Build başarılı olduğunda:
- ✅ "npm install" log'da görünür
- ✅ "Migration applied" mesajı var
- ✅ "Compiled successfully" mesajı var
- ✅ Server başladı ve health check çalışıyor
- ✅ Admin ve Garson panelleri yükleniyor

---

**Son Güncelleme**: 4 Ağustos 2026
**Status**: Manuel fix gerekli - Render Dashboard'dan Build Command ayarlanmalı
