import { NextResponse } from "next/server";
import { createPublicClient, http, parseEther } from "viem";
import { sepolia } from "viem/chains";
import { prisma } from "@/lib/prisma";
import { ensureWalletUser } from "@/lib/world";
import { getWalletAddressFromRequest, normalizeWalletAddress } from "@/lib/wallet";

const sepoliaRpcUrl =
  process.env.SEPOLIA_RPC_URL ??
  process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ??
  "https://ethereum-sepolia-rpc.publicnode.com";

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(sepoliaRpcUrl),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ offerId: string }> },
) {
  try {
    const walletAddress = getWalletAddressFromRequest(req);
    if (!walletAddress) {
      return NextResponse.json({ error: "Wallet address is required" }, { status: 401 });
    }

    const { offerId } = await params;
    if (!offerId) {
      return NextResponse.json({ error: "Offer id is required" }, { status: 400 });
    }

    const body = await req.json();
    const txHash = typeof body?.txHash === "string" ? body.txHash.trim() : "";
    if (!txHash) {
      return NextResponse.json({ error: "Transaction hash is required" }, { status: 400 });
    }

    const buyerWallet = normalizeWalletAddress(walletAddress);
    const offer = await prisma.tradeOffer.findUnique({ where: { id: offerId } });

    if (!offer) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    if (offer.status !== "OPEN") {
      return NextResponse.json({ error: "Offer is no longer open" }, { status: 409 });
    }

    if (normalizeWalletAddress(offer.walletAddress) === buyerWallet) {
      return NextResponse.json({ error: "You cannot buy your own offer" }, { status: 400 });
    }

    if (offer.currency !== "ETH") {
      return NextResponse.json({ error: "Only Sepolia ETH offers are supported" }, { status: 400 });
    }

    const expectedValue = parseEther(offer.priceCrypto);

    const [tx, receipt] = await Promise.all([
      publicClient.getTransaction({ hash: txHash as `0x${string}` }),
      publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` }),
    ]);

    if (receipt.status !== "success") {
      return NextResponse.json({ error: "Transaction is not successful" }, { status: 400 });
    }

    const txFrom = tx.from ? normalizeWalletAddress(tx.from) : "";
    const txTo = tx.to ? normalizeWalletAddress(tx.to) : "";
    const sellerWallet = normalizeWalletAddress(offer.walletAddress);

    if (txFrom !== buyerWallet) {
      return NextResponse.json({ error: "Transaction sender does not match buyer wallet" }, { status: 400 });
    }

    if (txTo !== sellerWallet) {
      return NextResponse.json({ error: "Transaction recipient must be the seller wallet" }, { status: 400 });
    }

    if (tx.value < expectedValue) {
      return NextResponse.json({ error: "Transaction value is lower than listing price" }, { status: 400 });
    }

    const buyer = await ensureWalletUser(prisma, buyerWallet);

    const saleResult = await prisma.$transaction(async (txDb) => {
      const updated = await txDb.tradeOffer.updateMany({
        where: { id: offer.id, status: "OPEN" },
        data: { status: "SOLD" },
      });

      if (updated.count === 0) {
        return { sold: false };
      }

      await txDb.inventory.upsert({
        where: {
          userId_cropType: {
            userId: buyer.id,
            cropType: offer.cropType,
          },
        },
        update: {
          quantity: { increment: offer.quantity },
        },
        create: {
          userId: buyer.id,
          cropType: offer.cropType,
          quantity: offer.quantity,
        },
      });

      return { sold: true };
    });

    if (!saleResult.sold) {
      return NextResponse.json({ error: "Offer was already purchased" }, { status: 409 });
    }

    return NextResponse.json({ message: "Offer purchased successfully", txHash });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to buy offer" }, { status: 500 });
  }
}
