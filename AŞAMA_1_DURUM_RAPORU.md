# AŞAMA 1 — ORDER_REQUEST Fonksiyonel Testi Durum Raporu

**Tarih**: 2 Ağustos 2026  
**Son Commit**: `9b5ec2c`  
**Durum**: ⚠️ BLOCKED - Migration Uygulanmadı

---

## 🚨 Kritik Sorun Tespit Edildi

### Hata
```
Error: The column `payments.receivedAmount` does not exist in the current database
Code: P2022
Endpoint: /api/waiter/payments (ve muhtemelen diğerleri)
```

### Kök Neden
Migration `20260802_sync_secure_customer_order_flow` **Supabase veritabanına uygulanmamış**.

### Neden Uygulanmadı?
Render'ın `npm run db:deploy` komutu başarısız oluyor çünkü:

1. ✅ **Migration dosyası var** (`prisma/migrations/20260802_sync_secure_customer_order_flow/migration.sql`)
2. ✅ **Prisma schema doğru** (tüm alanlar tanımlı)
3. ✅ **db:deploy script tanımlı** (`package.json`)
4. ✅ **render.yaml buildCommand doğru** (`npm ci && npm run db:deploy && npm run build`)
5. ❌ **`DATABASE_URL_UNPOOLED` muhtemelen Render'da tanımlı değil**

Prisma migrations **pooled connection kullanamaz** - direct PostgreSQL connection gerekir.

---

## 🔧 Yapılan İşlemler

### 1. Diagnostic Endpoint Oluşturuldu
**Dosya**: `src/app/api/diagnostics/schema/route.ts`  
**Endpoint**: `GET /api/diagnostics/schema`

Schema durumunu kontrol eder:
- `customer_access_blocks.revokedById`
- `customer_access_blocks.revocationNote`
- `payments.receivedAmount`
- `payments.changeAmount`
- `payments.idempotencyKey`

### 2. Manuel Migration Script Hazırlandı
**Dosya**: `MANUAL_MIGRATION_SCRIPT.sql`

İdempotent SQL script:
- `IF NOT EXISTS` kullanıyor
- Güvenle tekrar çalıştırılabilir
- Veri kaybı riski yok
- Tüm eksik kolonları ekler

### 3. Detaylı Talimatlar Eklendi
**Dosya**: `MIGRATION_FIX_INSTRUCTIONS.md`

İçerik:
- Supabase SQL Editor'da manuel migration
- `DATABASE_URL_UNPOOLED` Render'da nasıl ayarlanır
- Verification queries
- Troubleshooting guide
- Test adımları

### 4. Render.yaml İyileştirildi
- `npm install` → `npm ci` (daha güvenilir)
- `DATABASE_URL_UNPOOLED` için comment eklendi

---

## 📋 Eksik Kolonlar

### customer_access_blocks
- [x] `revokedById` TEXT (Schema'da ✅ | Database'de ❌)
- [x] `revocationNote` TEXT (Schema'da ✅ | Database'de ❌)

### payments
- [x] `receivedAmount` DECIMAL(10,2) (Schema'da ✅ | Database'de ❌)
- [x] `changeAmount` DECIMAL(10,2) (Schema'da ✅ | Database'de ❌)
- [x] `idempotencyKey` TEXT UNIQUE (Schema'da ✅ | Database'de ❌)

---

## ⏭️ Sonraki Adımlar (ZORUNLU)

ORDER_REQUEST testlerine geçmeden önce **migration uygulanmalı**:

### Seçenek A: Manuel Migration (Hızlı - Önerilen)
1. Supabase → SQL Editor aç
2. `MANUAL_MIGRATION_SCRIPT.sql` içeriğini kopyala
3. Paste ve Run
4. Verification queries çalıştır
5. Local: `npx prisma migrate resolve --applied 20260802_sync_secure_customer_order_flow`

**Süre**: ~2 dakika

### Seçenek B: Render DATABASE_URL_UNPOOLED Ayarla (Kalıcı Çözüm)
1. Supabase → Settings → Database → Connection string kopyala (pooled değil!)
2. Render → Environment → `DATABASE_URL_UNPOOLED` ekle
3. Redeploy
4. Build logs kontrol et

