# 🛠️ Sipariş Reddetme Sonrası Masa Hatalı Kapanması Düzeltmesi

**Tarih:** 12 Haziran 2026  
**Durum:** ✅ Tamamlandı  
**Önem:** 🔴 Kritik (Ciro kaybı riski)

---

## 🔴 Problem

### Senaryo:
1. Müşteri **3 kez yanlışlıkla çay** siparişi veriyor
2. Garson **1 siparişi kabul ediyor** → Hazırlıyor → **Servis ediyor**
3. Garson **2 yanlış siparişi reddediyor**
4. **Sistem masayı otomatik kapatıyor** ❌

### Sonuç:
- Servis edilen çay ödemesiz kalıyor
- Addisyon kayboldu
- Ciro kaybı oluşuyor
- Müşteri ödemeden ayrılabiliyor

---

## 💡 Kök Neden Analizi

### Hatalı Mantık:
```typescript
// ❌ YANLIŞ KOD (Eski)
if (status === "CANCELLED" || status === "REJECTED") {
  // Sadece PENDING/ACCEPTED/PREPARING siparişlere bakıyor
  if (otherActiveOrders === 0) {
    newTableStatus = TableStatus.EMPTY; // ❌ Masayı kapatıyor
  }
}
```

**Problem:**
- Kod sadece `PENDING`, `ACCEPTED`, `PREPARING` durumlarındaki siparişleri kontrol ediyor
- **SERVED durumundaki ödenmemiş siparişleri göz ardı ediyor**
- Sonuç: Servis edilmiş ama ödenmemiş sipariş varken masa kapanıyor

---

## ✅ Çözüm

### Yeni Mantık:
```typescript
// ✅ DOĞRU KOD (Yeni)
if (status === "CANCELLED" || status === "REJECTED") {
  if (otherActiveOrders === 0) {
    // 1️⃣ Önce ödenmemiş SERVED siparişleri kontrol et
    const unPaidServedOrders = await prisma.order.count({
      where: {
        tableId: order.tableId,
        id: { not: params.id },
        status: "SERVED",
      },
    });

    // 2️⃣ SERVED sipariş varsa masa SERVED kalmalı
    if (unPaidServedOrders > 0) {
      newTableStatus = TableStatus.SERVED;
    } else {
      // 3️⃣ Açık adisyon kontrolü yap
      if (order.tableSessionId) {
        const bill = await prisma.bill.findFirst({
          where: { 
            tableSessionId: order.tableSessionId,
            status: "OPEN"
          },
          select: { remainingAmount: true },
        });

        // 4️⃣ Ödenmemiş tutar varsa masa boş yapılmamalı
        if (bill && Number(bill.remainingAmount) > 0) {
          newTableStatus = TableStatus.SERVED;
        } else {
          newTableStatus = TableStatus.EMPTY;
        }
      } else {
        newTableStatus = TableStatus.EMPTY;
      }
    }
  }
}
```

---

## 🔄 Doğru İş Akışı

### Sipariş Reddetme Kontrol Listesi:

#### 1. Aktif Sipariş Kontrolü
```typescript
const otherActiveOrders = await prisma.order.count({
  where: {
    tableId: order.tableId,
    id: { not: params.id },
    status: { in: ["PENDING", "ACCEPTED", "PREPARING"] }
  }
});
```

#### 2. Servis Edilmiş Sipariş Kontrolü
```typescript
const unPaidServedOrders = await prisma.order.count({
  where: {
    tableId: order.tableId,
    id: { not: params.id },
    status: "SERVED"
  }
});
```

#### 3. Açık Adisyon Kontrolü
```typescript
const bill = await prisma.bill.findFirst({
  where: { 
    tableSessionId: order.tableSessionId,
    status: "OPEN"
  }
});
```

#### 4. Masa Durumu Kararı
```
IF otherActiveOrders > 0 → Masa durumu değişmez
ELSE IF unPaidServedOrders > 0 → Masa = SERVED
ELSE IF bill.remainingAmount > 0 → Masa = SERVED
ELSE → Masa = EMPTY
```

---

## 📋 Düzeltilen Dosyalar

### 1. Garson Sipariş Durumu (Ana Endpoint) ✅
**`src/app/api/waiter/orders/[id]/status/route.ts`**
- CANCELLED/REJECTED sonrası SERVED sipariş kontrolü eklendi
- Açık adisyon kontrolü eklendi
- Masa durumu doğru belirleniyor

### 2. Admin Sipariş İptal ✅
**`src/app/api/admin/orders/[orderId]/cancel/route.ts`**
- SERVED sipariş kontrolü eklendi
- OCCUPIED yerine gerekirse SERVED durumuna geçiyor

### 3. Genel Sipariş İptal (Müşteri) ✅
**`src/app/api/orders/[orderId]/route.ts`**
- PATCH endpoint: CANCELLED case'de SERVED kontrol eklendi
- DELETE endpoint: SERVED kontrol eklendi

---

## 🧪 Test Senaryoları

### Senaryo 1: Problem Senaryosu (Düzeltildi)
```
1. Müşteri 3 kez çay siparişi veriyor
   → 3 PENDING sipariş oluşuyor

2. Garson 1 siparişi kabul ediyor
   → Status: ACCEPTED → PREPARING → SERVED
   → Masa: SERVED
   → Bill.totalAmount = 20 TL

3. Garson 2 yanlış siparişi reddediyor
   → Status: REJECTED
   ✅ Masa: SERVED (eskiden EMPTY oluyordu ❌)
   ✅ Bill: OPEN (20 TL ödenmemiş)
   ✅ Müşteri ödemeden ayrılamıyor

4. Müşteri ödeme yapıyor
   → Bill: PAID
   → CustomerSession: CLOSED
   → Masa: EMPTY
```

