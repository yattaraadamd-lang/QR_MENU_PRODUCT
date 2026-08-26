# E2E Test Issues - Comprehensive Fix Plan

**Date**: 2026-08-07  
**Source**: Automated E2E test suite results  
**Status**: Fixes in progress

---

## ISSUE 1: Customer Demo Navigation ❌

**Problem**: Clicking "Müşteri Demo" goes to `/auth/signin` instead of public menu

**Root Cause**: Landing page routes all demos to signin page

**Expected**: Direct link to public menu experience

**Fix Required**:
1. Add demo business menu route: `/menu/demo-business-id/demo-table`
2. Update landing page to route customer demo directly to menu
3. Generate demo QR token for seamless access

**Files to Modify**:
- `src/app/page.tsx` - Update DEMOS[0] href
- Create `/qr/[qrToken]/page.tsx` redirect if needed

---

## ISSUE 2: Waiter Demo Login Fails ❌

**Problem**: `garson@demo.com / garson123` credentials show "E-posta veya şifre hatalı"

**Root Cause**: 
- Seed may not have run in production
- Password hash mismatch
- User not active

**Expected**: Successful login → redirect to `/waiter`

**Fix Required**:
1. Verify seed ran: `SELECT * FROM "User" WHERE email = 'garson@demo.com'`
2. Check `isActive` = true
3. Verify password hash with bcrypt
4. Re-seed if necessary

**Database Query**:
```sql
SELECT id, email, "isActive", role, "businessId"
FROM "User"  
WHERE email IN ('admin@demo.com', 'garson@demo.com');
```

---

## ISSUE 3: Admin Demo Login Fails ❌

**Problem**: `admin@demo.com / admin123` credentials fail

**Root Cause**: Same as Issue 2

**Expected**: Successful login → redirect to `/admin`

**Fix Required**: Same as Issue 2

---

## ISSUE 4: Staff Management Missing Roster ❌

**Problem**: Personel page only shows invite codes, not staff list

**Root Cause**: UI not rendering user roster

**Expected**: Show personnel table with names/emails + invite codes

**Fix Required**:
1. Check `src/app/admin/staff/page.tsx`
2. Ensure staff query includes users
3. Render user table above invite codes
4. Add filter/search functionality

**Files to Check**:
- `src/app/admin/staff/page.tsx`
- `/api/admin/staff` endpoint

---

## ISSUE 5: Customer Menu Not Public ❌

**Problem**: Customer menu requires auth

**Root Cause**: Design decision or middleware blocking

**Expected**: Decide if customer browsing is public

**Options**:
A. **Make public**: Allow `/menu/[businessId]/[tableNumber]` without auth
B. **Keep private**: Update landing page to not promise public access

**Recommended**: Option B (keep private for security)
- QR codes grant session tokens
- Prevents menu scraping
- Maintains business privacy

**Fix Required**:
1. Update landing page copy
2. Make customer demo use QR token flow
3. Add explainer: "Scan QR code at table to view menu"

---

## ISSUE 6: Registration from Demo Page ❌

**Problem**: Signin page doesn't show registration/invite flow

**Root Cause**: Test expects invite-based reg on signin page

**Expected**: Either add invite flow or clarify registration path

**Fix Required**:
1. Add "Register with Invite Code" link on signin page
2. Or: Update test expectations (registration is separate `/auth/register`)

**Current Flow**:
- `/auth/signin` - Login only
- `/auth/register` - Invite-based registration

**Recommended**: Keep separate, update test

---

## ISSUE 7: Real-time Notifications Not Testable ❌

**Problem**: No way to simulate notifications in test environment

**Root Cause**: Needs actual orders/events

**Expected**: Dev-only event simulator

**Fix Required**:
1. Add `/api/dev/simulate-event` endpoint (dev only)
2. Waiter panel: Add "Simulate Order" button (dev only)
3. Seed some pending orders/requests

**Implementation**:
```typescript
// src/app/api/dev/simulate-event/route.ts
if (process.env.NODE_ENV !== 'development') {
  return NextResponse.json({ error: 'Dev only' }, { status: 403 });
}

// Create fake order
// Emit socket event
// Return success
```

---

## PRIORITY FIXES

### HIGH PRIORITY (Breaks core demo flow)
1. ✅ Fix demo login credentials (Issue 2 & 3)
2. ✅ Customer demo navigation (Issue 1)
3. ✅ Staff roster display (Issue 4)

### MEDIUM PRIORITY (UX improvements)
4. ⚠️ Registration flow clarity (Issue 6)
5. ⚠️ Public menu decision (Issue 5)

### LOW PRIORITY (Test environment)
6. ℹ️ Real-time event simulator (Issue 7)

---

## IMPLEMENTATION PLAN

### Step 1: Verify Database State
```bash
# Check if demo users exist
psql $DATABASE_URL -c "SELECT email, role, \"isActive\" FROM \"User\" WHERE email LIKE '%demo.com';"

# If missing, re-seed
npm run db:seed
```

### Step 2: Fix Customer Demo Navigation
```typescript
// src/app/page.tsx
const DEMOS = [
  {
    title: "Müşteri Demo",
    // OLD: href: "/auth/signin"
    href: "/menu/demo-business-id/1", // Direct to demo table 1
    // ...
  },
  // Waiter & Admin stay on /auth/signin
];
```

### Step 3: Fix Staff Management UI
```typescript
// src/app/admin/staff/page.tsx
// Add staff roster section above invite codes
<div>
  <h2>Personel Listesi</h2>
  {staff.map(user => (
    <div key={user.id}>
      {user.name} - {user.email} - {user.role}
    </div>
  ))}
</div>

<h2>Davet Kodları</h2>
{/* Existing invite code list */}
```

### Step 4: Update Landing Page Copy
- Change "Müşteri Demo" description to: "QR kodu okutup menüyü görüntüleyin (masa gerektirir)"
- Or: Create demo QR token that auto-grants session

### Step 5: Add Dev Event Simulator (Optional)
- `/api/dev/simulate-event/route.ts`
- Waiter panel: `[DEV] Simulate Order` button
- Only visible in development

---

## TESTING VERIFICATION

After fixes, run these checks:

### Test 1: Admin Login
```
1. Go to /auth/signin
2. Click "Admin · admin@demo.com"
3. Should fill email/password
4. Click "Giriş Yap"
5. Should redirect to /admin
```

### Test 2: Waiter Login
```
1. Go to /auth/signin
2. Click "Garson · garson@demo.com"
3. Should redirect to /waiter
```

### Test 3: Customer Demo
```
1. Go to landing page
2. Click "Müşteri Demo"
3. Should show menu with products
4. Add item to cart
5. Should see cart with items
```

### Test 4: Staff Management
```
1. Login as admin
2. Go to Personel page
3. Should see table with:
   - Admin Kullanıcı - admin@demo.com - ADMIN
   - Demo Garson - garson@demo.com - WAITER
4. Below that: Invite codes section
```

---

## ROLLBACK PLAN

If fixes break existing functionality:

```bash
# Revert landing page changes
git checkout HEAD -- src/app/page.tsx

# Revert staff page changes  
git checkout HEAD -- src/app/admin/staff/page.tsx

# Re-seed database
npm run db:reset
npm run db:seed
```

---

## NOTES

- Demo credentials are intentionally weak (dev only)
- Production seed has guards against weak passwords
- Customer menu security: Keep QR token requirement
- Real-time tests need actual events or simulator

---

**Next Steps**:
1. Implement HIGH priority fixes first
2. Test each fix independently
3. Run full E2E suite
4. Document any test assumption changes
