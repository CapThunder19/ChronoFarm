-- CreateTable
CREATE TABLE "NPC" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NPC_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketPrice" (
    "id" TEXT NOT NULL,
    "cropType" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketPrice_cropType_key" ON "MarketPrice"("cropType");
