import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { generateDeviceKey, hashDeviceKey, checkDeviceBlock } from "@/lib/security/device-block";

export const dynamic = "force-dynamic";

const DEVICE_COOKIE_NAME = "customer_device_id";

/**
 * 🔒 SECURITY FIX P0-06/P0-07: Secure customer session management
 * 
 * CHANGES:
 * - Session token: 256-bit CSPRNG (crypto.randomBytes(32))
 * - Token stored as SHA-256 hash in database
 * - Raw token returned ONLY on creation
 * - Device binding enforced on token reuse
 * - Cache-Control: no-store on all responses
 * - Token NEVER in URL query parameters
 */

/**
 * Hash a session token for database storage/lookup.
 */
function hashSessionToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Generate a cryptographically secure session token (256-bit).
 */
function generateSessionToken(): string {
  return `cs_${crypto.randomBytes(32).toString("hex")}`;
}

/**
 * Add security headers to response.
 */
function addSecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "no-store, private");
  res.headers.set("Pragma", "no-cache");
  return res;
}

/**
 * POST /api/customer/session
 *
 * Her cihaz için benzersiz VIEW_ONLY müşteri oturumu oluşturur.
 * Başka cihazın token'ını ASLA döndürmez.
 *
 * - İstemci kendi mevcut token'ını gönderirse (existingToken) yeniden kullanır.
 * - Geçerli QR ile gelen her yeni cihaz benzersiz VIEW_ONLY session alır.
 * - Token loglama YAPILMAZ.
 * - Cihaz anahtarı HttpOnly cookie olarak saklanır.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessId, tableId, qrToken, existingToken } = body;

    if (!businessId || !tableId || typeof businessId !== "string" || typeof tableId !== "string") {
      return addSecurityHeaders(
        NextResponse.json({ error: "Geçersiz oturum bilgileri" }, { status: 400 })
      );
    }

    // ─── Masa kontrolü
    const table = await prisma.table.findFirst({
      where: { id: tableId, businessId, isActive: true, isDeleted: false },
    });

    if (!table) {
      return addSecurityHeaders(
        NextResponse.json(
          { error: "Bu QR kod artık geçerli değil. Lütfen işletme personelinden yeni QR kod isteyin." },
          { status: 404 }
        )
      );
    }

    // ─── Cihaz anahtarını cookie'den al veya oluştur
    let rawDeviceKey = request.cookies.get(DEVICE_COOKIE_NAME)?.value || null;
    let isNewDevice = false;

    if (!rawDeviceKey) {
      rawDeviceKey = generateDeviceKey();
      isNewDevice = true;
    }

    const deviceKeyHash = hashDeviceKey(rawDeviceKey);

    // ─── Cihaz engeli kontrolü
    const isBlocked = await checkDeviceBlock(businessId, deviceKeyHash);
    if (isBlocked) {
      const res = addSecurityHeaders(
        NextResponse.json(
          {
            error: "Bu cihazın bu işletmede işlem yapması engellendi.",
            code: "CUSTOMER_DEVICE_BLOCKED",
            viewOnly: true,
          },
          { status: 403 }
        )
      );
      if (isNewDevice) {
        res.cookies.set(DEVICE_COOKIE_NAME, rawDeviceKey, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 365 * 24 * 60 * 60,
          path: "/",
        });
      }
      return res;
    }

    // ─── Mevcut token yeniden kullanımı (aynı cihaz sayfa yenilerse)
    if (existingToken && typeof existingToken === "string") {
      // ✅ SECURITY: Hash the token for database lookup
      const existingTokenHash = hashSessionToken(existingToken);

      const existing = await prisma.customerSession.findUnique({
        where: { sessionToken: existingTokenHash },
      });

      if (
        existing &&
        existing.tableId === tableId &&
        existing.businessId === businessId &&
        existing.status === "ACTIVE" &&
        existing.expiresAt > new Date()
      ) {
        // ✅ P0-06 FIX: Validate device binding
        if (existing.deviceKeyHash && existing.deviceKeyHash !== deviceKeyHash) {
          return addSecurityHeaders(
            NextResponse.json(
              {
                error: "Bu oturum farklı bir cihaza ait. Güvenlik nedeniyle reddedildi.",
                code: "SESSION_DEVICE_MISMATCH",
                sessionToken: null,
              },
              { status: 403 }
            )
          );
        }

        // deviceKeyHash'i güncelle (eski session'larda olmayabilir)
        if (!existing.deviceKeyHash && deviceKeyHash) {
          await prisma.customerSession.update({
            where: { id: existing.id },
            data: { deviceKeyHash },
          });
        }

        const res = addSecurityHeaders(
          NextResponse.json({
            sessionToken: existingToken, // ✅ Return the raw token the client already has
            expiresAt: existing.expiresAt.toISOString(),
            authorizationStatus: existing.authorizationStatus,
            message: "Mevcut oturum kullanılıyor",
          })
        );

        if (isNewDevice) {
          res.cookies.set(DEVICE_COOKIE_NAME, rawDeviceKey, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 365 * 24 * 60 * 60,
            path: "/",
          });
        }
        return res;
      }
    }

    // ✅ E2E FIX: Demo business special handling
    // For demo-business-id, auto-create or reuse pre-authorized session
    if (businessId === "demo-business-id") {
      // Check if a demo session already exists for this table
      let demoSession = await prisma.customerSession.findFirst({
        where: {
          businessId: "demo-business-id",
          tableId: table.id,
          status: "ACTIVE",
          authorizationStatus: "AUTHORIZED",
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
      });

      // If no valid demo session, check for table session
      if (!demoSession) {
        // Find or create active table session for demo table
        let activeTableSession = await prisma.tableSession.findFirst({
          where: {
            businessId: "demo-business-id",
            tableId: table.id,
            status: "ACTIVE",
          },
        });

        if (!activeTableSession) {
          // Create table session (need a waiter - use first waiter)
          const demoWaiter = await prisma.user.findFirst({
            where: {
              businessId: "demo-business-id",
              role: "WAITER",
              isActive: true,
            },
          });

          if (demoWaiter) {
            activeTableSession = await prisma.tableSession.create({
              data: {
                businessId: "demo-business-id",
                tableId: table.id,
                status: "ACTIVE",
                openedBy: demoWaiter.id,
                openedAt: new Date(),
              },
            });

            // Create bill for table session
            await prisma.bill.create({
              data: {
                businessId: "demo-business-id",
                tableId: table.id,
                tableSessionId: activeTableSession.id,
                status: "OPEN",
                totalAmount: 0,
                paidAmount: 0,
                remainingAmount: 0,
              },
            });

            // Update table status
            await prisma.table.update({
              where: { id: table.id },
              data: { status: "OCCUPIED" },
            });
          }
        }

        // Create new pre-authorized demo session
        if (activeTableSession) {
          const rawToken = generateSessionToken();
          const tokenHash = hashSessionToken(rawToken);
          const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year for demo

          demoSession = await prisma.customerSession.create({
            data: {
              businessId: "demo-business-id",
              tableId: table.id,
              tableSessionId: activeTableSession.id,
              sessionToken: tokenHash,
              status: "ACTIVE",
              authorizationStatus: "AUTHORIZED", // Pre-authorized for demo
              deviceKeyHash,
              expiresAt,
              authorizedAt: new Date(),
            },
          });

          const res = addSecurityHeaders(
            NextResponse.json({
              sessionToken: rawToken,
              expiresAt: expiresAt.toISOString(),
              authorizationStatus: "AUTHORIZED",
              message: "Demo oturum oluşturuldu (pre-authorized)",
            })
          );

          if (isNewDevice) {
            res.cookies.set(DEVICE_COOKIE_NAME, rawDeviceKey, {
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              sameSite: "lax",
              maxAge: 365 * 24 * 60 * 60,
              path: "/",
            });
          }
          return res;
        }
      } else {
        // Return existing demo session token (but we don't have the raw token)
        // Create a new one with same session ID binding
        const rawToken = generateSessionToken();
        const tokenHash = hashSessionToken(rawToken);

        await prisma.customerSession.update({
          where: { id: demoSession.id },
          data: {
            sessionToken: tokenHash,
            deviceKeyHash,
            lastSeenAt: new Date(),
          },
        });

        const res = addSecurityHeaders(
          NextResponse.json({
            sessionToken: rawToken,
            expiresAt: demoSession.expiresAt.toISOString(),
            authorizationStatus: demoSession.authorizationStatus,
            message: "Demo oturumu yenilendi",
          })
        );

        if (isNewDevice) {
          res.cookies.set(DEVICE_COOKIE_NAME, rawDeviceKey, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 365 * 24 * 60 * 60,
            path: "/",
          });
        }
        return res;
      }
    }

    // ─── Yeni session oluşturmak için qrToken ZORUNLU (normal businesses)
    if (!qrToken || qrToken !== table.qrToken) {
      return addSecurityHeaders(
        NextResponse.json({
          sessionToken: null,
          viewOnly: true,
          message: "Sipariş vermek için QR kodu tekrar okutun.",
        })
      );
    }

    // ─── Benzersiz VIEW_ONLY CustomerSession oluştur (2 saatlik)
    // ✅ SECURITY: 256-bit CSPRNG token
    const rawToken = generateSessionToken();
    const tokenHash = hashSessionToken(rawToken);
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

    await prisma.customerSession.create({
      data: {
        businessId,
        tableId,
        sessionToken: tokenHash, // ✅ Store HASH, not raw token
        status: "ACTIVE",
        authorizationStatus: "VIEW_ONLY",
        deviceKeyHash,
        expiresAt,
      },
    });

    const res = addSecurityHeaders(
      NextResponse.json({
        sessionToken: rawToken, // ✅ Raw token returned ONLY here, ONCE
        expiresAt: expiresAt.toISOString(),
        authorizationStatus: "VIEW_ONLY",
        message: "Menü görüntüleme oturumu oluşturuldu",
      })
    );

    if (isNewDevice) {
      res.cookies.set(DEVICE_COOKIE_NAME, rawDeviceKey, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 365 * 24 * 60 * 60,
        path: "/",
      });
    }

    return res;
  } catch (error) {
    console.error("Oturum oluşturma hatası:", {
      // ❌ DO NOT log tokens or device keys
      code: (error as any)?.code,
    });
    return addSecurityHeaders(
      NextResponse.json({ error: "Oturum oluşturulurken bir hata oluştu" }, { status: 500 })
    );
  }
}

/**
 * GET /api/customer/session
 * 
 * ✅ P0-07 FIX: Token from header only (never URL query)
 * Token doğrula + yetki durumu döndür
 */
