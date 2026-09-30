import { Terminal } from "@/components/Terminal";
import { draftLaunch, getLaunch } from "@/lib/api";
import { getTrenchToken, trenchHolders, trenchPairLabel, trenchTicks, trenchToLaunch, trenchTrades } from "@/lib/trenches";
import type { LaunchWithStats } from "@/lib/types";

type PageProps = {
  params: Promise<{ address: string }>;
  searchParams: Promise<{
    name?: string;
    symbol?: string;
    description?: string;
    lucky?: string;
    fee?: string;
    launchFee?: string;
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

  const trench = await getTrenchToken(address).catch(() => null);
  const feePending = query.launchFee === "pending";
  if (trench) {
    const launch = trenchToLaunch(trench.pair);
    const socials = trench.pair.socials;
    return (
      <Terminal
        launch={launch}
        initialStats={launch.stats}
        chain
        feePending={feePending}
        holders={trenchHolders(trench.holders)}
        trades={trenchTrades(trench.trades)}
        ticks={trenchTicks(trench)}
        meta={{
          website: socials?.website,
          twitter: socials?.twitter,
          telegram: socials?.telegram,
          discord: socials?.discord,
          farcaster: socials?.farcaster,
          pair: trenchPairLabel(trench.pair.pairToken),
        }}
      />
    );
  }

  let launch: LaunchWithStats | ReturnType<typeof draftLaunch>;
  try {
    launch = await getLaunch(address);
  } catch {
    launch = draftLaunch({
      address: address === "preview" ? "0xpreview0000000000000000000000000000aa" : address,
      name: query.name,
      symbol: query.symbol,
      description: query.description,
      creator: query.wallet || "0x0000000000000000000000000000000000000000",
      luckyShare: Number(query.lucky || 20),
      creatorTax: Number(query.fee || 1),
    });
  }

  return (
    <Terminal
      launch={launch}
      initialStats={"stats" in launch ? launch.stats : undefined}
      feePending={feePending}
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
