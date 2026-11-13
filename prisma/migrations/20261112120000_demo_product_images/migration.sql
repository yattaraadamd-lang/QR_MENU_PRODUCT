-- Demo menüsünün ürün görselleri (public/images/demo-menu; yollar prisma/demo-data.ts'teki
-- demoProductImage ile aynı). Yalnız demo işletmesinin görseli boş ürünleri dolar: başka
-- işletmeye ve elle konmuş görsele dokunulmaz. Boş veritabanında (CI, yeni kurulum) hiçbir satır
-- eşleşmez; orada görselleri seed yazar.
UPDATE "products" AS p
SET "image" = v."image",
    "updatedAt" = CURRENT_TIMESTAMP
FROM (VALUES
  ('prod-turk-kahvesi', '/images/demo-menu/turk-kahvesi.webp'),
  ('prod-latte', '/images/demo-menu/latte.webp'),
  ('prod-cay', '/images/demo-menu/cay.webp'),
  ('prod-cappuccino', '/images/demo-menu/cappuccino.webp'),
  ('prod-sicak-cikolata', '/images/demo-menu/sicak-cikolata.webp'),
  ('prod-ayran', '/images/demo-menu/ayran.webp'),
  ('prod-limonata', '/images/demo-menu/limonata.webp'),
  ('prod-ice-tea', '/images/demo-menu/ice-tea.webp'),
  ('prod-tost', '/images/demo-menu/tost.webp'),
  ('prod-hamburger', '/images/demo-menu/hamburger.webp'),
  ('prod-izgara-kofte', '/images/demo-menu/izgara-kofte.webp'),
  ('prod-tavuk-sis', '/images/demo-menu/tavuk-sis.webp'),
  ('prod-karisik-pizza', '/images/demo-menu/karisik-pizza.webp'),
  ('prod-cheesecake', '/images/demo-menu/cheesecake.webp'),
  ('prod-sutlac', '/images/demo-menu/sutlac.webp'),
  ('prod-baklava', '/images/demo-menu/baklava.webp')
) AS v("id", "image")
WHERE p."id" = v."id"
  AND p."businessId" = 'demo-business-id'
  AND p."image" IS NULL;
