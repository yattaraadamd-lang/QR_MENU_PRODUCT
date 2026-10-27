-- Baseline: db push ile canlıya gelmiş ama hiçbir migration'da olmayan nesneler
--
-- Neden bu tarih: 20260804103500 migration'ı payments."billId" ve payments."tableSessionId"
-- sütunlarına indeks koyuyor; bu sütunlar ve table_sessions, bills, audit_logs,
-- product_modifiers, product_modifier_assignments tabloları yalnız db push ile oluşmuştu.
-- Boş bir veritabanında (staging, CI, felaket sonrası geri yükleme) migrate deploy bu yüzden
-- 20260804103500'de kırılıyordu. Bu dosya o migration'dan hemen önce çalışır.
--
-- Canlıda: migrate deploy henüz uygulanmamış bu migration'ı bir kez çalıştırır. Her ifade
-- IF NOT EXISTS ya da istisna bloğu içinde olduğu için var olan nesnelere dokunmaz.
-- Canlıda gerçekten eksik bir yabancı anahtar ya da unique indeks varsa ve mevcut satırlar
-- onu ihlal ediyorsa deploy durmaz: kısıt NOT VALID bırakılır / indeks atlanır (Render'da
-- Shell olmadığı için yarım kalan migration kurtarılamaz). Prisma Postgres WARNING'lerini
-- göstermez; deploy sonrası şu iki sorgu boş dönmeli:
--   SELECT conname FROM pg_constraint WHERE NOT convalidated;
--   SELECT i FROM unnest(ARRAY['bills_tableSessionId_key', 'orders_idempotencyKey_key',
--     'service_requests_idempotencyKey_key', 'product_modifier_assignments_productId_modifierId_key']) i
--   WHERE to_regclass(quote_ident(i)) IS NULL;
--
-- Sonraki migration'ların oluşturduğu nesneler bilerek burada YOK:
--   20260804103500: payments onay sütunları, PaymentStatus yeni değerleri, iki payments indeksi
--   20260804164500: OrderCancelReasonCode ve orders iptal sütunları (o dosya idempotent değil)
--   20261015120000: subscription_plans / business_subscriptions iyzico sütunları ve indeksleri

-- ─── Yardımcılar (yalnız bu bağlantı boyunca yaşar) ─────────────────────────

CREATE OR REPLACE FUNCTION pg_temp.baseline_add_fk(p_table text, p_name text, p_definition text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = p_name) THEN
        RETURN;
    END IF;
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I %s NOT VALID', p_table, p_name, p_definition);
    BEGIN
        EXECUTE format('ALTER TABLE %I VALIDATE CONSTRAINT %I', p_table, p_name);
    EXCEPTION WHEN foreign_key_violation THEN
        RAISE WARNING 'baseline: % mevcut satirlarla dogrulanamadi, NOT VALID birakildi', p_name;
    END;
END
$$;

