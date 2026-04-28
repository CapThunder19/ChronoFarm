export const WALLET_STORAGE_KEY = "chronofarm_wallet";

const WALLET_SESSION_KEYS = [
  WALLET_STORAGE_KEY,
  "wagmi.state",
  "wagmi.recentConnectorId",
  "rk-transactions",
  "rk-recent",
  "rk-latest-id",
  "WALLETCONNECT_DEEPLINK_CHOICE",
];

export function getStoredWalletAddress() {
  if (typeof window === "undefined") {
    return "";
  }

  return localStorage.getItem(WALLET_STORAGE_KEY) || "";
}

export function setStoredWalletAddress(address: string) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(WALLET_STORAGE_KEY, address);
}

export function clearWalletSession() {
  if (typeof window === "undefined") {
    return;
  }

  for (const key of WALLET_SESSION_KEYS) {
    localStorage.removeItem(key);
  }
}