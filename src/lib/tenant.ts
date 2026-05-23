/**
 * Tenant Authorization Utilities
 * 
 * Bu dosya multi-tenant güvenlik kontrollerini sağlar.
 * Her API route'u businessId kontrolü yapmalıdır.
 */

import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { NextResponse } from "next/server";
import { prisma } from "./prisma";

export interface TenantSession {
  userId: string;
  businessId: string;
  role: "ADMIN" | "WAITER" | "SUPER_ADMIN";
  email: string;
  name: string;
}

export interface TenantAuthResult {
  success: true;
  session: TenantSession;
}

export interface TenantAuthError {
  success: false;
  response: NextResponse;
}

/**
 * Admin veya Waiter authentication gerektirir
 * BusinessId session'dan alınır - ASLA request body'den alınmaz
 */
export async function requireAuth(): Promise<TenantAuthResult | TenantAuthError> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return {
      success: false,
      response: NextResponse.json(
        { error: "Yetkisiz erişim. Lütfen giriş yapın." },
        { status: 401 }
      ),
    };
  }

  return {
    success: true,
    session: {
      userId: session.user.id,
      businessId: session.user.businessId,
      role: session.user.role as "ADMIN" | "WAITER" | "SUPER_ADMIN",
      email: session.user.email!,
      name: session.user.name!,
    },
  };
}

/**
 * Sadece Admin rolü gerektirir
 */
export async function requireAdmin(): Promise<TenantAuthResult | TenantAuthError> {
  const authResult = await requireAuth();

  if (!authResult.success) {
    return authResult;
  }

  if (authResult.session.role !== "ADMIN" && authResult.session.role !== "SUPER_ADMIN") {
    return {
      success: false,
      response: NextResponse.json(
        { error: "Bu işlem için admin yetkisi gereklidir." },
        { status: 403 }
      ),
    };
  }

  return authResult;
}

/**
 * Sadece Super Admin rolü gerektirir
 */
export async function requireSuperAdmin(): Promise<TenantAuthResult | TenantAuthError> {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return {
      success: false,
      response: NextResponse.json(
        { error: "Bu işlem için super admin yetkisi gereklidir." },
        { status: 403 }
      ),
    };
  }

  return {
    success: true,
    session: {
      userId: session.user.id,
      businessId: session.user.businessId,
      role: "SUPER_ADMIN",
      email: session.user.email!,
      name: session.user.name!,
    },
  };
}

/**
 * Bir kaynağın (table, order, product, vb.) belirtilen business'a ait olduğunu doğrular
 */
export async function verifyResourceOwnership(
  resourceType: "table" | "order" | "product" | "category" | "serviceRequest" | "payment",
  resourceId: string,
  businessId: string
): Promise<boolean> {
  try {
    let resource;

    switch (resourceType) {
      case "table":
        resource = await prisma.table.findFirst({
          where: { id: resourceId, businessId },
          select: { id: true },
        });
        break;

      case "order":
        resource = await prisma.order.findFirst({
          where: { id: resourceId, businessId },
          select: { id: true },
        });
        break;

      case "product":
        resource = await prisma.product.findFirst({
          where: { id: resourceId, businessId },
          select: { id: true },
        });
        break;

      case "category":
        resource = await prisma.category.findFirst({
          where: { id: resourceId, businessId },
          select: { id: true },
        });
        break;

      case "serviceRequest":
        resource = await prisma.serviceRequest.findFirst({
          where: { id: resourceId, businessId },
          select: { id: true },
        });
        break;

      case "payment":
        resource = await prisma.payment.findFirst({
          where: { id: resourceId, businessId },
          select: { id: true },
        });
        break;

      default:
        return false;
    }

    return !!resource;
  } catch (error) {
    console.error(`Resource ownership verification failed for ${resourceType}:${resourceId}`, error);
    return false;
  }
}

/**
 * QR token ile table session doğrulama
 * Customer endpoint'leri için kullanılır
 */
export interface QRSessionResult {
  success: true;
  table: {
    id: string;
    tableNumber: string;
    tableName: string | null;
    businessId: string;
    qrToken: string;
    business?: any; // Konum kontrolü için opsiyonel
  };
}

export interface QRSessionError {
  success: false;
  response: NextResponse;
}

export async function verifyQRSession(
  tableId: string,
  qrToken: string
): Promise<QRSessionResult | QRSessionError> {
  if (!qrToken || !tableId) {
    return {
      success: false,
      response: NextResponse.json(
        { error: "Geçersiz oturum bilgileri" },
        { status: 400 }
      ),
    };
  }

  const table = await prisma.table.findUnique({
    where: { id: tableId },
    select: {
      id: true,
      tableNumber: true,
      tableName: true,
      businessId: true,
      qrToken: true,
      qrTokenExpiresAt: true,
      isActive: true,
      business: {
        select: {
          latitude: true,
          longitude: true,
          allowedRadiusMeters: true,
        },
      },
    },
  });

  if (!table) {
    return {
      success: false,
      response: NextResponse.json(
        { error: "Masa bulunamadı" },
        { status: 404 }
      ),
    };
  }

  if (!table.isActive) {
    return {
      success: false,
      response: NextResponse.json(
        { error: "Bu masa şu anda aktif değil" },
        { status: 400 }
      ),
    };
  }

  if (table.qrToken !== qrToken) {
    return {
      success: false,
      response: NextResponse.json(
        { error: "Geçersiz oturum. Lütfen QR kodu tekrar okutun." },
        { status: 403 }
      ),
    };
  }

  if (table.qrTokenExpiresAt && new Date() > table.qrTokenExpiresAt) {
    return {
      success: false,
      response: NextResponse.json(
        { error: "Oturum süresi doldu. Lütfen QR kodu tekrar okutun." },
        { status: 403 }
      ),
    };
  }

  return {
    success: true,
    table: {
      id: table.id,
      tableNumber: table.tableNumber,
      tableName: table.tableName,
      businessId: table.businessId,
      qrToken: table.qrToken,
      business: table.business,
    },
  };
}

/**
 * BusinessId'yi session'dan güvenli şekilde al
 * ASLA request body veya query string'den businessId kullanma!
 */
export function getBusinessIdFromSession(session: TenantSession): string {
  return session.businessId;
}

/**
 * Tenant-safe error response helper
 */
export function createTenantError(message: string, status: number = 403): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Ownership check helper - throws if not owned
 */
export async function assertResourceOwnership(
  resourceType: "table" | "order" | "product" | "category" | "serviceRequest" | "payment",
  resourceId: string,
  businessId: string
): Promise<void> {
  const isOwned = await verifyResourceOwnership(resourceType, resourceId, businessId);
  
  if (!isOwned) {
    throw new Error(`Resource ${resourceType}:${resourceId} does not belong to business ${businessId}`);
  }
}
