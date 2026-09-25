import type { Launch } from "./mock";

/** Fixed split of accrued creator tax. */
export const CREATOR_FEE_SHARE = 0.8;
export const PROTOCOL_BURN_SHARE = 0.2;

/** Mock $LOOTING price for burn amount display (USD per token). */
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

export function lootingTokensFromUsd(usd: number) {
  if (usd <= 0 || LOOTING_PRICE_USD <= 0) return 0;
  return usd / LOOTING_PRICE_USD;
}

export function formatLootingBurn(usd: number) {
  const tokens = lootingTokensFromUsd(usd);
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(2)}M LOOTING`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k LOOTING`;
  return `${Math.round(tokens).toLocaleString()} LOOTING`;
}
