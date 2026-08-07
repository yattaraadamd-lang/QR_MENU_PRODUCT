# Security Test Matrix

**Date**: 2026-08-07  
**Scope**: Verification Matrix for Security Vulnerabilities and Defensive Controls  

---

## Test Execution & Validation Results

| Test ID | Vulnerability / Target | Test Scenario | Expected Outcome | Actual Result | Status |
|---------|-----------------------|---------------|------------------|---------------|--------|
| **TEST-01** | P0-01 Staff Invite | Unauthenticated POST to `/api/staff/invite` | HTTP 401 Unauthorized | HTTP 401 Unauthorized | ✅ PASS |
| **TEST-02** | P0-01 Staff Invite | Waiter role POST to `/api/staff/invite` | HTTP 403 Forbidden | HTTP 403 Forbidden | ✅ PASS |
| **TEST-03** | P0-01 Staff Invite | Admin POST to `/api/staff/invite` | Code generated, stored as SHA-256 hash | Code returned once, DB holds hash | ✅ PASS |
| **TEST-04** | P0-02 Registration | Concurrent registration with single invite code | Only 1 request succeeds (atomic tx) | 1 succeeds (201), rest fail (400) | ✅ PASS |
| **TEST-05** | P0-02 Registration | Weak password (`123456789012`) | Rejected by password policy | HTTP 400 "çok yaygın" | ✅ PASS |
| **TEST-06** | P0-03 Socket Auth | Connect without token or invalid signature | `connect_error` emitted | Connection rejected | ✅ PASS |
| **TEST-07** | P0-03 Socket Auth | Deactivated user attempts socket connection | DB check fails, connection dropped | Connection rejected (`USER_DISABLED`) | ✅ PASS |
| **TEST-08** | P0-04 Device Block | Startup without `CUSTOMER_DEVICE_HMAC_SECRET` in prod | Fail-fast process termination | Process exits with code 1 | ✅ PASS |
| **TEST-09** | P0-05 Customer Auth | `VIEW_ONLY` session requests payment | HTTP 403 Forbidden | HTTP 403 (`SESSION_NOT_AUTHORIZED_FOR_TABLE`) | ✅ PASS |
| **TEST-10** | P0-06 Device Binding | Reusing session token with different device cookie | HTTP 403 Forbidden | HTTP 403 (`SESSION_DEVICE_MISMATCH`) | ✅ PASS |
| **TEST-11** | P0-07 Token Transport | Session token passed via URL query parameter | Token ignored / Rejected | HTTP 400 (`x-session-token header gerekli`) | ✅ PASS |
| **TEST-12** | P0-08 Seed Security | Executing `seed.ts` or `reset-db.ts` with `NODE_ENV=production` | Process error throw | Execution blocked immediately | ✅ PASS |
| **TEST-13** | P0-09 Tenant Isolation | Business A admin attempts fetching Business B resource | HTTP 403 Forbidden / Not Found | HTTP 403/404 Scope isolation | ✅ PASS |
| **TEST-14** | P0-10 Idempotency | Duplicate order request with same `idempotencyKey` | Return existing order without error | HTTP 200 with existing order data | ✅ PASS |
| **TEST-15** | System Headers | Inspection of response headers on `/api/customer/session` | Includes `Cache-Control: no-store, private` | Headers present | ✅ PASS |
| **TEST-16** | Build & Types | Execution of `npx tsc --noEmit` and `prisma generate` | Zero TypeScript errors | 0 errors | ✅ PASS |
