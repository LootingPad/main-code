export type Launch = {
  address: string;
  name: string;
  symbol: string;
  description: string;
  creator: string;
  marketCap: number;
  progress: number;
  change1h: number;
  priceUsd: number;
  luckyShare: number;
  creatorTax: number;
  phase: "curve" | "graduated";
  draft?: boolean;
};

export const launches: Launch[] = [
  {
    address: "0x7a31c8e14b0d9f6a2c55e81d4b90aa1100c0ff21",
    name: "Night Vault",
    symbol: "VAULT",
    description: "A Robinhood Chain launch funding Lucky Boxes from creator fees.",
    creator: "0x4c91aa7700de12bb3318e774c0ff21aa",
    marketCap: 186420,
    progress: 72,
    change1h: 14.2,
    priceUsd: 0.000186,
    luckyShare: 20,
    creatorTax: 1,
    phase: "curve",
  },
  {
    address: "0x12ab90ff33c1d8e774aa0199bb221100de44a901",
    name: "Gold Thread",
    symbol: "THREAD",
    description: "Creator keeps half. Lucky Boxes take the other half.",
    creator: "0x4c91aa7700de12bb3318e774c0ff21aa",
    marketCap: 84210,
    progress: 41,
    change1h: -3.4,
    priceUsd: 0.000084,
    luckyShare: 50,
    creatorTax: 1,
    phase: "curve",
  },
  {
    address: "0x90de44aa771100cc2288bb9012ff33c1aa0199c2",
    name: "Harbor",
    symbol: "HARBOR",
    description: "Graduated into a locked Uniswap v4 pool.",
    creator: "0x19bb221100de44a90112ab90ff33c1",
    marketCap: 940000,
    progress: 100,
    change1h: 2.1,
    priceUsd: 0.00094,
    luckyShare: 20,
    creatorTax: 1,
    phase: "graduated",
  },
  {
    address: "0xc1d8e774aa0199bb221100de44a90112ab90ff33",
    name: "Paper Lantern",
    symbol: "LANTERN",
    description: "Fresh curve. Small creator tax, a slice set aside for boxes.",
    creator: "0x7712bb09331100aa77c144c01aa98e",
    marketCap: 12440,
    progress: 18,
    change1h: 28.6,
    priceUsd: 0.000012,
    luckyShare: 30,
    creatorTax: 1,
    phase: "curve",
  },
  {
    address: "0x55e81d4b90aa1100c0ff217a31c8e14b0d9f6a2c",
    name: "Copper Key",
    symbol: "KEY",
    description: "Reward program active while fees route to the LOOTING router.",
    creator: "0x00117b6Daa10AfBe91c02d4418c77e",
    marketCap: 256800,
    progress: 88,
    change1h: 6.4,
    priceUsd: 0.000257,
    luckyShare: 20,
    creatorTax: 1,
    phase: "curve",
  },
  {
    address: "0xaa0199bb221100de44a90112ab90ff33c1d8e774",
    name: "Quiet Market",
    symbol: "QUIET",
    description: "Low volume curve with a larger Lucky Box allocation.",
    creator: "0x09331100aa77c144c01aa98e7712bb",
    marketCap: 4310,
    progress: 9,
    change1h: 0.4,
    priceUsd: 0.000004,
    luckyShare: 40,
    creatorTax: 1,
    phase: "curve",
  },
  {
    address: "0x88c01aa98e7712bb09331100aa77c1de44a90112",
    name: "Amber Dock",
    symbol: "DOCK",
    description: "Late curve. Most of the raise is already in.",
    creator: "0x88c01aa98e7712bb09331100aa77c1",
    marketCap: 412000,
    progress: 91,
    change1h: 4.8,
    priceUsd: 0.000412,
    luckyShare: 10,
    creatorTax: 1,
    phase: "curve",
  },
  {
    address: "0x77de44a90112ab90ff33c1d8e774aa0199bb2211",
    name: "Velvet Rail",
    symbol: "RAIL",
    description: "Steady buyers, with a larger slice set aside for boxes.",
    creator: "0x77de44a90112ab90ff33c1d8e774aa",
    marketCap: 67300,
    progress: 33,
    change1h: 9.1,
    priceUsd: 0.000067,
    luckyShare: 35,
    creatorTax: 1,
    phase: "curve",
  },
  {
    address: "0x66aa0199bb221100de44a90112ab90ff33c1d8e7",
    name: "Cipher Mint",
    symbol: "MINT",
    description: "Graduated pool. Fees still fund the reward router.",
    creator: "0x66aa0199bb221100de44a90112ab90",
    marketCap: 1280000,
    progress: 100,
    change1h: 1.2,
    priceUsd: 0.00128,
    luckyShare: 15,
    creatorTax: 1,
    phase: "graduated",
  },
  {
    address: "0x55bb09331100aa77c144c01aa98e7712bb093311",
    name: "North Signal",
    symbol: "NORTH",
    description: "Thin book. A wide Lucky Box cut on a small tax.",
    creator: "0x55bb09331100aa77c144c01aa98e77",
    marketCap: 22800,
    progress: 27,
    change1h: -8.4,
    priceUsd: 0.000023,
    luckyShare: 45,
    creatorTax: 1,
    phase: "curve",
  },
  {
    address: "0x44c01aa98e7712bb09331100aa77c1de12ab90ff",
    name: "Static Bloom",
    symbol: "BLOOM",
    description: "Climbing toward graduation with a modest box share.",
    creator: "0x44c01aa98e7712bb09331100aa77c1",
    marketCap: 540000,
    progress: 80,
    change1h: 7.7,
    priceUsd: 0.00054,
    luckyShare: 20,
    creatorTax: 1,
    phase: "curve",
  },
  {
    address: "0x33d8e774aa0199bb221100de44a90112ab90ff33",
    name: "Ivory Current",
    symbol: "CURRENT",
    description: "Just launched. Fast tape, most fees still ahead.",
    creator: "0x33d8e774aa0199bb221100de44a901",
    marketCap: 9100,
    progress: 14,
    change1h: 21.4,
    priceUsd: 0.000009,
    luckyShare: 30,
    creatorTax: 1,
    phase: "curve",
  },
  {
    address: "0x221100de44a90112ab90ff33c1d8e774aa0199bb",
    name: "Rust Chapel",
    symbol: "CHAPEL",
    description: "Quiet graduation path. Creator keeps most of the tax.",
    creator: "0x221100de44a90112ab90ff33c1d8e7",
    marketCap: 310000,
    progress: 76,
    change1h: -1.1,
    priceUsd: 0.00031,
    luckyShare: 10,
    creatorTax: 1,
    phase: "curve",
  },
  {
    address: "0x1100c0ff217a31c8e14b0d9f6a2c55e81d4b90aa",
    name: "Lime Index",
    symbol: "INDEX",
    description: "Mid curve with the widest Lucky Box allocation on the board.",
    creator: "0x1100c0ff217a31c8e14b0d9f6a2c55",
    marketCap: 88000,
    progress: 48,
    change1h: 3.2,
    priceUsd: 0.000088,
    luckyShare: 55,
    creatorTax: 1,
    phase: "curve",
  },
];

