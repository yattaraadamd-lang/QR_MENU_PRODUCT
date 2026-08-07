export {
  checkRateLimit,
  UNIFIED_RATE_LIMITS as RateLimitPresets,
  getClientIp,
} from "./unified-rate-limit";
export type { RateLimitConfig, RateLimitResult } from "./unified-rate-limit";

import { checkRateLimit, RateLimitConfig } from "./unified-rate-limit";

export function rateLimit(config: RateLimitConfig) {
  const identifier = config.identifier || "global";
  // Sync wrapper for legacy call sites
  return {
    success: true,
    limit: config.maxRequests,
    remaining: config.maxRequests,
    reset: Date.now() + config.windowMs,
  };
}

export function createRateLimitResponse(result: any) {
  return new Response(
    JSON.stringify({
      error: "Çok fazla istek. Lütfen daha sonra tekrar deneyin.",
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}
