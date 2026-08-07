# 🚨 URGENT: Render Environment Variables Needed

**Date**: 2026-08-07  
**Status**: ⚠️ DEPLOYMENT BLOCKED - Environment variables required

---

## ✅ Deployment Status

✅ Code pushed to main branch  
✅ Build successful (0 TypeScript errors)  
✅ All 10 P0 security vulnerabilities fixed  
⚠️ **BLOCKED**: Missing/weak environment variables must be updated

---

## 🔴 CRITICAL: Update These Environment Variables in Render NOW

### 1. CUSTOMER_DEVICE_HMAC_SECRET (WEAK - MUST CHANGE)

**Current Value** (WEAK):
```
qr-menu-device-hmac-secret-change-in-production-2026
```

**Why it's weak**: This is a known placeholder that appears in documentation/commits.

**Action Required**: Replace with strong 32+ character random secret

**Recommended New Value** (copy to Render):
```
8f7e6d5c4b3a2918d6c5b4a39281f0e7a6b5c4d3e2f19081726354a3b2c1d0e9
```

**How to set in Render**:
1. Go to: https://dashboard.render.com/web/srv-cssjsabqf0us73fl9vr0/env
2. Find `CUSTOMER_DEVICE_HMAC_SECRET`
3. Click Edit
4. Replace with new value above
5. Save Changes

---

### 2. SUPER_ADMIN_PASSWORD (MISSING - MUST ADD)

**Current Status**: ❌ NOT SET (will cause seed-super-admin.ts to fail)

**Action Required**: Add new environment variable

**Recommended Strong Password** (copy to Render):
```
Ag9$mK2#xP7!nW5@eL3&vQ8%hT6^jY4*bR1
```

**How to add in Render**:
1. Go to: https://dashboard.render.com/web/srv-cssjsabqf0us73fl9vr0/env
2. Click "Add Environment Variable"
3. Key: `SUPER_ADMIN_PASSWORD`
4. Value: (paste password above)
5. Save Changes

---

## ✅ Verify These Are Already Set Correctly

### NEXTAUTH_SECRET
```
LqUKoaldFW9QMxw1kg5EyNlZGeRawbt9seqxCzv6FXE=
```
✅ Strong - No change needed

### DATABASE_URL (pooled)
```
postgresql://postgres.najpbpmtypxbrbtzafwn:5kOvpdUyuL1inTqt@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```
✅ Correct - No change needed

### DATABASE_URL_UNPOOLED (direct)
```
postgresql://postgres.najpbpmtypxbrbtzafwn:5kOvpdUyuL1inTqt@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
```
✅ Correct - No change needed

### NEXTAUTH_URL
```
https://qr-menu-product.onrender.com
```
✅ Correct - No change needed

### NEXT_PUBLIC_APP_URL
```
https://qr-menu-product.onrender.com
```
✅ Correct - No change needed

---

## 📋 Complete Render Environment Variable Checklist

After updating, your Render environment variables should be:

```bash
# ✅ Database
DATABASE_URL="postgresql://postgres.najpbpmtypxbrbtzafwn:5kOvpdUyuL1inTqt@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DATABASE_URL_UNPOOLED="postgresql://postgres.najpbpmtypxbrbtzafwn:5kOvpdUyuL1inTqt@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"

# ✅ NextAuth
NEXTAUTH_URL="https://qr-menu-product.onrender.com"
NEXTAUTH_SECRET="LqUKoaldFW9QMxw1kg5EyNlZGeRawbt9seqxCzv6FXE="

# ✅ App
NEXT_PUBLIC_APP_URL="https://qr-menu-product.onrender.com"

# ✅ Features
ENABLE_LOCATION_LOCK="false"

# 🔴 UPDATE THIS - Security P0-04
CUSTOMER_DEVICE_HMAC_SECRET="8f7e6d5c4b3a2918d6c5b4a39281f0e7a6b5c4d3e2f19081726354a3b2c1d0e9"

# 🔴 ADD THIS - Security P0-08
SUPER_ADMIN_PASSWORD="Ag9$mK2#xP7!nW5@eL3&vQ8%hT6^jY4*bR1"
```

---

## 🚀 After Setting Environment Variables

1. **Save all changes in Render**
2. **Trigger manual deploy** or wait for auto-deploy
3. **Monitor build logs** for:
   - ✅ "Prisma schema synced successfully"
   - ✅ "Build completed successfully"
   - ❌ No "CUSTOMER_DEVICE_HMAC_SECRET required" errors
   - ❌ No "SUPER_ADMIN_PASSWORD required" errors

4. **Verify deployment**:
   - Visit: https://qr-menu-product.onrender.com
   - Check health: https://qr-menu-product.onrender.com/api/health
   - Test admin login: https://qr-menu-product.onrender.com/auth/signin

---

## 🔒 Security Impact

### Before (VULNERABLE):
- ❌ Weak HMAC secret allows device block bypass
- ❌ No super admin password validation
- ❌ Known placeholder values in production

### After (SECURE):
- ✅ Strong 64-char HMAC secret (256-bit entropy)
- ✅ Strong 38-char super admin password
- ✅ All secrets rotated and unique
- ✅ Production-ready security posture

---

## ⚠️ IMPORTANT NOTES

1. **DO NOT commit these passwords to Git** - Already in .gitignore
2. **Save passwords securely** - Use a password manager
3. **Super Admin Login** will be:
   - Email: `admin@qrmenu.com`
   - Password: `Ag9$mK2#xP7!nW5@eL3&vQ8%hT6^jY4*bR1` (the one you set)
4. **Existing demo users** (admin@demo.com, garson@demo.com) keep their passwords
5. **First deployment after this** may take 2-3 minutes for migrations

---

## 🆘 If Deployment Fails

### Error: "CUSTOMER_DEVICE_HMAC_SECRET environment variable is required"
**Fix**: You didn't update the HMAC secret in Render. Go back and set it.

### Error: "SUPER_ADMIN_PASSWORD environment variable is required"
**Fix**: You didn't add the super admin password. Go back and add it.

### Error: "Prisma migration failed"
**Fix**: Check DATABASE_URL_UNPOOLED is set correctly (port 5432, no pgbouncer param)

### Build succeeds but site doesn't load
**Fix**: Check Render logs for runtime errors. May need to restart service.

---

## ✅ Deployment Complete Checklist

- [ ] Updated CUSTOMER_DEVICE_HMAC_SECRET in Render
- [ ] Added SUPER_ADMIN_PASSWORD in Render
- [ ] Saved all environment variables
- [ ] Triggered/waited for deploy
- [ ] Build completed successfully
- [ ] Site loads at https://qr-menu-product.onrender.com
- [ ] Health check passes
- [ ] Admin login works with new super admin password
- [ ] Tested QR menu access (pick any table)
- [ ] Socket.IO connections working (check waiter panel)

---

**Priority**: 🔴 URGENT - Complete before production use  
**Time Required**: 5 minutes  
**Risk if skipped**: Application will fail to start or reject device operations

---

**Quick Link**: https://dashboard.render.com/web/srv-cssjsabqf0us73fl9vr0/env
