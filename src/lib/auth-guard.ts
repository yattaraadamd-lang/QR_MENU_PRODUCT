import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./auth";
import { prisma } from "./prisma";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "WAITER" | "SUPER_ADMIN";
  businessId: string;
  businessName?: string;
}

export type AuthGuardSuccess = {
  error: false;
  response: null;
  session: {
    user: AuthenticatedUser;
  };
};

export type AuthGuardError = {
  error: true;
  response: NextResponse;
  session: null;
};

export type AuthGuardResult = AuthGuardSuccess | AuthGuardError;

/**
 * Validates session and checks active status of user and business in database.
 */
export async function requireAuth(): Promise<AuthGuardResult> {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !session?.user?.businessId) {
      return {
        error: true,
        response: NextResponse.json(
          { error: "Yetkisiz erişim. Lütfen giriş yapın." },
          { status: 401 }
        ),
        session: null,
      };
    }

    // Live DB validation (prevent use of revoked/deactivated session tokens)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        businessId: true,
        isActive: true,
        deletedAt: true,
        business: {
          select: {
            id: true,
            name: true,
            isActive: true,
          },
        },
      },
    });

    if (!user || !user.isActive || user.deletedAt) {
      return {
        error: true,
        response: NextResponse.json(
          { error: "Kullanıcı hesabı pasif veya silinmiş." },
          { status: 401 }
        ),
        session: null,
      };
    }

    if (user.role !== "SUPER_ADMIN" && (!user.business || !user.business.isActive)) {
      return {
        error: true,
        response: NextResponse.json(
          { error: "İşletme hesabı pasif." },
          { status: 403 }
        ),
        session: null,
      };
    }

    return {
      error: false,
      response: null,
      session: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as "ADMIN" | "WAITER" | "SUPER_ADMIN",
          businessId: user.businessId,
          businessName: user.business?.name,
        },
      },
    };
  } catch (error) {
    console.error("[AUTH_GUARD_ERROR]", error);
    return {
      error: true,
      response: NextResponse.json(
        { error: "Kimlik doğrulanırken hata oluştu" },
        { status: 500 }
      ),
      session: null,
    };
  }
}

/**
 * Require ADMIN role or SUPER_ADMIN
 */
export async function requireAdmin(): Promise<AuthGuardResult> {
  const result = await requireAuth();
  if (result.error) return result;

  const role = result.session.user.role;
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    return {
      error: true,
      response: NextResponse.json(
        { error: "Bu işlem için yetkiniz bulunmamaktadır." },
        { status: 403 }
      ),
      session: null,
    };
  }

  return result;
}

/**
 * Require WAITER, ADMIN, or SUPER_ADMIN role
 */
export async function requireWaiterOrAdmin(): Promise<AuthGuardResult> {
  const result = await requireAuth();
  if (result.error) return result;

  const role = result.session.user.role;
  if (role !== "WAITER" && role !== "ADMIN" && role !== "SUPER_ADMIN") {
    return {
      error: true,
      response: NextResponse.json(
        { error: "Bu işlem için yetkiniz bulunmamaktadır." },
        { status: 403 }
      ),
      session: null,
    };
  }

  return result;
}

export const requireWaiter = requireWaiterOrAdmin;

/**
 * Require SUPER_ADMIN role
 */
export async function requireSuperAdmin(): Promise<AuthGuardResult> {
  const result = await requireAuth();
  if (result.error) return result;

  if (result.session.user.role !== "SUPER_ADMIN") {
    return {
      error: true,
      response: NextResponse.json(
        { error: "Bu işlem için Super Admin yetkisi gereklidir." },
        { status: 403 }
      ),
      session: null,
    };
  }

  return result;
}

/**
 * Get tenant businessId safely from session
 */
export function getBusinessId(session: { user: { businessId: string } }): string {
  return session.user.businessId;
}
