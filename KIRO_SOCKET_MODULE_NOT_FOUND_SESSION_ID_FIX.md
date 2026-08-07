# Kiro Görevi — Socket.IO `ERR_MODULE_NOT_FOUND` ve `Session ID unknown` Hatasını Düzelt

## Proje
- Repo: `https://github.com/yattaraadamd-lang/QR_MENU_PRODUCT`
- Branch: `main`
- Runtime: Render
- Start komutu: `node server.js`

## Canlı Hata

```text
[Socket] Middleware error:
Cannot find module '/opt/render/project/src/src/lib/prisma'
imported from /opt/render/project/src/src/lib/socket-auth.ts

code: ERR_MODULE_NOT_FOUND

[Socket.IO] Connection error:
Session ID unknown
```

## Kesin Kök Neden

`server.js` production'da doğrudan Node ile çalışıyor:

```json
"start": "node server.js"
```

ve Socket middleware'i şu şekilde yüklüyor:

```js
const { authenticateSocket } =
  require("./src/lib/socket-auth.ts");
```

`src/lib/socket-auth.ts` içinde:

```ts
import { prisma } from "./prisma";
```

var.

Gerçekte dosya:

```text
src/lib/prisma.ts
```

olarak mevcut.

Next.js/TypeScript bundler geliştirme/build sırasında extensionless `./prisma` importunu çözebilir; ancak `node server.js` tarafından runtime'da doğrudan yüklenen `.ts` modülü aynı bundler çözümlemesini kullanmaz.

Bu nedenle Node şu yolu arıyor:

```text
/src/lib/prisma
```

ve `prisma.ts` dosyasını bulamıyor.

`Session ID unknown` hatası büyük ihtimalle middleware bağlantılarının sürekli başarısız olması ve Socket.IO istemcisinin reconnect/polling denemelerinin eski session ID ile devam etmesinin ikincil sonucudur.

---

# Görev

Sorunu yalnız import satırına `.ts` ekleyerek geçici kapatma. Production runtime'ı Node sürümüne bağımlı kırılgan TypeScript source loading yapısından çıkar.

## 1. `server.js` içinde `.ts` dosyasını doğrudan require etme

Şu yapı kaldırılmalı:

```js
require("./src/lib/socket-auth.ts")
```

Production server `node server.js` ile çalışıyorsa runtime Socket authentication modülü JavaScript/CommonJS veya build edilmiş JavaScript olmalı.

### Tercih edilen çözüm

Yeni dosya oluştur:

```text
src/lib/socket-auth-runtime.cjs
```

ve Socket authentication kodunun server runtime için gerekli kısmını buraya taşı.

`server.js`:

```js
const {
  authenticateSocket,
} = require("./src/lib/socket-auth-runtime.cjs");
```

olmalı.

`socket-auth-runtime.cjs` doğrudan TypeScript kaynak dosyalarına import yapmamalı.

## 2. Prisma runtime modülünü güvenli oluştur

Yeni CommonJS runtime singleton oluştur:

```text
src/lib/prisma-runtime.cjs
```

Örnek:

```js
const { PrismaClient } = require("@prisma/client");

const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.__socketPrisma ||
  new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__socketPrisma = prisma;
}

module.exports = { prisma };
```

Socket runtime:

```js
const { prisma } =
  require("./prisma-runtime.cjs");
```

kullansın.

Alternatif olarak mevcut Prisma singletonını build ederek ortak JavaScript modülüne dönüştürmek daha temizse onu uygula.

Ama production'da:

```text
server.js -> raw .ts -> raw .ts import
```

zinciri bırakma.

## 3. `prisma.ts` dosyasının varlığını doğrula

Dosya şu anda mevcut olmalı:

```text
src/lib/prisma.ts
```

Bu dosyayı silme.

Next.js API route'ları mevcut:

```ts
import { prisma } from "@/lib/prisma";
```

kullanımına devam edebilir.

Sorun dosyanın olmaması değil, custom Node server tarafından TypeScript modül çözümlemesinin yanlış yapılmasıdır.

## 4. Build/start testini production komutuyla yap

Sadece:

```bash
npm run build
```

testi yeterli değildir.

Şunları çalıştır:

```bash
npm ci
npx prisma generate
npm run build
NODE_ENV=production npm start
```

