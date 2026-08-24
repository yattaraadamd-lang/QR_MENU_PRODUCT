import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "./prisma";
import { checkRateLimit, UNIFIED_RATE_LIMITS } from "./unified-rate-limit";

/**
 * 🔒 SECURITY FIX P0: Login Rate Limiting
 *
 * Rate limiting is now integrated directly into the authorize callback using
 * the in-memory sliding-window limiter from unified-rate-limit.ts.
 *
 * Current: In-memory rate limiting (5 attempts / 15 min per email).
 *          Single-instance protection only — does not share state across processes.
 *
 * For stronger protection at scale, consider:
 *   - Redis-based rate limiting (@upstash/ratelimit)
 *   - Edge/CDN level (Cloudflare, Render)
 *   - Database-based failed attempt tracking with account lockout
 */

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "E-posta", type: "email" },
        password: { label: "Şifre", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          // ✅ SECURITY: Email normalization
          const normalizedEmail = credentials.email.trim().toLowerCase();

          // ✅ P0 FIX: Rate limit login attempts by email
          // FAIL-CLOSED: if checkRateLimit throws, deny the attempt
          try {
            const rl = await checkRateLimit(
              `login:${normalizedEmail}`,
              UNIFIED_RATE_LIMITS.LOGIN
            );
            if (!rl.allowed) {
              const waitMinutes = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 60000));
              throw new Error(
                `Çok fazla giriş denemesi. Lütfen ${waitMinutes} dakika sonra tekrar deneyin.`
              );
            }
          } catch (rateLimitError: any) {
            // If the error is our rate limit message, re-throw it
            if (rateLimitError.message?.includes("giriş denemesi")) {
              throw rateLimitError;
            }
            // Otherwise: fail-closed — reject unknown rate limit errors
            console.error("[Auth] Rate limit check failed — failing closed:", rateLimitError);
            throw new Error("Giriş işlemi şu anda kullanılamıyor. Lütfen tekrar deneyin.");
          }

          const user = await prisma.user.findUnique({
            where: { email: normalizedEmail },
            include: { business: true },
          });

          if (!user || !user.isActive || user.deletedAt) {
            // ✅ SECURITY: Constant-time-ish behavior — still hash even if user not found
            // This reduces timing difference between "user exists" and "user doesn't exist"
            if (!user) {
              await bcrypt.hash(credentials.password, 10);
            }
            return null;
          }

          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            user.password
          );

          if (!isPasswordValid) {
            return null;
          }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          businessId: user.businessId,
          businessName: user.business.name,
        };
        } catch (error) {
          // Re-throw rate limit errors so NextAuth surfaces them
          if (error instanceof Error && error.message.includes("giriş denemesi")) {
            throw error;
          }
          if (error instanceof Error && error.message.includes("kullanılamıyor")) {
            throw error;
          }
          console.error("Auth error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.businessId = user.businessId;
        token.businessName = user.businessName;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.businessId = token.businessId as string;
        session.user.businessName = token.businessName as string;
      }
      
      // ✅ SECURITY FIX: HMAC-signed socket access token
      // Format: base64(payload) + "." + hex(HMAC-SHA256(payload, secret))
      const socketAuthPayload = {
        userId: token.id,
        businessId: token.businessId,
        role: token.role,
        iat: Math.floor(Date.now() / 1000),
      };
      
      const payload = Buffer.from(JSON.stringify(socketAuthPayload)).toString('base64');
      const secret = process.env.NEXTAUTH_SECRET;
      
      if (secret) {
        const signature = crypto
          .createHmac("sha256", secret)
          .update(payload)
          .digest("hex");
        session.accessToken = `${payload}.${signature}`;
      } else {
        // ⚠️ NEXTAUTH_SECRET missing — socket auth will reject unsigned tokens.
        // Assign payload so the session callback doesn't break,
        // but socket connections will fail until the secret is configured.
        console.warn("[Auth] NEXTAUTH_SECRET is not set. Socket authentication will fail.");
        session.accessToken = payload;
      }
      
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // ✅ SECURITY: 8 hour max session age
  },
  secret: process.env.NEXTAUTH_SECRET,
};

