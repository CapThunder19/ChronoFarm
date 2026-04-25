import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const existingUser = await prisma.user.findFirst();

    if (existingUser) {
      return NextResponse.json({
        message: "Game already initialized",
      });
    }

    const user = await prisma.user.create({
      data: {
        name: "Player",
        money: 100,
      },
    });

    await prisma.farm.create({
      data: {
        userId: user.id,
        level: 1,
      },
    });

    return NextResponse.json({
      message: "Game initialized",
    });

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Initialization failed" },
      { status: 500 }
    );
  }
}