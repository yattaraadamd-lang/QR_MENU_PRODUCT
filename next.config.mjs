/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
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
        ],
      },
      {
        // HSTS only for production (applied to all routes)
        source: "/:path*",
        headers: process.env.NODE_ENV === "production"
          ? [
              {
                key: "Strict-Transport-Security",
                value: "max-age=31536000; includeSubDomains",
              },
            ]
          : [],
      },
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
