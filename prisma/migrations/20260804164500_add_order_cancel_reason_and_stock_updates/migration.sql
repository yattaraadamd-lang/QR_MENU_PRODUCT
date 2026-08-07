-- CreateEnum
CREATE TYPE "OrderCancelReasonCode" AS ENUM ('OUT_OF_STOCK', 'CUSTOMER_CANCELLED', 'WRONG_ORDER', 'TABLE_NOT_VERIFIED', 'BUSINESS_NOT_ACCEPTING', 'OTHER');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "cancelReasonCode" "OrderCancelReasonCode",
ADD COLUMN     "cancelledById" TEXT,
ADD COLUMN     "stockUpdatedProductIds" JSONB;
