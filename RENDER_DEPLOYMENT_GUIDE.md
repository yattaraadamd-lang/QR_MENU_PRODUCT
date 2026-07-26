# 🚀 Render.com Deployment Guide - QR Menu Platform

## 🔍 Deployment Sorununu Teşhis Etme

### 1. Build Log'larını Kontrol Edin

Render Dashboard'da:
1. Service'inizi seçin
2. **"Logs"** sekmesine gidin
3. **"Deploy"** log'larını inceleyin

### Yaygın Hatalar ve Çözümleri:

#### ❌ Hata 1: "prisma generate failed"
**Sebep:** DATABASE_URL environment variable eksik veya yanlış

**Çözüm:**
```bash
# Render Dashboard -> Environment
DATABASE_URL = postgresql://user:password@host:5432/database?schema=public
```

#### ❌ Hata 2: "Module not found: Can't resolve 'socket.io'"
**Sebep:** Dependencies düzgün yüklenmemiş

**Çözüm:**
```bash
# Build Command'i şuna değiştirin:
npm ci && npm run build
```

#### ❌ Hata 3: "Type errors" during build
**Sebep:** Next.js 15 params Promise pattern eksik

**Çözüm:** ✅ Bu proje zaten güncellenmiş durumda (tüm route'lar Promise pattern kullanıyor)

#### ❌ Hata 4: "NEXTAUTH_SECRET is not defined"
**Sebep:** Environment variables eksik

**Çözüm:** Aşağıdaki tüm environment variable'ları ekleyin

---

## 📋 Render.com Deployment Adımları

### Adım 1: Yeni Web Service Oluşturma

1. **Render Dashboard'a gidin:** https://dashboard.render.com/
2. **"New +"** → **"Web Service"** seçin
3. **GitHub repository'nizi bağlayın**
4. Repository seçin: `yattaraadamd-lang/QR_MENU_PRODUCT`

### Adım 2: Service Yapılandırması

#### Basic Settings:
```yaml
Name: qr-menu-platform
Region: Frankfurt (veya size yakın)
Branch: main (veya fix/security-vulnerabilities)
Root Directory: qr-menu-platform
Runtime: Node
```

#### Build & Deploy:
```yaml
Build Command: npm install && npm run build
Start Command: npm start
```

**⚠️ ÖNEMLİ:** Root Directory'yi `qr-menu-platform` olarak ayarlayın çünkü repository'niz monorepo yapısında.

### Adım 3: Environment Variables Ekleme

Render Dashboard → Service → Environment sekmesinden şu değişkenleri ekleyin:

#### Zorunlu Variables:

```bash
# Database
DATABASE_URL = postgresql://user:password@host:5432/dbname?schema=public

# NextAuth
NEXTAUTH_SECRET = [buraya güçlü bir secret key girin]
NEXTAUTH_URL = https://your-app-name.onrender.com

# App URL
NEXT_PUBLIC_APP_URL = https://your-app-name.onrender.com

# Node Environment
NODE_ENV = production
```

#### NEXTAUTH_SECRET Nasıl Oluşturulur:
```bash
# Terminal'de çalıştırın:
openssl rand -base64 32

# Veya Node.js ile:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Adım 4: PostgreSQL Database Oluşturma

1. **Render Dashboard** → **"New +"** → **"PostgreSQL"**
2. Database adı girin: `qr-menu-db`
3. Plan seçin: **Free** (başlangıç için)
4. Region: Web service ile aynı (Frankfurt)
5. **"Create Database"**

Database oluşturulduktan sonra:
1. **"Info"** sekmesinden **Internal Database URL**'yi kopyalayın
2. Web service'inizin **Environment** sekmesine gidin
3. `DATABASE_URL` variable'ına yapıştırın

### Adım 5: Database Migration

İlk deployment'tan sonra database'i migrate etmeniz gerekiyor:

**Option 1: Render Shell (Önerilen)**
```bash
# Render Dashboard → Service → Shell
npm run db:push
npm run db:seed:super-admin
```

**Option 2: Build Command'e Ekleyin**
```bash
# Build Command:
npm install && npm run build && npm run db:push
```

⚠️ **NOT:** Migration'ları build command'e eklemek her deploy'da çalıştırır. Production'da dikkatli kullanın.

---

## 🔧 Yapılandırma Dosyası (render.yaml)

Proje dizinine `render.yaml` eklendi. Bu dosya ile otomatik deployment yapılandırması:

```yaml
services:
  - type: web
    name: qr-menu-platform
    env: node
    region: frankfurt
    plan: free
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        sync: false
      - key: NEXTAUTH_SECRET
        sync: false
      - key: NEXTAUTH_URL
        sync: false
      - key: NEXT_PUBLIC_APP_URL
        sync: false
    healthCheckPath: /api/health
```

**Kullanımı:**
1. Repository'nize `render.yaml` ekleyin
2. Git push yapın
3. Render otomatik olarak bu yapılandırmayı algılayacak

---

## 🩺 Health Check Endpoint

**Endpoint:** `GET /api/health`

**Response (Success):**
```json
{
  "status": "ok",
  "timestamp": "2026-06-13T10:30:00.000Z",
  "database": "connected",
  "service": "qr-menu-platform",
  "version": "1.1.0"
}
```

**Response (Error):**
```json
{
  "status": "error",
  "timestamp": "2026-06-13T10:30:00.000Z",
  "database": "disconnected",
  "service": "qr-menu-platform",
  "error": "Database connection failed"
}
```

Render bu endpoint'i kullanarak uygulamanızın sağlıklı olup olmadığını kontrol eder.

---

## ⚠️ Yaygın Sorunlar ve Çözümleri

### Sorun 1: "Build başarılı ama deploy olmuyor"

**Neden:** Start command çalışmıyor veya port yanlış

**Çözüm:**
```bash
# server.js dosyanızda PORT environment variable'ı kullanıldığından emin olun
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### Sorun 2: "Application Error - Connection Timeout"

**Neden:** Database bağlantısı kurulamıyor

**Çözüm:**
1. `DATABASE_URL` doğru mu kontrol edin
2. Database ve Web Service aynı region'da mı?
3. Database'in **Internal URL**'sini kullanıyor musunuz?

### Sorun 3: "Module not found errors"

**Neden:** `postinstall` script çalışmamış

**Çözüm:**
```json
// package.json'da bu script var mı kontrol edin:
"scripts": {
  "postinstall": "prisma generate"
}
```

### Sorun 4: "Out of Memory Error"

**Neden:** Free plan memory limiti aşılıyor

**Çözüm:**
```bash
# Build command'i optimize edin:
npm install --production=false && npm run build && npm prune --production

# Veya Node.js memory limitini artırın:
NODE_OPTIONS="--max-old-space-size=512" npm run build
```

### Sorun 5: "Socket.io connection failed"

**Neden:** WebSocket bağlantısı Render'da farklı yapılandırma gerektiriyor

**Çözüm:**
```typescript
// server.js'de CORS ayarlarını düzeltin:
const io = new Server(server, {
  cors: {
    origin: process.env.NEXTAUTH_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});
```

---

## 🔐 Güvenlik Notları

### Production Environment Variables:

```bash
# ✅ GÜVENLİ - Internal Database URL kullanın
DATABASE_URL = postgresql://internal-host:5432/db?schema=public

# ❌ GÜVENSİZ - External URL kullanmayın (daha yavaş + güvensiz)
DATABASE_URL = postgresql://external-host.render.com:5432/db

# ✅ GÜVENLİ - Strong secret key (minimum 32 karakter)
NEXTAUTH_SECRET = [openssl rand -base64 32 output'u]

# ✅ GÜVENLİ - HTTPS URL kullanın
NEXTAUTH_URL = https://your-app.onrender.com

# ❌ GÜVENSİZ - HTTP kullanmayın
NEXTAUTH_URL = http://your-app.onrender.com
```

---

## 📊 Deployment Verification Checklist

Deploy sonrası bu adımları takip edin:

### 1. Health Check
```bash
curl https://your-app.onrender.com/api/health
```

### 2. Homepage
```bash
curl https://your-app.onrender.com/
```

### 3. API Test
```bash
curl https://your-app.onrender.com/api/auth/providers
```

### 4. Database Connection
- [ ] Admin panel'e giriş yapabiliyorum
- [ ] Super admin hesabı çalışıyor
- [ ] Tablolar görüntüleniyor

### 5. Real-time Features
- [ ] Socket.io bağlantısı çalışıyor
- [ ] Live updates alınıyor (sipariş bildirimleri)

---

## 🚀 İlk Deployment Sonrası Yapılacaklar

### 1. Super Admin Hesabı Oluşturma

```bash
# Render Shell'de çalıştırın:
npm run db:seed:super-admin
```

**Default Credentials:**
```
Email: admin@qrmenu.com
Password: admin123
```

⚠️ **ÖNEMLİ:** İlk giriş sonrası şifreyi değiştirin!

### 2. İlk Business Oluşturma

1. Super admin ile giriş yapın
2. **Business Management** → **"Create New Business"**
3. Business bilgilerini girin
4. Admin kullanıcısı oluşturun

### 3. Test QR Kodu Oluşturma

1. Admin panel'e business admin ile giriş yapın
2. **Tables** → Masa ekleyin
3. **"Generate QR"** butonuna tıklayın
4. QR kodu test edin

---

## 🔄 Continuous Deployment

Render otomatik deployment yapılandırması:

### Auto-Deploy Ayarları:
1. **Render Dashboard** → Service → Settings
2. **"Auto-Deploy"** bölümünde:
   - ✅ **"Auto-Deploy"** aktif
   - Branch: `main`
3. Her `git push` sonrası otomatik deploy başlar

### Manual Deploy:
```bash
# Render Dashboard'dan:
Service → Manual Deploy → "Deploy latest commit"
```

---

## 📞 Destek ve Troubleshooting

### Render Support:
- Dashboard: https://dashboard.render.com/
- Docs: https://render.com/docs
- Community: https://community.render.com/

### Project Logs:
```bash
# Real-time logs:
Render Dashboard → Service → Logs → Live

# Download logs:
Render Dashboard → Service → Logs → Download
```

### Common Commands:
```bash
# Shell access:
Render Dashboard → Service → Shell

# Restart service:
Render Dashboard → Service → Manual Deploy → "Clear build cache & deploy"

# View environment:
echo $DATABASE_URL (Shell'de)
```

---

## ✅ Deployment Başarı Kriterleri

- [ ] Build başarılı (yeşil ✓)
- [ ] Service "Live" durumunda
- [ ] Health check 200 OK dönüyor
- [ ] Homepage yükleniyor
- [ ] Database bağlantısı çalışıyor
- [ ] Admin panel'e giriş yapılabiliyor
- [ ] Socket.io bağlantısı aktif
- [ ] QR menü müşteriler için erişilebilir

---

**Son Güncelleme:** 13 Haziran 2026  
**Proje Versiyonu:** 1.1.0  
**Next.js Versiyonu:** 15.5.18  
**Deployment Platform:** Render.com
