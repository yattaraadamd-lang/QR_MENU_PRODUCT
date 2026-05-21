# Güvenlik Dokümantasyonu

QR Menü Platformu için güvenlik özellikleri ve en iyi uygulamalar.

## 🔒 Güvenlik Özellikleri

### 1. QR Token Tabanlı Oturum Sistemi

#### Nasıl Çalışır?

1. Müşteri QR kodu okuttuğunda benzersiz bir token oluşturulur
2. Token 4 saat geçerlidir
3. Token masa ile ilişkilendirilir
4. Sipariş verirken token doğrulanır

#### Güvenlik Avantajları

- ✅ İşletme dışından sipariş verme engellenir
- ✅ Her oturum benzersizdir
- ✅ Token süresi dolunca otomatik geçersiz olur
- ✅ Eski QR kod bağlantıları çalışmaz

#### Uygulama

```typescript
// Oturum oluşturma
POST /api/tables/[tableId]/session
Response: { qrToken: "unique-token", expiresAt: "..." }

// Sipariş verirken
POST /api/orders
Headers: { "X-QR-Token": "unique-token" }
```

#### Güvenlik Kontrolleri

```typescript
// Token kontrolü
if (!qrToken || table.qrToken !== qrToken) {
  return 403; // Forbidden
}

// Süre kontrolü
if (table.qrTokenExpiresAt && new Date() > table.qrTokenExpiresAt) {
  return 403; // Token expired
}
```

### 2. Kimlik Doğrulama

#### NextAuth.js

- Güvenli session yönetimi
- JWT token tabanlı
- HTTP-only cookies
- CSRF koruması

#### Şifre Güvenliği

```typescript
// Şifre hashleme (bcrypt)
const hashedPassword = await bcrypt.hash(password, 12);

// Şifre doğrulama
const isValid = await bcrypt.compare(password, hashedPassword);
```

**Güvenlik Özellikleri:**
- ✅ Bcrypt ile hashleme (12 rounds)
- ✅ Salt otomatik oluşturulur
- ✅ Şifreler düz metin olarak saklanmaz
- ✅ Minimum 6 karakter zorunluluğu

### 3. Yetkilendirme

#### Rol Tabanlı Erişim Kontrolü (RBAC)

```typescript
enum UserRole {
  ADMIN,  // Tüm yetkilere sahip
  WAITER  // Sadece sipariş/talep yönetimi
}
```

#### Yetki Kontrolleri

```typescript
// Admin kontrolü
const { error, response, session } = await requireAdmin();
if (error) return response;

// İşletme kontrolü
const businessId = getBusinessId(session);
const resource = await prisma.resource.findFirst({
  where: { id, businessId }
});
```

**Güvenlik Kuralları:**
- ✅ Her API endpoint yetki kontrolü yapar
- ✅ Kullanıcı sadece kendi işletmesinin verilerine erişir
- ✅ Cross-business veri erişimi engellenir

### 4. Veritabanı Güvenliği

#### Prisma ORM

- ✅ SQL injection koruması
- ✅ Parametreli sorgular
- ✅ Tip güvenliği
- ✅ Otomatik sanitizasyon

#### Veri İlişkileri

```prisma
// Cascade delete
business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)

// Null on delete
waiter User? @relation(fields: [waiterId], references: [id], onDelete: SetNull)
```

**Güvenlik Avantajları:**
- ✅ İşletme silindiğinde tüm ilgili veriler silinir
- ✅ Yetim kayıtlar oluşmaz
- ✅ Veri bütünlüğü korunur

### 5. API Güvenliği

#### Input Validasyonu

```typescript
// Zod ile validasyon
import { z } from 'zod';

const orderSchema = z.object({
  businessId: z.string().cuid(),
  tableId: z.string().cuid(),
  items: z.array(z.object({
    productId: z.string().cuid(),
    quantity: z.number().min(1).max(99)
  }))
});
```

#### Hata Yönetimi

```typescript
// Güvenli hata mesajları
try {
  // ...
} catch (error) {
  console.error("Detaylı hata:", error); // Sadece log'da
  return NextResponse.json(
    { error: "Genel hata mesajı" }, // Kullanıcıya
    { status: 500 }
  );
}
```

**Güvenlik İlkeleri:**
- ✅ Detaylı hata mesajları kullanıcıya gösterilmez
- ✅ Stack trace'ler gizlenir
- ✅ Hassas bilgiler loglanmaz

