# 🚨 Migration Fix Instructions - P2022 Error

## Problem
```
Error: The column `payments.receivedAmount` does not exist in the current database
Code: P2022
```

**Root Cause**: Migration `20260802_sync_secure_customer_order_flow` not applied to Supabase database.

**Why**: Render's `npm run db:deploy` either:
1. Cannot connect to database (missing `DATABASE_URL_UNPOOLED`)
2. Failed silently and build continued
3. Used pooled connection instead of direct connection

---

## ⚡ Quick Fix: Manual Migration

### Step 1: Open Supabase SQL Editor
1. Go to https://supabase.com
2. Select your project
3. Click **SQL Editor** in left sidebar
4. Click **+ New Query**

### Step 2: Run Migration Script
Copy the entire contents of `MANUAL_MIGRATION_SCRIPT.sql` and paste into SQL Editor.

**File Location**: `qr-menu-platform/MANUAL_MIGRATION_SCRIPT.sql`

Click **Run** (or press F5).

### Step 3: Verify Columns Exist
Run the verification queries at the bottom of the script:

```sql
-- Should return 2 rows
SELECT column_name FROM information_schema.columns
WHERE table_name = 'customer_access_blocks'
  AND column_name IN ('revokedById', 'revocationNote');

-- Should return 3 rows
SELECT column_name FROM information_schema.columns
WHERE table_name = 'payments'
  AND column_name IN ('receivedAmount', 'changeAmount', 'idempotencyKey');
```

### Step 4: Mark Migration as Applied in Prisma
After manually running the SQL, mark it as applied so Prisma doesn't try to run it again:

```bash
# On your local machine (with DATABASE_URL pointing to Supabase)
npx prisma migrate resolve --applied 20260802_sync_secure_customer_order_flow
```

---

## 🔧 Permanent Fix: Configure DATABASE_URL_UNPOOLED in Render

### Why This is Needed
Prisma migrations **require a direct PostgreSQL connection**, not a pooled connection.

### How to Fix in Render

1. **Get Direct Connection String from Supabase**:
   - Go to Supabase → Settings → Database
   - Find **Connection string** section
   - Copy **Connection string** (NOT "Connection pooling")
   - Format: `postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`

2. **Add to Render Environment Variables**:
   - Go to Render Dashboard → qr-menu-platform → Environment
   - Find `DATABASE_URL_UNPOOLED` variable
   - **Paste the DIRECT connection string** (not pooled)
   - Click **Save Changes**

3. **Redeploy**:
   - Render will automatically redeploy
   - This time `npm run db:deploy` should work

### Verify DATABASE_URL_UNPOOLED is Set
Check Render build logs for:
```
✔ Generated Prisma Client
✔ 0 migrations found in prisma/migrations
✔ The database is in sync with the Prisma schema
```

If you see:
```
✖ Error: Connection failed
```
Then `DATABASE_URL_UNPOOLED` is missing or incorrect.

---

## 🧪 Test After Fix

### Test 1: Diagnostic Endpoint
```bash
curl https://your-app.onrender.com/api/diagnostics/schema
```

Expected response:
```json
{
  "status": "ok",
  "checks": {
    "customer_access_blocks_revokedById": true,
    "customer_access_blocks_revocationNote": true,
    "payments_receivedAmount": true,
    "payments_changeAmount": true,
    "payments_idempotencyKey": true
  }
}
```

### Test 2: ORDER_REQUEST
1. Scan QR code
2. Add product to cart
3. Click "Sipariş Talebi Oluştur"
4. Expected: HTTP 201 with verification code (no P2022 error)

### Test 3: Waiter Payments List
1. Login as waiter
2. Go to Payments page
3. Expected: List loads without P2022 error

---

## 📋 Checklist

- [ ] Manual migration script run in Supabase SQL Editor
- [ ] Verification queries return expected row counts
- [ ] `npx prisma migrate resolve --applied` executed locally
- [ ] `DATABASE_URL_UNPOOLED` added to Render environment
- [ ] Render redeployed successfully
- [ ] Diagnostic endpoint returns `"status": "ok"`
- [ ] ORDER_REQUEST test passes (no P2022)
- [ ] Waiter payments page loads (no P2022)
- [ ] No P2022 errors in Render logs

---

## 🔍 Troubleshooting

### Migration Already Applied Error
If you get "migration already applied" error:
```bash
# Skip it - means columns already exist
# Just verify with SELECT queries
```

### Permission Denied Error
You need to run SQL as postgres superuser. Make sure you're using the **postgres** role connection string from Supabase.

### Build Still Failing After Adding DATABASE_URL_UNPOOLED
Check Render build logs for the exact error. Common issues:
- Typo in connection string
- Password contains special characters (needs URL encoding)
- Using pooled URL instead of direct URL

---

## 📞 Need Help?

Check these resources:
1. Render build logs: Render Dashboard → qr-menu-platform → Events
2. Supabase logs: Supabase → Logs → Postgres Logs
3. Diagnostic endpoint: `/api/diagnostics/schema`

---

**Next Steps**: Once migration is applied, proceed with ORDER_REQUEST functional tests (AŞAMA 1).