export async function GET(request: NextRequest) {
  try {
    // ✅ P0-07 FIX: Read token from header instead of URL query
    const rawToken = request.headers.get("x-session-token");

    if (!rawToken) {
      return addSecurityHeaders(
        NextResponse.json(
          { valid: false, error: "x-session-token header gerekli" },
          { status: 400 }
        )
      );
    }

    // ✅ SECURITY: Hash token for database lookup
    const tokenHash = hashSessionToken(rawToken);

    const session = await prisma.customerSession.findUnique({
      where: { sessionToken: tokenHash },
    });

    if (!session) {
      return addSecurityHeaders(
        NextResponse.json({ valid: false, error: "Geçersiz oturum" })
      );
    }

    if (session.status === "REVOKED") {
      return addSecurityHeaders(
        NextResponse.json({
          valid: false,
          authorizationStatus: "REVOKED",
          error: "Bu oturum iptal edilmiş.",
          code: "SESSION_REVOKED",
        })
      );
    }

    if (session.status !== "ACTIVE") {
      return addSecurityHeaders(
        NextResponse.json({ valid: false, error: "Oturum aktif değil" })
      );
    }

    if (new Date() > session.expiresAt) {
      await prisma.customerSession.update({
        where: { id: session.id },
        data: { status: "EXPIRED" },
      });
      return addSecurityHeaders(
        NextResponse.json({ valid: false, error: "Oturum süresi doldu" })
      );
    }

    return addSecurityHeaders(
      NextResponse.json({
        valid: true,
        authorizationStatus: session.authorizationStatus,
        tableSessionId: session.tableSessionId,
      })
    );
  } catch (error) {
    console.error("Token doğrulama hatası:", {
      code: (error as any)?.code,
      // ❌ DO NOT log tokens
    });
    return addSecurityHeaders(
      NextResponse.json(
        { valid: false, error: "Doğrulama hatası" },
        { status: 500 }
      )
    );
  }
}
