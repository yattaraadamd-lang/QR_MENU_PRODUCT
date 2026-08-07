/**
 * 🔒 SECURITY FIX P0-03: Get NextAuth JWT token for socket authentication
 * 
 * Retrieves the raw JWT token from NextAuth session for use with Socket.IO.
 * This token is then validated on the socket server to enforce tenant isolation.
 */

"use client";

import { getSession } from "next-auth/react";

/**
 * Get NextAuth JWT token for authenticated socket connection
 * 
 * @returns JWT token string or null if not authenticated
 */
export async function getSessionToken(): Promise<string | null> {
  try {
    const session = await getSession();
    
    if (!session) {
      return null;
    }

    // The JWT token is stored in cookies by NextAuth
    // We need to extract it for socket authentication
    
    // Option 1: Get from cookie directly (client-side)
    const cookieName = process.env.NODE_ENV === "production" 
      ? "__Secure-next-auth.session-token"
      : "next-auth.session-token";
    
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === cookieName) {
        return decodeURIComponent(value);
      }
    }

    // Option 2: Fallback - call API to get token
    // (This is less efficient but more reliable)
    const response = await fetch('/api/auth/session');
    const data = await response.json();
    
    if (data?.accessToken) {
      return data.accessToken;
    }

    console.warn('[Socket Auth] Could not retrieve session token');
    return null;
  } catch (error) {
    console.error('[Socket Auth] Error getting session token:', error);
    return null;
  }
}
