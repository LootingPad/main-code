import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Plus_Jakarta_Sans, Sora } from "next/font/google";
import { Shell } from "@/components/Shell";
import { WalletProvider } from "@/components/Wallet";
import { AppKitProvider } from "@/context/AppKitProvider";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: true,
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  weight: ["500", "600", "700"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "LOOTING",
  description: "A Robinhood Chain launchpad where qualified trades open Lucky Boxes.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#171717",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookies = (await headers()).get("cookie");

  return (
    <html lang="en" className={`${sora.variable} ${jakarta.variable}`} suppressHydrationWarning>
      <body className="antialiased">
        <AppKitProvider cookies={cookies}>
          <WalletProvider>
            <Shell>{children}</Shell>
          </WalletProvider>
        </AppKitProvider>
      </body>
    </html>
  );
}
