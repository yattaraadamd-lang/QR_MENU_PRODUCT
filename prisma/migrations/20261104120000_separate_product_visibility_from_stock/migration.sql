-- isAvailable artık yalnız görünürlük ("Menüde Görünsün"), stockStatus yalnız stok.
-- Eskiden stok düğmesi ve sipariş iptali stoğu düşürürken isAvailable'ı da kapatıyordu; bu ürünler
-- menüde "Stokta Yok" görünüyordu. Yeni kodda isAvailable=false menüden gizlediği için, müşterinin
-- bugün gördüğü hali korumak adına stoksuz ürünlerin bayrağı açılır.
--
-- Ayrım veride yok: hem stoksuz hem elle gizlenmiş ürün de açılır. Bu ürünler zaten bugün menüde
-- "Stokta Yok" görünüyor, yani müşteri için değişiklik olmaz; gizlemek isteyen admin yeniden kapatır.
-- Stokta olup kapalı ürünler (gerçek gizleme) ve silinmişler dokunulmadan kalır.
UPDATE "products"
SET "isAvailable" = true
WHERE "stockStatus" = 'OUT_OF_STOCK'
  AND "isAvailable" = false
  AND "isDeleted" = false;
