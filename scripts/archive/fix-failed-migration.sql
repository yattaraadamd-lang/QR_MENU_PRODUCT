-- ==========================================
-- P3018 Migration Fix SQL Script
-- ==========================================
-- Run this in Supabase SQL Editor if Prisma CLI times out
-- This manually marks the failed migration as applied

-- Step 1: Release any stuck advisory locks
SELECT pg_advisory_unlock_all();

-- Step 2: Verify the migration exists and is in failed state
SELECT 
  migration_name,
  started_at,
  finished_at,
  rolled_back_at,
  applied_steps_count,
  logs
FROM "_prisma_migrations"
WHERE migration_name = '20260513115229_add_v1_1_0_features';

-- Step 3: Verify schema objects exist (should return counts)
SELECT 'Enums' as type, COUNT(*) as count
FROM pg_type 
WHERE typname IN (
  'UserRole', 'StockStatus', 'TableStatus', 'OrderStatus', 
  'ServiceRequestType', 'RequestStatus', 'NotificationType', 'SoundType'
)
UNION ALL
SELECT 'Tables' as type, COUNT(*) as count
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
  'businesses', 'users', 'categories', 'products', 'tables', 
  'orders', 'order_items', 'service_requests', 'notifications', 'waiter_invites'
);

-- Step 4: Mark migration as successfully applied
-- ONLY RUN THIS AFTER VERIFYING ABOVE QUERIES SHOW:
-- - Enums: 8
-- - Tables: 10
UPDATE "_prisma_migrations"
SET 
  finished_at = NOW(),
  applied_steps_count = 1,
  logs = 'Migration marked as applied manually on 2026-08-07. All schema objects verified to exist. Fixed P3018 error (UserRole already exists).'
WHERE migration_name = '20260513115229_add_v1_1_0_features'
AND finished_at IS NULL
AND rolled_back_at IS NULL;

-- Step 5: Verify the fix
SELECT 
  migration_name,
  started_at,
  finished_at,
  rolled_back_at,
  applied_steps_count,
  logs
FROM "_prisma_migrations"
WHERE migration_name = '20260513115229_add_v1_1_0_features';

-- Expected result: finished_at should now have a timestamp
