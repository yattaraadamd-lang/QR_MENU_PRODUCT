# Antigravity Görevi — `AuthStatus` TypeScript Build Hatasını Düzelt

## Proje
- Repository: `https://github.com/yattaraadamd-lang/QR_MENU_PRODUCT`
- Branch: `main`
- Dosya: `src/app/menu/[businessId]/[tableNumber]/page.tsx`

## Render Build Hatası

```text
Type error: Type 'AuthStatus' is not assignable to type
'"PENDING" | "VIEW_ONLY" | "AUTHORIZED"'.

Type '"REVOKED"' is not assignable to type
'"PENDING" | "VIEW_ONLY" | "AUTHORIZED"'.

effectiveAuthStatus = serverSession.status;
```

## Kök Neden

Kodda önce:

```ts
if (
  authStatus === "REVOKED" ||
  authStatus === "TABLE_ALREADY_CLAIMED"
) {
  return;
}
```

kontrolü yapıldığı için TypeScript `authStatus` değişkenini:

```ts
"VIEW_ONLY" | "PENDING" | "AUTHORIZED"
```

tipine daraltıyor.

Ardından:

```ts
let effectiveAuthStatus = authStatus;
```

yazıldığı için `effectiveAuthStatus` da aynı dar tipe sahip oluyor.

Fakat `serverSession.status` tam `AuthStatus` tipidir ve `REVOKED` ile `TABLE_ALREADY_CLAIMED` değerlerini de içerebilir.

## Yapılacak Düzeltme

Şunu:

```ts
let effectiveAuthStatus = authStatus;
```

şununla değiştir:

```ts
let effectiveAuthStatus: AuthStatus = authStatus;
```

`as any`, `@ts-ignore` veya `@ts-expect-error` kullanma.

## Canonical Server Durumlarını Eksiksiz İşle

`serverSession.status` geldikten sonra şu durumları açıkça ele al:

```ts
let effectiveAuthStatus: AuthStatus = authStatus;

const serverSession =
  await fetchCanonicalSessionStatus(token);

if (serverSession.ok && serverSession.status) {
  effectiveAuthStatus = serverSession.status;

  if (effectiveAuthStatus !== authStatus) {
    setAuthStatus(effectiveAuthStatus);
  }

  if (effectiveAuthStatus === "REVOKED") {
    showToast(
      "Oturumunuz iptal edilmiş. Personelden yardım isteyin.",
      "err"
    );
    return;
  }

  if (
    effectiveAuthStatus === "TABLE_ALREADY_CLAIMED"
  ) {
    showToast(
      "Bu masa başka bir aktif oturuma ait. Personelden yardım isteyin.",
      "err"
    );
    return;
  }
}
```

Ardından mevcut akış:

```ts
if (effectiveAuthStatus === "AUTHORIZED") {
  await sendActualOrder(token);
  return;
}

if (effectiveAuthStatus === "PENDING") {
  showToast(
    "Garson onayı bekleniyor. Lütfen bekleyin.",
    "err"
  );
  return;
}

if (effectiveAuthStatus === "VIEW_ONLY") {
  // ORDER_REQUEST oluştur
}
```

şeklinde devam etmeli.

## Önceki Düzeltmeyi Bozma

Şu davranış korunmalı:

```text
QR okut
→ ürün ekle
→ Sipariş Talebi Oluştur
→ PENDING
→ garson doğrulama kodunu girer
→ CustomerSession AUTHORIZED
→ müşteri ekranı otomatik AUTHORIZED olur
→ sayfa yenilemeye gerek kalmaz
→ sepet korunur
→ gerçek sipariş gönderilir
```

Şunları geri getirme:

```text
yalnız local authStatus'a güvenme
AUTHORIZED durumda tekrar ORDER_REQUEST oluşturma
"Masanız açıldı, tekrar butona basın" davranışı
tokenı URL query'de taşıma
```

## Testler

Çalıştır:

```bash
npx tsc --noEmit
npx next build
```

Beklenen:

```text
0 TypeScript error
Next.js build successful
```

Fonksiyonel testler:

- [ ] PENDING → AUTHORIZED geçişi sayfa yenilemeden gerçekleşiyor.
- [ ] AUTHORIZED server state varken ikinci ORDER_REQUEST oluşmuyor.
- [ ] REVOKED durumda sipariş gönderilmiyor.
- [ ] TABLE_ALREADY_CLAIMED durumda sipariş gönderilmiyor.
- [ ] Sepet masa onayından sonra korunuyor.
- [ ] Render build başarılı.

## Teslim Raporu

```text
Kök neden:
Değiştirilen satır:
effectiveAuthStatus tipi:
REVOKED handling:
TABLE_ALREADY_CLAIMED handling:
tsc sonucu:
next build sonucu:
Render sonucu:
Değiştirilen dosyalar:
```

`npx tsc --noEmit` ve `npx next build` başarılı olmadan tamamlandı deme.
