import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

const connectionString = process.env.DATABASE_URL!
  .replace("sslmode=require", "")
  .replace("&&", "&")
  .replace("?&", "?");

const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  await prisma.$executeRaw`SET statement_timeout = 300000;`;
  const all = await prisma.region.findMany({ orderBy: { createdAt: "asc" } });
  console.log(`Found ${all.length} total regions`);

  const seen = new Map<string, string>(); // name -> canonical id
  const toDelete: string[] = [];

  for (const r of all) {
    if (seen.has(r.name)) {
      toDelete.push(r.id);
      console.log(`  Duplicate: ${r.name} (${r.id}) → will be deleted`);
    } else {
      seen.set(r.name, r.id);
      console.log(`  Canonical: ${r.name} (${r.id})`);
    }
  }

  if (toDelete.length === 0) {
    console.log("No duplicates found. Nothing to do.");
    return;
  }

  for (const dupId of toDelete) {
    const dupRegion = all.find(r => r.id === dupId)!;
    const canonicalId = seen.get(dupRegion.name)!;
    console.log(`Cleaning up ${dupRegion.name} duplicate (${dupId}) → canonical (${canonicalId})`);

    // Reassign users pointing at duplicate region
    await prisma.user.updateMany({ where: { currentRegionId: dupId }, data: { currentRegionId: canonicalId } });

    // Delete farms tied to duplicate region (canonical region already has a farm for each user)
    const dupFarms = await prisma.farm.findMany({ where: { regionId: dupId } });
    for (const dupFarm of dupFarms) {
      await prisma.crop.deleteMany({ where: { farmId: dupFarm.id } });
      await prisma.tile.deleteMany({ where: { farmId: dupFarm.id } });
      await prisma.farm.delete({ where: { id: dupFarm.id } });
      console.log(`  Deleted duplicate farm ${dupFarm.id}`);
    }

    // Delete market data and NPCs for duplicate region
    await prisma.nPC.deleteMany({ where: { regionId: dupId } });
    await prisma.marketPrice.deleteMany({ where: { regionId: dupId } });
    await prisma.region.delete({ where: { id: dupId } });
    console.log(`  Deleted duplicate region ${dupId}`);
  }

  const remaining = await prisma.region.findMany({ orderBy: { createdAt: "asc" } });
  console.log(`\nDone. ${remaining.length} regions remain:`);
  remaining.forEach(r => console.log(`  ${r.name} (${r.id})`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
