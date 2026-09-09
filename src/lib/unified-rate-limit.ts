/**
 * Unified Rate Limiter Utility
 * 
 * Provides consistent rate limiting across staff auth, customer sessions,
 * orders, service requests, and payments.
 * 
 * Designed for sliding window in-memory protection with zero external dependencies,
 * clean automatic key expiration, and rate limit header helpers.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup expired entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    const keysToDelete: string[] = [];
    rateLimitStore.forEach((entry, key) => {
      if (entry.resetAt < now) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => rateLimitStore.delete(key));
  }, 5 * 60 * 1000);
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  identifier?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || entry.resetAt < now) {
    const resetAt = now + config.windowMs;
    rateLimitStore.set(identifier, { count: 1, resetAt });
    return {
      allowed: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - 1,
      resetAt,
    };
  }

  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      limit: config.maxRequests,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  entry.count++;
  rateLimitStore.set(identifier, entry);
  return {
    allowed: true,
    limit: config.maxRequests,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Standardized presets for system rate limits (including aliases for legacy code)
 */
export const UNIFIED_RATE_LIMITS = {
  LOGIN: {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000, // 5 tries per 15 min
  },
  REGISTER: {
    maxRequests: 3,
    windowMs: 60 * 60 * 1000, // 3 tries per hour
  },
  STAFF_INVITE: {
    maxRequests: 10,
    windowMs: 60 * 1000, // 10 invites per min
  },
  CUSTOMER_SESSION: {
    maxRequests: 10,
    windowMs: 15 * 60 * 1000, // 10 session creations per 15 min
  },
  ORDER_CREATE: {
    maxRequests: 1,
    windowMs: 10 * 1000, // 1 order per 10 seconds
  },
  ORDER_CREATION: {
    maxRequests: 20,
    windowMs: 15 * 60 * 1000,
  },
  SERVICE_REQUEST: {
    maxRequests: 1,
    windowMs: 60 * 1000, // 1 request per 60 seconds
  },
  PAYMENT_REQUEST: {
    maxRequests: 1,
    windowMs: 60 * 1000, // 1 payment request per 60 seconds
  },
  ORDER_REQUEST_CREATE: {
    maxRequests: 1,
    windowMs: 60 * 1000, // 60 seconds
  },
  ORDER_REQUEST_BURST: {
    maxRequests: 3,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },
  GENERAL: {
    maxRequests: 100,
    windowMs: 15 * 60 * 1000,
  },
} as const;

/**
 * Helper to get client IP from Next.js / standard Request headers safely
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  if (cfConnectingIp) {
    return cfConnectingIp;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "127.0.0.1";
}

/** Legacy alias for backward compatibility */
export const RATE_LIMITS = UNIFIED_RATE_LIMITS;

/**
 * Async rate limiter — legacy compat wrapper.
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

/**
 * Creates a standardized 429 response with retry-after header.
 */
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
