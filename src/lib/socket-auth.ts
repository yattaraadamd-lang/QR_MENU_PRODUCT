/**
 * 🔒 SECURITY FIX P0-03: Socket.IO Authentication Middleware
 * 
 * Implements secure socket authentication with tenant isolation.
 * Prevents unauthorized cross-tenant data access via socket rooms.
 * 
 * FEATURES:
 * - Token validation on handshake
 * - User existence and active status verification (database lookup)
 * - Tenant-scoped room enforcement (businessId from auth, not client)
 * - Rate limiting preparation
 * - Connection audit logging
 * 
 * ATTACK PREVENTION:
 * - Real-time espionage on other businesses
 * - PII/financial data leakage
 * - Order/payment information exposure
 * 
 * SECURITY NOTE:
 * Token is base64-encoded user info, validated against live database.
 * This prevents tampering as user must exist and be active.
 */

import { prisma } from "./prisma";
import crypto from "crypto";
import type { Socket } from "socket.io";

// Extended error type for socket middleware
interface ExtendedError extends Error {
  data?: any;
}

/**
 * Socket data extended with authentication info
 */
export interface AuthenticatedSocketData {
  userId: string;
  businessId: string;
  role: "ADMIN" | "WAITER" | "SUPER_ADMIN";
  email: string;
  authenticatedAt: Date;
}

/**
 * Authenticate socket connection via NextAuth JWT
 * 
 * Validates JWT token from handshake, verifies user in database,
 * and attaches auth data to socket for room authorization.
 * 
 * @param socket Socket.IO socket instance
 * @param next Callback to continue or reject connection
 */
/**
 * Authenticate socket connection via access token
 * 
 * Validates token from handshake, verifies user in database,
 * and attaches auth data to socket for room authorization.
 * 
 * @param socket Socket.IO socket instance
 * @param next Callback to continue or reject connection
 */
