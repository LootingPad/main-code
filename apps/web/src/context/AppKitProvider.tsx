"use client";

import { type ReactNode, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createAppKit } from "@reown/appkit/react";
import { cookieToInitialState, WagmiProvider, type Config } from "wagmi";
import { networks, projectId, wagmiAdapter } from "@/config/wagmi";
import { robinhoodChain } from "@/lib/chains";

const metadata = {
  name: "LOOTING",
  description: "Robinhood Chain launchpad — trade anywhere, loot after exit.",
  url: "https://looting.org",
  icons: ["/logo.png"],
};

if (projectId) {
  createAppKit({
    adapters: [wagmiAdapter],
    projectId,
    networks: [...networks],
    defaultNetwork: robinhoodChain,
    metadata,
    features: {
      analytics: false,
      email: false,
      socials: false,
    },
  });
}

export function AppKitProvider({
  children,
  cookies,
}: {
  children: ReactNode;
  cookies: string | null;
}) {
  const [queryClient] = useState(() => new QueryClient());
  const initialState = cookieToInitialState(wagmiAdapter.wagmiConfig as Config, cookies);

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig as Config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
