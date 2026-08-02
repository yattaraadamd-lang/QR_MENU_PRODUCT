# QR Menü — Admin Cihaz Engel Yönetimi ve Nakit Ödeme Düzeltmesi

## Rol
Bu repoda kıdemli Full Stack geliştirici olarak çalış:
`https://github.com/yattaraadamd-lang/QR_MENU_PRODUCT/tree/main`

Mevcut çalışan sipariş, QR, masa oturumu ve ödeme akışlarını bozma. Gereksiz refactor, yeni paket ve kapsam dışı tasarım değişikliği yapma.

## Hedefler
1. Engellenen müşteri cihazlarını yalnız admin panelinden görüntüleme ve engel kaldırma.
2. Nakit ödeme seçeneğini güvenilir, kayıt altına alınabilir ve admin kontrollü biçimde çalıştırma.

---

# A. Admin Panelinden Cihaz Engelini Kaldırma

## Mevcut yapı
- `CustomerAccessBlock` ve `deviceKeyHash` yapısını yeniden oluşturma; mevcut modeli kullan.
- Aktif engel ölçütü: `revokedAt === null`.
- Engel kaydını silme. Engel kaldırıldığında `revokedAt` doldurularak geçmiş korunmalı.

## Backend

### 1. Listeleme endpointi
Oluştur:
`GET /api/admin/customer-access-blocks`

Kurallar:
- Yalnız `ADMIN` erişebilsin.
- `businessId` istemciden alınmasın; giriş yapan adminin işletmesinden türetilsin.
- Varsayılan olarak yalnız aktif engelleri getir.
- Destekle: `status=active|revoked|all`, sayfalama ve en yeni önce sıralama.
- Dönen alanlar:
  - `id`
  - maskelenmiş cihaz özeti
  - `reason`
  - `sourceRequestId`
  - engelleyen kullanıcı
  - `createdAt`
  - `revokedAt`
- Tam `deviceKeyHash` değerini frontend'e gönderme.

### 2. Engel kaldırma endpointi
Oluştur:
`PATCH /api/admin/customer-access-blocks/[id]/revoke`

Body:
```json
{ "note": "İsteğe bağlı admin açıklaması" }
```

Kurallar:
- Yalnız `ADMIN`.
- Kayıt mutlaka adminin kendi işletmesine ait olmalı.
- Aktif engelde `revokedAt = now()` yap.
- Mümkünse şemaya `revokedById` ve `revocationNote` ekleyerek işlemi denetlenebilir tut.
- Aynı istek tekrar gönderilirse yeni kayıt oluşturma; mevcut kaldırılmış durumu idempotent olarak döndür.
- Eski `REVOKED` müşteri oturumunu tekrar aktif etme. Kullanıcı QR'ı yeniden okuttuğunda yeni, yetkisiz `VIEW_ONLY` oturum oluşturulsun ve normal masa doğrulama sürecinden geçsin.
- Garson rolüne engel kaldırma yetkisi verme.

### 3. Veri bütünlüğü
- Aynı işletme ve cihaz için aynı anda birden fazla aktif engel oluşmasını veritabanı seviyesinde önle.
- Mevcut kayıtlarla uyumlu, veri kaybettirmeyen Prisma migration oluştur.

## Admin arayüzü
Oluştur:
`/admin/blocked-devices`

Admin menüsüne **Engelli Cihazlar** bağlantısı ekle.

Sayfada göster:
- Aktif / kaldırılmış filtreleri
- Maskelenmiş cihaz kimliği
- Engel nedeni
- Engel tarihi
- Engelleyen kişi
- Kaynak talep bilgisi mevcutsa masa/talep özeti
- Durum
- Yalnız aktif kayıtta **Engeli Kaldır** butonu

Engel kaldırma işlemi:
- Onay penceresi açsın.
- İsteğe bağlı açıklama alınabilsin.
- Başarılı işlemden sonra listeyi yenilesin.
- Çift tıklamayı önlesin.
- Başarı ve hata mesajlarını Türkçe göstersin.

---

# B. Nakit Ödeme Sistemini Düzeltme

## Temel sorun
Projede ödeme tamamlama mantığı birden fazla endpointte farklı uygulanıyor. Admin nakit ödeme ekranı `receivedAmount` göndermiyor; bazı endpointler nakit doğrulama hatalarını genel `500` hatasına dönüştürüyor. Ödeme iş mantığını tek serviste birleştir.

## Yetki kuralı
- `PAID` durumuna geçirme, ciroya işleme, adisyon ve masa kapatma yalnız admin tarafından yapılmalı.
- Garson ödeme talebi/alınacak ödeme bilgisi oluşturabilir fakat nihai finansal onayı veremez.
- Mevcut admin onay akışını bozma.

## Tek ödeme servisi
`table-flow.service.ts` veya mevcut uygun ödeme servisinde tek bir atomik fonksiyon oluştur ve admin ödeme endpointlerini buna yönlendir.

Önerilen giriş:
```ts
{
  billId: string;
  amount: number;
  method: "CASH" | "CARD" | "ONLINE" | "OTHER";
  receivedAmount?: number;
  note?: string;
  idempotencyKey?: string;
  adminId: string;
  businessId: string;
}
```

