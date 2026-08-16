import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "./prisma";

/**
 * SECURITY NOTE: Rate Limiting for Login
 * 
 * NextAuth doesn't provide built-in rate limiting for the authorize callback.
 * For production, implement one of these solutions:
 * 
 * 1. Middleware-based rate limiting (recommended):
 *    - Use @upstash/ratelimit with Redis
 *    - Apply to /api/auth/callback/credentials route
 * 
 * 2. Database-based tracking:
 *    - Track failed login attempts in database
 *    - Lock account after N failed attempts
 *    - Implement exponential backoff
 * 
 * 3. Edge/CDN level:
 *    - Cloudflare Rate Limiting
 *    - Vercel Edge Config
 * 
 * Current implementation: Basic in-memory rate limiting is available
 * in src/lib/rate-limit.ts but needs to be integrated at the route level.
 * 
 * TODO: Implement production-grade login rate limiting before deployment
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