export const stagedLaunches: Launch[] = [
  {
    address: "0xab90ff33c1d8e774aa0199bb221100de44a90112",
    name: "Glass Bell",
    symbol: "GLASS",
    description: "New curve. Buyers are still finding the open.",
    creator: "0xab90ff33c1d8e774aa0199bb2211",
    marketCap: 6400,
    progress: 11,
    change1h: 36.4,
    priceUsd: 0.000006,
    luckyShare: 25,
    creatorTax: 1,
    phase: "curve",
  },
  {
    address: "0xcd44a90112ab90ff33c1d8e774aa0199bb221100",
    name: "Neon Pier",
    symbol: "PIER",
    description: "Fresh launch with a bright first hour.",
    creator: "0xcd44a90112ab90ff33c1d8e774aa01",
    marketCap: 15200,
    progress: 24,
    change1h: 18.6,
    priceUsd: 0.000015,
    luckyShare: 20,
    creatorTax: 1,
    phase: "curve",
  },
  {
    address: "0xef7712bb09331100aa77c144c01aa98e7712bb09",
    name: "Marble Fox",
    symbol: "FOX",
    description: "Early curve. Half the creator tax is boxed.",
    creator: "0xef7712bb09331100aa77c144c01aa9",
    marketCap: 4800,
    progress: 8,
    change1h: 12.5,
    priceUsd: 0.000005,
    luckyShare: 50,
    creatorTax: 1,
    phase: "curve",
  },
  {
    address: "0x9012ab90ff33c1d8e774aa0199bb221100de44a9",
    name: "Silk Route",
    symbol: "SILK",
    description: "Just listed. Volume is still finding a range.",
    creator: "0x9012ab90ff33c1d8e774aa0199bb22",
    marketCap: 11300,
    progress: 19,
    change1h: -2.2,
    priceUsd: 0.000011,
    luckyShare: 20,
    creatorTax: 1,
    phase: "curve",
  },
];

const avatarColors = ["#8eb6ff", "#7d6bff", "#5ee0b5", "#f0c36a", "#ff8fab", "#67d4ff"];

export function tokenColor(symbol: string) {
  const index = [...symbol].reduce((sum, char) => sum + char.charCodeAt(0), 0) % avatarColors.length;
  return avatarColors[index];
}

