-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "expiryDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "expiryAlertDays" INTEGER NOT NULL DEFAULT 30;

-- CreateIndex
CREATE INDEX "Product_shopId_expiryDate_idx" ON "Product"("shopId", "expiryDate");

