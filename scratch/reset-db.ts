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
  console.log("Resetting database completely...");
  await prisma.crop.deleteMany();
  await prisma.tile.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.marketPrice.deleteMany();
  await prisma.nPC.deleteMany();
  await prisma.farm.deleteMany();
  await prisma.user.deleteMany();
  await prisma.timeline.deleteMany();
  await prisma.region.deleteMany();
  console.log("Reset done.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
