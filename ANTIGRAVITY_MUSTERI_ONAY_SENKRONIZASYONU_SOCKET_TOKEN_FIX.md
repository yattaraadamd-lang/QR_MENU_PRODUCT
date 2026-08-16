# Antigravity Görevi — Müşteri Masa Onay Senkronizasyonu + Socket Token Hatalarını Düzelt

## Proje
- Repo: `https://github.com/yattaraadamd-lang/QR_MENU_PRODUCT`
- Branch: `main`
- Stack: Next.js + Prisma + Supabase + Socket.IO + Render

## Kullanıcıda Görülen Hatalı Akış

1. Müşteri QR okutur.
2. Sepete ürün ekler.
3. `Sipariş Talebi Oluştur` der.
4. Garson doğrulama kodunu girip `Masayı Aç` yapar.
5. Backend masa oturumunu açar ve CustomerSession'ı `AUTHORIZED` yapar.
6. Fakat müşteri ekranı `Garson Onayı Bekleniyor` durumunda takılı kalır.
7. Müşteri sayfayı yenileyince bile UI önce eski state ile davranabilir.
8. Tekrar butona basınca backend `SESSION_ALREADY_AUTHORIZED` döndürür, ancak o zaman UI “Masanız açıldı” durumuna geçer.
9. Müşteri gereksiz yere ekstra yenileme/tıklama yapmak zorunda kalır.

Bu davranış düzeltilmelidir.

## Console Hataları

```text
Failed to load resource: 404
WebSocket is closed before the connection is established
[Socket] Connection error: Invalid token format - signature required
/socket.io/... transport=polling ... 400
```

---

# 1. Kök Neden — Müşteri Yetki Durumu

Backend `open-table` endpointi doğru şekilde:

```text
CustomerSession.authorizationStatus = AUTHORIZED
CustomerSession.tableSessionId = yeni aktif TableSession
ServiceRequest = COMPLETED
Table = OCCUPIED
```

yapıyor.

Problem frontend senkronizasyonudur.

Mevcut müşteri ekranı:

```text
src/app/menu/[businessId]/[tableNumber]/page.tsx
```

`authStatus` state'ini client'ta tutuyor ve PENDING durumunda:

```text
GET /api/customer/session?token=...
```

ile polling yapıyor.

Bu yapı:

- tokenı URL query'de taşıyor,
- client state ile server state arasında stale state oluşturabiliyor,
- sayfa yüklemesinde stored token varsa canonical auth status yüklenmeden UI aktif hale gelebiliyor,
- submit sırasında server AUTHORIZED olsa bile local state VIEW_ONLY/PENDING kalabiliyor.

---

# 2. Canonical Session Status Endpoint Oluştur

Yeni endpoint:

```text
GET /api/customer/session/status
```

Token yalnız header'dan:

```text
x-session-token
```

alınmalı.

Query string token kullanımını kaldır.

Response:

```json
{
  "valid": true,
  "authorizationStatus": "AUTHORIZED",
  "tableSessionId": "...",
  "customerSessionId": "...",
  "tableId": "...",
  "businessId": "...",
  "orderRequestStatus": "COMPLETED"
}
```

Response header:

```text
Cache-Control: no-store, private
```

Kontroller:

- token mevcut
- CustomerSession ACTIVE
- expiresAt geçmemiş
- business/table eşleşmesi
- REVOKED doğru dönmeli
- AUTHORIZED ise aktif TableSession gerçekten mevcut ve session.tableSessionId ile aynı olmalı

Hata kodları:

```text
SESSION_TOKEN_REQUIRED       401
SESSION_NOT_FOUND            401
SESSION_EXPIRED              401
SESSION_REVOKED              403
SESSION_TABLE_MISMATCH       403
TABLE_SESSION_NOT_ACTIVE     409
```

Eski:

```text
GET /api/customer/session?token=...
```

kullanımlarını yeni endpoint'e geçir.

Tokenı URL'de taşımaya devam etme.

---

