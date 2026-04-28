"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

const WalletProvidersClient = dynamic(() => import("./wallet-providers-client"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center bg-[#050505] text-sm text-zinc-500">
      Loading wallet connector...
    </div>
  ),
});

export default function Providers({ children }: { children: ReactNode }) {
  return <WalletProvidersClient>{children}</WalletProvidersClient>;
}
