/**
 * 🔒 Audit Log Service — Append-only security event logging
 * 
 * RULES:
 * - Audit records are NEVER updated or deleted by normal admins
 * - Sensitive fields (tokens, passwords, hashes) are ALWAYS redacted
 * - IP addresses are stored as hashes (HMAC) to comply with privacy
 * - userAgent is truncated to essential info
 */

import { prisma } from "@/lib/prisma";
import crypto from "crypto";

// Fields that must NEVER appear in audit log JSON
const SENSITIVE_FIELDS = [
  "password", "hashedPassword", "sessionToken", "token",
  "inviteCode", "secret", "cookie", "deviceKey", "rawDeviceKey",
  "qrToken", "accessToken", "verificationCode",
];

/**
 * Redact sensitive fields from an object for audit logging.
 */
function redactSensitiveFields(obj: Record<string, any> | null | undefined): Record<string, any> | null {
  if (!obj) return null;

  const redacted: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_FIELDS.some(f => key.toLowerCase().includes(f.toLowerCase()))) {
      redacted[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      redacted[key] = redactSensitiveFields(value);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

/**
 * Hash an IP address for privacy-safe storage.
 */
function hashIp(ip: string | null): string | null {
  if (!ip || ip === "unknown") return null;
  const secret = process.env.CUSTOMER_DEVICE_HMAC_SECRET || "audit-ip-hash-key";
  return crypto.createHmac("sha256", secret).update(ip).digest("hex").substring(0, 16);
}

/**
 * Truncate user agent to essential info.
 */
function truncateUserAgent(ua: string | null): string | null {
  if (!ua) return null;
  // Keep first 200 chars max
  return ua.substring(0, 200);
}

export interface AuditLogParams {
  businessId?: string | null;
  actorUserId?: string | null;
  actorRole?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  requestId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  before?: Record<string, any> | null;
  after?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
}

/**
 * Create an audit log entry.
 * 
 * This is fire-and-forget: errors are caught and logged, never thrown.
 * Audit logging should NEVER block or break the main business operation.
 */
export async function createAuditLog(params: AuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        businessId: params.businessId || null,
        actorUserId: params.actorUserId || null,
        actorRole: params.actorRole || null,
        action: params.action,
        entityType: params.entityType || null,
        entityId: params.entityId || null,
        requestId: params.requestId || null,
        ipHash: hashIp(params.ip || null),
        userAgentInfo: truncateUserAgent(params.userAgent || null),
        beforeJson: redactSensitiveFields(params.before) as any,
        afterJson: redactSensitiveFields(params.after) as any,
        metadata: params.metadata as any,
      },
    });
  } catch (error) {
    // ❌ NEVER let audit logging break the main operation
    console.error("[AUDIT_LOG_ERROR]", {
      action: params.action,
      error: (error as any)?.message,
      // Do NOT log sensitive params
    });
  }
}

/**
 * Audit log action constants for type safety.
 */
export const AuditActions = {
  // Auth
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  LOGIN_FAILURE: "LOGIN_FAILURE",
  LOGIN_LOCKOUT: "LOGIN_LOCKOUT",
  
  // Invite
  INVITE_CREATED: "INVITE_CREATED",
  INVITE_CONSUMED: "INVITE_CONSUMED",
  INVITE_EXPIRED: "INVITE_EXPIRED",
  
  // User
  USER_REGISTERED: "USER_REGISTERED",
  USER_DEACTIVATED: "USER_DEACTIVATED",
  USER_ROLE_CHANGED: "USER_ROLE_CHANGED",
  USER_PASSWORD_CHANGED: "USER_PASSWORD_CHANGED",
  
  // QR
  QR_ROTATED: "QR_ROTATED",
  
  // Table
  TABLE_OPENED: "TABLE_OPENED",
  TABLE_FORCE_CLOSED: "TABLE_FORCE_CLOSED",
  
  // Order
  ORDER_REQUEST_APPROVED: "ORDER_REQUEST_APPROVED",
  ORDER_REQUEST_REJECTED: "ORDER_REQUEST_REJECTED",
  ORDER_STATUS_CHANGED: "ORDER_STATUS_CHANGED",
  ORDER_CANCELLED: "ORDER_CANCELLED",
  
  // Device
  DEVICE_BLOCKED: "DEVICE_BLOCKED",
  DEVICE_UNBLOCKED: "DEVICE_UNBLOCKED",
  
  // Payment
  PAYMENT_APPROVED: "PAYMENT_APPROVED",
  PAYMENT_REJECTED: "PAYMENT_REJECTED",
  PAYMENT_COLLECTED: "PAYMENT_COLLECTED",
  BILL_CLOSED: "BILL_CLOSED",
  
  // Session
  SESSION_DEVICE_MISMATCH: "SESSION_DEVICE_MISMATCH",
  SESSION_REPLAY_ATTEMPT: "SESSION_REPLAY_ATTEMPT",
  
  // Subscription
  SUBSCRIPTION_CHANGED: "SUBSCRIPTION_CHANGED",
  BUSINESS_ACTIVATED: "BUSINESS_ACTIVATED",
  BUSINESS_DEACTIVATED: "BUSINESS_DEACTIVATED",
} as const;
