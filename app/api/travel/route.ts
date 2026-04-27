import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { regionId } = await req.json();

    const user = await prisma.user.findFirst();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const region = await prisma.region.findUnique({
      where: { id: regionId },
    });

    if (!region) {
      return NextResponse.json({ error: "Region not found" }, { status: 404 });
    }

      // Prevent travel to locked regions based on player's farm levels
      const farms = await prisma.farm.findMany({ where: { userId: user.id } });
      const maxLevel = farms.reduce((m, f) => Math.max(m, f.level ?? 1), 0);
      if (region.unlockLevel && maxLevel < region.unlockLevel) {
        return NextResponse.json({ error: `Region locked until level ${region.unlockLevel}` }, { status: 400 });
      }

    await prisma.user.update({
      where: { id: user.id },
      data: { currentRegionId: region.id },
    });

    return NextResponse.json({ message: `Traveled to ${region.name}` });
  } catch (error) {
    return NextResponse.json({ error: "Travel failed" }, { status: 500 });
  }
}
