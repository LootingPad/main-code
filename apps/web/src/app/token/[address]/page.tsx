import { Terminal } from "@/components/Terminal";
import { findLaunch, type Launch } from "@/lib/mock";

type PageProps = {
  params: Promise<{ address: string }>;
  searchParams: Promise<{
    name?: string;
    symbol?: string;
    description?: string;
    lucky?: string;
    fee?: string;
    website?: string;
    twitter?: string;
    telegram?: string;
    discord?: string;
    farcaster?: string;
    buy?: string;
    pair?: string;
    holders?: string;
    wallet?: string;
    exempt?: string;
  }>;
};

export default async function TokenPage({ params, searchParams }: PageProps) {
  const { address } = await params;
  const query = await searchParams;
  const existing = findLaunch(address);

  const launch: Launch = existing ?? {
    address: address === "preview" ? "0xpreview0000000000000000000000000000aa" : address,
    name: query.name || "Untitled",
    symbol: (query.symbol || "NEW").toUpperCase(),
    description: query.description || "Draft coin. Not launched yet.",
    creator: "0x4c91aa7700de12bb3318e774c0ff21aa",
    marketCap: 0,
    progress: 0,
    change1h: 0,
    priceUsd: 0.000001,
    luckyShare: Number(query.lucky || 20),
    creatorTax: Number(query.fee || 1),
    phase: "curve",
    draft: true,
  };

  return (
    <Terminal
      launch={launch}
      meta={{
        website: query.website,
        twitter: query.twitter,
        telegram: query.telegram,
        discord: query.discord,
        farcaster: query.farcaster,
        initialBuy: query.buy,
        pair: query.pair,
        holders: query.holders,
        wallet: query.wallet,
        exempt: query.exempt,
      }}
    />
  );
}