# 3. Müşteri Frontend State Senkronizasyonunu Düzelt

Yeni helper:

```ts
const fetchCanonicalSessionStatus = useCallback(
  async (token: string) => {
    const res = await fetch("/api/customer/session/status", {
      method: "GET",
      headers: {
        "x-session-token": token,
      },
      cache: "no-store",
    });

    const data = await res.json();

    return {
      ok: res.ok,
      status: data.authorizationStatus,
      tableSessionId: data.tableSessionId,
      code: data.code,
    };
  },
  []
);
```

## İlk yükleme

Stored session token bulunduğunda yalnız:

```ts
setSessionToken(storedToken)
```

yapıp bırakma.

Önce canonical status yükle.

UI sipariş aksiyonu aktif olmadan:

```text
sessionStateHydrated = true
```

olmalı.

Yeni state:

```ts
const [sessionStateHydrated, setSessionStateHydrated] = useState(false);
```

Canonical durum öğrenilene kadar butonu disabled yap:

```text
Oturum kontrol ediliyor...
```

Eğer server:

```text
AUTHORIZED
```

döndürürse sayfa yenilense bile doğrudan:

```text
Siparişi Gönder
```

durumuna geçmeli.

Asla tekrar `Sipariş Talebi Oluştur` göstermemeli.

---

# 4. PENDING Polling'i Güvenilir Hale Getir

PENDING durumunda:

```text
1-2 saniyede bir
```

status endpointini kontrol et.

Öneri:

```ts
useEffect(() => {
  if (authStatus !== "PENDING" || !sessionToken) return;

  let cancelled = false;

  const sync = async () => {
    const result = await fetchCanonicalSessionStatus(sessionToken);
    if (cancelled) return;

    if (result.status === "AUTHORIZED") {
      setAuthStatus("AUTHORIZED");
      setVerificationCode(null);
      setPendingRequestExpiresAt(null);
      await checkActiveRequests();
      showToast("Masanız açıldı! Siparişinizi gönderebilirsiniz. ✅");
    }

    if (result.status === "REVOKED") {
      setAuthStatus("REVOKED");
    }
  };

  sync();
  const timer = window.setInterval(sync, 1500);

  return () => {
    cancelled = true;
    window.clearInterval(timer);
  };
}, [
  authStatus,
  sessionToken,
  fetchCanonicalSessionStatus,
  checkActiveRequests
]);
```

Ayrıca:

```text
window focus
document visibilitychange → visible
online event
```

olduğunda bir kez anında sync et.

Multiple interval oluşturma.

Cleanup zorunlu.

---

# 5. Submit Sırasında Server State'i Tekrar Doğrula

En kritik düzeltme budur.

`submitOrder()` yalnız local `authStatus` değerine güvenmemeli.

Butona basıldığında sessionToken alındıktan sonra:

```ts
const serverSession =
  await fetchCanonicalSessionStatus(token);
```

çalıştır.

## Server AUTHORIZED ise

Local state VIEW_ONLY veya PENDING olsa bile:

```ts
setAuthStatus("AUTHORIZED");
```

de ve **aynı tıklamada gerçek sipariş gönderme akışına devam et**.

Müşteriye:

```text
Masanız açıldı, tekrar butona basın
```

deme.

Gereksiz ikinci tıklamayı kaldır.

Önerilen yapı:

```ts
const sendRealOrder = async (token: string) => {
  return fetch("/api/customer/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-session-token": token,
    },
    body: JSON.stringify({
      items: ...,
      note: ...,
      idempotencyKey: ...
    })
  });
};
```

`submitOrder()`:

```text
1. token
2. canonical status
3. AUTHORIZED → sendRealOrder()
4. PENDING → yalnız bekleme mesajı
5. VIEW_ONLY → ORDER_REQUEST oluştur
6. REVOKED → engelle
```

Bu sayede stale frontend state yüzünden ikinci ORDER_REQUEST çağrısı oluşmaz.

---

# 6. ORDER_REQUEST Sonrası Sepeti Koruma

