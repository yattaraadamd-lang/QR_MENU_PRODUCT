-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'AWAITING_ADMIN_APPROVAL';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "requestedById" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "requestedByName" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "approvalRequestedAt" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "approvedById" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "approvedByName" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "rejectedById" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;

-- Verify/Ensure customer_access_blocks columns
ALTER TABLE "customer_access_blocks" ADD COLUMN IF NOT EXISTS "revokedById" TEXT;
ALTER TABLE "customer_access_blocks" ADD COLUMN IF NOT EXISTS "revocationNote" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payments_billId_status_idx" ON "payments"("billId", "status");
CREATE INDEX IF NOT EXISTS "payments_tableSessionId_status_idx" ON "payments"("tableSessionId", "status");