**Süre**: ~10 dakika (redeploy dahil)

### Önerilen: Her İkisini de Yap
1. **Önce Manuel Migration** (acil düzeltme)
2. **Sonra DATABASE_URL_UNPOOLED** (gelecekteki migrationlar için)

---

## ✅ Migration Başarılı Olduğunda

Test edilecekler:

### Test 1: Diagnostic Endpoint
```bash
curl https://your-app.onrender.com/api/diagnostics/schema
```
Beklenen: `"status": "ok"` ve tüm `checks: true`

### Test 2: Waiter Payments Page
- Garson olarak login
- Payments sayfası aç
- Beklenen: Liste görünür (P2022 hatası yok)

### Test 3: ORDER_REQUEST (Ana Test)
1. QR kod oku
2. Ürün sepete ekle
3. "Sipariş Talebi Oluştur" bas
4. Beklenen: HTTP 201, verification code

---

## 📊 Test Durumu

| Test | Durum | Açıklama |
|------|-------|----------|
| Migration Applied | ❌ | Henüz uygulanmadı |
| Schema Diagnostic | ⏳ | Endpoint hazır, test bekliyor |
| OR-01: Talep oluşturma | ⏳ | Migration bekliyor |
| OR-02: Garson görünürlük | ⏳ | Migration bekliyor |
| OR-03: Yanlış kod | ⏳ | Migration bekliyor |
| OR-04: Doğru kod | ⏳ | Migration bekliyor |
| OR-05: Çift gönderim | ⏳ | Migration bekliyor |
| OR-06: Aktif masa koruması | ⏳ | Migration bekliyor |
| OR-07: Reddetme | ⏳ | Migration bekliyor |
| OR-08: Log kontrolü | ⏳ | Migration bekliyor |

---

## 🎯 Geçiş Kriteri

AŞAMA 2'ye (Ödeme Sistemi) geçmeden önce:

- [ ] Migration Supabase'de uygulandı
- [ ] Diagnostic endpoint `"status": "ok"` döndü
- [ ] P2022 hataları loglardan kayboldu
- [ ] OR-01 testini geçti (201 Created + verification code)
- [ ] OR-02 testini geçti (Garson ekranında görünür)
- [ ] OR-03 testini geçti (Yanlış kod reddedilir)
- [ ] OR-04 testini geçti (Doğru kod masa açar)
- [ ] OR-05 testini geçti (Çift gönderim idempotent)
- [ ] OR-06 testini geçti (Aktif masa koruması)
- [ ] OR-07 testini geçti (Reddetme + cihaz engeli)
- [ ] OR-08 testini geçti (Loglar temiz)

---

## 📁 Oluşturulan Dosyalar

### Diagnostic
- `src/app/api/diagnostics/schema/route.ts` (endpoint)

### Migration
- `MANUAL_MIGRATION_SCRIPT.sql` (Supabase SQL Editor için)
- `MIGRATION_FIX_INSTRUCTIONS.md` (adım adım talimatlar)

### Dokümantasyon
- `AŞAMA_1_DURUM_RAPORU.md` (bu dosya)
- `KIRO_ORDER_REQUEST_TESTLERI_SONRA_ODEME_SISTEMI_GOREVI.md` (görev tanımı)

### Config
- `render.yaml` (npm ci + DATABASE_URL_UNPOOLED comment)

---

## 🔍 Log Örnekleri

### Migration Uygulanmadan Önce (ŞU AN)
```
Error [PrismaClientKnownRequestError]:
Invalid `prisma.payment.findMany()` invocation:
The column `payments.receivedAmount` does not exist in the current database.
Code: P2022
```

### Migration Uygulandıktan Sonra (BEKLENİYOR)
```
✅ ServiceRequest created
✅ CustomerSession updated to PENDING
✅ Notification created
✅ ORDER_REQUEST successful
```

---

**SON DURUM**: Migration uygulanmayı bekliyor. Manuel script hazır ve GitHub'da.

**SONRAKI ADIM**: Kullanıcı `MANUAL_MIGRATION_SCRIPT.sql` dosyasını Supabase SQL Editor'da çalıştırmalı.
