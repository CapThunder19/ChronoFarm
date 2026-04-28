import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { syncProgression } from "@/lib/progression";

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

    const synced = await syncProgression(prisma);
    const newYear = synced.year;

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
      message: "Year synced to farm progression",
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