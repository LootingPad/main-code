import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { robinhoodChain } from "@/lib/chains";

export const projectId = process.env.NEXT_PUBLIC_PROJECT_ID?.trim() ?? "";

if (!projectId && typeof window === "undefined") {
  console.warn("NEXT_PUBLIC_PROJECT_ID is not set — Reown AppKit will not connect.");
}

export const networks = [robinhoodChain] as const;

export const wagmiAdapter = new WagmiAdapter({
  ssr: true,
  projectId: projectId || "00000000000000000000000000000000",
  networks: [...networks],
});

export const config = wagmiAdapter.wagmiConfig;
