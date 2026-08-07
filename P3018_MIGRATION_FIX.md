# P3018 Migration Fix - UserRole Already Exists

**Date**: 2026-08-07  
**Issue**: Migration `20260513115229_add_v1_1_0_features` failed with P3018 "type UserRole already exists"  
**Root Cause**: Migration partially applied, then failed on existing enum  

---

## Problem Analysis

### Migration Status
```
Migration: 20260513115229_add_v1_1_0_features
Status: FAILED (started but not finished)
Error: P3018 - Database error code 42710
Message: type "UserRole" already exists
```

### What This Migration Does
Creates base schema for v1.1.0:
- ✅ Enums: UserRole, StockStatus, TableStatus, OrderStatus, ServiceRequestType, RequestStatus, NotificationType, SoundType
- ✅ Tables: businesses, users, categories, products, tables, orders, order_items, service_requests, notifications, waiter_invites
- ✅ Foreign keys and indexes

### Current Situation
- Migration started at 2026-08-07 18:36:17.846289 UTC
- Failed on `CREATE TYPE "UserRole"` because enum already exists
- All schema objects from this migration appear to exist in database
- 4 pending migrations blocked by this failed migration

---

## Solution: Mark Migration as Applied

Since all schema objects from this migration already exist in the database, we need to mark it as applied without re-running the SQL.

### Step 1: Release Postgres Advisory Lock (If Stuck)

If you get "advisory lock timeout" errors, run this in Supabase SQL Editor:

```sql
-- Check for stuck advisory locks
SELECT 
  locktype,
  database,
  pid,
  mode,
  granted
FROM pg_locks
WHERE locktype = 'advisory';

-- Release Prisma's advisory lock if stuck
SELECT pg_advisory_unlock_all();
```

### Step 2: Verify Schema Completeness

Run in Supabase SQL Editor to confirm all objects exist:

```sql
-- Check enums (should return 8 rows)
SELECT typname 
FROM pg_type 
WHERE typname IN (
  'UserRole', 'StockStatus', 'TableStatus', 'OrderStatus', 
  'ServiceRequestType', 'RequestStatus', 'NotificationType', 'SoundType'
);

-- Check tables (should return 10 rows)
SELECT tablename
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
  'businesses', 'users', 'categories', 'products', 'tables', 
  'orders', 'order_items', 'service_requests', 'notifications', 'waiter_invites'
);

-- Check UserRole values
SELECT enumlabel
FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'UserRole')
ORDER BY enumsortorder;
```

**Expected Results**:
- 8 enums exist
- 10 tables exist
- UserRole has values: ADMIN, WAITER (and possibly SUPER_ADMIN from later migration)

### Step 3: Mark Migration as Applied

**Option A: Via Prisma CLI** (if advisory lock works):
```bash
npx prisma migrate resolve --applied 20260513115229_add_v1_1_0_features
```

**Option B: Direct Database Update** (if advisory lock stuck):

Run in Supabase SQL Editor:

```sql
-- Update the failed migration to mark it as successfully applied
UPDATE "_prisma_migrations"
SET 
  finished_at = NOW(),
  applied_steps_count = 1,
  logs = 'Migration marked as applied manually - all schema objects verified to exist'
WHERE migration_name = '20260513115229_add_v1_1_0_features'
AND finished_at IS NULL;

-- Verify the update
SELECT 
  migration_name,
  started_at,
  finished_at,
  rolled_back_at,
  applied_steps_count
FROM "_prisma_migrations"
WHERE migration_name = '20260513115229_add_v1_1_0_features';
```

### Step 4: Deploy Remaining Migrations

After marking as applied:

```bash
# Check status
npx prisma migrate status

# Should show 4 pending migrations:
# - 20260517131318_
# - 20260802095237_add_access_block_revocation_and_cash_payment_fields
# - 20260802_sync_secure_customer_order_flow
# - 20260804164500_add_order_cancel_reason_and_stock_updates

# Deploy them
npx prisma migrate deploy
```

### Step 5: Verify Success

```bash
# Should show "No pending migrations"
npx prisma migrate status

# Regenerate Prisma Client
npx prisma generate

# Type check
npx tsc --noEmit

# Build
npm run build
```

---

## Why This Happened

### Root Cause
1. Migration `20260513115229` was run previously
2. It created the `UserRole` enum successfully
3. The migration process crashed/timed out before completion
4. Prisma marked it as "started but failed"
5. On retry, it hits "UserRole already exists" error

### Prevention
- Ensure stable database connection during migrations
- Use `DATABASE_URL_UNPOOLED` for migrations (direct connection)
- Monitor Render build logs for migration timeouts
- Keep migration files in Git (they are tracked now)

---

## Render Deployment Fix

Once local migration is resolved and pushed:

1. **Verify Environment Variables** in Render:
   ```
   DATABASE_URL         = pooled connection (port 6543, pgbouncer=true)
   DATABASE_URL_UNPOOLED = direct connection (port 5432, no pgbouncer)
   ```

2. **Trigger Manual Deploy**:
   - Go to Render dashboard
   - Click "Manual Deploy" → "Deploy latest commit"
   - Watch build logs for migration success

3. **Monitor Build Logs** for:
   - ✅ "6 migrations found"
   - ✅ "No pending migrations" OR "Applying migrations..."
   - ✅ "Build completed successfully"
   - ❌ NO P3018 errors
   - ❌ NO P3009 errors

---

## Rollback Plan (If Needed)

If marking as applied causes issues:

```sql
-- Mark migration as rolled back
UPDATE "_prisma_migrations"
SET 
  rolled_back_at = NOW(),
  finished_at = NULL
WHERE migration_name = '20260513115229_add_v1_1_0_features';
```

Then create a recovery migration with only the missing pieces.

---

## Testing Checklist

After fix is deployed:

- [ ] `npx prisma migrate status` shows no pending migrations
- [ ] `npx prisma generate` succeeds
- [ ] `npm run build` succeeds
- [ ] Admin login works
- [ ] Waiter login works
- [ ] Customer QR scan works
- [ ] ORDER_REQUEST flow works
- [ ] Payment flow works
- [ ] No P3018 in Render logs
- [ ] No P2021/P2022 column errors

---

## Files to Commit

After resolving locally:

```bash
# No migration files need to be changed
# Just commit this documentation

git add P3018_MIGRATION_FIX.md
git commit -m "docs: P3018 migration fix procedure"
git push origin main
```

---

## Support Commands

```bash
# Check Prisma version
npx prisma --version

# Validate schema
npx prisma validate

# Format schema
npx prisma format

# Check migration history
npx prisma migrate status

# Generate client
npx prisma generate

# Check database connection
npx prisma db execute --stdin < test-query.sql
```

---

**Status**: Ready to apply  
**Risk**: Low (schema objects already exist, just marking as applied)  
**Time**: 5-10 minutes  
**Requires**: Supabase SQL Editor access or working Prisma CLI connection
