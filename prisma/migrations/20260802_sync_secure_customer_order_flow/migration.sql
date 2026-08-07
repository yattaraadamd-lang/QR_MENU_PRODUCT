-- AddColumn: customer_access_blocks.revocationNote (nullable)
-- AddColumn: customer_access_blocks.revokedById (nullable, foreign key to users)
ALTER TABLE "customer_access_blocks" 
ADD COLUMN IF NOT EXISTS "revocationNote" TEXT,
ADD COLUMN IF NOT EXISTS "revokedById" TEXT;

-- AddColumn: payments.changeAmount (nullable, for cash payments)
-- AddColumn: payments.receivedAmount (nullable, for cash payments)
-- AddColumn: payments.idempotencyKey (nullable, unique)
ALTER TABLE "payments" 
ADD COLUMN IF NOT EXISTS "changeAmount" DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
ADD COLUMN IF NOT EXISTS "receivedAmount" DECIMAL(10,2);

-- CreateIndex: payments.idempotencyKey (unique, if not exists)
CREATE UNIQUE INDEX IF NOT EXISTS "payments_idempotencyKey_key" ON "payments"("idempotencyKey");

-- Note: This migration is idempotent and safe to run multiple times
-- All columns are nullable to prevent data loss on existing records
-- No data modification or deletion occurs
