export function normalizeWalletAddress(address: string): string {
  return address.trim().toLowerCase();
}

export function walletUserName(address: string): string {
  return `wallet:${normalizeWalletAddress(address)}`;
}

export function getWalletAddressFromRequest(req: Request): string | null {
  const headerAddress = req.headers.get("x-wallet-address");
  if (headerAddress) {
    const normalized = normalizeWalletAddress(headerAddress);
    return normalized || null;
  }

  const { searchParams } = new URL(req.url);
  const queryAddress = searchParams.get("wallet");
  if (queryAddress) {
    const normalized = normalizeWalletAddress(queryAddress);
    return normalized || null;
  }

  return null;
}
