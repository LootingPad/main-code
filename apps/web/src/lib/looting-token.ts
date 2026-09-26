/** Mock $LOOTING token stats for the /looting dashboard (UI seed). */

export const LOOTING_TOKEN = {
  symbol: "LOOTING",
  name: "LOOTING",
  tagline: "$LOOTING powers the Robinhood Chain launchpad",
  blurb:
    "Protocol burn share from LOOTING launches is tracked here — verifiable fee flow into burn accounting, separate from Lucky Box cuts.",
  address: "0xloot1ng0000000000000000000000000000cafe",
  priceUsd: 0.000186,
  marketCap: 74_400_000,
  fdv: 186_000_000,
  volume24h: 4_820_000,
  holders: 18_420,
  circulating: 400_000_000_000,
  totalSupply: 1_000_000_000_000,
  burned: 48_620_000_000,
  burnedUsd: 9_040_000,
  feesUsd: 45_200_000,
  burnShareOfSupply: 4.862,
  annualizedRevenue: 18_600_000,
  revenuePerDay: 51_000,
  burnAllocationPct: 20,
  dailyBurnUsd: 10_200,
  activeWallets: 42_600,
  lootingWallets: 12_840,
  asOf: "Sep 26, 2026",
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

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function stamp(dayOffset: number) {
  const base = Date.UTC(2026, 8, 26);
  const date = new Date(base - dayOffset * 86_400_000);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

function isoDay(dayOffset: number) {
  const base = Date.UTC(2026, 8, 26);
  const date = new Date(base - dayOffset * 86_400_000);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const lootingBurnHistory: LootingBurnRow[] = Array.from({ length: 40 }, (_, index) => {
  const usd = 8_400 + (index % 7) * 620 + (index % 3) * 180;
  const price = 0.000168 + (index % 9) * 0.000003;
  const burned = Math.round(usd / price);
  const ethSpent = usd / 3500;
  const revenuePct = 18.4 + (index % 5) * 0.7;
  return {
    id: `burn-${index}`,
    date: stamp(index),
    burned,
    ethSpent,
    usd,
    price,
    revenuePct,
  };
});

const DAYS = 180;

function buildDailyWeights(days: number) {
  const burn: number[] = [];
  const fee: number[] = [];
  const alloc: number[] = [];
  const chain: number[] = [];
  const looting: number[] = [];

  for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
    const wave = Math.sin(dayIndex / 11) * 0.35 + Math.cos(dayIndex / 19) * 0.2;
    const feeDaily = 420_000 + (dayIndex % 13) * 22_000 + (dayIndex % 7) * 9_500 + wave * 80_000;
    const burnDaily = Math.max(1_200, feeDaily * 0.2 + (dayIndex % 9) * 1_400 + wave * 18_000);
    const allocPct =
      dayIndex < days * 0.55
        ? 38 + (dayIndex % 17) * 4.2 + Math.abs(wave) * 28
        : 18 + (dayIndex % 5) * 0.9 + Math.abs(wave) * 3;
    const chainWallets = 18_000 + dayIndex * 95 + (dayIndex % 21) * 420 + Math.max(0, wave) * 8_000;
    const lootingWallets = 3_200 + dayIndex * 42 + (dayIndex % 11) * 180 + Math.max(0, wave) * 2_400;

    fee.push(feeDaily);
    burn.push(burnDaily);
    alloc.push(allocPct);
    chain.push(chainWallets);
    looting.push(lootingWallets);
  }

  return { burn, fee, alloc, chain, looting };
}

const weights = buildDailyWeights(DAYS);

export const lootingDailyBurnSeries: LootingTimePoint[] = (() => {
  const raw = weights.burn;
  const last = raw[raw.length - 1] || 1;
  const scale = LOOTING_TOKEN.dailyBurnUsd / last;
  const points = raw.map((value, index) => ({
    time: isoDay(DAYS - 1 - index),
    value: Math.round(value * scale),
  }));
  const end = points[points.length - 1];
  if (end) end.value = LOOTING_TOKEN.dailyBurnUsd;
  return points;
})();

export const lootingRevenueAllocSeries: LootingTimePoint[] = (() => {
  const points = weights.alloc.map((value, index) => ({
    time: isoDay(DAYS - 1 - index),
    value: Number(value.toFixed(2)),
  }));
  const end = points[points.length - 1];
  if (end) end.value = LOOTING_TOKEN.burnAllocationPct;
  return points;
})();

export const lootingWalletSeries: LootingWalletPoint[] = (() => {
  const lastChain = weights.chain[weights.chain.length - 1] || 1;
  const lastLoot = weights.looting[weights.looting.length - 1] || 1;
  const chainScale = LOOTING_TOKEN.activeWallets / lastChain;
  const lootScale = LOOTING_TOKEN.lootingWallets / lastLoot;
  const points = weights.chain.map((chain, index) => ({
    time: isoDay(DAYS - 1 - index),
    chain: Math.round(chain * chainScale),
    looting: Math.round(weights.looting[index] * lootScale),
  }));
  const end = points[points.length - 1];
  if (end) {
    end.chain = LOOTING_TOKEN.activeWallets;
    end.looting = LOOTING_TOKEN.lootingWallets;
  }
  return points;
})();

export const lootingCumulativeSeries: LootingChartPoint[] = (() => {
  const points: LootingChartPoint[] = [];
  let burn = 0;
  let fees = 0;
  const feeSum = weights.fee.reduce((sum, value) => sum + value, 0);
  const burnSum = weights.burn.reduce((sum, value) => sum + value, 0);
  const feeScale = LOOTING_TOKEN.feesUsd / feeSum;
  const burnScale = LOOTING_TOKEN.burnedUsd / burnSum;

  for (let i = DAYS - 1; i >= 0; i -= 1) {
    const dayIndex = DAYS - 1 - i;
    fees += weights.fee[dayIndex] * feeScale;
    burn += weights.burn[dayIndex] * burnScale;
    points.push({
      time: isoDay(i),
      burnUsd: Math.round(burn),
      feeUsd: Math.round(fees),
    });
  }

  const last = points[points.length - 1];
  if (last) {
    last.burnUsd = LOOTING_TOKEN.burnedUsd;
    last.feeUsd = LOOTING_TOKEN.feesUsd;
  }

  return points;
})();
