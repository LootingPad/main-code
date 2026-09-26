export const DAY = 24 * 60 * 60 * 1000;
export const STAKING_NOW = Date.parse("2026-09-26T00:00:00Z");

export const STAKING_LOCK_OPTIONS = [
  { id: "flex", label: "Flexible", rate: 8 },
  { id: "30", label: "30 days", rate: 14 },
  { id: "90", label: "90 days", rate: 22 },
] as const;

export type StakingLockId = (typeof STAKING_LOCK_OPTIONS)[number]["id"];

export type StakingEvent = {
  id: string;
  address: string;
  symbol: string;
  name: string;
  creator: string;
  reward: number;
  staked: number;
  stakers: number;
  marketCap: number;
  volume24h: number;
  durationDays: number;
  locks: StakingLockId[];
  ends: number;
};

export type StakingPosition = {
  id: string;
  eventId: string;
  address: string;
  symbol: string;
  name: string;
  amount: number;
  lock: StakingLockId;
  claimable: number;
  started: number;
};

export const publicStakingEvents: StakingEvent[] = [
  {
    id: "vault-pool",
    address: "0x7a31c8e14b0d9f6a2c55e81d4b90aa1100c0ff21",
    symbol: "VAULT",
    name: "Night Vault",
    creator: "0x4c91aa7700de12bb3318e774c0ff21aa",
    reward: 2_400_000,
    staked: 8_420_000,
    stakers: 186,
    marketCap: 186_420,
    volume24h: 94_200,
    durationDays: 90,
    locks: ["flex", "30", "90"],
    ends: STAKING_NOW + 64 * DAY,
  },
  {
    id: "thread-pool",
    address: "0x12ab90ff33c1d8e774aa0199bb221100de44a901",
    symbol: "THREAD",
    name: "Gold Thread",
    creator: "0x4c91aa7700de12bb3318e774c0ff21aa",
    reward: 900_000,
    staked: 3_120_000,
    stakers: 94,
    marketCap: 84_210,
    volume24h: 41_800,
    durationDays: 180,
    locks: ["30", "90"],
    ends: STAKING_NOW + 142 * DAY,
  },
  {
    id: "harbor-pool",
    address: "0x90de44aa771100cc2288bb9012ff33c1aa0199c2",
    symbol: "HARBOR",
    name: "Harbor",
    creator: "0x19bb221100de44a90112ab90ff33c1",
    reward: 1_500_000,
    staked: 5_640_000,
    stakers: 128,
    marketCap: 940_000,
    volume24h: 312_400,
    durationDays: 90,
    locks: ["flex", "30", "90"],
    ends: STAKING_NOW + 41 * DAY,
  },
  {
    id: "lantern-pool",
    address: "0xaa0199bb221100de44a90112ab90ff33c1d8e774",
    symbol: "LANTERN",
    name: "Lantern",
    creator: "0x7712bb09331100aa77c144c01aa98e",
    reward: 620_000,
    staked: 1_880_000,
    stakers: 57,
    marketCap: 12_440,
    volume24h: 6_820,
    durationDays: 30,
    locks: ["flex", "30"],
    ends: STAKING_NOW + 18 * DAY,
  },
  {
    id: "key-pool",
    address: "0xbb9012ff33c1aa0199c290de44aa771100cc2288",
    symbol: "KEY",
    name: "Skeleton Key",
    creator: "0x00117b6Daa10AfBe91c02d4418c77e",
    reward: 3_100_000,
    staked: 11_200_000,
    stakers: 241,
    marketCap: 256_800,
    volume24h: 128_600,
    durationDays: 365,
    locks: ["30", "90"],
    ends: STAKING_NOW + 280 * DAY,
  },
  {
    id: "ember-pool",
    address: "0xc1aa0199bb221100de44a90112ab90ff33c1d8e7",
    symbol: "EMBER",
    name: "Ember",
    creator: "0x55e81d4b90aa1100c0ff217a31c8e14b",
    reward: 780_000,
    staked: 2_450_000,
    stakers: 72,
    marketCap: 67_300,
    volume24h: 28_400,
    durationDays: 90,
    locks: ["flex", "30"],
    ends: STAKING_NOW + 52 * DAY,
  },
  {
    id: "rift-pool",
    address: "0xd8e774aa0199bb221100de44a90112ab90ff33c1",
    symbol: "RIFT",
    name: "Rift",
    creator: "0x12ab90ff33c1d8e774aa0199bb221100",
    reward: 1_120_000,
    staked: 4_010_000,
    stakers: 109,
    marketCap: 412_000,
    volume24h: 186_200,
    durationDays: 180,
    locks: ["30", "90"],
    ends: STAKING_NOW + 118 * DAY,
  },
  {
    id: "moss-pool",
    address: "0xe44a90112ab90ff33c1d8e774aa0199bb221100d",
    symbol: "MOSS",
    name: "Moss",
    creator: "0x90de44aa771100cc2288bb9012ff33c1",
    reward: 430_000,
    staked: 1_260_000,
    stakers: 41,
    marketCap: 22_800,
    volume24h: 9_640,
    durationDays: 30,
    locks: ["flex", "30", "90"],
    ends: STAKING_NOW + 22 * DAY,
  },
  {
    id: "signal-pool",
    address: "0xff33c1d8e774aa0199bb221100de44a90112ab90",
    symbol: "SIGNAL",
    name: "Signal",
    creator: "0xaa0199bb221100de44a90112ab90ff33",
    reward: 2_050_000,
    staked: 6_880_000,
    stakers: 163,
    marketCap: 540_000,
    volume24h: 214_800,
    durationDays: 90,
    locks: ["flex", "90"],
    ends: STAKING_NOW + 73 * DAY,
  },
  {
    id: "drift-pool",
    address: "0xa90112ab90ff33c1d8e774aa0199bb221100de44",
    symbol: "DRIFT",
    name: "Drift",
    creator: "0xbb9012ff33c1aa0199c290de44aa7711",
    reward: 960_000,
    staked: 3_340_000,
    stakers: 88,
    marketCap: 88_000,
    volume24h: 36_500,
    durationDays: 180,
    locks: ["30", "90"],
    ends: STAKING_NOW + 155 * DAY,
  },
  {
    id: "prism-pool",
    address: "0xb90ff33c1d8e774aa0199bb221100de44a90112a",
    symbol: "PRISM",
    name: "Prism",
    creator: "0xc1aa0199bb221100de44a90112ab90ff",
    reward: 1_680_000,
    staked: 5_120_000,
    stakers: 134,
    marketCap: 1_280_000,
    volume24h: 418_000,
    durationDays: 365,
    locks: ["flex", "30", "90"],
    ends: STAKING_NOW + 310 * DAY,
  },
];

