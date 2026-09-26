import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Sora } from "next/font/google";
import { Shell } from "@/components/Shell";
import { WalletProvider } from "@/components/Wallet";
import "./globals.css";

// Body/UI font — preload so text paints with the intended face sooner.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: true,
});

// Display/headings — still swap-loaded; skip preload so it does not contend with the body font.
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} ${jakarta.variable}`} suppressHydrationWarning>
      <body className="antialiased">
        <WalletProvider>
          <Shell>{children}</Shell>
        </WalletProvider>
      </body>
    </html>
  );
}