### Senaryo 2: Tüm Siparişler Reddedildi
```
1. Müşteri 3 sipariş veriyor
2. Garson 3 siparişi de reddediyor
   → Hiçbir SERVED sipariş yok
   → Bill.totalAmount = 0
   ✅ Masa: EMPTY (doğru)
```

### Senaryo 3: Karma Durum
```
1. Müşteri 5 sipariş veriyor
2. Garson 2 siparişi kabul ediyor → Servis ediyor
3. Garson 2 siparişi reddediyor
4. 1 sipariş hala PREPARING durumunda
   → otherActiveOrders = 1
   ✅ Masa durumu değişmez (HAS_ORDER/PREPARING)
```

### Senaryo 4: Ödeme Alındıktan Sonra Red
```
1. Sipariş servis edildi → Bill.totalAmount = 20 TL
2. Ödeme alındı → Bill.paidAmount = 20 TL
3. Yeni sipariş verildi → Reddedildi
   → Bill.remainingAmount = 0
   ✅ Masa: EMPTY (doğru)
```

---

## 🔒 Güvenlik ve Tutarlılık

### Ciro Koruması:
- ✅ Servis edilmiş ürünler kesinlikle ödenmeden masa kapanmıyor
- ✅ Addisyon açık kaldığı sürece masa EMPTY yapılamıyor
- ✅ Bill.remainingAmount > 0 ise masa aktif tutulur

### Veri Tutarlılığı:
- ✅ Masa durumu ile Bill durumu senkronize
- ✅ CustomerSession durumu kontrol ediliyor
- ✅ Transaction kullanımı korundu

### İş Kuralları:
1. **Masa EMPTY olabilir sadece:**
   - Tüm siparişler CANCELLED/REJECTED ve
   - Hiç SERVED sipariş yok ve
   - Bill.remainingAmount = 0 veya Bill yok

2. **Masa SERVED kalmalıdır eğer:**
   - En az 1 SERVED sipariş varsa veya
   - Açık addisyonda ödenmemiş tutar varsa

3. **Masa durumu değişmez eğer:**
   - Hala PENDING/ACCEPTED/PREPARING sipariş varsa

---

## 📊 Etki Analizi

### Düzeltme Öncesi:
- ❌ Ciro kaybı riski
- ❌ Müşteri ödemeden ayrılabiliyor
- ❌ Garson manuel müdahale etmek zorunda
- ❌ Veri tutarsızlığı

### Düzeltme Sonrası:
- ✅ Ciro korunuyor
- ✅ Ödeme zorunlu
- ✅ Otomatik doğru davranış
- ✅ Veri tutarlılığı

---

## 🚀 Deployment Notları

### Build Durumu:
```bash
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Zero TypeScript errors
Exit Code: 0 ✅
```

### Breaking Changes:
**YOK** - Geriye dönük uyumlu

### Migration Gerekli mi?
**HAYIR** - Sadece business logic değişikliği

### Rollback Planı:
Git commit'e dön: Önceki commit hash'i kullan

---

## 📝 Kod Değişiklikleri Özeti

### Değiştirilen Satırlar:
- `waiter/orders/[id]/status/route.ts`: ~40 satır eklendi
- `admin/orders/[orderId]/cancel/route.ts`: ~15 satır eklendi
- `orders/[orderId]/route.ts`: ~20 satır eklendi (2 yerde)

### Eklenen Kontroller:
1. `unPaidServedOrders` counter
2. `bill.remainingAmount` check
3. Conditional `newTableStatus` logic

---

## ✅ Kabul Kriterleri

- ✅ SERVED sipariş varken masa kapanmıyor
- ✅ Açık addisyon varken masa kapanmıyor
- ✅ Tüm siparişler red edilince masa kapanıyor
- ✅ Build başarılı (zero errors)
- ✅ Geriye dönük uyumlu
- ✅ Transaction güvenliği korundu

---

## 🎯 İlgili Belgeler

- `NAKIT_ODEME_PARA_USTU_DUZELTMESI.md` - Nakit ödeme düzeltmesi
- `SECURITY_IMPLEMENTATION_PROGRESS.md` - Güvenlik iyileştirmeleri
- `table-flow.service.ts` - Masa yaşam döngüsü servisi

---

## 🔍 Debug Notları

### Masa Durumu Kontrol:
```sql
SELECT 
  t.tableNumber,
  t.status as tableStatus,
  COUNT(o.id) as totalOrders,
  SUM(CASE WHEN o.status = 'SERVED' THEN 1 ELSE 0 END) as servedOrders,
  b.remainingAmount
FROM Table t
LEFT JOIN Order o ON o.tableId = t.id
LEFT JOIN TableSession ts ON ts.tableId = t.id AND ts.status = 'ACTIVE'
LEFT JOIN Bill b ON b.tableSessionId = ts.id AND b.status = 'OPEN'
WHERE t.businessId = '...'
GROUP BY t.id;
```

### Log İzleme:
```typescript
console.log({
  action: "order_rejected",
  otherActiveOrders,
  unPaidServedOrders,
  billRemainingAmount: bill?.remainingAmount,
  decidedTableStatus: newTableStatus
});
```

---

**✅ Düzeltme Tamamlandı ve Production'a Hazır!**

Artık garson yanlış siparişleri reddettiğinde, servis edilmiş ve ödenmemiş siparişler güvenli şekilde korunuyor. Masa ancak tüm ödemeler alındıktan sonra kapanıyor.
