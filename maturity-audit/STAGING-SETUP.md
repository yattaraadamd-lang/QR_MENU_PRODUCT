# Staging kurulumu (Render + Neon)

Amaç: canlıya dokunmadan yük (k6) ve girdi fuzz testlerinin çalıştırılabileceği ayrı bir ortam.
Staging, canlıyla aynı kodu ve aynı Render free planını kullanır; ayrı bir veritabanı, ayrı gizli
anahtarları ve iyzico sandbox ayarı vardır. Hiçbir sayfası arama motorlarında dizine eklenmez.

> Gizli değerler repoda yok. `NEXTAUTH_SECRET` ve `CUSTOMER_DEVICE_HMAC_SECRET` değerlerini Render
> kendisi üretir. Veritabanı ve iyzico anahtarlarını yalnızca Render paneline girin.

## 0. Önce bu PR'ı birleştirin

Staging, `main` dalından deploy edilir. noindex ayarı (`APP_ENV=staging`) bu PR ile geliyor.
Canlıda `APP_ENV` tanımlı olmadığı için canlının davranışı değişmez.

## 1. Veritabanı (Neon): boş ve ayrı bir veritabanı

**Canlı veritabanının veri kopyasını taşıyan bir branch kullanmayın.** Staging herkese açık bir
adreste çalışacak ve demo hesaplarının şifreleri zayıf. Gerçek işletme, çalışan ya da müşteri
verisi orada bulunmamalı. Bir başka neden: sadece şemayı kopyalayan (schema-only) branch'te
`_prisma_migrations` geçmişi gelmediği için `prisma migrate deploy` hata verir.

**A. Önerilen yol: ayrı bir Neon projesi**
1. Neon Console → **New Project**
2. Ad: `qr-menu-staging`. Bölge: **AWS Europe Central 1 (Frankfurt)**. Postgres sürümü canlıyla aynı olsun.
3. Proje sayfası → **Connect**
   - **Connection pooling açık** iken görünen dizeyi `DATABASE_URL` olarak alın.
   - **Connection pooling kapalı** iken görünen dizeyi `DATABASE_URL_UNPOOLED` olarak alın.
   - Ek parametreler (`sslmode`, `pgbouncer`, `connect_timeout` vb.) canlıdaki `DATABASE_URL` ile aynı olsun.

**B. Neon'da proje sınırı doluysa**
1. Canlı projede **Branches → Create branch** ile `staging` adında bir branch açın.
2. Bu branch seçiliyken **Databases → New database** ile `qrmenu_staging` adında **boş** bir veritabanı oluşturun.
3. **Connect** ekranında branch olarak `staging`, veritabanı olarak `qrmenu_staging` seçin ve iki dizeyi A'daki gibi alın.
   Branch'in varsayılan veritabanında canlı verinin bir kopyası durur. Uygulama ona bağlanmaz, ama
   bu kopyanın Neon'da bulunmasını istemiyorsanız A yolunu tercih edin.

Canlı veritabanı Supabase'deyse, ayrı ve ücretsiz bir Supabase projesi de aynı işi görür.

## 2. Render: staging servisi

1. Render Dashboard → **New → Blueprint**
2. Repo: `yattaraadamd-lang/QR_MENU_PRODUCT`. Branch: `main`.
   **Blueprint Path: `render.staging.yaml`.** Bu dosya, canlının kullandığı `render.yaml` değildir.
3. Render, `sync: false` olan değerleri sorar:
   | Anahtar | Değer |
   |---|---|
   | `DATABASE_URL` | 1. adımdaki pooled staging dizesi |
   | `DATABASE_URL_UNPOOLED` | 1. adımdaki doğrudan (unpooled) staging dizesi |
   | `IYZICO_API_KEY`, `IYZICO_SECRET_KEY`, `IYZICO_MERCHANT_ID` | **Yalnızca sandbox** anahtarları (sandbox-merchant.iyzipay.com). Boş bırakılabilir; o durumda abonelik ödemesi "Yakında" görünür. |
4. **Apply.** İlk build, `prisma migrate deploy` ile şemayı staging veritabanına kurar.
   Build log'unda `Using DATABASE_URL_UNPOOLED for migrations` satırını görün ve migrate çıktısındaki
   host'un staging'e ait olduğundan emin olun.
5. Servisin adresi `https://qr-menu-platform-staging.onrender.com` değilse (ad alınmışsa Render bir ek
   koyar): servis → **Environment** → `NEXTAUTH_URL` ve `NEXT_PUBLIC_APP_URL` değerlerini gerçek adresle
   değiştirin → **Manual Deploy → Clear build cache & deploy**. `NEXT_PUBLIC_*` değerleri derleme
   sırasında koda gömüldüğü için yeniden derleme şarttır.

