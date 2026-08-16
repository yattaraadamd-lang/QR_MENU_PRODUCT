/**
 * Customer Session Token Utilities
 *
 * Centralised helpers for hashing and looking up customer session tokens.
 * The raw token is NEVER stored in the database; only the SHA-256 hash is
 * persisted.  Every endpoint that needs to look up a CustomerSession by
 * token MUST use these helpers so the hashing algorithm is not duplicated.
 *
 * ❌ DO NOT log, store, or include raw tokens in error responses.
 */

import crypto from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * Hash a raw customer session token for database lookup / storage.
 *
 * @param rawToken  The token the client sends (e.g. `cs_<hex>`)
 * @returns SHA-256 hex digest
 */
export function hashCustomerSessionToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Look up an ACTIVE CustomerSession by raw token.
 *
 * Returns `null` when the token is missing, the session does not exist,
 * or the session is not in `ACTIVE` status.
 *
 * @param rawToken  Raw token from the `x-session-token` header
 */
export async function findActiveCustomerSession(rawToken: string | null) {
  if (!rawToken || typeof rawToken !== "string") return null;

  const tokenHash = hashCustomerSessionToken(rawToken);

  const session = await prisma.customerSession.findUnique({
    where: { sessionToken: tokenHash },
  });

  if (!session) return null;

  return session;
}
