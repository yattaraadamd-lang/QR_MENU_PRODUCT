/**
 * Rate Limiting — Production-grade wrapper
 *
 * ⚠️  SECURITY FIX P0-01: The previous `rateLimit()` was a NO-OP that always
 * returned `{ success: true }`. ALL rate limiting was effectively disabled.
 *
 * This module now delegates to the real in-memory sliding-window limiter in
 * unified-rate-limit.ts.
 *
 * STORAGE LIMITATION: In-memory only (single-process).
 * Multiple Render instances or process restarts do NOT share rate-limit state.
 * This provides single-instance protection, not distributed rate limiting.
 *
 * FAIL-CLOSED POLICY: If the rate-limit subsystem throws an unexpected error,
 * security-sensitive endpoints (login, order, payment) will REJECT the request
 * rather than silently allowing it through.
 */

export {
  checkRateLimit,
  UNIFIED_RATE_LIMITS as RateLimitPresets,
  getClientIp,
} from "./unified-rate-limit";
export type { RateLimitConfig, RateLimitResult } from "./unified-rate-limit";

import { checkRateLimit, RateLimitConfig, RateLimitResult } from "./unified-rate-limit";

/**
 * Async rate limiter — replaces the old no-op sync wrapper.
 *
 * All callers MUST `await` this function and check `result.success`.
 *
 * @returns { success, limit, remaining, reset }
 */
export async function rateLimit(
  config: RateLimitConfig
): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
  const identifier = config.identifier || "global";
  try {
    const result: RateLimitResult = await checkRateLimit(identifier, config);
    return {
      success: result.allowed,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.resetAt,
    };
  } catch (error) {
    // FAIL-CLOSED: reject the request rather than silently allowing it
    console.error("[RateLimit] Unexpected error — failing closed:", error);
    return {
      success: false,
      limit: config.maxRequests,
      remaining: 0,
      reset: Date.now() + config.windowMs,
    };
  }
}

export function createRateLimitResponse(result: { reset?: number }) {
  const retryAfter = result.reset
    ? Math.max(1, Math.ceil((result.reset - Date.now()) / 1000))
    : 60;

  return new Response(
    JSON.stringify({
      error: "Çok fazla istek. Lütfen daha sonra tekrar deneyin.",
      retryAfterSeconds: retryAfter,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
      },
    }
  );
}
