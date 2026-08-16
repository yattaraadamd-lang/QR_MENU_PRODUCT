/**
 * 🔒 SECURITY FIX P0-03: Get NextAuth JWT token for socket authentication
 *
 * Retrieves the HMAC-signed access token from NextAuth session for use
 * with Socket.IO.  This token is validated on the socket server to enforce
 * tenant isolation.
 *
 * ❌ DO NOT read document.cookie — NextAuth session cookie is HttpOnly.
 * ❌ DO NOT use this for customer session tokens (different security domain).
 */

"use client";

import { getSession } from "next-auth/react";

/**
 * Get NextAuth access token for authenticated socket connection.
 *
 * @returns Signed access token string, or null if not authenticated.
 */
export async function getSessionToken(): Promise<string | null> {
  try {
    const session = await getSession();

    if (!session) {
      return null;
    }

    const token =
      typeof (session as any).accessToken === "string"
        ? (session as any).accessToken
        : null;

    if (!token || token.split(".").length !== 2) {
      return null;
    }

    return token;
  } catch (error) {
    console.error("[Socket Auth] Token retrieval failed");
    return null;
  }
}
