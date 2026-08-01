import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const HMAC_SECRET = process.env.CUSTOMER_DEVICE_HMAC_SECRET || "default-dev-secret-change-in-production";

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

  await client.customerAccessBlock.create({
    data: {
      businessId: params.businessId,
      deviceKeyHash: params.deviceKeyHash,
      reason: params.reason,
      sourceRequestId: params.sourceRequestId || null,
      createdById: params.createdById || null,
    },
  });
}
