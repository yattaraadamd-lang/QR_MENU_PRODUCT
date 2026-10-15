-- SaaS: plan kodu, deneme süresi, iyzico referansları
-- Sadece ekleme yapar; IF NOT EXISTS ile tekrar çalıştırılabilir.

-- AlterTable
ALTER TABLE "subscription_plans"
  ADD COLUMN IF NOT EXISTS "code" TEXT,
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "trialDays" INTEGER NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "iyzicoPricingPlanRef" TEXT;

-- AlterTable
ALTER TABLE "business_subscriptions"
  ADD COLUMN IF NOT EXISTS "iyzicoSubscriptionRef" TEXT,
  ADD COLUMN IF NOT EXISTS "iyzicoCustomerRef" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "subscription_plans_code_key" ON "subscription_plans"("code");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "subscription_plans_iyzicoPricingPlanRef_key" ON "subscription_plans"("iyzicoPricingPlanRef");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "business_subscriptions_iyzicoSubscriptionRef_key" ON "business_subscriptions"("iyzicoSubscriptionRef");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "business_subscriptions_businessId_status_idx" ON "business_subscriptions"("businessId", "status");