Blueprint ekranında "Blueprint Path" alanı yoksa servisi **New → Web Service** ile elle açın ve
`render.staging.yaml` içindeki ayarları birebir girin. `NEXTAUTH_SECRET` ve
`CUSTOMER_DEVICE_HMAC_SECRET` için paneldeki **Generate** düğmesini kullanın.

Free planda tüm free servisler aylık 750 saati paylaşır. Staging boşta kaldığında uyuduğu için bu
genelde sorun olmaz. Uzun süre kullanmayacaksanız servisi **Suspend** edin.

## 3. Demo verisi (seed)

Testler demo işletmesini (`demo-business-id`) kullanır. Render free planda Shell olmadığı için seed'i
kendi bilgisayarınızdan **bir kez** çalıştırın:

```powershell
cd qr-menu-platform
$env:DATABASE_URL = "<STAGING unpooled dizesi>"
npx tsx prisma/seed.ts
Remove-Item Env:DATABASE_URL
```

> ⚠️ Dizenin **staging**'e ait olduğunu iki kez kontrol edin. Seed, `admin123` gibi zayıf şifrelerle
> demo hesapları oluşturur. Bilgisayarınızda `NODE_ENV` tanımlı olmadığı için koruma devreye girmez,
> bu yüzden yanlışlıkla canlı dizesi girilirse bu hesaplar canlıya yazılır.

## 4. Kontrol

- `https://<staging>/api/health` → `"status":"healthy"`
- `https://<staging>/robots.txt` → `Disallow: /`
- Herhangi bir sayfanın yanıt başlıklarında `X-Robots-Tag: noindex, nofollow` bulunur.
- `https://<staging>/menu/demo-business-id/1` → demo menü açılır.

## 5. Testler

Staging hazır olunca adresi Claude'a iletin; testleri o çalıştırır ve sonuçları
`maturity-audit/LOAD-FUZZ.md` dosyasına yazar. Elle çalıştırmak isterseniz önce k6'yı kurun
(`winget install k6 --source winget`), ardından:

```powershell
$env:BASE_URL = "https://qr-menu-platform-staging.onrender.com"
k6 run -e BASE_URL=$env:BASE_URL maturity-audit/tests/load/normal.js
k6 run -e BASE_URL=$env:BASE_URL maturity-audit/tests/load/spike.js
k6 run -e BASE_URL=$env:BASE_URL maturity-audit/tests/load/bots.js
k6 run -e BASE_URL=$env:BASE_URL maturity-audit/tests/load/ratelimit.js
node maturity-audit/tests/fuzz-customer.mjs
```

Betikler canlı host'u (`qr-menu-product.onrender.com`) her koşulda reddeder. Adında `staging`
geçmeyen host'ları da (localhost hariç) çalıştırmaz.

| Betik | Ne ölçer | Hedef |
|---|---|---|
| `load/normal.js` | 10 eşzamanlı kullanıcı, 5 dk (%70 QR müşterisi, %30 landing) | hata < %1, API p95 < 800 ms, sayfa p95 < 1500 ms, 5xx yok |
| `load/spike.js` | 60. saniyede 10 sn içinde 10 kat kullanıcı, 1 dk kalır | hata < %1; mevcut kullanıcıların API p95 değeri < 1600 ms |
| `load/bots.js` | 20+ bot UA (Googlebot, GPTBot, ClaudeBot, Bytespider…) + agresif tarayıcı + aynı anda gerçek müşteriler | 5xx yok, bot ile tarayıcı aynı durum kodunu alır, robots.txt 200, noindex |
| `load/ratelimit.js` | 429 + `Retry-After`; sahte `CF-Connecting-IP`/`X-Forwarded-For` ile limit atlatma | 429 doğru dönmeli, sahte başlık limiti atlatamamalı |
| `fuzz-customer.mjs` | `/api/customer/*`: yanlış tipler, çok uzun metinler, unicode/NUL, enjeksiyon, bozuk JSON | 5xx yok, stack trace / Prisma mesajı yok |

Ayarlar: `-e BASE_VUS=10`, `-e P95_API_MS=800`, `-e BOT_RATE=5`. Demo masası çakışırsa
`-e RL_TABLE_NUMBER=3` ya da `FUZZ_TABLE_NUMBER=4` ile başka bir masa seçin.
`ratelimit.js`, bu IP'nin staging'deki davet doğrulama hakkını 15 dakika boyunca tüketir.