export async function authenticateSocket(
  socket: Socket,
  next: (err?: ExtendedError) => void
) {
  try {
    // ✅ SECURITY FIX: Only accept token from auth, NOT query
    // Query string tokens can leak in logs/referrers
    const token = socket.handshake.auth?.token;

    if (!token || typeof token !== "string") {
      const error = new Error("Authentication required") as ExtendedError;
      error.data = { code: "NO_TOKEN" };
      return next(error);
    }

    // ✅ SECURITY FIX: Verify HMAC signature before trusting token content
    // Token format: base64(JSON) + "." + hex(HMAC-SHA256)
    let decoded: any;
    try {
      const parts = token.split(".");

      // ✅ SECURITY FIX: Require signed tokens only (no unsigned fallback)
      if (parts.length !== 2) {
        const error = new Error("Invalid token format - signature required") as ExtendedError;
        error.data = { code: "INVALID_TOKEN_FORMAT" };
        return next(error);
      }

      const [payload, signature] = parts;
      const secret = process.env.NEXTAUTH_SECRET;
      if (!secret) {
        const error = new Error("Server configuration error") as ExtendedError;
        error.data = { code: "SERVER_CONFIG_ERROR" };
        return next(error);
      }

      // Verify HMAC signature with timing-safe comparison
      const expectedSig = crypto
        .createHmac("sha256", secret)
        .update(payload)
        .digest("hex");

      const actual = Buffer.from(signature, "hex");
      const expected = Buffer.from(expectedSig, "hex");

      if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
        const error = new Error("Invalid token signature") as ExtendedError;
        error.data = { code: "INVALID_SIGNATURE" };
        return next(error);
      }

      const jsonString = Buffer.from(payload, 'base64').toString('utf-8');
      decoded = JSON.parse(jsonString);
    } catch (decodeError) {
      if ((decodeError as ExtendedError).data?.code) {
        return next(decodeError as ExtendedError);
      }
      const error = new Error("Invalid token format") as ExtendedError;
      error.data = { code: "INVALID_TOKEN_FORMAT" };
      return next(error);
    }

    if (!decoded || !decoded.userId || !decoded.businessId || !decoded.role) {
      const error = new Error("Invalid token payload") as ExtendedError;
      error.data = { code: "INVALID_TOKEN_PAYLOAD" };
      return next(error);
    }

    // ✅ Check token age (24 hour max)
    const tokenAge = Math.floor(Date.now() / 1000) - (decoded.iat || 0);
    if (tokenAge > 86400) {
      const error = new Error("Token expired") as ExtendedError;
      error.data = { code: "TOKEN_EXPIRED" };
      return next(error);
    }

    // ✅ P0-03 FIX: Verify user exists, is active, and not deleted
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId as string },
      select: {
        id: true,
        email: true,
        businessId: true,
        role: true,
        isActive: true,
        deletedAt: true,
      },
    });

    if (!user) {
      const error = new Error("User not found") as ExtendedError;
      error.data = { code: "USER_NOT_FOUND" };
      return next(error);
    }

    if (!user.isActive || user.deletedAt) {
      const error = new Error("User account is disabled") as ExtendedError;
      error.data = { code: "USER_DISABLED" };
      return next(error);
    }

    // ✅ P0-03 FIX: Verify businessId from token matches database
    // Prevents token reuse after business change
    if (user.businessId !== decoded.businessId) {
      const error = new Error("Business ID mismatch") as ExtendedError;
      error.data = { code: "BUSINESS_MISMATCH" };
      return next(error);
    }

    // ✅ Verify role matches
    if (user.role !== decoded.role) {
      const error = new Error("Role mismatch") as ExtendedError;
      error.data = { code: "ROLE_MISMATCH" };
      return next(error);
    }

    // ✅ Attach authenticated data to socket
    socket.data = {
      userId: user.id,
      businessId: user.businessId,
      role: user.role,
      email: user.email,
      authenticatedAt: new Date(),
    } as AuthenticatedSocketData;

    // ✅ Security logging (production should use structured logging)
    if (process.env.NODE_ENV === "development") {
      console.log(`[Socket Auth] ✅ ${socket.id} authenticated as ${user.email} (${user.role}) for business ${user.businessId}`);
    }

    // ✅ TODO: Rate limit connection attempts per user/IP
    // ✅ TODO: Audit log successful connection

    next();
  } catch (error) {
    console.error("[Socket Auth] Error:", error);
    
    const authError = new Error("Authentication failed") as ExtendedError;
    authError.data = { 
      code: "AUTH_ERROR",
      // ❌ DO NOT expose internal error details to client
    };
    
    next(authError);
  }
}

/**
 * Get authenticated business room name
 * 
 * Returns the secure room name for the authenticated user's business.
 * MUST be called only after socket authentication.
 * 
 * @param socket Authenticated socket
 * @returns Room name (e.g., "business_abc123")
 * @throws Error if socket is not authenticated
 */
export function getAuthenticatedBusinessRoom(socket: Socket): string {
  const authData = socket.data as AuthenticatedSocketData;
  
  if (!authData?.businessId) {
    throw new Error("Socket not authenticated - businessId missing");
  }

  return `business_${authData.businessId}`;
}

/**
 * Validate that socket is authorized for a specific business
 * 
 * Use this for additional authorization checks beyond room membership.
 * 
 * @param socket Authenticated socket
 * @param businessId Business ID to check
 * @returns true if authorized, false otherwise
 */
export function isAuthorizedForBusiness(socket: Socket, businessId: string): boolean {
  const authData = socket.data as AuthenticatedSocketData;
  
  if (!authData?.businessId) {
    return false;
  }

  // SUPER_ADMIN can access any business (for support/monitoring)
  if (authData.role === "SUPER_ADMIN") {
    return true;
  }

  // Regular users can only access their own business
  return authData.businessId === businessId;
}

/**
 * Get socket authentication info
 * 
 * Returns the authentication data attached to socket, or null if not authenticated.
 * 
 * @param socket Socket instance
 * @returns Authentication data or null
 */
export function getSocketAuth(socket: Socket): AuthenticatedSocketData | null {
  return (socket.data as AuthenticatedSocketData) || null;
}
