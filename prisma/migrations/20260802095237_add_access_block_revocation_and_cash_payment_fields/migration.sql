-- Ensure customer_access_blocks exists in the migration history.
-- The table may already exist in production because it was previously
-- created with prisma db push, while a fresh shadow database does not have it.

CREATE TABLE IF NOT EXISTS "customer_access_blocks" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "deviceKeyHash" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "sourceRequestId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "customer_access_blocks_pkey" PRIMARY KEY ("id")
);

-- Base lookup index
CREATE INDEX IF NOT EXISTS
    "customer_access_blocks_businessId_deviceKeyHash_revokedAt_idx"
ON "customer_access_blocks" (
    "businessId",
    "deviceKeyHash",
    "revokedAt"
);

-- Business foreign key
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'customer_access_blocks_businessId_fkey'
    ) THEN
        ALTER TABLE "customer_access_blocks"
        ADD CONSTRAINT "customer_access_blocks_businessId_fkey"
        FOREIGN KEY ("businessId")
        REFERENCES "businesses"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE;
    END IF;
END
$$;

-- CustomerAccessBlock revocation audit fields
ALTER TABLE "customer_access_blocks"
    ADD COLUMN IF NOT EXISTS "revokedById" TEXT,
    ADD COLUMN IF NOT EXISTS "revocationNote" TEXT;

-- User who revoked the access block
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'customer_access_blocks_revokedById_fkey'
    ) THEN
        ALTER TABLE "customer_access_blocks"
        ADD CONSTRAINT "customer_access_blocks_revokedById_fkey"
        FOREIGN KEY ("revokedById")
        REFERENCES "users"("id")
        ON DELETE SET NULL
        ON UPDATE CASCADE;
    END IF;
END
$$;

-- Cash payment and idempotency fields
ALTER TABLE "payments"
    ADD COLUMN IF NOT EXISTS "receivedAmount" DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS "changeAmount" DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

-- Payment idempotency unique index
CREATE UNIQUE INDEX IF NOT EXISTS
    "payments_idempotencyKey_key"
ON "payments" ("idempotencyKey");

-- Prevent more than one active block for the same device and business
CREATE UNIQUE INDEX IF NOT EXISTS
    "customer_access_blocks_active_unique"
ON "customer_access_blocks" ("businessId", "deviceKeyHash")
WHERE "revokedAt" IS NULL;