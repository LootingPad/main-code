/** $LOOTING dashboard types — live series land here after CA + fee path (no seed data). */

export const LOOTING_TOKEN = {
  symbol: "LOOTING",
  name: "LOOTING",
  tagline: "$LOOTING powers the Robinhood Chain launchpad",
  blurb:
    "Protocol burn share from LOOTING launches is tracked here once the token CA and fee routing are live.",
  address: "",
} as const;

export type LootingBurnRow = {
  id: string;
  date: string;
  burned: number;
  ethSpent: number;
  usd: number;
  price: number;
  revenuePct: number;
};

export type LootingTimePoint = {
  time: string;
  value: number;
};

export type LootingWalletPoint = {
  time: string;
  chain: number;
  looting: number;
};

export type LootingChartPoint = {
  time: string;
  burnUsd: number;
  feeUsd: number;
};

export const lootingBurnHistory: LootingBurnRow[] = [];
export const lootingDailyBurnSeries: LootingTimePoint[] = [];
export const lootingRevenueAllocSeries: LootingTimePoint[] = [];
export const lootingWalletSeries: LootingWalletPoint[] = [];
export const lootingCumulativeSeries: LootingChartPoint[] = [];
