# 🚀 HIZLI BAŞVURU REHBERİ - QR Menu Güvenlik Sistemi

## 📋 Hızlı Özet

### Problem Neydi?
❌ Müşteri QR okutup ilk siparişi veremiyor.

### Çözüm Nedir?
✅ `table.status === "EMPTY"` kontrolü güvenlik katmanından kaldırıldı.  
✅ Her endpoint kendi mantığında karar veriyor.

---

## 🔐 Güvenlik Nasıl Çalışıyor?

### Ana Prensip
**Güvenlik = CustomerSession Durumu**

| CustomerSession Status | İşlem Yapılır mı? |
|------------------------|-------------------|
| ACTIVE ✅ | Evet, işlem yapılabilir |
| CLOSED ❌ | Hayır, masa kapanmış |
| EXPIRED ❌ | Hayır, session süresi dolmuş |

---

## 🎯 Endpoint Davranışları

### 1️⃣ Sipariş Endpoint
**URL**: `/api/customer/orders`

```
EMPTY masa → ✅ OK (ilk sipariş)
OCCUPIED masa → ✅ OK (ek sipariş)
CLOSED session → ❌ REJECT
```

**Ne Yapar?**
- CustomerSession doğrular
- Rate limit kontrol eder (10s)
- İlk sipariş ise TableSession + Bill oluşturur
- Masa durumunu OCCUPIED yapar

---

### 2️⃣ Yardım Talebi Endpoint
**URL**: `/api/customer/service-requests`

```
EMPTY masa → ✅ OK (bazı talepler)
OCCUPIED masa → ✅ OK
PENDING talep var → ❌ REJECT (spam)
CLOSED session → ❌ REJECT
```

**Ne Yapar?**
- CustomerSession doğrular
- Rate limit kontrol eder (60s)
- Aynı tipte PENDING talep var mı kontrol eder (SPAM koruması)
- Masa dolu ise durumunu günceller

---

### 3️⃣ Ödeme Talebi Endpoint
**URL**: `/api/customer/payment-requests`

```
EMPTY masa → ❌ REJECT (sipariş yok)
OCCUPIED masa → ✅ OK
CLOSED session → ❌ REJECT
```

**Ne Yapar?**
- CustomerSession doğrular
- Rate limit kontrol eder (60s)
- EMPTY masa ise reddeder (önce sipariş gerekir)
- Payment + ServiceRequest oluşturur

---

## 📊 Masa Durumları

| Table Status | Anlamı | Müşteri Ne Yapabilir? |
|--------------|--------|----------------------|
| EMPTY | Boş masa | ✅ QR okut, sipariş ver |
| OCCUPIED | Sipariş var | ✅ Ek sipariş, yardım, ödeme |
| WAITING_WAITER | Garson çağrıldı | ✅ Bekle veya başka talep |
| PAYMENT_REQUESTED | Ödeme istendi | ✅ Bekle |
| SERVED | Servis edildi | ✅ Ödeme iste |

---

## 🛡️ Güvenlik Önlemleri

### 1. CustomerSession Kontrolü ✅
Her endpoint şunu kontrol eder:
```typescript
const sessionCheck = await validateCustomerActionSession(request);
if (!sessionCheck.ok) return error(403);
```

**Kontroller:**
- ✅ Session token var mı?
- ✅ Session ACTIVE mi?
- ✅ Session süresi dolmamış mı?
- ✅ tableId/businessId eşleşiyor mu?
- ✅ Masa deleted/inactive değil mi?

### 2. Rate Limiting ✅
**Çok hızlı istek engellenir:**
- Sipariş: 10 saniye
- Yardım talebi: 60 saniye
- Ödeme talebi: 60 saniye

### 3. SPAM Koruması ✅
**Aynı anda sadece 1 PENDING talep:**
```sql
SELECT * FROM ServiceRequest
WHERE tableId = ? 
  AND requestType = ?
  AND status = 'PENDING';
```

Varsa → ❌ REJECT  
Yoksa → ✅ OK

### 4. Transaction Güvenliği ✅
**Kritik işlemler transaction içinde:**
```typescript
await prisma.$transaction(async (tx) => {
  // 1. TableSession oluştur
  // 2. Bill oluştur
  // 3. Order oluştur
  // 4. Table.status güncelle
});
```

---

## 🧪 Test Senaryoları

### ✅ Senaryo 1: İlk Sipariş
```
1. QR okut → CustomerSession ACTIVE, table EMPTY
2. Sipariş ver → ✅ OK
3. TableSession + Bill oluşur
4. Table.status = OCCUPIED
```

### ✅ Senaryo 2: Eski Token
```
1. Masa kapat → CustomerSession CLOSED
2. Eski token ile sipariş → ❌ REJECT
   "Müşteri oturumu aktif değil. Masa kapatılmış olabilir."
```

