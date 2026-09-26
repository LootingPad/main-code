import type { Launch } from "./types";

/** Defaults match backend `FE_FEES` until `/api/fees` is loaded. */
export const DEV_LOCK_FEE_ETH = 0.003;
export const CREATE_STAKING_FEE_ETH = 0.003;
export const CREATOR_FEE_SHARE = 0.8;
export const PROTOCOL_BURN_SHARE = 0.2;
export const ETH_USD = 3500;
export const LOOTING_PRICE_USD = 0.0024;

export function feeAccrualWeight(launch: Launch) {
  return 0.35 + launch.progress / 200;
}

export function accruedFeeUsd(launch: Launch) {
  return launch.marketCap * (launch.creatorTax / 100) * feeAccrualWeight(launch);
}

export function splitCreatorFeeUsd(feeUsd: number) {
  const protocolBurnUsd = feeUsd * PROTOCOL_BURN_SHARE;
  const creatorUsd = feeUsd * CREATOR_FEE_SHARE;
  return { feeUsd, creatorUsd, protocolBurnUsd };
}

export function splitLaunchFees(launch: Launch) {
  return splitCreatorFeeUsd(accruedFeeUsd(launch));
}

export function lootingTokensFromUsd(usd: number, priceUsd = LOOTING_PRICE_USD) {
  if (usd <= 0 || priceUsd <= 0) return 0;
  return usd / priceUsd;
}

export function formatLootingBurn(usd: number, priceUsd = LOOTING_PRICE_USD) {
  const tokens = lootingTokensFromUsd(usd, priceUsd);
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(2)}M LOOTING`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k LOOTING`;
  return `${Math.round(tokens).toLocaleString()} LOOTING`;
}
