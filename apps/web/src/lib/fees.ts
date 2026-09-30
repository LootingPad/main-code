import type { Launch } from "./types";

/**
 * Protocol fee constants (not market quotes).
 * ETH_USD / LOOTING_PRICE_USD stay 0 until `/api/fees` returns a live spot.
 */
export const DEV_LOCK_FEE_ETH = 0.003;
export const CREATE_STAKING_FEE_ETH = 0.003;
export const CREATOR_FEE_SHARE = 0.8;
export const PROTOCOL_BURN_SHARE = 0.2;
/** Unknown until `/api/fees` loads a live spot — never invent $3500. */
export const ETH_USD = 0;
/** $LOOTING CA not published — stay 0. */
export const LOOTING_PRICE_USD = 0;
/** Flat platform fee on every buy and sell. */
export const TRADE_FEE_USD = 0.056;

/**
 * Split on-chain creator tax (already paid to creatorFeeRecipient) by luckyShare.
 * Do not apply the 80/20 burn overlay here — event `tax` is the real payout.
 */
export function feePoolsFromTaxEth(taxPaidEth: number, luckySharePercent: number) {
  const accrued = Math.max(0, taxPaidEth);
  const lucky = Math.min(100, Math.max(0, luckySharePercent)) / 100;
  return {
    accruedEth: accrued,
    creatorEth: accrued * (1 - lucky),
    poolEth: accrued * lucky,
  };
}

/**
 * Real creator-tax accrual from traded quote volume.
 * Returns zeros when volume is unknown — never invent from market-cap × progress.
 */
export function feePoolsFromVolumeUsd(
  volumeUsd: number,
  creatorTaxPercent: number,
  luckySharePercent: number,
  creatorFeeShare = CREATOR_FEE_SHARE,
) {
  const tax = Math.max(0, creatorTaxPercent) / 100;
  const accruedUsd = Math.max(0, volumeUsd) * tax;
  const share = Math.min(1, Math.max(0, creatorFeeShare));
  const creatorSideUsd = accruedUsd * share;
  const lucky = Math.min(100, Math.max(0, luckySharePercent)) / 100;
  return {
    accruedUsd,
    burnUsd: accruedUsd * (1 - share),
    creatorUsd: creatorSideUsd * (1 - lucky),
    poolUsd: creatorSideUsd * lucky,
  };
}

/**
 * Lucky Box accrual for a launch row — volume×tax only.
 */
export function luckyBoxUsd(
  _mcapUsd: number,
  creatorTaxPercent: number,
  _progress: number,
  volumeUsd = 0,
  luckySharePercent = 0,
) {
  if (!(volumeUsd > 0) || !(creatorTaxPercent > 0)) return 0;
  return feePoolsFromVolumeUsd(volumeUsd, creatorTaxPercent, luckySharePercent).poolUsd;
}

export function splitCreatorFeeUsd(feeUsd: number) {
  const protocolBurnUsd = feeUsd * PROTOCOL_BURN_SHARE;
  const creatorUsd = feeUsd * CREATOR_FEE_SHARE;
  return { feeUsd, creatorUsd, protocolBurnUsd };
}

export function splitLaunchFees(launch: Launch, volumeUsd = 0) {
  if (!(volumeUsd > 0)) {
    return { feeUsd: 0, creatorUsd: 0, protocolBurnUsd: 0, poolUsd: 0 };
  }
  const pools = feePoolsFromVolumeUsd(volumeUsd, launch.creatorTax, launch.luckyShare);
  return {
    feeUsd: pools.accruedUsd,
    creatorUsd: pools.creatorUsd,
    protocolBurnUsd: pools.burnUsd,
    poolUsd: pools.poolUsd,
  };
}

export function lootingTokensFromUsd(usd: number, priceUsd = LOOTING_PRICE_USD) {
  if (usd <= 0 || priceUsd <= 0) return 0;
  return usd / priceUsd;
}

export function formatLootingBurn(usd: number, priceUsd = LOOTING_PRICE_USD) {
  const tokens = lootingTokensFromUsd(usd, priceUsd);
  if (tokens <= 0) return "—";
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(2)}M LOOTING`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k LOOTING`;
  return `${Math.round(tokens).toLocaleString()} LOOTING`;
}
