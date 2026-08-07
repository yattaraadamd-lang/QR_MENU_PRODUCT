# Security Fix Report — Remediation Details

**Date**: 2026-08-07  
**Scope**: Codebase Remediation & Architecture Hardening  

---

## Remediation Details by Vulnerability

### 1. P0-01: Staff Invite Endpoint Protection (`src/app/api/staff/invite/route.ts`)
- **Fix**: Added mandatory `requireAdmin()` session check.
- **Hash Storage**: Raw invite codes (`inv_<32-hex>`) are returned only once to the admin; stored as SHA-256 hash in database (`codeHash`).
- **Expiry**: Enforced mandatory 7-day expiration date on invite generation.

### 2. P0-02: Register Atomic Invite Consumption (`src/app/api/auth/register/route.ts`)
- **Fix**: Wrapped invite verification and usage in an atomic Prisma transaction using `updateMany` (`isUsed: false`).
- **Password Hardening**: Zod strict schema enforcing 12-72 characters, harf + rakam, common password block, email !== password check.
- **Enumeration Defense**: Unified error responses to prevent user existence probing.

### 3. P0-03: Socket Authentication & HMAC Signing (`src/lib/socket-auth.ts`, `src/lib/auth.ts`)
- **Fix**: Access tokens generated in session callback are now cryptographically signed with HMAC-SHA256 using `NEXTAUTH_SECRET`.
- **Validation**: Handshake verifies signature before DB lookup; checks `user.isActive`, `user.deletedAt`, and matching `businessId`.

### 4. P0-04: Fail-closed Device Block Configuration (`src/lib/security/device-block.ts`, `server.js`)
- **Fix**: Missing `CUSTOMER_DEVICE_HMAC_SECRET` in production causes immediate server startup failure (`process.exit(1)`).
- **Environment**: Render deployment configuration updated to include `CUSTOMER_DEVICE_HMAC_SECRET`.

### 5. P0-05: Customer Session Authorization Enforcement (`src/lib/security/validate-customer-session.ts`)
- **Fix**: Enforced `validateAuthorizedTableSession` on all state-changing endpoints (orders, payments, requests).
- **Legacy Removal**: Removed dangerous `validateCustomerActionSession` alias.

### 6. P0-06: Device Binding & Session Token Hashing (`src/app/api/customer/session/route.ts`)
- **Fix**: Customer session tokens generated using 256-bit CSPRNG (`crypto.randomBytes(32)`), stored as SHA-256 hash in DB.
- **Binding**: Enforced `deviceKeyHash` check matching HttpOnly `customer_device_id` cookie.

### 7. P0-07: Header-Only Session Token Transport (`src/app/api/customer/session/route.ts`)
- **Fix**: Removed URL query string token support; tokens are sent exclusively via `x-session-token` header.
- **Headers**: Added `Cache-Control: no-store, private` to all session and API responses.

### 8. P0-08: Hardcoded Credentials & Production Guard (`prisma/seed.ts`, `prisma/reset-db.ts`)
- **Fix**: Added `checkProductionSafety()` guard throwing errors if seed or reset scripts are run in production or against cloud DB URLs.
- **Log Masking**: Removed plaintext password printing from seed logs.

### 9. P0-09: Centralized Auth Guard & Tenant Isolation (`src/lib/auth-guard.ts`)
- **Fix**: Created authoritative `auth-guard.ts` module with live database verification of `user.isActive`, `user.deletedAt`, and `business.isActive`.
- **Integration**: Re-exported through `src/lib/auth-helpers.ts` to protect all staff API endpoints automatically.

### 10. P0-10: Idempotency Recovery & Stream Safety (`src/app/api/customer/orders/route.ts`)
- **Fix**: Declared `body` outside `try` block to eliminate double `request.json()` call in `catch` block on `P2002` error.
- **Scope**: Scoped idempotency key search strictly to `businessId` + `customerSessionId`.

---

## System Hardening & Infrastructure Improvements

- **Deployment Safety**: Removed `prisma/migrations/` from `.gitignore`. Updated `scripts/render-build.js` to execute `npx prisma migrate deploy` instead of destructive `db push --accept-data-loss`.
- **Audit Logging**: Created append-only `AuditLog` Prisma model and `src/lib/services/audit-log.service.ts` with automatic sensitive field redaction and IP hashing.
- **Unified Rate Limiting**: Implemented `src/lib/unified-rate-limit.ts` for sliding-window rate limiting on login, registration, orders, and payments.
- **Security Headers & Image Allowlist**: Restricted Next.js image domain patterns to `*.supabase.co` / `*.supabase.in` in `next.config.mjs` and applied security headers (`X-Frame-Options`, `HSTS`, `Permissions-Policy`, `COOP`).
- **CI/CD Security Gate**: Added `.github/workflows/security.yml` for automated Prisma validation, TypeScript compilation, Next build verification, and production dependency vulnerability auditing.
