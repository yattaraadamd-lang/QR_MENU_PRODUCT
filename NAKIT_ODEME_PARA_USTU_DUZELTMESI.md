# 💰 Nakit Ödeme / Para Üstü / Ciro Hatası Düzeltmesi

**Tarih:** 12 Haziran 2026  
**Durum:** ✅ Tamamlandı

---

## 🎯 Problem

Garson panelindeki ödeme alma ekranında:
- Müşterinin borcu: **20 TL**
- Müşteri verdi: **100 TL**
- **Sistem ciroya 100 TL ekliyordu** ❌

**Doğru olması gereken:**
- Ciroya eklenecek: **20 TL**
- Para üstü: **80 TL**

---

## 🔧 Yapılan Düzeltmeler

### 1. Frontend (UI) - `/src/app/waiter/payments/page.tsx`

#### ✅ Eklenen Özellikler:
1. **Nakit input alanı** - Sadece nakit ödeme seçildiğinde görünür
2. **Para üstü hesaplama** - Gerçek zamanlı gösterim
3. **Validasyon** - Alınan tutar < borç ise uyarı
4. **Görsel feedback** - Para üstü bilgisi renkli kutuda

#### Yeni UI Akışı:
```
Ödenmesi Gereken: 20 TL
↓
Ödeme Yöntemi: [💵 Nakit] [💳 Kart]
↓
(Nakit seçilirse)
Alınan Nakit Tutarı: [100.00]
↓
Para Üstü: ₺80.00 (yeşil kutu)
Ciroya Eklenecek: ₺20.00
```

#### Kod Değişiklikleri:
- **State eklendi:** `receivedAmount` (alınan nakit)
- **Validasyon:** Frontend'de yetersiz tutar kontrolü
- **Para üstü hesabı:** `changeAmount = received - dueAmount`

---

### 2. Backend API - `/api/waiter/payments/[id]/complete/route.ts`

#### ✅ Eklenen Güvenlik:
```typescript
// Nakit ödeme için validasyon
if (method === "CASH") {
  if (!receivedAmount || receivedAmount <= 0) {
    throw new Error("Nakit ödeme için alınan tutar belirtilmelidir");
  }
  
  if (receivedAmount < dueAmount) {
    throw new Error(
      `Alınan tutar (${receivedAmount}), borçtan (${dueAmount}) küçük olamaz`
    );
  }
}
```

#### ✅ Ciro Mantığı:
```typescript
// ✅ Ciroya eklenecek tutar her zaman dueAmount (payment.amount)
// receivedAmount sadece para üstü hesabı için kullanılır
const changeAmount = method === "CASH" && receivedAmount 
  ? receivedAmount - dueAmount 
  : 0;
```

**Önemli:** 
- `payment.amount` = Ciroya eklenecek tutar (ödenmesi gereken)
- `receivedAmount` = Sadece para üstü hesabı için (ciroya eklenmez)

---

### 3. Backend API - `/api/waiter/payments/collect/route.ts`

Aynı validasyon `collect` endpoint'ine de eklendi (doğrudan ödeme alma için).

---

## 📋 Doğru İş Mantığı

### Nakit Ödeme Akışı:
```
1. Müşteri borcu: 20 TL (dueAmount)
2. Müşteri verdi: 100 TL (receivedAmount)
3. Para üstü: 80 TL (changeAmount = receivedAmount - dueAmount)
4. Ciroya eklenecek: 20 TL (amount = dueAmount)
```

### Kart Ödeme Akışı:
```
1. Müşteri borcu: 20 TL
2. Kart ile ödeme: 20 TL (tam tutar)
3. Para üstü: 0 TL
4. Ciroya eklenecek: 20 TL
```

---

## ✅ Validasyon Kuralları

### Frontend Validasyonu:
1. ❌ Alınan tutar boş olamaz
2. ❌ Alınan tutar 0 veya negatif olamaz
3. ❌ Alınan tutar < ödenmesi gereken tutar
4. ✅ Alınan tutar ≥ ödenmesi gereken tutar → Para üstü göster

### Backend Validasyonu:
1. ❌ Nakit ödeme ise `receivedAmount` zorunlu
2. ❌ `receivedAmount < amount` → 400 Bad Request
3. ✅ Validasyon geçerse → Payment.status = PAID

---

## 🧪 Test Senaryoları

### Senaryo 1: Normal Nakit Ödeme
```
Borç: 20 TL
Alınan: 100 TL
Para Üstü: 80 TL
Ciro: +20 TL ✅
```

### Senaryo 2: Tam Tutar Nakit
```
Borç: 20 TL
Alınan: 20 TL
Para Üstü: 0 TL
Ciro: +20 TL ✅
```

### Senaryo 3: Yetersiz Nakit
```
Borç: 20 TL
Alınan: 10 TL
Sonuç: Hata mesajı ❌
"Alınan tutar, ödenmesi gereken tutardan küçük olamaz"
```

### Senaryo 4: Kart Ödeme
```
Borç: 20 TL
Yöntem: Kart
Ciro: +20 TL ✅
(receivedAmount gerekmez)
```

---

## 📊 Veritabase Etkisi

### Payment Tablosu:
- `amount` → Ciroya eklenen tutar (ödenmesi gereken)
- `method` → CASH / CARD
- `status` → PAID
- **Not:** `receivedAmount` veritabanına kaydedilmiyor (sadece UI/validasyon için)

### Bill Tablosu:
```typescript
paidAmount = SUM(Payment.amount WHERE status = PAID)
remainingAmount = totalAmount - paidAmount
paymentStatus = (remainingAmount == 0) ? "PAID" : "PARTIALLY_PAID"
```

---

## 🔒 Güvenlik Açığı Kapatıldı

**Önceki Durum:**
- Frontend alınan tutarı doğrudan backend'e gönderebiliyordu
- Backend client verilerine güvenmiyordu ama validasyon yoktu

**Yeni Durum:**
✅ Backend `receivedAmount` < `dueAmount` kontrolü yapıyor  
✅ Ciro her zaman `payment.amount` (server-side hesaplanan)  
✅ Client manipülasyonu etkisiz  

---

## 📝 Değiştirilen Dosyalar

1. ✅ `qr-menu-platform/src/app/waiter/payments/page.tsx`
2. ✅ `qr-menu-platform/src/app/api/waiter/payments/[id]/complete/route.ts`
3. ✅ `qr-menu-platform/src/app/api/waiter/payments/collect/route.ts`

---

## 🚀 Sonraki Adımlar

### P0 (Acil)
- [ ] Sipariş quantity validasyonu (1-99 arası)
- [ ] Admin/Waiter rol kontrolleri sıkılaştırma
- [ ] Login rate limiting (brute-force koruması)

### P1 (Önemli)
- [ ] Soft delete tutarlılığı kontrolü
- [ ] Database index/constraint ekle
- [ ] Frontend modernizasyon devam

---

## 📌 Notlar

1. **receivedAmount opsiyonel** - Sadece nakit ödeme için zorunlu
2. **Kart ödemelerinde** receivedAmount gönderilmez
3. **Para üstü** sadece UI'da gösterilir, veritabanına kaydedilmez
4. **Ciro hesabı** her zaman `payment.amount` üzerinden yapılır

---

**✅ Bu düzeltme ile artık:**
- Garson nakit ödeme alırken para üstü hesaplanıyor
- Ciro doğru tutar kadar artıyor
- Yetersiz tutar uyarısı veriliyor
- İş mantığı tam olarak doğru çalışıyor
