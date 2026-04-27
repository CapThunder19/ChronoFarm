/*
  Warnings:

  - A unique constraint covering the columns `[userId,regionId]` on the table `Farm` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[cropType,regionId]` on the table `MarketPrice` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `basePrice` to the `MarketPrice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `regionId` to the `MarketPrice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `regionId` to the `NPC` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "MarketPrice_cropType_key";

-- AlterTable
ALTER TABLE "Farm" ADD COLUMN     "regionId" TEXT,
ADD COLUMN     "xp" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "MarketPrice" ADD COLUMN     "basePrice" INTEGER NOT NULL,
ADD COLUMN     "demand" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "regionId" TEXT NOT NULL,
ADD COLUMN     "supply" INTEGER NOT NULL DEFAULT 100;

-- AlterTable
ALTER TABLE "NPC" ADD COLUMN     "regionId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Region" ADD COLUMN     "priceMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN     "unlockLevel" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "currentRegionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Farm_userId_regionId_key" ON "Farm"("userId", "regionId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketPrice_cropType_regionId_key" ON "MarketPrice"("cropType", "regionId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_currentRegionId_fkey" FOREIGN KEY ("currentRegionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Farm" ADD CONSTRAINT "Farm_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NPC" ADD CONSTRAINT "NPC_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketPrice" ADD CONSTRAINT "MarketPrice_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