CREATE OR REPLACE FUNCTION pg_temp.baseline_unique_index(p_name text, p_ddl text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    EXECUTE p_ddl;
EXCEPTION WHEN unique_violation THEN
    RAISE WARNING 'baseline: % mevcut satirlarda tekrar eden deger yuzunden olusturulamadi', p_name;
END
$$;

-- ─── Enum'lar ────────────────────────────────────────────────────────────────

DO $$ BEGIN
    CREATE TYPE "OrderPaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "TableSessionStatus" AS ENUM ('ACTIVE', 'CLOSED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "BillPaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "BillStatus" AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "CustomerAuthorizationStatus" AS ENUM ('VIEW_ONLY', 'PENDING', 'AUTHORIZED', 'REVOKED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE "CustomerSessionStatus" ADD VALUE IF NOT EXISTS 'REVOKED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

-- ─── Var olan tablolara eklenen sütunlar ─────────────────────────────────────

ALTER TABLE "customer_sessions"
    ADD COLUMN IF NOT EXISTS "authorizationStatus" "CustomerAuthorizationStatus" NOT NULL DEFAULT 'VIEW_ONLY',
    ADD COLUMN IF NOT EXISTS "authorizedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "deviceKeyHash" TEXT,
    ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "tableSessionId" TEXT;

ALTER TABLE "orders"
    ADD COLUMN IF NOT EXISTS "customerSessionId" TEXT,
    ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
    ADD COLUMN IF NOT EXISTS "paymentStatus" "OrderPaymentStatus" NOT NULL DEFAULT 'UNPAID',
    ADD COLUMN IF NOT EXISTS "tableSessionId" TEXT;

ALTER TABLE "payments"
    ADD COLUMN IF NOT EXISTS "billId" TEXT,
    ADD COLUMN IF NOT EXISTS "handledByWaiterName" TEXT,
    ADD COLUMN IF NOT EXISTS "tableSessionId" TEXT;

ALTER TABLE "products"
    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "service_requests"
    ADD COLUMN IF NOT EXISTS "customerSessionId" TEXT,
    ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
    ADD COLUMN IF NOT EXISTS "orderPreview" JSONB,
    ADD COLUMN IF NOT EXISTS "reason" TEXT,
    ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "seenAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "verificationCode" TEXT;

-- ─── Yeni tablolar ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "table_sessions" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "status" "TableSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "closeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "table_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "bills" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "tableSessionId" TEXT NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "remainingAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "paymentStatus" "BillPaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "status" "BillStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bills_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" TEXT NOT NULL,
    "businessId" TEXT,
    "actorUserId" TEXT,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "requestId" TEXT,
    "ipHash" TEXT,
    "userAgentInfo" TEXT,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "product_modifiers" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "extraPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_modifiers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "product_modifier_assignments" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "modifierId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_modifier_assignments_pkey" PRIMARY KEY ("id")
);

-- ─── Unique indeksler ────────────────────────────────────────────────────────

SELECT pg_temp.baseline_unique_index('bills_tableSessionId_key',
    'CREATE UNIQUE INDEX IF NOT EXISTS "bills_tableSessionId_key" ON "bills"("tableSessionId")');
SELECT pg_temp.baseline_unique_index('product_modifier_assignments_productId_modifierId_key',
    'CREATE UNIQUE INDEX IF NOT EXISTS "product_modifier_assignments_productId_modifierId_key" ON "product_modifier_assignments"("productId", "modifierId")');
SELECT pg_temp.baseline_unique_index('orders_idempotencyKey_key',
    'CREATE UNIQUE INDEX IF NOT EXISTS "orders_idempotencyKey_key" ON "orders"("idempotencyKey")');
SELECT pg_temp.baseline_unique_index('service_requests_idempotencyKey_key',
    'CREATE UNIQUE INDEX IF NOT EXISTS "service_requests_idempotencyKey_key" ON "service_requests"("idempotencyKey")');

-- ─── İndeksler ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "table_sessions_tableId_status_idx" ON "table_sessions"("tableId", "status");
CREATE INDEX IF NOT EXISTS "table_sessions_businessId_status_idx" ON "table_sessions"("businessId", "status");
CREATE INDEX IF NOT EXISTS "bills_businessId_status_idx" ON "bills"("businessId", "status");
CREATE INDEX IF NOT EXISTS "audit_logs_businessId_createdAt_idx" ON "audit_logs"("businessId", "createdAt");
CREATE INDEX IF NOT EXISTS "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");
CREATE INDEX IF NOT EXISTS "audit_logs_actorUserId_createdAt_idx" ON "audit_logs"("actorUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "product_modifiers_businessId_isActive_idx" ON "product_modifiers"("businessId", "isActive");
CREATE INDEX IF NOT EXISTS "categories_businessId_isActive_idx" ON "categories"("businessId", "isActive");
CREATE INDEX IF NOT EXISTS "customer_sessions_businessId_tableId_status_idx" ON "customer_sessions"("businessId", "tableId", "status");
CREATE INDEX IF NOT EXISTS "customer_sessions_tableSessionId_authorizationStatus_idx" ON "customer_sessions"("tableSessionId", "authorizationStatus");
CREATE INDEX IF NOT EXISTS "notifications_businessId_isRead_createdAt_idx" ON "notifications"("businessId", "isRead", "createdAt");
CREATE INDEX IF NOT EXISTS "notifications_businessId_createdAt_idx" ON "notifications"("businessId", "createdAt");
CREATE INDEX IF NOT EXISTS "orders_businessId_status_createdAt_idx" ON "orders"("businessId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "orders_businessId_createdAt_idx" ON "orders"("businessId", "createdAt");
CREATE INDEX IF NOT EXISTS "orders_tableId_status_idx" ON "orders"("tableId", "status");
CREATE INDEX IF NOT EXISTS "orders_tableSessionId_idx" ON "orders"("tableSessionId");
CREATE INDEX IF NOT EXISTS "orders_customerSessionId_createdAt_idx" ON "orders"("customerSessionId", "createdAt");
CREATE INDEX IF NOT EXISTS "payments_businessId_status_createdAt_idx" ON "payments"("businessId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "payments_tableId_status_idx" ON "payments"("tableId", "status");
CREATE INDEX IF NOT EXISTS "payments_tableSessionId_idx" ON "payments"("tableSessionId");
CREATE INDEX IF NOT EXISTS "products_businessId_createdAt_idx" ON "products"("businessId", "createdAt");
CREATE INDEX IF NOT EXISTS "products_businessId_isDeleted_isAvailable_idx" ON "products"("businessId", "isDeleted", "isAvailable");
CREATE INDEX IF NOT EXISTS "products_categoryId_idx" ON "products"("categoryId");
CREATE INDEX IF NOT EXISTS "service_requests_businessId_status_createdAt_idx" ON "service_requests"("businessId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "service_requests_tableId_status_idx" ON "service_requests"("tableId", "status");
CREATE INDEX IF NOT EXISTS "service_requests_businessId_tableId_status_idx" ON "service_requests"("businessId", "tableId", "status");
CREATE INDEX IF NOT EXISTS "service_requests_customerSessionId_status_idx" ON "service_requests"("customerSessionId", "status");
CREATE INDEX IF NOT EXISTS "tables_businessId_status_idx" ON "tables"("businessId", "status");
CREATE INDEX IF NOT EXISTS "tables_businessId_isDeleted_idx" ON "tables"("businessId", "isDeleted");

-- ─── Yabancı anahtarlar ──────────────────────────────────────────────────────

SELECT pg_temp.baseline_add_fk('orders', 'orders_tableSessionId_fkey',
    'FOREIGN KEY ("tableSessionId") REFERENCES "table_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE');
SELECT pg_temp.baseline_add_fk('orders', 'orders_customerSessionId_fkey',
    'FOREIGN KEY ("customerSessionId") REFERENCES "customer_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE');
SELECT pg_temp.baseline_add_fk('service_requests', 'service_requests_customerSessionId_fkey',
    'FOREIGN KEY ("customerSessionId") REFERENCES "customer_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE');
SELECT pg_temp.baseline_add_fk('table_sessions', 'table_sessions_businessId_fkey',
    'FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.baseline_add_fk('table_sessions', 'table_sessions_tableId_fkey',
    'FOREIGN KEY ("tableId") REFERENCES "tables"("id") ON DELETE RESTRICT ON UPDATE CASCADE');
SELECT pg_temp.baseline_add_fk('bills', 'bills_businessId_fkey',
    'FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.baseline_add_fk('bills', 'bills_tableId_fkey',
    'FOREIGN KEY ("tableId") REFERENCES "tables"("id") ON DELETE RESTRICT ON UPDATE CASCADE');
SELECT pg_temp.baseline_add_fk('bills', 'bills_tableSessionId_fkey',
    'FOREIGN KEY ("tableSessionId") REFERENCES "table_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE');
SELECT pg_temp.baseline_add_fk('customer_sessions', 'customer_sessions_businessId_fkey',
    'FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.baseline_add_fk('customer_sessions', 'customer_sessions_tableId_fkey',
    'FOREIGN KEY ("tableId") REFERENCES "tables"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.baseline_add_fk('customer_sessions', 'customer_sessions_tableSessionId_fkey',
    'FOREIGN KEY ("tableSessionId") REFERENCES "table_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE');
SELECT pg_temp.baseline_add_fk('payments', 'payments_tableSessionId_fkey',
    'FOREIGN KEY ("tableSessionId") REFERENCES "table_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE');
SELECT pg_temp.baseline_add_fk('payments', 'payments_billId_fkey',
    'FOREIGN KEY ("billId") REFERENCES "bills"("id") ON DELETE SET NULL ON UPDATE CASCADE');
SELECT pg_temp.baseline_add_fk('product_modifiers', 'product_modifiers_businessId_fkey',
    'FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.baseline_add_fk('product_modifier_assignments', 'product_modifier_assignments_productId_fkey',
    'FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.baseline_add_fk('product_modifier_assignments', 'product_modifier_assignments_modifierId_fkey',
    'FOREIGN KEY ("modifierId") REFERENCES "product_modifiers"("id") ON DELETE CASCADE ON UPDATE CASCADE');
-- 20260802095237 bunu ekliyor; o migration canlıda resolve --applied ile işaretlendiyse eksik kalmış olabilir
SELECT pg_temp.baseline_add_fk('customer_access_blocks', 'customer_access_blocks_revokedById_fkey',
    'FOREIGN KEY ("revokedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE');