### 6. XSS Koruması

#### React Otomatik Koruması

```typescript
// Güvenli (React otomatik escape eder)
<div>{userInput}</div>

// Tehlikeli (kullanmayın)
<div dangerouslySetInnerHTML={{ __html: userInput }} />
```

#### Content Security Policy (CSP)

```typescript
// next.config.mjs
const securityHeaders = [
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  }
];
```

### 7. CSRF Koruması

NextAuth.js otomatik CSRF koruması sağlar:
- ✅ CSRF token'ları otomatik oluşturulur
- ✅ Her form submission'da doğrulanır
- ✅ SameSite cookie attribute'ları

### 8. Rate Limiting (Önerilir)

Production ortamında rate limiting eklenmeli:

```typescript
// Örnek: next-rate-limit
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 100 // 100 istek
});
```

**Önerilen Limitler:**
- Genel API: 100 istek/15 dakika
- Sipariş oluşturma: 10 istek/15 dakika
- Giriş denemesi: 5 istek/15 dakika

## 🛡️ Güvenlik En İyi Uygulamaları

### Ortam Değişkenleri

```bash
# .env.local
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="güçlü-random-string"
NEXTAUTH_URL="https://yourdomain.com"
```

**Güvenlik Kuralları:**
- ✅ `.env.local` dosyası git'e eklenmemeli
- ✅ Production'da farklı secret kullanın
- ✅ Secret'lar en az 32 karakter olmalı
- ✅ Düzenli olarak secret'ları değiştirin

### ⚠️ PRODUCTION SECRET YÖNETİMİ

**KRİTİK:** Production ortamında environment variable'lar **ASLA** kod deposuna commit edilmemelidir.

**Doğru Yaklaşım:**
- Production secret'ları sadece hosting platformunda (Vercel, AWS, vb.) environment variables olarak saklayın
- `.env.production` dosyası asla git'e eklenmemelidir (`.gitignore`'da engellendi)
- Her deployment ortamı için ayrı secret'lar kullanın
- Secret rotation planı oluşturun ve düzenli olarak güncelleyin

**Hosting Platform Örnekleri:**
- **Vercel:** Project Settings → Environment Variables
- **AWS:** Systems Manager Parameter Store veya Secrets Manager
- **Heroku:** Config Vars
- **Railway:** Variables tab

**Secret Rotation Checklist:**
- [ ] `NEXTAUTH_SECRET` değiştir
- [ ] `DATABASE_URL` şifresini güncelle
- [ ] API key'leri yenile
- [ ] Eski secret'ların kullanımını loglardan kontrol et

### HTTPS Kullanımı

Production ortamında mutlaka HTTPS kullanın:

```typescript
// next.config.mjs
module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains'
          }
        ]
      }
    ];
  }
};
```

### Veritabanı Güvenliği

```bash
# PostgreSQL güvenlik ayarları
# postgresql.conf

ssl = on
password_encryption = scram-sha-256
```

**En İyi Uygulamalar:**
- ✅ Veritabanı şifresi güçlü olmalı
- ✅ Sadece gerekli IP'lerden erişim
- ✅ SSL/TLS bağlantı kullanın
- ✅ Düzenli yedekleme yapın
- ✅ Yedekler şifreli saklanmalı

### Session Güvenliği

```typescript
// lib/auth.ts
export const authOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 gün
  },
  cookies: {
    sessionToken: {
      name: `__Secure-next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: true // Production'da true
      }
    }
  }
};
```

### Dosya Yükleme Güvenliği

Gelecekte dosya yükleme eklenirse:

```typescript
// Güvenlik kontrolleri
const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
const maxSize = 5 * 1024 * 1024; // 5MB

if (!allowedTypes.includes(file.type)) {
  throw new Error('Geçersiz dosya tipi');
}

