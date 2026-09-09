-- AlterTable
ALTER TABLE "customer_access_blocks" ADD COLUMN     "revocationNote" TEXT,
ADD COLUMN     "revokedById" TEXT;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "changeAmount" DECIMAL(10,2),
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "receivedAmount" DECIMAL(10,2);

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotencyKey_key" ON "payments"("idempotencyKey");

