import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { Pool } from "pg";

// Ensure we don't have conflicting ssl modes in the connection string
const connectionString = process.env.DATABASE_URL!
  .replace("sslmode=require", "")
  .replace("&&", "&")
  .replace("?&", "?");

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

const adapter = new PrismaPg(pool);

declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}

// Force reload after schema update