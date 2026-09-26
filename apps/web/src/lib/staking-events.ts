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
    durationDays: 365,
    locks: ["30", "90"],
    ends: STAKING_NOW + 280 * DAY,
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
