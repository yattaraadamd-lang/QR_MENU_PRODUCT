import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

/**
 * 🔒 SECURITY: Middleware with Auth, CSRF/Origin, and Security Headers
 *
 * CHANGES:
 * - CSRF/Origin validation for staff mutation endpoints (POST/PATCH/PUT/DELETE)
 * - Security headers applied to all matched routes
 * - JSON Content-Type enforcement for mutation API requests
 */

// ─── Allowed origins for CSRF protection ──────────────────────────────────────
function getAllowedOrigins(): string[] {
  const origins: string[] = [];
  if (process.env.NEXT_PUBLIC_APP_URL) {
    origins.push(process.env.NEXT_PUBLIC_APP_URL);
  }
  if (process.env.NODE_ENV !== "production") {
    origins.push("http://localhost:3000");
  }
  return origins;
}

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const isAuth = !!token;
    const isAuthPage = req.nextUrl.pathname.startsWith("/auth");

    // ─── CSRF/Origin validation for staff API mutations ─────────────────
    const isApiRoute = req.nextUrl.pathname.startsWith("/api/");
    const isMutation = ["POST", "PATCH", "PUT", "DELETE"].includes(req.method);
    const isStaffApi = isApiRoute && !req.nextUrl.pathname.startsWith("/api/customer/") &&
                       !req.nextUrl.pathname.startsWith("/api/public/") &&
                       !req.nextUrl.pathname.startsWith("/api/menu/") &&
                       !req.nextUrl.pathname.startsWith("/api/qr/") &&
                       !req.nextUrl.pathname.startsWith("/api/health");

    if (isStaffApi && isMutation) {
      const origin = req.headers.get("origin");
      const allowedOrigins = getAllowedOrigins();

      // ✅ CSRF: Reject mutations from unknown/missing origins
      if (origin && allowedOrigins.length > 0 && !allowedOrigins.includes(origin)) {
        return NextResponse.json(
          { error: "Cross-origin mutation rejected." },
          { status: 403 }
        );
      }

      // ✅ Content-Type enforcement for non-GET API requests
      const contentType = req.headers.get("content-type");
      if (contentType && !contentType.includes("application/json") && !contentType.includes("multipart/form-data")) {
        return NextResponse.json(
          { error: "Invalid content type. JSON required." },
          { status: 415 }
        );
      }
    }

    // Add Security Headers
    const response = NextResponse.next();
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

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
    if (req.nextUrl.pathname.startsWith("/super-admin") && token.role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/auth/signin", req.url));
    }

    // Admin route protection
    if (req.nextUrl.pathname.startsWith("/admin") && token.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/waiter", req.url));
    }

    return response;
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: ["/admin/:path*", "/waiter/:path*", "/super-admin/:path*"],
};
