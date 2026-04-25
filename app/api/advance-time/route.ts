import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const timeline =
      await prisma.timeline.findFirst();

    if (!timeline)
      return NextResponse.json({
        error: "Timeline missing",
      });

    const newYear =
      timeline.year + 1;

    await prisma.timeline.update({
      where: {
        id: timeline.id,
      },
      data: {
        year: newYear,
        lastAdvanced: new Date(),
      },
    });

    return NextResponse.json({
      year: newYear,
      message: "Year advanced",
    });

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to advance time" },
      { status: 500 }
    );
  }
}