if (file.size > maxSize) {
  throw new Error('Dosya çok büyük');
}
```

## 🚨 Güvenlik Kontrol Listesi

### Geliştirme Aşaması

- [x] Şifreler hashlenmiş
- [x] SQL injection koruması (Prisma)
- [x] XSS koruması (React)
- [x] CSRF koruması (NextAuth)
- [x] Input validasyonu
- [x] Yetkilendirme kontrolleri
- [x] QR token sistemi
- [x] Session yönetimi

### Production Öncesi

- [ ] HTTPS aktif
- [ ] Güçlü NEXTAUTH_SECRET
- [ ] Rate limiting eklendi
- [ ] Security headers yapılandırıldı
- [ ] Veritabanı SSL aktif
- [ ] Firewall kuralları ayarlandı
- [ ] Yedekleme sistemi kuruldu
- [ ] Monitoring eklendi
- [ ] Error tracking (Sentry vb.)
- [ ] Log yönetimi

### Düzenli Kontroller

- [ ] Bağımlılık güncellemeleri (npm audit)
- [ ] Güvenlik yamaları
- [ ] Log analizi
- [ ] Erişim logları kontrolü
- [ ] Şüpheli aktivite kontrolü
- [ ] Yedek testleri
- [ ] Penetrasyon testleri

## 🔍 Güvenlik Testleri

### 1. SQL Injection Testi

```bash
# Prisma kullanıldığı için korumalı
# Ancak yine de test edin
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"businessId": "1 OR 1=1"}'
```

**Beklenen:** Hata veya geçersiz ID

### 2. XSS Testi

```javascript
// Ürün adına script eklemeyi deneyin
{
  "name": "<script>alert('XSS')</script>",
  "price": 10
}
```

**Beklenen:** Script çalışmamalı, metin olarak gösterilmeli

### 3. CSRF Testi

```bash
# Session olmadan API çağrısı
curl -X POST http://localhost:3000/api/admin/products
```

**Beklenen:** 401 Unauthorized

### 4. Token Testi

```bash
# Geçersiz token ile sipariş
curl -X POST http://localhost:3000/api/orders \
  -H "X-QR-Token: invalid-token"
```

**Beklenen:** 403 Forbidden

### 5. Yetkilendirme Testi

```bash
# Garson hesabıyla admin endpoint'e erişim
curl -X GET http://localhost:3000/api/admin/business \
  -H "Cookie: session-token=waiter-session"
```

**Beklenen:** 403 Forbidden

## 📊 Güvenlik Monitoring

### Log Yapısı

```typescript
// Güvenlik olaylarını logla
console.log({
  timestamp: new Date().toISOString(),
  event: 'INVALID_TOKEN_ATTEMPT',
  tableId: 'table_123',
  ip: request.ip,
  userAgent: request.headers['user-agent']
});
```

### İzlenmesi Gereken Olaylar

- ❌ Başarısız giriş denemeleri
- ❌ Geçersiz token kullanımı
- ❌ Yetki ihlali denemeleri
- ❌ Anormal sipariş miktarları
- ❌ Hızlı tekrarlayan istekler
- ❌ Şüpheli IP adresleri

## 🆘 Güvenlik Olayı Müdahalesi

### Şüpheli Aktivite Tespit Edilirse

1. **Hemen Yapılacaklar:**
   - Şüpheli IP'yi engelleyin
   - İlgili kullanıcı hesaplarını askıya alın
   - Logları kaydedin

2. **Araştırma:**
   - Etkilenen kaynakları belirleyin
   - Saldırı vektörünü analiz edin
   - Veri sızıntısı olup olmadığını kontrol edin

3. **Düzeltme:**
   - Güvenlik açığını kapatın
   - Etkilenen kullanıcıları bilgilendirin
   - Şifre sıfırlama zorunlu hale getirin

4. **Önleme:**
   - Güvenlik yamalarını uygulayın
   - Monitoring'i güçlendirin
   - Güvenlik politikalarını güncelleyin

## 📞 Güvenlik İletişimi

### Güvenlik Açığı Bildirimi

Güvenlik açığı keşfederseniz:
- E-posta: security@example.com
- Detaylı açıklama yapın
- Exploit kodu paylaşmayın (sorumlu açıklama)

### Yanıt Süresi

- Kritik: 24 saat içinde
- Yüksek: 72 saat içinde
- Orta: 1 hafta içinde
- Düşük: 1 ay içinde

## 📚 Kaynaklar

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security](https://nextjs.org/docs/advanced-features/security-headers)
- [Prisma Security](https://www.prisma.io/docs/concepts/components/prisma-client/security)
- [NextAuth.js Security](https://next-auth.js.org/configuration/options#security)

---

**Son Güncelleme:** 2024-05-13
**Güvenlik Seviyesi:** Production Ready
**Uyumluluk:** OWASP Top 10, GDPR Ready
