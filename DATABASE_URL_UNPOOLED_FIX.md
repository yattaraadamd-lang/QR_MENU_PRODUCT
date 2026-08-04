# 🔧 DATABASE_URL_UNPOOLED Fix - Migration Timeout Çözümü

## ❌ Problem
```
Error: P1002
The database server at `aws-1-ap-southeast-1.pooler.supabase.com:5432` was reached but timed out.
Context: Timed out trying to acquire a postgres advisory lock
```

## 🔍 Root Cause
Supabase **pooled connection** migrations için uygun değil çünkü:
- Advisory locks pooler üzerinden çalışmaz
- Migrations direct PostgreSQL connection gerektirir
- `DATABASE_URL` (pooled) yerine `DATABASE_URL_UNPOOLED` (direct) kullanılmalı

## ✅ ÇÖZÜM: Render'da DATABASE_URL_UNPOOLED Ekle

### Adım 1: Supabase'den Direct Connection String Al

1. **Supabase Dashboard**'a git: https://supabase.com/dashboard
2. Projenizi seçin
3. **Settings** → **Database** → **Connection string** bölümüne git
4. **Connection Pooling** seçeneğini **DISABLE** et veya **Session mode** kullan
5. **URI** formatında connection string'i kopyala

**Doğru format** (direct, pooler yok):
```
postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres

VEYA (transaction mode - daha iyi):

postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1

VEYA (en iyisi - direct connection):

postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

### Adım 2: Render Dashboard'a Ekle

1. **Render Dashboard**: https://dashboard.render.com
2. **qr-menu-platform** servisini seç
3. **Environment** sekmesine git
4. **Add Environment Variable** butonuna bas

**Eklenecek Variable**:
```
Key:   DATABASE_URL_UNPOOLED
Value: postgresql://postgres.[PROJECT-REF]:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

**ÖNEMLİ**: 
- `pooler.supabase.com` kullanma (bu pooled)
- `db.[PROJECT-REF].supabase.co` kullan (bu direct)
- Port `5432` olmalı (`6543` değil)

### Adım 3: Mevcut DATABASE_URL'i Kontrol Et

**DATABASE_URL** (runtime için - pooled OK):
```
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

**DATABASE_URL_UNPOOLED** (migrations için - direct):
```
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

### Adım 4: Prisma Schema'yı Kontrol Et

Prisma otomatik olarak migrations sırasında `DATABASE_URL_UNPOOLED` kullanacak.

`prisma/schema.prisma` dosyasında:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DATABASE_URL_UNPOOLED") // ✅ Bu otomatik kullanılacak
}
```

Zaten doğru ayarlanmış olmalı. Kontrol edelim:

<function_calls>
<invoke name="grep_search">
<parameter name="query">directUrl