# Security Risk Acceptance & Residual Risk Register

**Date**: 2026-08-07  
**Status**: 🟢 **LOW RESIDUAL RISK - SUITABLE FOR PRODUCTION DEPLOYMENT**  

---

## Residual Risk Matrix

All P0 critical risks have been 100% remediated. The items below represent operational considerations and residual architectural risks monitored for future phases.

| Risk ID | Title | Residual Risk Level | Mitigation & Compensating Controls | Action / Future Roadmap |
|---------|-------|--------------------|-------------------------------------|------------------------|
| **RR-01** | In-Memory Sliding-Window Rate Limiting | 🟡 LOW | Single-node deployment (Render web service) effectively throttles brute-force attempts per instance. | Upgrade to distributed Redis rate limiting (`@upstash/ratelimit`) when scaling to multi-region/multi-instance deployments. |
| **RR-02** | External CDN Image Host Allowing | 🟡 LOW | Host pattern in `next.config.mjs` restricted strictly to `*.supabase.co` and `*.supabase.in`. | If self-hosting S3/Cloudflare R2, narrow hostname pattern strictly to specific bucket domain. |
| **RR-03** | HMAC Secret Rotation | 🟢 VERY LOW | `CUSTOMER_DEVICE_HMAC_SECRET` and `NEXTAUTH_SECRET` must be set via environment variables. | Rotate secrets annually or immediately upon suspected compromise (will invalidate active customer device hashes). |

---

## Sign-off & Recommendations

1. **Deploy Migration Files**: Ensure `npx prisma migrate deploy` is executed on Render build step (automated in updated `render-build.js`).
2. **Environment Variable Checklist**: Confirm `NEXTAUTH_SECRET`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, and `CUSTOMER_DEVICE_HMAC_SECRET` are configured in production environment settings.