İlk `Sipariş Talebi Oluştur` sırasında gönderilen ürünler müşterinin sepetinden silinmemeli.

Garson masa açtıktan sonra:

```text
cart korunmalı
button = Siparişi Gönder
```

olmalı.

Müşterinin ürünleri tekrar seçmesi gerekmemeli.

Gerçek `/api/customer/orders` başarılı olunca sepet temizlenmeli.

---

# 7. `SESSION_ALREADY_AUTHORIZED` Recovery Davranışı

Backend güvenlik için bu response'u koruyabilir:

```text
SESSION_ALREADY_AUTHORIZED
```

Ancak frontend bunu yalnız:

```text
toast göster ve return
```

şeklinde kullanmamalı.

Eğer ORDER_REQUEST endpointi bu kodu döndürürse:

```ts
setAuthStatus("AUTHORIZED");
```

ve mevcut sepeti doğrudan `/api/customer/orders` endpointine gönder.

Aynı kullanıcı aksiyonunda tamamlanmalı.

---

# 8. Socket Token Kök Nedeni

Socket server production runtime:

```text
src/lib/socket-auth-runtime.cjs
```

yalnız şu token biçimini kabul ediyor:

```text
base64(payload).hex_hmac_signature
```

Bu güvenlik davranışını ZAYIFLATMA.

Şunları geri getirme:

```text
unsigned base64 fallback
query token
auth'suz business room
```

Console:

```text
Invalid token format - signature required
```

client'ın server'a yanlış token verdiğini kanıtlıyor.

---

# 9. `get-session-token.ts` Düzelt

Dosya:

```text
src/lib/get-session-token.ts
```

Mevcut kod `getSession()` çağırdıktan sonra session içindeki hazır accessToken'ı kullanmıyor, browser cookie okumaya çalışıyor.

NextAuth session cookie HttpOnly olmalıdır; `document.cookie` ile okunmaya çalışılmamalı.

Dosyayı sadeleştir:

```ts
"use client";

import { getSession } from "next-auth/react";

export async function getSessionToken(): Promise<string | null> {
  try {
    const session = await getSession();

    const token =
      typeof session?.accessToken === "string"
        ? session.accessToken
        : null;

    if (!token || token.split(".").length !== 2) {
      return null;
    }

    return token;
  } catch (error) {
    console.error("[Socket Auth] Token retrieval failed");
    return null;
  }
}
```

`document.cookie` ile NextAuth tokenı arama.

Raw NextAuth JWT cookie'yi Socket tokenı olarak kullanma.

---

# 10. Bütün Socket Caller'larını Tara

Repo genelinde ara:

```bash
rg "getSocket|connectToBusinessRoom|getSessionToken|socket\.connect|io\(" src
```

Her çağrıyı kontrol et.

Socket'e gönderilen token yalnız:

```text
session.accessToken
```

olmalı.

Şu legacy patternleri kaldır:

```text
btoa(...)
Buffer.from(...).toString("base64")
raw next-auth cookie
businessId'nin token gibi gönderilmesi
eski localStorage socket token
```

Server'ın beklediği format ile client'ın ürettiği format aynı olmalı.

---

# 11. Socket Reconnect Spam'ini Durdur

`src/lib/socket-client.ts` şu auth hata kodlarını fatal saymalı:

```text
NO_TOKEN
INVALID_TOKEN
INVALID_TOKEN_FORMAT
INVALID_SIGNATURE
INVALID_TOKEN_PAYLOAD
USER_DISABLED
USER_NOT_FOUND
BUSINESS_MISMATCH
ROLE_MISMATCH
SERVER_CONFIG_ERROR
```

Bu durumlarda:

```ts
socket.io.opts.reconnection = false;
socket.disconnect();
```

ve auth failure event gönder.

Sonsuz reconnect yapma.

`TOKEN_EXPIRED` için:

1. socket disconnect
2. `getSession()` ile yeni `session.accessToken` al
3. en fazla bir kontrollü reconnect
4. hala başarısızsa dur

