import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
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
          throw new Error("E-posta ve şifre gerekli");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { business: true },
        });

        if (!user) {
          throw new Error("Kullanıcı bulunamadı");
        }

        if (!user.isActive) {
          throw new Error("Hesabınız pasif durumda. Yöneticinizle iletişime geçin.");
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          throw new Error("Geçersiz şifre");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          businessId: user.businessId,
          businessName: user.business.name,
        };
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
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
