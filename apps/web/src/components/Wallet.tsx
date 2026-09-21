"use client";

import { createContext, useContext, useState } from "react";

type WalletContextValue = {
  connected: boolean;
  address: string;
  connect: () => void;
  disconnect: () => void;
};

const WalletContext = createContext<WalletContextValue | null>(null);

const demoAddress = "0x4c91aa7700de12bb3318e774c0ff21aa";

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);

  return (
    <WalletContext.Provider
      value={{
        connected,
        address: demoAddress,
        connect: () => setConnected(true),
        disconnect: () => setConnected(false),
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const value = useContext(WalletContext);
  if (!value) throw new Error("useWallet must be used inside WalletProvider");
  return value;
}
