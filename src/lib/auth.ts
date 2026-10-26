import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "./prisma";
import { checkRateLimit, getClientIp, UNIFIED_RATE_LIMITS } from "./unified-rate-limit";
import { createAuditLog, auditRequestContext, AuditActions } from "./services/audit-log.service";

/**
 * Kilitlenmeyi pencere başına bir kez kaydeder: kilitliyken gelen her deneme audit
 * tablosuna satır yazarsa saldırgan veritabanını doldurabilir. Hedef hesap varsa
 * kayda bağlanır; girilen e-posta metni hiçbir zaman saklanmaz.
 */
async function logLoginLockout(
  scope: "email" | "ip",
  key: string,
  resetAt: number,
  email: string,
  context: ReturnType<typeof auditRequestContext>
) {
  try {
    const once = await checkRateLimit(`lockout_logged:${key}`, {
      maxRequests: 1,
      windowMs: Math.max(1000, resetAt - Date.now()),
    });
    if (!once.allowed) return;

    const target =
      scope === "email"
        ? await prisma.user.findUnique({ where: { email }, select: { id: true, businessId: true } })
        : null;

    await createAuditLog({
      ...context,
      businessId: target?.businessId,
      action: AuditActions.LOGIN_LOCKOUT,
      entityType: target ? "User" : null,
      entityId: target?.id,
      metadata: { scope },
    });
  } catch (error) {
    console.error("[Auth] Lockout audit failed:", (error as Error)?.message);
  }
}

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
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          // ✅ SECURITY: Email normalization
          const normalizedEmail = credentials.email.trim().toLowerCase();

          const headerEntries = Object.entries(req?.headers ?? {}).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string"
          );
          const headers = new Headers(headerEntries);
          const auditContext = auditRequestContext(headers);

          // ✅ P0 FIX: Rate limit login attempts by email AND by IP
          // (yalnız e-posta limiti, tek IP'den çok sayıda hesabın denenmesini engellemez)
          // FAIL-CLOSED: if checkRateLimit throws, deny the attempt
          try {
            const clientIp = getClientIp({ headers } as Request);
            const emailKey = `login:${normalizedEmail}`;
            const ipKey = `login_ip:${clientIp}`;

            const [rlEmail, rlIp] = await Promise.all([
              checkRateLimit(emailKey, UNIFIED_RATE_LIMITS.LOGIN),
              checkRateLimit(ipKey, UNIFIED_RATE_LIMITS.LOGIN_IP),
            ]);
            const rl = !rlEmail.allowed ? rlEmail : rlIp;
            if (!rl.allowed) {
              const scope = !rlEmail.allowed ? "email" : "ip";
              void logLoginLockout(scope, scope === "email" ? emailKey : ipKey, rl.resetAt, normalizedEmail, auditContext);
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
            // ✅ SECURITY: Constant-time-ish behavior — still hash when the account is
            // missing or inactive, so response time doesn't reveal which accounts exist
            await bcrypt.hash(credentials.password, 10);
            createAuditLog({
              ...auditContext,
              businessId: user?.businessId,
              action: AuditActions.LOGIN_FAILURE,
              entityType: user ? "User" : null,
              entityId: user?.id,
              metadata: { reason: user ? "inactive" : "unknown_user" },
            });
            return null;
          }

          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            user.password
          );

          if (!isPasswordValid) {
            createAuditLog({
              ...auditContext,
              businessId: user.businessId,
              action: AuditActions.LOGIN_FAILURE,
              entityType: "User",
              entityId: user.id,
              metadata: { reason: "bad_password" },
            });
            return null;
          }

          createAuditLog({
            ...auditContext,
            businessId: user.businessId,
            actorUserId: user.id,
            actorRole: user.role,
            action: AuditActions.LOGIN_SUCCESS,
            entityType: "User",
            entityId: user.id,
          });

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

