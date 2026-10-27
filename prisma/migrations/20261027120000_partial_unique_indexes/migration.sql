-- Masa başına tek ACTIVE oturum ve tek bekleyen sipariş talebi
--
-- Bu iki kural yalnız elle çalıştırılan scripts/add-partial-indexes.ts içindeydi; canlıda var
-- olup olmadıkları bilinmiyordu. Uygulama önce kontrol edip sonra ekliyor (Read Committed):
-- aynı masayı eşzamanlı açan iki istek iki aktif oturum ve iki adisyon üretebiliyordu.
-- İndeks ikinci kaydı reddeder (P2002); openTable ve sipariş talebi ucu bunu yakalayıp
-- kazanan kaydı döndürür. Prisma kısmi indeksleri şemada ifade edemez, bu yüzden yalnız burada.
--
-- Canlıda kurala aykırı eski satırlar varsa deploy durmaz: indeks atlanır (Render'da Shell
-- olmadığı için yarım kalan migration kurtarılamaz). Prisma uyarıları göstermez; deploy
-- sonrası şu sorgu boş dönmeli:
--   SELECT i FROM unnest(ARRAY['table_sessions_unique_active_per_table',
--     'service_requests_unique_pending_order_request']) i WHERE to_regclass(quote_ident(i)) IS NULL;

-- Süresi dolmuş bekleyen sipariş talepleri: uygulama bunları yeni talepten önce zaten
-- CANCELLED yapıyor (api/customer/service-requests); kalıntılar indeksi engellemesin.
-- expiresAt UTC olarak saklanır (timestamp without time zone).
UPDATE "service_requests"
SET "status" = 'CANCELLED'
WHERE "requestType" = 'ORDER_REQUEST'
  AND "status" IN ('PENDING', 'SEEN')
  AND "expiresAt" < (now() AT TIME ZONE 'UTC');

DO $$
BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS "table_sessions_unique_active_per_table"
        ON "table_sessions" ("tableId")
        WHERE "status" = 'ACTIVE';
EXCEPTION WHEN unique_violation THEN
    RAISE WARNING 'table_sessions_unique_active_per_table olusturulamadi: ayni masada birden fazla ACTIVE oturum var';
END
$$;

DO $$
BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS "service_requests_unique_pending_order_request"
        ON "service_requests" ("tableId")
        WHERE "requestType" = 'ORDER_REQUEST' AND "status" IN ('PENDING', 'SEEN');
EXCEPTION WHEN unique_violation THEN
    RAISE WARNING 'service_requests_unique_pending_order_request olusturulamadi: ayni masada birden fazla bekleyen siparis talebi var';
END
$$;
