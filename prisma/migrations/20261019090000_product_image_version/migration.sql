-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "imageUpdatedAt" TIMESTAMP(3);


-- Existing photos get a stable version so their addresses don't all change at once.
UPDATE "Product" SET "imageUpdatedAt" = "updatedAt" WHERE "imageType" IS NOT NULL AND "imageUpdatedAt" IS NULL;
