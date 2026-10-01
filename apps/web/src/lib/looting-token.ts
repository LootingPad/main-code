/** Shared types for $LOOTING dashboard. Live series come from `/api/looting-token`. */

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