export const seedStakingPositions: StakingPosition[] = [
  {
    id: "pos-vault",
    eventId: "vault-pool",
    address: "0x7a31c8e14b0d9f6a2c55e81d4b90aa1100c0ff21",
    symbol: "VAULT",
    name: "Night Vault",
    amount: 420_000,
    lock: "30",
    claimable: 1_840,
    started: STAKING_NOW - 12 * DAY,
  },
  {
    id: "pos-harbor",
    eventId: "harbor-pool",
    address: "0x90de44aa771100cc2288bb9012ff33c1aa0199c2",
    symbol: "HARBOR",
    name: "Harbor",
    amount: 180_000,
    lock: "90",
    claimable: 620,
    started: STAKING_NOW - 28 * DAY,
  },
  {
    id: "pos-thread",
    eventId: "thread-pool",
    address: "0x12ab90ff33c1d8e774aa0199bb221100de44a901",
    symbol: "THREAD",
    name: "Gold Thread",
    amount: 95_000,
    lock: "flex",
    claimable: 210,
    started: STAKING_NOW - 4 * DAY,
  },
  {
    id: "pos-vault-flex",
    eventId: "vault-pool",
    address: "0x7a31c8e14b0d9f6a2c55e81d4b90aa1100c0ff21",
    symbol: "VAULT",
    name: "Night Vault",
    amount: 62_000,
    lock: "flex",
    claimable: 96,
    started: STAKING_NOW - 2 * DAY,
  },
  {
    id: "pos-lantern",
    eventId: "lantern-pool",
    address: "0x55e81d4b90aa1100c0ff217a31c8e14b0d9f6a2c",
    symbol: "LANTERN",
    name: "Lantern",
    amount: 240_000,
    lock: "30",
    claimable: 880,
    started: STAKING_NOW - 9 * DAY,
  },
  {
    id: "pos-harbor-30",
    eventId: "harbor-pool",
    address: "0x90de44aa771100cc2288bb9012ff33c1aa0199c2",
    symbol: "HARBOR",
    name: "Harbor",
    amount: 74_000,
    lock: "30",
    claimable: 310,
    started: STAKING_NOW - 6 * DAY,
  },
  {
    id: "pos-thread-90",
    eventId: "thread-pool",
    address: "0x12ab90ff33c1d8e774aa0199bb221100de44a901",
    symbol: "THREAD",
    name: "Gold Thread",
    amount: 128_000,
    lock: "90",
    claimable: 540,
    started: STAKING_NOW - 18 * DAY,
  },
  {
    id: "pos-key",
    eventId: "key-pool",
    address: "0x00117b6Daa10AfBe91c02d4418c77e90aa1100c0",
    symbol: "KEY",
    name: "Keystone",
    amount: 310_000,
    lock: "flex",
    claimable: 420,
    started: STAKING_NOW - 7 * DAY,
  },
  {
    id: "pos-ember",
    eventId: "ember-pool",
    address: "0x19bb221100de44a90112ab90ff33c1aa0199bb22",
    symbol: "EMBER",
    name: "Ember",
    amount: 88_000,
    lock: "30",
    claimable: 160,
    started: STAKING_NOW - 3 * DAY,
  },
  {
    id: "pos-rift",
    eventId: "rift-pool",
    address: "0x7712bb09331100aa77c144c01aa98e7712bb0933",
    symbol: "RIFT",
    name: "Rift",
    amount: 156_000,
    lock: "90",
    claimable: 720,
    started: STAKING_NOW - 21 * DAY,
  },
  {
    id: "pos-signal",
    eventId: "signal-pool",
    address: "0x44c01aa98e7712bb09331100aa77c1de44c01aa9",
    symbol: "SIGNAL",
    name: "Signal",
    amount: 52_000,
    lock: "flex",
    claimable: 84,
    started: STAKING_NOW - 1 * DAY,
  },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatStakingDate(ms: number) {
  const date = new Date(ms);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

export function formatStakingTokens(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    const scaled = abs / 1_000_000;
    return `${scaled >= 10 ? scaled.toFixed(1) : scaled.toFixed(2)}M`;
  }
  if (abs >= 10_000) return `${Math.round(abs / 1000)}K`;
  return Math.round(abs).toLocaleString("en-US");
}

export function eventAprRange(event: StakingEvent) {
  const rates = STAKING_LOCK_OPTIONS.filter((item) => event.locks.includes(item.id)).map((item) => item.rate);
  if (rates.length === 0) return "—";
  const min = Math.min(...rates);
  const max = Math.max(...rates);
  return min === max ? `${min}%` : `${min}–${max}%`;
}

export function lockLabel(id: StakingLockId) {
  return STAKING_LOCK_OPTIONS.find((item) => item.id === id)?.label ?? id;
}

export function lockRate(id: StakingLockId) {
  return STAKING_LOCK_OPTIONS.find((item) => item.id === id)?.rate ?? 0;
}
