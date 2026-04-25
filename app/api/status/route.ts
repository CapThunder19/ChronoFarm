import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const user = await prisma.user.findFirst({
      include: {
        farms: {
          include: {
            crops: {
              orderBy: {
                plantedAt: "asc",
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      money: user?.money ?? 0,
      farms: user?.farms ?? [],
    });

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        money: 0,
        farms: [],
      },
      { status: 500 }
    );
  }
}