import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const isAuth = !!token;
    const isAuthPage = req.nextUrl.pathname.startsWith("/auth");
    
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