`reconnectionAttempts: Infinity` auth hatalarında devre dışı kalmalı.

Bu düzeltme console'daki tekrar eden:

```text
400
WebSocket closed
Invalid token format
Session ID unknown
```

spam'ini kesmelidir.

---

# 12. Customer Page Staff Socket'e Bağlanmamalı

Müşteri QR menü ekranı staff/business Socket.IO odasına bağlanmamalı.

Staff Socket auth:

```text
ADMIN
WAITER
SUPER_ADMIN
```

içindir.

Müşteri masa onay state'i için bu görevde canonical HTTP polling kullan.

Müşteri için ileride real-time socket istenecekse ayrı:

```text
customer session scoped socket token
customer_session_<random-id> room
```

tasarlanmalıdır.

Client'a business staff room erişimi verme.

---

# 13. 404 Hatasını Gerçek URL ile Bul

Console'daki:

```text
Failed to load resource: 404
```

için tahmin yapma.

Chrome Network veya log üzerinden gerçek Request URL'yi tespit et.

Kiro local/Playwright test sırasında 404 veren URL'yi kaydet.

Eğer eski:

```text
/api/socket-token
/api/auth/socket-token
legacy session endpoint
eski asset
```

çağrısı varsa caller'ı yeni akışa geçir.

404'ü catch ile gizleme.

---

# 14. Socket.IO 400 / Session ID Unknown

Önce INVALID_TOKEN_FORMAT sorununu çöz.

Ardından hala:

```text
Session ID unknown
```

varsa kontrol et:

- aynı socket singleton mı?
- component renderlarında yeni socket oluşturuluyor mu?
- polling requestleri farklı Render instance'larına mı gidiyor?
- birden fazla Render instance varsa sticky session gerekiyor mu?

Tek instance ortamında doğru token ile hata kalmamalı.

Gerekirse güvenilir Render ortamında:

```ts
transports: ["websocket"]
```

test et.

Bunu token hatasını gizlemek için ilk çözüm olarak kullanma.

---

# 15. Backend `open-table` Sonrası State Doğrulaması

Mevcut atomik işlem korunmalı:

```text
TableSession ACTIVE
Bill OPEN
Table OCCUPIED
CustomerSession AUTHORIZED
CustomerSession.tableSessionId = active session
ORDER_REQUEST COMPLETED
```

Transaction sonrasında response'a ekle:

```json
{
  "authorizationStatus": "AUTHORIZED",
  "customerSessionId": "...",
  "tableSessionId": "..."
}
```

Staff panel bu sonucu düzgün işlemeli.

İşlem başarılıysa DB'de CustomerSession'ın gerçekten AUTHORIZED olduğunu integration test ile doğrula.

---

# 16. Cache Sorununu Önle

Şu endpointlerde:

```text
/api/customer/session/status
/api/customer/active-requests
```

header:

```text
Cache-Control: no-store, private
```

kullan.

Frontend fetch:

```ts
cache: "no-store"
```

kullansın.

Browser/CDN eski PENDING cevabı cachelememeli.

---

# 17. Zorunlu Fonksiyonel Testler

## FLOW-01 Normal onay

1. QR okut.
2. Ürün sepete ekle.
3. Sipariş Talebi Oluştur.
4. UI `PENDING`.
5. Kod garsona söyle.
6. Garson Masayı Aç.

Beklenen en geç 2 saniye içinde:

```text
authStatus = AUTHORIZED
verification code paneli kaybolur
button = Siparişi Gönder
cart aynen durur
```

Sayfa yenileme GEREKMEMELİ.

## FLOW-02 Sipariş gönderimi

FLOW-01 sonrası aynı sepette:

```text
Siparişi Gönder
```

bas.

Beklenen:

```text
/api/customer/orders → 201
cart temizlenir
sipariş garson paneline düşer
```

## FLOW-03 Stale local state

Server CustomerSession = AUTHORIZED iken client local state'i testte zorla PENDING yap.

