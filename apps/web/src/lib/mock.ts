/**
 * Legacy barrel — formatters + types only.
 * Seed arrays removed; pages load from `@/lib/api`.
 * `/looting` still uses `@/lib/looting-token` mock.
 */
export type { BoxStatus, Launch, LuckyBox, MarketStats } from "./types";
export { formatCount, formatPrice, formatUsd, shortAddress, tokenColor } from "./format";
