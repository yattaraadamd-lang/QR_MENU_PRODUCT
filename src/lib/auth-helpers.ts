import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./auth";

export async function getAuthSession() {
  return await getServerSession(authOptions);
}

export async function requireAuth() {
  const session = await getAuthSession();
  if (!session?.user) {
    return { error: true, response: NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 }), session: null };
  }
  return { error: false, response: null, session };
}

export async function requireAdmin() {
  const { error, response, session } = await requireAuth();
  if (error) return { error, response, session };
  
  if (session!.user.role !== "ADMIN") {
    return { error: true, response: NextResponse.json({ error: "Admin yetkisi gerekli" }, { status: 403 }), session: null };
  }
  return { error: false, response: null, session };
}

export async function requireWaiterOrAdmin() {
  const { error, response, session } = await requireAuth();
  if (error) return { error, response, session };
  
  if (session!.user.role !== "ADMIN" && session!.user.role !== "WAITER") {
    return { error: true, response: NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 }), session: null };
  }
  return { error: false, response: null, session };
}

export function getBusinessId(session: any): string {
  return session.user.businessId;
}

// Alias for backward compatibility
export const requireWaiter = requireWaiterOrAdmin;

export async function requireSuperAdmin() {
  const { error, response, session } = await requireAuth();
  if (error) return { error, response, session };
  
  if (session!.user.role !== "SUPER_ADMIN") {
    return { error: true, response: NextResponse.json({ error: "Super Admin yetkisi gerekli" }, { status: 403 }), session: null };
  }
  return { error: false, response: null, session };
}
