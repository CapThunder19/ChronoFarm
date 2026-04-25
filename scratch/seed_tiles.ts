import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const farms = await prisma.farm.findMany({
    include: { tiles: true },
  });

  for (const farm of farms) {
    if (farm.tiles.length === 0) {
      console.log(`Seeding tiles for farm ${farm.id}...`);
      const tiles = [];
      for (let i = 0; i < 9; i++) {
        tiles.push({
          farmId: farm.id,
          index: i,
          unlocked: i < 3,
        });
      }
      await prisma.tile.createMany({ data: tiles });
      console.log(`Tiles seeded for farm ${farm.id}`);
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
