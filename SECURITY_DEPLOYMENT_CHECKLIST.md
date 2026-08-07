# Security Deployment Checklist

**Date**: 2026-08-07  
**Target Platform**: Render / Node.js Production Environment  

---

## Pre-Deployment Verification

- [x] **Git Tracking**: Verified `prisma/migrations/` is tracked by Git (removed from `.gitignore`).
- [x] **Build Script**: Verified `scripts/render-build.js` executes `npx prisma migrate deploy` with fail-fast checks.
- [x] **TypeScript Check**: `npx tsc --noEmit` executed with 0 errors.
- [x] **Prisma Client**: `npx prisma generate` updated with AuditLog model and partial indexes.

---

## Environment Variables Configuration

Configure the following environment variables in your deployment dashboard (e.g. Render / Vercel):

- [ ] `DATABASE_URL`: Production PostgreSQL connection string.
- [ ] `DATABASE_URL_UNPOOLED`: Direct (unpooled) PostgreSQL connection string for Prisma migrations.
- [ ] `NEXTAUTH_SECRET`: Random 32+ byte string (`openssl rand -base64 32`).
- [ ] `NEXTAUTH_URL`: Canonical application URL (e.g. `https://your-domain.com`).
- [ ] `NEXT_PUBLIC_APP_URL`: Public app URL for CORS configuration.
- [ ] `CUSTOMER_DEVICE_HMAC_SECRET`: Random 32+ byte string (`openssl rand -base64 32`).

---

## Post-Deployment Verification Steps

1. **Health Check**: Verify `/api/health` returns HTTP 200.
2. **Server Log Inspection**: Verify server log prints `🔒 Production security checks passed`.
3. **CORS Verification**: Test requests from unauthorized domains to confirm origin blocking.
4. **Auth Flow Check**: Verify staff login, registration, and invite link generation.
