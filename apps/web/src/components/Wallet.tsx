"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAppKit, useAppKitAccount, useDisconnect } from "@reown/appkit/react";
import { WalletTermsModal } from "./WalletTermsModal";

type WalletContextValue = {
  connected: boolean;
  address: string;
  termsAccepted: boolean;
  connect: () => void;
  disconnect: () => void;
  acceptTerms: () => void;
};

const WalletContext = createContext<WalletContextValue | null>(null);
const TERMS_KEY = "looting-wallet-terms-v1";

function readAccepted(address: string) {
  if (typeof window === "undefined" || !address) return false;
  try {
    return window.localStorage.getItem(`${TERMS_KEY}:${address.toLowerCase()}`) === "1";
  } catch {
    return false;
  }
}

function writeAccepted(address: string) {
  try {
    window.localStorage.setItem(`${TERMS_KEY}:${address.toLowerCase()}`, "1");
  } catch {
    // ignore quota / private mode
  }
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { disconnect: appKitDisconnect } = useDisconnect();

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!address) {
      setTermsAccepted(false);
      return;
    }
    setTermsAccepted(readAccepted(address));
  }, [address]);

  const connect = useCallback(() => {
    void open({ view: "Connect" });
  }, [open]);

  const disconnect = useCallback(() => {
    void appKitDisconnect();
  }, [appKitDisconnect]);

  const acceptTerms = useCallback(() => {
    if (!address) return;
    writeAccepted(address);
    setTermsAccepted(true);
  }, [address]);

  const connected = Boolean(isConnected && address);
  const needsTerms = hydrated && connected && !termsAccepted;

  const value = useMemo(
    () => ({
      connected,
      address: address ?? "",
      termsAccepted,
      connect,
      disconnect,
      acceptTerms,
    }),
    [connected, address, termsAccepted, connect, disconnect, acceptTerms],
  );

  return (
    <WalletContext.Provider value={value}>
      {children}
      <WalletTermsModal open={needsTerms} onAccept={acceptTerms} onDisconnect={disconnect} />
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const value = useContext(WalletContext);
  if (!value) throw new Error("useWallet must be used inside WalletProvider");
  return value;
}
