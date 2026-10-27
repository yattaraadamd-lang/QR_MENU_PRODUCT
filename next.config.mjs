/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ PERF: Gereksiz X-Powered-By header'ını kaldır
  poweredByHeader: false,
  // ✅ PERF: React Strict Mode
  reactStrictMode: true,
  // pino transport'lar için dinamik require / worker thread kullanır; bundle'a alınmasın
  // (bu Next sürümünün varsayılan harici paket listesinde yok)
  serverExternalPackages: ["pino", "thread-stream"],
  images: {
    // ✅ PERF: Modern image formatları — AVIF %50, WebP %30 daha küçük
    formats: ["image/avif", "image/webp"],
    // ✅ PERF: Optimize edilmiş görseller 30 gün cache'lenir
    minimumCacheTTL: 2592000,
    remotePatterns: [
      // ✅ SECURITY FIX: Restrict image hosts to known trusted domains
      // Previously: hostname: "**" (allowed ALL hosts — SSRF risk)
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "https",
        hostname: "*.supabase.in",
      },
      // Add your specific CDN/storage domains here:
      // { protocol: "https", hostname: "your-cdn.example.com" },
    ],
  },
  // ✅ SECURITY: Global security headers via Next.js config
  async headers() {
    return [
      {
        // Apply to ALL routes
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self), payment=()",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            // Chromium ihlalleri Reporting API ile bu uca gönderir (CSP'deki report-to adı)
            key: "Reporting-Endpoints",
            value: 'csp-endpoint="/api/csp-report"',
          },
          {
            // ✅ CSP: Report-only mode for safe rollout
            // Gradually tighten by moving to Content-Security-Policy once violations are analyzed.
            // İhlaller /api/csp-report'a gelir ve Render loglarında [CSP_VIOLATION] olarak görünür.
            key: "Content-Security-Policy-Report-Only",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in",
              "connect-src 'self' wss: ws: https://*.supabase.co",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              // report-uri: Firefox/Safari; report-to: Chromium (ikisi de varsa report-to'yu kullanır)
              "report-uri /api/csp-report",
              "report-to csp-endpoint",
            ].join("; "),
          },
        ],
      },
      // HSTS only for production (applied to all routes).
      // Next.js boş headers dizisini reddettiği için girdi geliştirmede hiç eklenmez.
      ...(process.env.NODE_ENV === "production"
        ? [
            {
              source: "/:path*",
              headers: [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=31536000; includeSubDomains",
                },
              ],
            },
          ]
        : []),
      // Staging (render.staging.yaml → APP_ENV=staging): hiçbir sayfa dizine eklenmez
      ...(process.env.APP_ENV === "staging"
        ? [
            {
              source: "/:path*",
              headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
            },
          ]
        : []),
      {
        // ✅ Private API routes: no caching
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, private",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
