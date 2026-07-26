/**
 * Simple in-memory rate limiter for MVP
 * For production, use Redis-based solution like @upstash/ratelimit
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
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

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || entry.resetAt < now) {
    // New window
    const resetAt = now + config.windowMs;
    rateLimitStore.set(identifier, { count: 1, resetAt });
    return { allowed: true, remaining: config.maxRequests - 1, resetAt };
  }

  if (entry.count >= config.maxRequests) {
    // Rate limit exceeded
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  // Increment count
  entry.count++;
  rateLimitStore.set(identifier, entry);
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Rate limit presets for different actions
 */
export const RATE_LIMITS = {
  ORDER_CREATE: {
    maxRequests: 1,
    windowMs: 10 * 1000, // 10 seconds
  },
  SERVICE_REQUEST: {
    maxRequests: 1,
    windowMs: 60 * 1000, // 60 seconds
  },
  PAYMENT_REQUEST: {
    maxRequests: 1,
    windowMs: 60 * 1000, // 60 seconds
  },
} as const;
