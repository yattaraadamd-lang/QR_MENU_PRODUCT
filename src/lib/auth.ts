import { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "./prisma";
import { checkRateLimit, getClientIp, resetRateLimit, UNIFIED_RATE_LIMITS } from "./unified-rate-limit";
import { createAuditLog, auditRequestContext, AuditActions } from "./services/audit-log.service";
import { logger as appLogger } from "./logger";
import { isSessionCurrent, SESSION_IDLE_SECONDS, SESSION_REVOKED } from "./session-policy";

const MAX_LOGIN_EMAIL_LENGTH = 254;
const MAX_LOGIN_PASSWORD_LENGTH = 1024;

/**
 * Oturum artık geçerli değilse fırlatır; NextAuth çerezi siler ve boş oturum döner.
 * Veritabanı okunamazsa oturum sonlandırılmaz (her fırlatılan hata çerezi siler, kısa bir
 * kesinti herkesi çıkarırdı): yetki denetimi auth-guard'ın kendi okumasıyla sürer, o da
 * okuyamazsa istek 500 döner.
 */
async function assertSessionCurrent(token: JWT) {
  if (!token.id) throw new Error(SESSION_REVOKED);

  let user;
  try {
    user = await prisma.user.findUnique({
      where: { id: token.id },
      select: { sessionVersion: true, isActive: true, deletedAt: true },
    });
  } catch (error) {
    appLogger.error({ err: error }, "[Auth] Oturum sürümü okunamadı");
    return;
  }

  if (!isSessionCurrent(token, user)) throw new Error(SESSION_REVOKED);
}

/**
 * Kilitlenmeyi pencere başına bir kez kaydeder: kilitliyken gelen her deneme audit
 * tablosuna satır yazarsa saldırgan veritabanını doldurabilir. Hedef hesap varsa
 * kayda bağlanır; girilen e-posta metni hiçbir zaman saklanmaz.
 */
async function logLoginLockout(
  scope: "email" | "pair" | "ip",
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
      scope !== "ip"
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
 * Current: In-memory rate limiting (bkz. authorize: IP, e-posta + IP, e-posta).
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

        // E-posta rate limit anahtarına girip pencere boyunca bellekte kalır, parola bcrypt'e
        // gider: sınır aşan girdi kimliksiz istekle sunucuyu şişirmeden önce elenir.
        if (
          credentials.email.length > MAX_LOGIN_EMAIL_LENGTH ||
          credentials.password.length > MAX_LOGIN_PASSWORD_LENGTH
        ) {
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
          const clientIp = getClientIp({ headers } as Request);
          const loginPairKey = `login:${normalizedEmail}:${clientIp}`;

          // ✅ P0 FIX: Rate limit login attempts
          // - IP: tek adresten çok sayıda hesabın denenmesi (password spraying)
          // - E-posta + IP: bir hesaba parola denemesi. Limit e-postanın kendisine bağlı olsaydı
          //   başka adresten birkaç yanlış denemeyle hesabın sahibi kilitlenebilirdi
          // - E-posta: birçok adresten aynı hesaba deneme; bu yüzden geniş
          // Sıra önemli: reddedilen deneme sonraki sayaçları artırmaz, yani tek adres e-posta
          // sayacını en fazla çift limiti kadar yükseltir.
          // FAIL-CLOSED: if checkRateLimit throws, deny the attempt
          try {
            const checks = [
              { scope: "ip", key: `login_ip:${clientIp}`, limit: UNIFIED_RATE_LIMITS.LOGIN_IP },
              { scope: "pair", key: loginPairKey, limit: UNIFIED_RATE_LIMITS.LOGIN },
              { scope: "email", key: `login_email:${normalizedEmail}`, limit: UNIFIED_RATE_LIMITS.LOGIN_EMAIL },
            ] as const;

            for (const { scope, key, limit } of checks) {
              const rl = await checkRateLimit(key, limit);
              if (!rl.allowed) {
                void logLoginLockout(scope, key, rl.resetAt, normalizedEmail, auditContext);
                const waitMinutes = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 60000));
                throw new Error(
                  `Çok fazla giriş denemesi. Lütfen ${waitMinutes} dakika sonra tekrar deneyin.`
                );
              }
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

          // Çıkış tüm cihazları kapatır; ortak hesabı kullanan tabletler yeniden girerken takılmasın
          resetRateLimit(loginPairKey);

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
          sessionVersion: user.sessionVersion,
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
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.businessId = user.businessId;
        token.businessName = user.businessName;
        token.sv = user.sessionVersion;
        token.authTime = Math.floor(Date.now() / 1000);
        return token;
      }

      await assertSessionCurrent(token);

      // İşletme adı değişince kenar çubuğu yeniden giriş beklemesin (useSession().update()).
      // İstemciden değer alınmaz: ad yalnız veritabanından, token'daki işletme için okunur
      if (trigger === "update" && token.businessId) {
        const business = await prisma.business.findUnique({
          where: { id: token.businessId as string },
          select: { name: true },
        });
        if (business) token.businessName = business.name;
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
        sv: token.sv,
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
  events: {
    // Çıkış, kullanıcının bütün cihazlardaki oturumlarını kapatır. Yalnız güncel sürümü taşıyan
    // token artırabilir: iptal edilmiş eski bir çerezle yeni oturumlar tekrar tekrar düşürülemez.
    async signOut({ token }) {
      if (!token?.id || typeof token.sv !== "number") return;
      await prisma.user.updateMany({
        where: { id: token.id, sessionVersion: token.sv },
        data: { sessionVersion: { increment: 1 } },
      });
    },
  },
  logger: {
    // İptal edilmiş oturum beklenen bir durum: bekleyen her istek log'a hata satırı yazmasın
    error(code, metadata) {
      if (code === "JWT_SESSION_ERROR" && (metadata as Error)?.message === SESSION_REVOKED) return;
      appLogger.error(metadata instanceof Error ? { code, err: metadata } : { code, metadata }, "[next-auth] Hata");
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
  session: {
    strategy: "jwt",
    maxAge: SESSION_IDLE_SECONDS,
  },
  secret: process.env.NEXTAUTH_SECRET,
};

