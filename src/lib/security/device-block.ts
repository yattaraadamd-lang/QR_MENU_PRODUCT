import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { createAuditLog, AuditActions } from "@/lib/services/audit-log.service";

// ✅ P0-04 FIX: Fail-fast if HMAC secret is missing or weak in production
function getHMACSecret(): string {
  const secret = process.env.CUSTOMER_DEVICE_HMAC_SECRET;
  
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("CUSTOMER_DEVICE_HMAC_SECRET environment variable is required in production");
    }
    // Development fallback
    console.warn("⚠️  Using development HMAC secret. DO NOT use in production!");
    return "dev-only-secret-do-not-use-in-production";
  }

  // Reject known placeholder secrets
  const FORBIDDEN_SECRETS = [
    "default-dev-secret-change-in-production",
    "change-me",
    "changeme",
    "secret",
    "password",
    "dev-only-secret-do-not-use-in-production",
  ];

  if (FORBIDDEN_SECRETS.includes(secret.toLowerCase())) {
    throw new Error("CUSTOMER_DEVICE_HMAC_SECRET cannot use placeholder value");
  }

  // Require minimum 32 bytes (64 hex chars or equivalent)
  if (secret.length < 32) {
    throw new Error("CUSTOMER_DEVICE_HMAC_SECRET must be at least 32 characters");
  }

  return secret;
}

const HMAC_SECRET = getHMACSecret();

/**
 * HMAC-SHA256 ile cihaz anahtarını hashle.
 * Ham değer veritabanında saklanmaz.
 */
export function hashDeviceKey(rawKey: string): string {
  return crypto.createHmac("sha256", HMAC_SECRET).update(rawKey).digest("hex");
}

/**
 * Rastgele cihaz anahtarı üret.
 */
export function generateDeviceKey(): string {
  return `cdk_${crypto.randomUUID()}`;
}

/**
 * İşletme düzeyinde aktif cihaz engeli kontrol et.
 * @returns true ise cihaz engelli
 */
export async function checkDeviceBlock(businessId: string, deviceKeyHash: string): Promise<boolean> {
  if (!deviceKeyHash) return false;

  const block = await prisma.customerAccessBlock.findFirst({
    where: {
      businessId,
      deviceKeyHash,
      revokedAt: null, // aktif engel
    },
  });

  return !!block;
}

/**
 * Cihaz engeli oluştur.
 * Mevcut aktif blok varsa çoğaltma.
 */
export async function createDeviceBlock(params: {
  businessId: string;
  deviceKeyHash: string;
  reason: string;
  sourceRequestId?: string;
  createdById?: string;
  tx?: any; // Prisma transaction client
}): Promise<void> {
  const client = params.tx || prisma;

  // Mevcut aktif blok varsa tekrar oluşturma
  const existing = await client.customerAccessBlock.findFirst({
    where: {
      businessId: params.businessId,
      deviceKeyHash: params.deviceKeyHash,
      revokedAt: null,
    },
  });

  if (existing) return;

  const created = await client.customerAccessBlock.create({
    data: {
      businessId: params.businessId,
      deviceKeyHash: params.deviceKeyHash,
      reason: params.reason,
      sourceRequestId: params.sourceRequestId || null,
      createdById: params.createdById || null,
    },
  });

  createAuditLog({
    businessId: params.businessId,
    actorUserId: params.createdById || null,
    actorRole: params.createdById ? "ADMIN" : "SYSTEM",
    action: AuditActions.DEVICE_BLOCKED,
    entityType: "CustomerAccessBlock",
    entityId: created.id,
    metadata: {
      reason: params.reason,
      sourceRequestId: params.sourceRequestId,
    },
  });
}
