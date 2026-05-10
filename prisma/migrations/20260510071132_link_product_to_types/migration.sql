/*
  Warnings:

  - Added the required column `productId` to the `ProductType` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ProductType" ADD COLUMN     "productId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "ProductType" ADD CONSTRAINT "ProductType_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
