/**
 * Rate Limiting Utility
 * 
 * Bu basit in-memory rate limiter production için yeterli değildir.
 * Production'da Redis tabanlı bir çözüm kullanılmalıdır.
 * 
 * Önerilen paketler:
 * - @upstash/ratelimit (Vercel için)
 * - ioredis + rate-limiter-flexible
 * - express-rate-limit (Express kullanıyorsanız)
 */

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

// In-memory store (production'da Redis kullanın!)
const store: RateLimitStore = {};

// Cleanup eski kayıtları her 5 dakikada bir
setInterval(() => {
  const now = Date.now();
  Object.keys(store).forEach((key) => {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  });
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  /**
   * Kaç istek izin verilecek
   */
  maxRequests: number;
  
  /**
   * Zaman penceresi (milisaniye)
   */
  windowMs: number;
  
  /**
   * Rate limit identifier (IP, user ID, vb.)
   */
  identifier: string;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Basit in-memory rate limiter
 * 
 * UYARI: Bu sadece development ve placeholder amaçlıdır.
 * Production'da Redis tabanlı çözüm kullanın!
 */
export function rateLimit(config: RateLimitConfig): RateLimitResult {
  const { maxRequests, windowMs, identifier } = config;
  const now = Date.now();
  
  // Mevcut kaydı al veya yeni oluştur
  if (!store[identifier] || store[identifier].resetTime < now) {
    store[identifier] = {
      count: 0,
      resetTime: now + windowMs,
    };
  }
  
  const record = store[identifier];
  record.count++;
  
  const remaining = Math.max(0, maxRequests - record.count);
  const success = record.count <= maxRequests;
  
  return {
    success,
    limit: maxRequests,
    remaining,
    reset: record.resetTime,
  };
}

/**
 * IP adresini request'ten al
 */
export function getClientIp(request: Request): string {
  // Vercel, Cloudflare, vb. için
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  
  // Cloudflare
  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  if (cfConnectingIp) {
    return cfConnectingIp;
  }
  
  // Fallback
  return "unknown";
}

/**
 * Rate limit presets
 */
export const RateLimitPresets = {
  /**
   * Login endpoint için
   * 5 deneme / 15 dakika
   */
  LOGIN: {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000, // 15 dakika
  },
  
  /**
   * Customer session oluşturma için
   * 10 istek / 15 dakika
   */
  CUSTOMER_SESSION: {
    maxRequests: 10,
    windowMs: 15 * 60 * 1000,
  },
  
  /**
   * Sipariş oluşturma için
   * 20 sipariş / 15 dakika
   */
  ORDER_CREATION: {
    maxRequests: 20,
    windowMs: 15 * 60 * 1000,
  },
  
  /**
   * Hizmet talebi oluşturma için
   * 30 talep / 15 dakika
   */
  SERVICE_REQUEST: {
    maxRequests: 30,
    windowMs: 15 * 60 * 1000,
  },
  
  /**
   * Genel API için
   * 100 istek / 15 dakika
   */
  GENERAL: {
    maxRequests: 100,
    windowMs: 15 * 60 * 1000,
  },
};

/**
 * Rate limit response helper
 */
export function createRateLimitResponse(result: RateLimitResult) {
  return new Response(
    JSON.stringify({
      error: "Çok fazla istek. Lütfen daha sonra tekrar deneyin.",
      retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "X-RateLimit-Limit": result.limit.toString(),
        "X-RateLimit-Remaining": result.remaining.toString(),
        "X-RateLimit-Reset": result.reset.toString(),
        "Retry-After": Math.ceil((result.reset - Date.now()) / 1000).toString(),
      },
    }
  );
}
