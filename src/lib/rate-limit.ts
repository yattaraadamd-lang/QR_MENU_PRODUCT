/**
 * Rate Limiting — Re-export from unified module
 *
 * ⚠️  All rate limiting logic is centralized in unified-rate-limit.ts.
 * This file exists solely for backward compatibility with existing imports.
 */

export {
  checkRateLimit,
  UNIFIED_RATE_LIMITS as RateLimitPresets,
  RATE_LIMITS,
  getClientIp,
  rateLimit,
  createRateLimitResponse,
} from "./unified-rate-limit";
export type { RateLimitConfig, RateLimitResult } from "./unified-rate-limit";
