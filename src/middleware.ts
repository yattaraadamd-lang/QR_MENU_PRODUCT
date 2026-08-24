import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequestWithAuth } from "next-auth/middleware";

/**
 * 🔒 SECURITY: Middleware with Auth, CSRF/Origin, and Security Headers
 *
 * P0-03 FIX: Expanded matcher to include /api/:path* so that:
 *   - CSRF origin validation applies to staff API mutations (POST/PATCH/PUT/DELETE)
 *   - Security headers apply to all matched routes
 *   - Customer/public/health/auth/qr API routes are exempted from auth via the
 *     `authorized` callback
 *
 * ARCHITECTURE:
 *   - withAuth `authorized` callback: returns true for non-staff routes (no JWT required)
 *   - middleware function: applies CSRF + security headers + page-level auth redirects
 *   - Endpoint-level auth guards (requireAuth, requireAdmin, etc.) remain the
 *     PRIMARY authorization mechanism. This middleware is defense-in-depth.
 *
 * CSRF POLICY:
 *   - Applied ONLY to POST/PATCH/PUT/DELETE (state-changing) methods
 *   - GET/HEAD/OPTIONS are NEVER subject to CSRF checks
 *   - Applied ONLY to staff API routes (/api/admin/*, /api/waiter/*, /api/super-admin/*,
 *     /api/orders/*, /api/service-requests/*, /api/tables/*, /api/table-sessions/*,
 *     /api/notifications/*, /api/bills/*, /api/badge-counts/*, /api/staff/*,
 *     /api/diagnostics/*)
 *   - EXEMPTED: /api/customer/*, /api/public/*, /api/menu/*, /api/qr/*,
 *     /api/health*, /api/auth/*, /api/business/*
 */

// ─── Route classification ─────────────────────────────────────────────────────

/** Routes that do NOT require JWT authentication (customer/public facing) */
const AUTH_EXEMPT_API_PREFIXES = [
  "/api/customer/",
  "/api/public/",
  "/api/menu/",
  "/api/qr/",
  "/api/health",
  "/api/auth/",
  "/api/business/",
];

/** Routes that are staff-only and subject to CSRF protection on mutations */
const STAFF_API_PREFIXES = [
  "/api/admin/",
  "/api/waiter/",
  "/api/super-admin/",
  "/api/orders/",
  "/api/orders",
  "/api/service-requests/",
  "/api/service-requests",
  "/api/tables/",
  "/api/tables",
  "/api/table-sessions/",
  "/api/table-sessions",
  "/api/notifications",
  "/api/bills/",
  "/api/badge-counts",
  "/api/staff/",
  "/api/diagnostics/",
];

/** HTTP methods that are state-changing and require CSRF protection */
const MUTATION_METHODS = ["POST", "PATCH", "PUT", "DELETE"];

function isAuthExemptApi(pathname: string): boolean {
  return AUTH_EXEMPT_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isStaffApi(pathname: string): boolean {
  return STAFF_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix)
  );
}

// ─── Allowed origins for CSRF protection ──────────────────────────────────────
function getAllowedOrigins(): string[] {
  const origins: string[] = [];
  if (process.env.NEXT_PUBLIC_APP_URL) {
    origins.push(process.env.NEXT_PUBLIC_APP_URL);
  }
  if (process.env.NEXTAUTH_URL) {
    const url = process.env.NEXTAUTH_URL;
    if (!origins.includes(url)) origins.push(url);
  }
  if (process.env.NODE_ENV !== "production") {
    origins.push("http://localhost:3000");
  }
  return origins;
}

export default withAuth(
  function middleware(req: NextRequestWithAuth) {
    const pathname = req.nextUrl.pathname;
    const isApiRoute = pathname.startsWith("/api/");

    // ─── CSRF/Origin validation for staff API mutations ─────────────────
    if (isApiRoute && isStaffApi(pathname) && MUTATION_METHODS.includes(req.method)) {
      const origin = req.headers.get("origin");
      const allowedOrigins = getAllowedOrigins();

      // ✅ CSRF: Reject mutations from unknown origins
      // If origin is present AND we have configured origins AND origin is not allowed → block
      // If origin is absent (same-origin requests from some browsers) → allow (safe with SameSite cookies)
      if (origin && allowedOrigins.length > 0 && !allowedOrigins.includes(origin)) {
        return NextResponse.json(
          { error: "Cross-origin mutation rejected." },
          { status: 403 }
        );
      }

      // ✅ Content-Type enforcement for mutation API requests
      const contentType = req.headers.get("content-type");
      if (
        contentType &&
        !contentType.includes("application/json") &&
        !contentType.includes("multipart/form-data")
      ) {
        return NextResponse.json(
          { error: "Invalid content type. JSON required." },
          { status: 415 }
        );
      }
    }

    // ─── Request Correlation (x-request-id) ───────────────────────────
    const requestId = req.headers.get("x-request-id") || crypto.randomUUID();

    // ─── Security Headers (all matched routes) ──────────────────────────
    const response = NextResponse.next();
    response.headers.set("x-request-id", requestId);
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    if (process.env.NODE_ENV === "production") {
      response.headers.set(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains"
      );
    }

    // ─── API routes: no page-level auth redirects, just return ───────────
    if (isApiRoute) {
      return response;
    }

    // ─── Page-level auth logic (existing behavior preserved) ────────────
    const token = req.nextauth.token;
    const isAuth = !!token;
    const isAuthPage = pathname.startsWith("/auth");

    if (isAuthPage) {
      if (isAuth) {
        if (token.role === "SUPER_ADMIN") {
          return NextResponse.redirect(new URL("/super-admin", req.url));
        }
        if (token.role === "ADMIN") {
          return NextResponse.redirect(new URL("/admin", req.url));
        }
        return NextResponse.redirect(new URL("/waiter", req.url));
      }
      return null;
    }

    if (!isAuth) {
      return NextResponse.redirect(new URL("/auth/signin", req.url));
    }

    // Super Admin route protection
    if (pathname.startsWith("/super-admin") && token.role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/auth/signin", req.url));
    }

    // Admin route protection
    if (pathname.startsWith("/admin") && token.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/waiter", req.url));
    }

    return response;
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl?.pathname || "";

        // API routes that don't require JWT: allow through middleware
        // (endpoint-level auth guards handle actual authorization)
        if (pathname.startsWith("/api/")) {
          if (isAuthExemptApi(pathname)) return true;
          // Staff API routes: still allow through middleware (return true)
          // because endpoint auth guards do the real check.
          // Middleware only adds CSRF/headers — it doesn't replace auth.
          return true;
        }

        // Auth pages: allow even without token
        if (pathname.startsWith("/auth")) return true;

        // All other pages (admin/waiter/super-admin): require token
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    "/admin/:path*",
    "/waiter/:path*",
    "/super-admin/:path*",
    "/auth/:path*",
    "/api/:path*",
  ],
};

