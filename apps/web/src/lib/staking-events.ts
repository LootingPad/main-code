import type { StakingEvent, StakingHistoryKind, StakingHistoryRow, StakingLockId, StakingPosition } from "./types";

export type { StakingEvent, StakingHistoryKind, StakingHistoryRow, StakingLockId, StakingPosition };

export const DAY = 24 * 60 * 60 * 1000;

/** Fallback lock options until `/api/fees` or `/api/staking/config` loads. */
export const STAKING_LOCK_OPTIONS = [
  { id: "flex" as const, label: "Flexible", rate: 8 },
  { id: "30" as const, label: "30 days", rate: 14 },
  { id: "90" as const, label: "90 days", rate: 22 },
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

export function eventAprRange(event: StakingEvent, locks = STAKING_LOCK_OPTIONS) {
  const rates = locks.filter((item) => event.locks.includes(item.id)).map((item) => item.rate);
  if (rates.length === 0) return "—";
  const min = Math.min(...rates);
  const max = Math.max(...rates);
  return min === max ? `${min}%` : `${min}–${max}%`;
}

export function lockLabel(id: StakingLockId, locks = STAKING_LOCK_OPTIONS) {
  return locks.find((item) => item.id === id)?.label ?? id;
}

export function lockRate(id: StakingLockId, locks = STAKING_LOCK_OPTIONS) {
  return locks.find((item) => item.id === id)?.rate ?? 0;
}
