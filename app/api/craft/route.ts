import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { CRAFTING_RECIPES } from "@/lib/crafting";
import { getWalletAddressFromRequest } from "@/lib/wallet";
import { ensureWalletUser } from "@/lib/world";

export async function POST(req: Request) {
  try {
    const walletAddress = getWalletAddressFromRequest(req);
    if (!walletAddress) {
      return NextResponse.json({ error: "Wallet address is required" }, { status: 401 });
    }

    const { recipeId } = await req.json();

    if (!recipeId) {
      return NextResponse.json({ error: "Recipe ID required" }, { status: 400 });
    }

    const recipe = CRAFTING_RECIPES.find((r) => r.id === recipeId);

    if (!recipe) {
      return NextResponse.json({ error: "Invalid recipe" }, { status: 400 });
    }

    const user = await ensureWalletUser(prisma, walletAddress);

    // Fetch user inventory
    const inventory = await prisma.inventory.findMany({
      where: { userId: user.id },
    });

    // Check if user has all ingredients
    for (const ingredient of recipe.ingredients) {
      const invItem = inventory.find((item) => item.cropType === ingredient.type);
      if (!invItem || invItem.quantity < ingredient.amount) {
        return NextResponse.json(
          { error: `Not enough ${ingredient.type}. Need ${ingredient.amount}.` },
          { status: 400 }
        );
      }
    }

    // Process crafting in a transaction
    await prisma.$transaction(async (tx) => {
      // Deduct ingredients
      for (const ingredient of recipe.ingredients) {
        await tx.inventory.update({
          where: {
            userId_cropType: {
              userId: user.id,
              cropType: ingredient.type,
            },
          },
          data: {
            quantity: { decrement: ingredient.amount },
          },
        });
      }

      // Add output
      await tx.inventory.upsert({
        where: {
          userId_cropType: {
            userId: user.id,
            cropType: recipe.output.type,
          },
        },
        update: {
          quantity: { increment: recipe.output.amount },
        },
        create: {
          userId: user.id,
          cropType: recipe.output.type,
          quantity: recipe.output.amount,
        },
      });
    });

    return NextResponse.json({ message: `Successfully crafted ${recipe.name}!` });
  } catch (error) {
    console.error("Crafting error:", error);
    return NextResponse.json({ error: "Crafting failed" }, { status: 500 });
  }
}
