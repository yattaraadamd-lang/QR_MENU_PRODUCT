-- =============================================================================
-- MANUAL MIGRATION SCRIPT FOR SUPABASE
-- Run this in Supabase SQL Editor if Render npm run db:deploy fails
-- =============================================================================

-- This script is IDEMPOTENT and safe to run multiple times
-- It uses IF NOT EXISTS to prevent errors if columns already exist

BEGIN;

-- =============================================================================
-- 1. CUSTOMER ACCESS BLOCKS - Add revocation tracking columns
-- =============================================================================

-- Add revocationNote column (nullable)
ALTER TABLE "customer_access_blocks" 
ADD COLUMN IF NOT EXISTS "revocationNote" TEXT;

-- Add revokedById column (nullable, FK to users)
ALTER TABLE "customer_access_blocks" 
ADD COLUMN IF NOT EXISTS "revokedById" TEXT;

-- =============================================================================
-- 2. PAYMENTS - Add cash payment and idempotency columns
-- =============================================================================

-- Add changeAmount column (nullable, for cash payments)
ALTER TABLE "payments" 
ADD COLUMN IF NOT EXISTS "changeAmount" DECIMAL(10,2);

-- Add idempotencyKey column (nullable, unique)
ALTER TABLE "payments" 
ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

-- Add receivedAmount column (nullable, for cash payments)
ALTER TABLE "payments" 
ADD COLUMN IF NOT EXISTS "receivedAmount" DECIMAL(10,2);

-- =============================================================================
-- 3. INDEXES - Add unique index for idempotencyKey
-- =============================================================================

-- Create unique index on payments.idempotencyKey (if not exists)
CREATE UNIQUE INDEX IF NOT EXISTS "payments_idempotencyKey_key" 
ON "payments"("idempotencyKey");

COMMIT;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- After running the migration, verify the columns exist:

-- Check customer_access_blocks columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'customer_access_blocks'
  AND column_name IN ('revokedById', 'revocationNote');
-- Expected: 2 rows

-- Check payments columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'payments'
  AND column_name IN ('receivedAmount', 'changeAmount', 'idempotencyKey');
-- Expected: 3 rows

-- Check index exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'payments'
  AND indexname = 'payments_idempotencyKey_key';
-- Expected: 1 row
