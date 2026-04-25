import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const user = await prisma.user.findFirst();

    if (!user) {
      return NextResponse.json([]);
    }

    const inventory = await prisma.inventory.findMany({
      where: {
        userId: user.id,
        quantity: {
          gt: 0,
        },
      },
    });

    return NextResponse.json(inventory);

  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load inventory" },
      { status: 500 }
    );
  }
}
