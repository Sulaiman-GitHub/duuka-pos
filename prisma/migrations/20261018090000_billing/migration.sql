-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('UNPAID', 'PAID', 'VOID');

-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "billingNote" TEXT,
ADD COLUMN     "maxUsers" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "monthlyPrice" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "paidUntil" TIMESTAMP(3),
ADD COLUMN     "planName" TEXT NOT NULL DEFAULT 'Trial',
ADD COLUMN     "trialEndsAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'UNPAID',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "paymentMethod" TEXT,
    "paymentReference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "businessName" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "paymentInstructions" TEXT NOT NULL DEFAULT '',
    "invoiceFooter" TEXT NOT NULL DEFAULT '',
    "trialDays" INTEGER NOT NULL DEFAULT 30,
    "nextInvoiceNo" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE INDEX "Invoice_shopId_issuedAt_idx" ON "Invoice"("shopId", "issuedAt");

-- CreateIndex
CREATE INDEX "Invoice_status_dueDate_idx" ON "Invoice"("status", "dueDate");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Backfill: shops that already exist start a trial now.
UPDATE "Shop" SET "trialEndsAt" = now() + interval '30 days' WHERE "trialEndsAt" IS NULL AND "paidUntil" IS NULL;
INSERT INTO "PlatformSettings" ("id") VALUES ('main') ON CONFLICT DO NOTHING;

-- Invoices: a shop may READ its own; only the platform owner may write.
ALTER TABLE "Invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invoice" FORCE ROW LEVEL SECURITY;
CREATE POLICY invoice_read ON "Invoice" FOR SELECT
  USING ("shopId" = current_setting('app.shop_id', true) OR current_setting('app.platform', true) = 'on');
CREATE POLICY invoice_write ON "Invoice" FOR ALL
  USING (current_setting('app.platform', true) = 'on')
  WITH CHECK (current_setting('app.platform', true) = 'on');

-- Platform settings: platform owner only.
ALTER TABLE "PlatformSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlatformSettings" FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_only ON "PlatformSettings"
  USING (current_setting('app.platform', true) = 'on')
  WITH CHECK (current_setting('app.platform', true) = 'on');
