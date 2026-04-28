"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RainbowKitProvider,
  darkTheme,
  getDefaultConfig,
  getDefaultWallets,
} from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { mainnet } from "wagmi/chains";

export default function WalletProvidersClient({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [config] = useState(() =>
    (() => {
      const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "YOUR_PROJECT_ID";
      const { wallets } = getDefaultWallets({
        appName: "ChronoFarm",
        projectId,
      });

      return getDefaultConfig({
        appName: "ChronoFarm",
        projectId,
        wallets,
        chains: [mainnet],
        ssr: true,
      });
    })(),
  );

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme()} modalSize="compact">
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}