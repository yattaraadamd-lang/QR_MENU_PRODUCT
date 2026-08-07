/**
 * 🔒 SECURITY FIX P0-03: Socket.IO Authentication Middleware (Runtime)
 * 
 * CommonJS runtime version for use in server.js production environment.
 * Implements secure socket authentication with tenant isolation.
 * 
 * FEATURES:
 * - Token validation on handshake (HMAC-signed)
 * - User existence and active status verification
 * - Tenant-scoped room enforcement
 * - No unsigned token fallback (security hardening)
 * - Only auth.token accepted (no query.token)
 * 
 * ATTACK PREVENTION:
 * - Real-time espionage on other businesses
 * - PII/financial data leakage
 * - Token forgery via unsigned payloads
 */

const { prisma } = require("./prisma-runtime.cjs");
const crypto = require("crypto");

/**
 * Create structured error for socket middleware
 */
function createSocketError(message, code) {
  const error = new Error(message);
  error.data = { code };
  return error;
}

/**
 * Authenticate socket connection via signed access token
 * 
 * @param {Socket} socket Socket.IO socket instance
 * @param {Function} next Callback to continue or reject connection
 */
async function authenticateSocket(socket, next) {
  try {
    // ✅ SECURITY FIX: Only accept token from auth, NOT query
    // Query string tokens can leak in logs/referrers
    const token = socket.handshake.auth?.token;

    if (!token || typeof token !== "string") {
      return next(createSocketError("Authentication required", "NO_TOKEN"));
    }

    // ✅ SECURITY FIX: Parse and verify HMAC signature
    // Token format: base64(JSON).hex(HMAC-SHA256)
    let decoded;
    try {
      const parts = token.split(".");
      
      // ✅ SECURITY FIX: Require signed tokens only (no unsigned fallback)
      if (parts.length !== 2) {
        return next(createSocketError("Invalid token format - signature required", "INVALID_TOKEN_FORMAT"));
      }

      const [payload, signature] = parts;
      const secret = process.env.NEXTAUTH_SECRET;
      
      if (!secret) {
        console.error("[Socket Auth] FATAL: NEXTAUTH_SECRET not configured");
        return next(createSocketError("Server configuration error", "SERVER_CONFIG_ERROR"));
      }

      // Verify HMAC signature with timing-safe comparison
      const expectedSig = crypto
        .createHmac("sha256", secret)
        .update(payload)
        .digest("hex");

      const actual = Buffer.from(signature, "hex");
      const expected = Buffer.from(expectedSig, "hex");

      // ✅ SECURITY FIX: Check buffer lengths before timingSafeEqual
      if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
        return next(createSocketError("Invalid token signature", "INVALID_SIGNATURE"));
      }

      const jsonString = Buffer.from(payload, "base64").toString("utf-8");
      decoded = JSON.parse(jsonString);
    } catch (decodeError) {
      if (decodeError.data?.code) {
        return next(decodeError);
      }
      return next(createSocketError("Invalid token format", "INVALID_TOKEN_FORMAT"));
    }

    // Validate required token fields
    if (!decoded || !decoded.userId || !decoded.businessId || !decoded.role) {
      return next(createSocketError("Invalid token payload", "INVALID_TOKEN_PAYLOAD"));
    }

    // ✅ SECURITY FIX: Validate token age (24 hours max)
    if (!decoded.iat) {
      return next(createSocketError("Token missing timestamp", "INVALID_TOKEN"));
    }

    const tokenAge = Math.floor(Date.now() / 1000) - decoded.iat;
    if (tokenAge > 86400) {
      return next(createSocketError("Token expired", "TOKEN_EXPIRED"));
    }
    if (tokenAge < -60) {
      // Token issued in future (clock skew tolerance: 1 minute)
      return next(createSocketError("Invalid token timestamp", "INVALID_TOKEN"));
    }

    // ✅ P0-03 FIX: Verify user in database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
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
      return next(createSocketError("User not found", "USER_NOT_FOUND"));
    }

    if (!user.isActive || user.deletedAt) {
      return next(createSocketError("User account is disabled", "USER_DISABLED"));
    }

    // ✅ P0-03 FIX: Verify businessId matches (prevents token reuse after business change)
    if (user.businessId !== decoded.businessId) {
      return next(createSocketError("Business ID mismatch", "BUSINESS_MISMATCH"));
    }

    // ✅ Verify role matches
    if (user.role !== decoded.role) {
      return next(createSocketError("Role mismatch", "ROLE_MISMATCH"));
    }

    // ✅ Attach authenticated data to socket
    socket.data = {
      userId: user.id,
      businessId: user.businessId,
      role: user.role,
      email: user.email,
      authenticatedAt: new Date(),
    };

    // Security logging
    if (process.env.NODE_ENV === "development") {
      console.log(`[Socket Auth] ✅ ${socket.id} authenticated as ${user.email} (${user.role}) for business ${user.businessId}`);
    }

    next();
  } catch (error) {
    console.error("[Socket Auth] Error:", error.message);
    
    // ❌ DO NOT expose internal error details to client
    return next(createSocketError("Authentication failed", "AUTH_ERROR"));
  }
}

/**
 * Get authenticated business room name
 * 
 * Returns the secure room name for the authenticated user's business.
 * MUST be called only after socket authentication.
 * 
 * @param {Socket} socket Authenticated socket
 * @returns {string} Room name (e.g., "business_abc123")
 */
function getAuthenticatedBusinessRoom(socket) {
  const authData = socket.data;
  
  if (!authData?.businessId) {
    throw new Error("Socket not authenticated - businessId missing");
  }

  return `business_${authData.businessId}`;
}

/**
 * Validate that socket is authorized for a specific business
 * 
 * @param {Socket} socket Authenticated socket
 * @param {string} businessId Business ID to check
 * @returns {boolean} true if authorized
 */
function isAuthorizedForBusiness(socket, businessId) {
  const authData = socket.data;
  
  if (!authData?.businessId) {
    return false;
  }

  // SUPER_ADMIN can access any business
  if (authData.role === "SUPER_ADMIN") {
    return true;
  }

  // Regular users can only access their own business
  return authData.businessId === businessId;
}

/**
 * Get socket authentication info
 * 
 * @param {Socket} socket Socket instance
 * @returns {Object|null} Authentication data or null
 */
function getSocketAuth(socket) {
  return socket.data || null;
}

module.exports = {
  authenticateSocket,
  getAuthenticatedBusinessRoom,
  isAuthorizedForBusiness,
  getSocketAuth,
};
