# 🚀 Render.com Hızlı Kurulum Rehberi

## ⚡ 5 Dakikada Deploy

### 1️⃣ PostgreSQL Database Oluştur

1. https://dashboard.render.com/ → **"New +"** → **"PostgreSQL"**
2. İsim: `qr-menu-db`
3. Plan: **Free**
4. Region: **Frankfurt**
5. **"Create Database"**
6. **Internal Database URL**'yi kopyala

### 2️⃣ Web Service Oluştur

1. **"New +"** → **"Web Service"**
2. GitHub repository bağla: `yattaraadamd-lang/QR_MENU_PRODUCT`
3. Ayarlar:
   ```
   Name: qr-menu-platform
   Region: Frankfurt
   Branch: fix/security-vulnerabilities
   Root Directory: qr-menu-platform
   Runtime: Node
   
   Build Command: npm install && npm run build
   Start Command: npm start
   
   Plan: Free
   ```

### 3️⃣ Environment Variables Ekle

**Service → Environment** sekmesinden ekle:

```bash
DATABASE_URL = [Adım 1'de kopyaladığın Internal URL]
NODE_ENV = production
NEXTAUTH_SECRET = [aşağıdaki komutu çalıştır]
NEXTAUTH_URL = https://[senin-render-url].onrender.com
NEXT_PUBLIC_APP_URL = https://[senin-render-url].onrender.com
```

**NEXTAUTH_SECRET oluştur:**
```bash
openssl rand -base64 32
```

### 4️⃣ Deploy Başlat

**"Create Web Service"** butonuna tıkla. Render otomatik olarak:
- Repository'i klonlar
- Dependencies yükler
- Build yapar
- Başlatır

### 5️⃣ Database Migrate Et

Deploy başarılı olduktan sonra:

1. **Service → Shell** sekmesine git
2. Şu komutları çalıştır:
```bash
npm run db:push
npm run db:seed:super-admin
```

---

## ✅ Test Et

1. **Health Check:**
   ```
   https://[senin-url].onrender.com/api/health
   ```
   
2. **Ana Sayfa:**
   ```
   https://[senin-url].onrender.com/
   ```

3. **Admin Girişi:**
   ```
   https://[senin-url].onrender.com/auth/signin
   Email: admin@qrmenu.com
   Password: admin123
   ```
   
   ⚠️ İlk girişten sonra şifreyi değiştir!

---

## 🔧 Yaygın Sorunlar

### ❌ "Application Error"
**Çözüm:** Environment variables kontrolü yap, özellikle `DATABASE_URL`

### ❌ "Build başarılı ama çalışmıyor"
**Çözüm:** 
1. Service → Logs → Live'ı kontrol et
2. `PORT` environment variable eklemene gerek yok (server.js zaten hallediyor)

### ❌ "Can't connect to database"
**Çözüm:** 
1. Database ve Web Service aynı region'da mı?
2. **Internal URL** kullanıyor musun? (External değil)

### ❌ "Socket.io connection failed"
**Çözüm:** `NEXT_PUBLIC_APP_URL` doğru mu kontrol et

---

## 🔄 Otomatik Deploy

Her `git push` sonrası Render otomatik deploy yapar:

```bash
git add .
git commit -m "yeni özellik"
git push origin fix/security-vulnerabilities
```

Render Dashboard → Service'de deployment durumunu izle.

---

## 📞 Yardım

Detaylı rehber için: `RENDER_DEPLOYMENT_GUIDE.md`

Render destek: https://community.render.com/

---

**Deployment Süresi:** ~5-10 dakika  
**Maliyet:** $0 (Free plan)  
**Uptime:** %99.9
