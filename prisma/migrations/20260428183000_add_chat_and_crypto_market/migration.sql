-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeOffer" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "cropType" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "priceCrypto" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ETH',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TradeOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt");

-- CreateIndex
CREATE INDEX "TradeOffer_createdAt_idx" ON "TradeOffer"("createdAt");

-- CreateIndex
CREATE INDEX "TradeOffer_status_idx" ON "TradeOffer"("status");