### ✅ Senaryo 3: Rate Limit
```
1. Sipariş ver → ✅ OK
2. 5 saniye sonra sipariş → ❌ REJECT
   "Lütfen 5 saniye bekleyin"
3. 10 saniye sonra sipariş → ✅ OK
```

### ✅ Senaryo 4: SPAM Koruması
```
1. Garson çağır → ✅ OK (PENDING)
2. Garson çağır → ❌ REJECT
   "Bekleyen garson çağrısı var"
3. Garson tamamla → Status = COMPLETED
4. Garson çağır → ✅ OK
```

### ✅ Senaryo 5: EMPTY Ödeme
```
1. QR okut → Session oluşur, masa EMPTY
2. Ödeme iste → ❌ REJECT
   "Önce sipariş verin"
3. Sipariş ver → ✅ OK, masa OCCUPIED
4. Ödeme iste → ✅ OK
```

---

## 🔧 Debug Yöntemleri

### 1. Session Token Kontrolü
**Browser Console:**
```javascript
sessionStorage.getItem("qr_session_token")
```

**Varsa:** ✅ Token mevcut  
**Yoksa:** ❌ QR tekrar okutulmalı

### 2. Network Tab İnceleme
**Chrome DevTools → Network:**
```
Request Headers:
  x-session-token: abc123...
```

**Varsa:** ✅ Frontend token gönderiyor  
**Yoksa:** ❌ Frontend sorunu

### 3. API Response Kontrol
**Status Codes:**
- `200 OK` → ✅ Başarılı
- `400 Bad Request` → ❌ Geçersiz veri
- `403 Forbidden` → ❌ Session sorunu
- `409 Conflict` → ❌ SPAM koruması
- `429 Too Many Requests` → ❌ Rate limit

### 4. Database Kontrol
**Prisma Studio:**
```bash
npx prisma studio
```

**Kontrol Et:**
- CustomerSession → status === "ACTIVE"?
- Table → status nedir?
- ServiceRequest → PENDING var mı?

---

## 🚨 Sık Karşılaşılan Hatalar

### ❌ "Aktif müşteri oturumu bulunamadı"
**Sebep:** x-session-token header yok  
**Çözüm:** Frontend token göndermelidir

### ❌ "Müşteri oturumu aktif değil"
**Sebep:** CustomerSession CLOSED/EXPIRED  
**Çözüm:** QR tekrar okutulmalı

### ❌ "Bekleyen talep var"
**Sebep:** SPAM koruması aktif  
**Çözüm:** Önceki talep tamamlanmalı

### ❌ "Rate limit"
**Sebep:** Çok hızlı istek  
**Çözüm:** Bekleme süresi sonrası tekrar dene

### ❌ "Önce sipariş verin"
**Sebep:** EMPTY masa ile ödeme talebi  
**Çözüm:** İlk sipariş verildikten sonra ödeme istenebilir

---

## 📦 Dosya Konumları

### Güvenlik Katmanı
```
src/lib/security/
├── validate-customer-session.ts  ← Ana güvenlik
├── rate-limit.ts                 ← Rate limiting
└── close-table-sessions.ts       ← Session kapatma
```

### API Endpoints
```
src/app/api/customer/
├── orders/route.ts               ← Sipariş
├── service-requests/route.ts     ← Yardım talepleri
├── payment-requests/route.ts     ← Ödeme talepleri
└── session/route.ts              ← Session oluşturma
```

### Frontend
```
src/app/menu/[businessId]/[tableNumber]/
└── page.tsx                      ← Müşteri menü sayfası
```

---

## 🎯 Hatırlanması Gerekenler

1. **Güvenlik = CustomerSession**
   - Table.status değil
   - CustomerSession.status kontrol edilir

2. **Her Endpoint Farklı**
   - Orders: EMPTY OK
   - Service: EMPTY OK (bazı talepler)
   - Payment: EMPTY NO

3. **Transaction Kullan**
   - Veri tutarlılığı için
   - Kritik işlemlerde zorunlu

4. **Frontend Token Göndermeli**
   - x-session-token header
   - Her API isteğinde

5. **Test Et**
   - İlk sipariş senaryosu
   - SPAM koruması
   - Rate limiting
   - Eski token reddi

---

## 📞 Yardım

**Build:**
```bash
cd qr-menu-platform
npm run build
```

**Dev Server:**
```bash
npm run dev
```

**Database:**
```bash
npx prisma studio
```

**Migration:**
```bash
npx prisma migrate dev
```

---

**Güncelleme**: 10 Haziran 2026  
**Durum**: ✅ ÇALIŞIYOR  
**Version**: v1.1.0 + Security Patch