Butona bas.

Beklenen:

```text
canonical status serverdan AUTHORIZED gelir
ikinci ORDER_REQUEST oluşturulmaz
gerçek order aynı tıklamada gönderilir
```

## FLOW-04 Refresh

Masa zaten AUTHORIZED iken sayfayı yenile.

Beklenen:

```text
Oturum kontrol ediliyor...
→ Siparişi Gönder
```

Asla:

```text
Sipariş Talebi Oluştur
```

göstermemeli.

## FLOW-05 Pending

Garson henüz onaylamadı.

Beklenen:

```text
Garson Onayı Bekleniyor
```

Buton disabled.

İkinci ORDER_REQUEST oluşmaz.

## FLOW-06 Rejected/revoked

Garson reddeder.

Beklenen session state serverdan alınır ve sipariş engellenir.

---

# 18. Socket Testleri

## SOCKET-01 Staff login

Admin/Waiter login.

`session.accessToken` formatı:

```text
payload.signature
```

olmalı.

Socket başarılı bağlanmalı.

## SOCKET-02 Console

Şunlar olmamalı:

```text
Invalid token format - signature required
WebSocket is closed before connection established
repeated /socket.io 400
Session ID unknown loop
```

## SOCKET-03 Invalid token

İmzasız base64 token gönder.

Beklenen:

```text
INVALID_TOKEN_FORMAT
```

ve client yeniden bağlanmayı durdurmalı.

## SOCKET-04 Tenant

Business A kullanıcısı yalnız A room'una bağlanmalı.

Business B eventleri gelmemeli.

---

# 19. Regresyon Testleri

- [ ] ORDER_REQUEST oluşturma
- [ ] doğrulama kodu
- [ ] Masayı Aç
- [ ] customer AUTHORIZED
- [ ] gerçek order
- [ ] waiter requests
- [ ] payment request
- [ ] admin payment
- [ ] cihaz engeli
- [ ] stok sistemi
- [ ] `npm run build`
- [ ] `npx prisma validate`
- [ ] Render production start
- [ ] console critical error yok

---

# 20. Değiştirilmesi Beklenen Dosyalar

En az:

```text
src/app/menu/[businessId]/[tableNumber]/page.tsx
src/app/api/customer/session/route.ts
src/app/api/customer/session/status/route.ts
src/app/api/customer/active-requests/route.ts
src/app/api/waiter/service-requests/[id]/open-table/route.ts
src/lib/get-session-token.ts
src/lib/socket-client.ts
src/lib/socket-auth-runtime.cjs
src/lib/socket-auth.ts
```

Ayrıca `connectToBusinessRoom` caller'larını repo genelinde incele.

---

# 21. Teslim Raporu

```text
Müşteri PENDING kalma kök nedeni:
Canonical status endpoint:
Eski query-token kullanımları kaldırıldı mı:
Refresh sonrası auth sonucu:
Stale state testi:
Sepet korundu mu:
ORDER_REQUEST duplicate sonucu:

Socket'e yanlış token gönderen caller:
Eski token formatı:
Yeni token formatı:
getSessionToken değişikliği:
Fatal reconnect değişikliği:
404 veren gerçek URL:
Session ID unknown kaldı mı:

FLOW-01:
FLOW-02:
FLOW-03:
FLOW-04:
SOCKET-01:
SOCKET-02:
Tenant testi:
Build:
Render deploy:
Değiştirilen dosyalar:
Başarısız kalan test:
```

Aşağıdakiler gerçek ortam/staging testinde geçmeden “tamamlandı” deme:

1. Garson masayı açınca müşterinin ekranı yenilemeden AUTHORIZED oluyor.
2. Sepet korunuyor ve müşteri doğrudan gerçek siparişi gönderebiliyor.
3. Sayfa yenilenince tekrar ORDER_REQUEST akışına düşmüyor.
4. Socket console'da `Invalid token format - signature required` döngüsü bitiyor.
5. Socket tenant izolasyonu korunuyor.
