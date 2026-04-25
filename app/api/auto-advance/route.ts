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

    const now = new Date();

    // advance every 60 seconds

    const diff =
      (now.getTime() -
        timeline.lastAdvanced.getTime()) /
      1000;

    if (diff < 60) {
      return NextResponse.json({
        message: "Not time yet",
      });
    }

    const newYear =
      timeline.year + 1;

    await prisma.timeline.update({
      where: {
        id: timeline.id,
      },
      data: {
        year: newYear,
        lastAdvanced: now,
      },
    });

    return NextResponse.json({
      message: "Year auto advanced",
      year: newYear,
    });

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Auto advance failed" },
      { status: 500 }
    );
  }
}