Server açıldıktan sonra Socket.IO bağlantısı kur ve logda şunların bulunmadığını doğrula:

```text
ERR_MODULE_NOT_FOUND
Cannot find module .../src/lib/prisma
AUTH_MIDDLEWARE_ERROR
```

---

# Kritik Güvenlik Düzeltmeleri

Bu runtime hatasını düzeltirken mevcut Socket authentication güvenlik açığını da kapat.

## 5. İmzasız legacy token fallback'ini kaldır

Mevcut `socket-auth.ts` içinde token iki parçalı değilse şu mantık var:

```ts
if (parts.length !== 2) {
  const jsonString =
    Buffer.from(token, "base64").toString("utf-8");

  decoded = JSON.parse(jsonString);
}
```

Bu, imzasız base64 tokenların kabul edilmesine yol açar.

Production'da yasak.

Token mutlaka:

```text
payload.signature
```

formatında olmalı ve HMAC doğrulaması geçmelidir.

Doğru:

```js
const parts = token.split(".");

if (parts.length !== 2) {
  return next(
    createSocketError(
      "Invalid authentication token",
      "INVALID_TOKEN_FORMAT"
    )
  );
}
```

Legacy unsigned token desteğini tamamen kaldır.

## 6. Tokenı query string'den alma

Şu kullanım kaldırılmalı:

```ts
socket.handshake.query?.token
```

Yalnız:

```ts
socket.handshake.auth?.token
```

kullan.

## 7. HMAC doğrulamasını sağlamlaştır

`timingSafeEqual()` öncesinde buffer uzunluklarını kontrol et.

```js
const actual = Buffer.from(signature, "hex");
const expected = Buffer.from(expectedSig, "hex");

if (
  actual.length !== expected.length ||
  !crypto.timingSafeEqual(actual, expected)
) {
  return next(
    createSocketError(
      "Invalid authentication token",
      "INVALID_SIGNATURE"
    )
  );
}
```

Malformed hex middleware'i düşürmemeli.

## 8. Token expiry doğrulaması

`iat` yoksa tokenı kabul etme.

Mümkünse ayrıca `exp` kullan.

## 9. Database doğrulamasını koru

Token sonrası DB'den:

```text
user.id
businessId
role
isActive
deletedAt
```

kontrolleri korunmalı.

Client business ID yetki kaynağı olmamalı.

Socket yalnız:

```text
business_${databaseUser.businessId}
```

odasına girebilmeli.

---

# `Session ID unknown` Testi

Önce module import hatasını düzelt.

Sonra hata devam ediyorsa:

## Tek instance
Client socket'in React renderlarında tekrar tekrar oluşturulmadığını kontrol et.

## Birden fazla Render instance
Polling kullanılıyorsa sticky session ihtiyacını kontrol et.

Çözüm sırası:

1. Sticky sessions
2. Redis adapter
3. Uygunsa WebSocket-only:

```js
transports: ["websocket"]
```

Import hatası çözülmeden sticky-session ayarlarını değiştirme.

---

# Kabul Testleri

- [ ] `npm run build` başarılı.
- [ ] `NODE_ENV=production npm start` başarılı.
- [ ] `ERR_MODULE_NOT_FOUND` yok.
- [ ] `src/lib/prisma` module hatası yok.
- [ ] Geçerli imzalı token ile socket bağlanıyor.
- [ ] Token yoksa bağlantı reddediliyor.
- [ ] İmzasız base64 token reddediliyor.
- [ ] Hatalı signature reddediliyor.
- [ ] Pasif kullanıcı reddediliyor.
- [ ] Business A kullanıcısı B odasına giremiyor.
- [ ] `Session ID unknown` normal kullanımda görünmüyor.
- [ ] Reconnect çalışıyor.

# Teslim Raporu

```text
Kök neden:
Node sürümü:
Eski runtime import zinciri:
Yeni runtime import zinciri:
ERR_MODULE_NOT_FOUND düzeldi mi:
Session ID unknown kaldı mı:
Unsigned token fallback kaldırıldı mı:
Query token kaldırıldı mı:
Tenant isolation testi:
Build sonucu:
Production start testi:
Render deploy sonucu:
Değiştirilen dosyalar:
```

Geçerli authenticated Socket.IO bağlantısı production start komutuyla test edilmeden görevi tamamlandı sayma.
