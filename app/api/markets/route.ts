import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const prices = await prisma.marketPrice.findMany();
    const npcs = await prisma.nPC.findMany();

    return NextResponse.json({
      prices,
      npcs,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch market data" }, { status: 500 });
  }
}
