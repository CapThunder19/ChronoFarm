/*
  Warnings:

  - You are about to drop the column `harvested` on the `Crop` table. All the data in the column will be lost.
  - Added the required column `tileIndex` to the `Crop` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Crop" DROP COLUMN "harvested",
ADD COLUMN     "tileIndex" INTEGER NOT NULL;
