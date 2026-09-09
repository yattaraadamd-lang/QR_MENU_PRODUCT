# 🔧 RENDER.COM DATABASE BAĞLANTI HATASI ÇÖZÜMÜ

## ❌ Hata Mesajı:
```
Error: Schema engine error:
FATAL: (ENOTFOUND) tenant/user postgres.najpbpmtypxbrbtzafwn not found
```

## 🔍 Sorunun Nedeni:
Render.com'da `DATABASE_URL_UNPOOLED` environment variable'ı yanlış veya eksik ayarlanmış. Prisma migration sırasında Supabase veritabanına bağlanamıyor.

---

## ✅ ÇÖZÜM ADIMLARI

### 1. Supabase'den Doğru Connection String'leri Al

Supabase Dashboard'a git:
1. **Project Settings** → **Database**
2. **Connection String** → **Transaction Mode** sekmesinde:

```
postgresql://postgres.najpbpmtypxbrbtzafwn:[YOUR-PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
```

3. **Connection String** → **Session Mode** sekmesinde:

```
postgresql://postgres.najpbpmtypxbrbtzafwn:[YOUR-PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

⚠️ **ÖNEMLİ:** `[YOUR-PASSWORD]` yerine gerçek database şifrenizi yazın!

---

### 2. Render.com Environment Variables'ı Güncelle

Render.com Dashboard → **Your Service** → **Environment** → **Environment Variables**

Aşağıdaki değişkenleri ekle/güncelle:

#### ✅ DATABASE_URL (Transaction/Session Mode - pgBouncer)
```
postgresql://postgres.najpbpmtypxbrbtzafwn:[YOUR-PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

#### ✅ DATABASE_URL_UNPOOLED (Direct Connection - Migrations için)
```
postgresql://postgres.najpbpmtypxbrbtzafwn:[YOUR-PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
```

#### ✅ NEXTAUTH_URL
```
https://[your-render-service-name].onrender.com
```

#### ✅ NEXTAUTH_SECRET
```
[32-64 karakter rastgele güvenli string]
```
Oluşturmak için:
```bash
openssl rand -base64 32
```

---

### 3. Prisma Schema Kontrolü

`prisma/schema.prisma` dosyasında doğru yapılandırma:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DATABASE_URL_UNPOOLED")
}
```

✅ Bu yapılandırma zaten mevcut.

---

### 4. Build Script Kontrolü

`scripts/render-build.js` dosyası otomatik olarak:
1. `npm install` çalıştırır
2. `DATABASE_URL_UNPOOLED` kullanarak `prisma migrate deploy` çalıştırır
3. `prisma generate` çalıştırır
4. `next build` çalıştırır

✅ Bu script zaten mevcut ve doğru yapılandırılmış.

---

### 5. Render.com'da Manuel Deployment Tetikleme

Environment variables'ları güncelledikten sonra:

1. **Manual Deploy** → **Deploy latest commit**
2. Logs'u takip et:
   ```
   ==> Running 'npm run build'
   ==> 🗄️ 2. Running Prisma migrations...
   ==> ✅ Migrations applied successfully
   ==> ⚙️ 3. Generating Prisma Client...
   ==> 🏗️ 4. Building Next.js application...
   ==> ✅ Build completed successfully!
   ```

---

## 🧪 Lokal Test (Opsiyonel)

Render.com'daki ayarları test etmek için:

```bash
# .env dosyasını güncelle
DATABASE_URL="postgresql://postgres.najpbpmtypxbrbtzafwn:[PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DATABASE_URL_UNPOOLED="postgresql://postgres.najpbpmtypxbrbtzafwn:[PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"

# Migration testi
npx prisma migrate deploy

# Build testi
npm run build
```

---

## 📋 Checklist

- [ ] Supabase'den doğru connection string'leri aldım
- [ ] `[YOUR-PASSWORD]` yerine gerçek şifreyi yazdım
- [ ] Render.com'da `DATABASE_URL` ayarlandı
- [ ] Render.com'da `DATABASE_URL_UNPOOLED` ayarlandı
- [ ] Render.com'da `NEXTAUTH_URL` ayarlandı
- [ ] Render.com'da `NEXTAUTH_SECRET` ayarlandı
- [ ] Manuel deploy tetiklendi
- [ ] Build logs'unda "✅ Migrations applied successfully" görüldü
- [ ] Deployment başarılı oldu

---

## 🆘 Hala Sorun mu Var?

### Connection String Format Kontrolü:

✅ **DOĞRU:**
```
postgresql://postgres.najpbpmtypxbrbtzafwn:password@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
```

❌ **YANLIŞ:**
```
postgresql://postgres.najpbpmtypxbrbtzafwn@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
```
(Şifre eksik!)

❌ **YANLIŞ:**
```
postgresql://postgres.najpbpmtypxbrbtzafwn:password@aws-1-ap-southeast-1.pooler.supabase.com/postgres
```
(Port eksik!)

---

## 🔒 Güvenlik Notu

- Database şifrelerini asla Git'e commit etme!
- `.env` dosyası `.gitignore` içinde olmalı ✅
- Render.com environment variables şifrelenmiş olarak saklanır ✅

---

**Son Güncelleme:** 2026-09-09  
**Durum:** Deployment için hazır (environment variables ayarlanmalı)