export function marketStats(launch: Launch) {
  const n = [...launch.symbol].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const ages = ["3m", "4m", "12m", "40m", "1h", "2h", "5h", "8h", "14h", "20h", "30h", "40h", "2d"];
  return {
    age: ages[n % ages.length],
    txns: 180 + (n % 12000),
    volume24h: Math.round(launch.marketCap * (0.4 + (n % 50) / 40)),
    traders: 40 + (n % 2400),
    change6h: Number((((n % 180) - 40) / 3).toFixed(1)),
    change24h: Number((launch.change1h * 2.4).toFixed(1)),
    ath: Math.round(launch.marketCap * (1.05 + (n % 20) / 40)),
    boxUsd:
      launch.marketCap *
      (launch.creatorTax / 100) *
      (0.35 + launch.progress / 200) *
      (launch.luckyShare / 100),
  };
}

export const leaderboard = [
  { wallet: "0x4c91aa7700de12bb3318e774c0ff21aa", tier: "Gold", xp: 7420, trades: 38, rewards: "$420" },
  { wallet: "0xAfBe91c02d4418c77e00117b6Daa10cc", tier: "Gold", xp: 6104, trades: 29, rewards: "$260" },
  { wallet: "0x19bb221100de44a90112ab90ff33c1aa", tier: "Silver", xp: 2840, trades: 17, rewards: "$84" },
  { wallet: "0x44c01aa98e7712bb09331100aa77c1de", tier: "Silver", xp: 1960, trades: 14, rewards: "$40" },
  { wallet: "0x7712bb09331100aa77c144c01aa98e11", tier: "Bronze", xp: 840, trades: 9, rewards: "$12" },
  { wallet: "0x00117b6Daa10AfBe91c02d4418c77e90", tier: "Bronze", xp: 420, trades: 5, rewards: "$0" },
  { wallet: "0x09331100aa77c144c01aa98e7712bb44", tier: "Bronze", xp: 210, trades: 3, rewards: "$0" },
  { wallet: "0x12ab90ff33c1d8e774aa0199bb221100de", tier: "Silver", xp: 1510, trades: 11, rewards: "$25" },
  { wallet: "0x88c01aa98e7712bb09331100aa77c1de", tier: "Gold", xp: 5330, trades: 22, rewards: "$140" },
  { wallet: "0x33d8e774aa0199bb221100de44a90112", tier: "Silver", xp: 980, trades: 8, rewards: "$18" },
  { wallet: "0xcd44a90112ab90ff33c1d8e774aa0199", tier: "Bronze", xp: 160, trades: 2, rewards: "$0" },
];

export function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function formatCount(value: number) {
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function formatUsd(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${value.toFixed(2)}`;
}

export function formatPrice(value: number) {
  if (value >= 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(6)}`;
}

export function findLaunch(address: string) {
  const key = address.toLowerCase();
  return [...launches, ...stagedLaunches].find((launch) => launch.address.toLowerCase() === key);
}

export type BoxStatus = "unopened" | "opened" | "claimed" | "holding" | "ineligible";

export type LuckyBox = {
  id: string;
  token: string;
  status: BoxStatus;
  reward?: string;
  tx?: string;
  claimedAt?: string;
};

const demoWallet = "0x4c91aa7700de12bb3318e774c0ff21aa";

const demoHistory: {
  id: string;
  token: string;
  bought: boolean;
  exited: boolean;
  reward?: string;
  tx?: string;
  claimedAt?: string;
}[] = [
  { id: "08", token: "LANTERN", bought: true, exited: true },
  { id: "07", token: "RAIL", bought: true, exited: true },
  { id: "06", token: "VAULT", bought: true, exited: false },
  { id: "05", token: "THREAD", bought: true, exited: false },
  { id: "03", token: "HARBOR", bought: true, exited: true, reward: "0.42 mSPY", tx: "0x8f3a21bb90de44a90112ab90ff33c1d8e774aa01", claimedAt: "2h" },
  { id: "01", token: "QUIET", bought: true, exited: true },
  { id: "04", token: "KEY", bought: false, exited: false },
  { id: "02", token: "DOCK", bought: false, exited: false },
];

function historyStatus(row: (typeof demoHistory)[number]): BoxStatus {
  if (!row.bought) return "ineligible";
  if (row.tx) return "claimed";
  if (!row.exited) return "holding";
  return "unopened";
}

export function boxesForWallet(address: string): LuckyBox[] {
  const known = address.toLowerCase() === demoWallet;
  return demoHistory.map((row) => {
    const bought = known && row.bought;
    const exited = known && row.exited;
    const entry = bought ? { ...row, bought, exited } : { ...row, bought: false, exited: false, reward: undefined, tx: undefined, claimedAt: undefined };
    return {
      id: row.id,
      token: row.token,
      status: historyStatus(entry),
      reward: entry.reward,
      tx: entry.tx,
      claimedAt: entry.claimedAt,
    };
  });
}

export const rewardPool = ["25 LOOTING", "0.18 mNVDA", "0.42 mSPY", "No reward", "40 LOOTING"];
