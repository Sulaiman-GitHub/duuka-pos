-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "needsReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "offlineAt" TIMESTAMP(3),
ADD COLUMN     "reviewNote" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Sale_shopId_clientId_key" ON "Sale"("shopId", "clientId");

