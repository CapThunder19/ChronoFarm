-- CreateTable
CREATE TABLE "Tile" (
    "id" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "unlocked" BOOLEAN NOT NULL DEFAULT false,
    "farmId" TEXT NOT NULL,

    CONSTRAINT "Tile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tile_farmId_index_key" ON "Tile"("farmId", "index");

-- AddForeignKey
ALTER TABLE "Tile" ADD CONSTRAINT "Tile_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
