import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  await prisma.crop.deleteMany({});

  return NextResponse.json({
    message: "All crops cleaned",
  });
}