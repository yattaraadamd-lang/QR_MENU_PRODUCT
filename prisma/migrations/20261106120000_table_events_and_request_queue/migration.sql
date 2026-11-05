-- Masa olay kaydı ve sipariş talebi kuyruğu
--
-- 1. Masa başına tek bekleyen talep kuralı kalkar: tek bir cihaz masayı diğer müşterilere
--    kapatabiliyordu. Yerine oturum başına tek bekleyen talep gelir (çift tıklama koruması).
-- 2. table_events: durum değişikliklerinin kim, neden ve hangi kanıtla yapıldığı.
--
-- Her adım idempotent: canlı şemanın bir kısmı db push ile geldi ve Render'da Shell olmadığı için
-- yarım kalan migration kurtarılamaz. Prisma kısmi indeksleri şemada ifade edemez, yalnız burada.
-- Deploy sonrası şu sorgu 'service_requests_unique_pending_order_request_per_session' dönmeli:
--   SELECT indexname FROM pg_indexes WHERE indexname LIKE 'service_requests_unique_pending%';

DROP INDEX IF EXISTS "service_requests_unique_pending_order_request";

DO $$
BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS "service_requests_unique_pending_order_request_per_session"
        ON "service_requests" ("customerSessionId")
        WHERE "requestType" = 'ORDER_REQUEST' AND "status" IN ('PENDING', 'SEEN');
EXCEPTION WHEN unique_violation THEN
    RAISE WARNING 'service_requests_unique_pending_order_request_per_session olusturulamadi: ayni oturumda birden fazla bekleyen siparis talebi var';
END
$$;

DO $$
BEGIN
    CREATE TYPE "TableEventSource" AS ENUM ('CUSTOMER', 'STAFF', 'SYSTEM');
EXCEPTION WHEN duplicate_object THEN
    NULL;
END
$$;

CREATE TABLE IF NOT EXISTS "table_events" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "fromStatus" "TableStatus" NOT NULL,
    "toStatus" "TableStatus" NOT NULL,
    "source" "TableEventSource" NOT NULL,
    "reason" TEXT NOT NULL,
    "actorUserId" TEXT,
    "customerSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "table_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "table_events_tableId_createdAt_idx" ON "table_events"("tableId", "createdAt");
CREATE INDEX IF NOT EXISTS "table_events_businessId_createdAt_idx" ON "table_events"("businessId", "createdAt");

DO $$
BEGIN
    ALTER TABLE "table_events" ADD CONSTRAINT "table_events_businessId_fkey"
        FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN
    NULL;
END
$$;

DO $$
BEGIN
    ALTER TABLE "table_events" ADD CONSTRAINT "table_events_tableId_fkey"
        FOREIGN KEY ("tableId") REFERENCES "tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN
    NULL;
END
$$;