Kurallar:
1. Adisyon ve işletme eşleşmesini sunucuda doğrula.
2. Kalan borcu sunucuda yeniden hesapla.
3. `amount > 0` ve `amount <= remainingDue` olmalı.
4. `CASH` için `receivedAmount` zorunlu ve `receivedAmount >= amount` olmalı.
5. Para üstü: `changeAmount = receivedAmount - amount`.
6. Ciroya yalnız `amount` ekle; müşterinin verdiği toplam nakdi ekleme.
7. Kart/online ödemede `receivedAmount` ve `changeAmount` boş olmalı.
8. Parasal hesapları kayan noktalı sayı eşitliğiyle yapma; Prisma Decimal veya kuruş tabanlı güvenli hesap kullan.
9. Kısmi ve karma ödeme desteklenmeli. Daha önce bir `PAID` kaydı olması yeni ödemeyi otomatik reddetmemeli; yalnız kalan borç kadar ödeme alınmalı.
10. Tam ödeme olduğunda aynı transaction içinde:
    - ödeme kaydını `PAID` yap,
    - adisyonu kapat,
    - masa oturumunu kapat,
    - masayı uygun boş duruma getir,
    - ilgili müşteri oturumlarını sonlandır.
11. Kısmi ödemede masa ve adisyon açık kalmalı.
12. Aynı isteğin iki kez finansal kayıt oluşturmasını idempotency ile engelle.

## Prisma
`Payment` modeline eksikse ekle:
```prisma
receivedAmount Decimal? @db.Decimal(10, 2)
changeAmount   Decimal? @db.Decimal(10, 2)
idempotencyKey String?  @unique
```

Alan adlarını mevcut proje standardına uyarla. Güvenli migration oluştur.

## Admin ödeme ekranı
Nakit seçildiğinde göster:
- **Borçtan Tahsil Edilecek Tutar**
- **Müşteriden Alınan Nakit**
- Anlık **Para Üstü**

Gönderilecek body geçiş süresince geriye uyumlu olsun:
```json
{
  "amount": 250,
  "method": "CASH",
  "receivedAmount": 300,
  "note": "",
  "idempotencyKey": "..."
}
```

Backend geçici olarak eski `paymentMethod` alanını da kabul edip `method` alanına normalize edebilir. `CREDIT_CARD` gelirse mevcut enumdaki `CARD` değerine dönüştür.

## Hata yönetimi
Aşağıdaki durumlarda genel `500` yerine açıklayıcı hata dön:
- Eksik alınan nakit: `400 CASH_RECEIVED_AMOUNT_REQUIRED`
- Alınan nakit yetersiz: `400 INSUFFICIENT_CASH_RECEIVED`
- Tutar kalan borçtan fazla: `400 AMOUNT_EXCEEDS_REMAINING_DUE`
- Başka işletmeye ait kayıt: `404`
- Yetkisiz rol: `403`
- Aynı idempotency anahtarı: önceki başarılı sonucu döndür

Frontend backend mesajını kullanıcıya Türkçe gösterirken ödeme butonunu tekrar aktif etsin.

## Eski endpointler
Aynı ödeme işini yapan eski admin endpointlerini silerek route kırma. İş mantıklarını kaldırıp tek ödeme servisine yönlendir. Garsonun doğrudan `PAID` yapan endpointi varsa finansal tamamlamayı durdur ve admin onay akışına yönlendir.

---

# Kabul Testleri

## Cihaz engeli
1. Admin yalnız kendi işletmesinin aktif engellerini görür.
2. Garson listeyi göremez ve engel kaldıramaz.
3. Admin engeli kaldırınca `revokedAt` dolar; kayıt silinmez.
4. Engel kaldırılan cihaz QR'ı yeniden okuttuğunda yeni `VIEW_ONLY` oturum alabilir.
5. Eski reddedilmiş oturum otomatik yetkilendirilmez.
6. Başka işletmenin engel kimliğiyle işlem yapılamaz.
7. Aynı engel kaldırma isteği iki kez hata veya ikinci mutation üretmez.

## Nakit ödeme
1. 250 TL borç, 250 TL nakit: ödeme başarılı, para üstü 0.
2. 250 TL borç, 300 TL nakit: ödeme başarılı, para üstü 50 TL.
3. 250 TL borç, 200 TL nakit: `400`, finansal kayıt değişmez.
4. Nakit seçilip alınan tutar boş bırakılırsa açıklayıcı hata gösterilir.
5. Önce kartla kısmi, sonra nakitle kalan borç ödenebilir.
6. Kısmi ödeme masayı kapatmaz.
7. Tam ödeme masa/adisyon/oturumları tek transaction ile kapatır.
8. Aynı ödeme iki kez tıklanınca tek ödeme oluşur.
9. Garson nihai `PAID` işlemi yapamaz.
10. Kart ve online ödeme akışları bozulmaz.

# Teslim Kuralları
- Önce ilgili dosyaları incele, mevcut auth ve servis yardımcılarını yeniden kullan.
- Yalnız gerekli dosyaları değiştir.
- TypeScript hatası, lint hatası ve Prisma uyumsuzluğu bırakma.
- Migration, değişen dosyalar ve yapılan testleri kısa özetle.
- Uzun açıklama veya tüm dosyaları yeniden yazma; yalnız uygulanan değişiklikleri ve kritik kararları bildir.
