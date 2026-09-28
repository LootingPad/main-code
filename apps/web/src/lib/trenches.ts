import { ETH_USD, luckyBoxUsd } from "./fees";
import type { Holder, LaunchWithStats, TokenTrade } from "./types";

const ZERO = "0x0000000000000000000000000000000000000000";

export type TrenchPhase = "new" | "almost migrated" | "migrated";

export type TrenchPair = {
  token: string;
  name: string;
  symbol: string;
  decimals?: number;
  totalSupply?: string;
  logo: string;
  description: string;
  socials?: {
    twitter: string;
    telegram: string;
    discord: string;
    website: string;
    farcaster: string;
  };
  deployer: string;
  pairToken: string;
  creatorTaxBps: number;
  taxPercent: number;
  mcap: string;
  athMcap: string;
  txns: number;
  volume: string;
  bundlers: number;
  holders: number;
  bondingPercentage: number;
  quoteDecimals: number;
  phase: string;
  launchedAt: string;
};

export type TrenchCandle = { t: number; o: number; h: number; l: number; c: number; v: number };
export type TrenchTick = { t: number; p: number; v: number };

export type TrenchTokenDetail = {
  pair: TrenchPair;
  holders: { address: string; amount: string; share: number }[];
  trades: { id: string; side: "buy" | "sell"; wallet: string; tokens: string; quote: string; blockNumber: string; time?: number }[];
  candles?: TrenchCandle[];
  ticks?: TrenchTick[];
};

export type TrenchSnapshot = {
  type: "snapshot";
  phases: Record<TrenchPhase, TrenchPair[]>;
};

export type TrenchUpdate = {
  type: "pair";
  phase: TrenchPhase;
  from?: TrenchPhase;
  pair: TrenchPair;
};

function httpBase() {
  if (typeof window !== "undefined") return "/backend-api";
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:8080";
  return raw.replace(/\/$/, "");
}

async function readJson<T>(url: string, timeoutMs: number): Promise<T | null> {
  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function getTrenchToken(token: string): Promise<TrenchTokenDetail | null> {
  return readJson<TrenchTokenDetail>(`${httpBase()}/trenches/token/${token}`, 8_000);
}

export function trenchImageUrl(token: string) {
  return `${httpBase()}/trenches/image/${token}`;
}

/** Chain numbers for the rows on the current page only. */
export async function getVisibleTrenchPairs(tokens: string[]): Promise<TrenchPair[]> {
  if (tokens.length === 0) return [];
  const body = await readJson<{ pairs?: TrenchPair[] }>(
    `${httpBase()}/trenches/live?tokens=${tokens.join(",")}`,
    8_000,
  );
  return body?.pairs ?? [];
}

export function trenchesSocketUrl() {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:8080";
  const base = raw.replace(/\/$/, "").replace(/^http/, "ws");
  return `${base}/trenches?limit=50`;
}

function quoteToUsd(amount: string, pairToken: string) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return 0;
  if (pairToken.toLowerCase() === ZERO) return value * ETH_USD;
  return value;
}

function tradeClock(ms: number) {
  const date = new Date(ms);
  if (!Number.isFinite(date.getTime())) return "";
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  if (sameDay) return `${hh}:${mm}:${ss}`;
  return `${date.getMonth() + 1}/${date.getDate()} ${hh}:${mm}`;
}

function ageLabel(iso: string) {
  const ms = Date.now() - Date.parse(iso);
  const sec = Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 1000)) : 0;
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hours = Math.floor(min / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function trenchToLaunch(pair: TrenchPair): LaunchWithStats {
  const marketCap = quoteToUsd(pair.mcap, pair.pairToken);
  const ath = quoteToUsd(pair.athMcap, pair.pairToken);
  const volume = quoteToUsd(pair.volume, pair.pairToken);
  const decimals = pair.decimals ?? 18;
  const supply = Number(pair.totalSupply ?? "0") / 10 ** decimals;
  const unit = supply > 0 ? Number(pair.mcap) / supply : 0;
  const priceUsd = pair.pairToken.toLowerCase() === ZERO ? unit * ETH_USD : unit;
  const progress = pair.phase === "PoolCreated" || pair.phase === "Swept" ? 100 : pair.bondingPercentage;
  const creatorTax = pair.creatorTaxBps / 100;
  const graduated = progress >= 100;
  return {
    address: pair.token,
    name: pair.name,
    symbol: pair.symbol,
    description: pair.description,
    creator: pair.deployer,
    marketCap,
    progress,
    change1h: 0,
    priceUsd,
    luckyShare: creatorTax > 0 ? Math.min(100, (0.5 / creatorTax) * 100) : 0,
    creatorTax,
    phase: graduated ? "graduated" : "curve",
    logoUrl: pair.logo || undefined,
    stats: {
      age: ageLabel(pair.launchedAt),
      txns: pair.txns,
      volume24h: volume,
      traders: pair.holders,
      change6h: 0,
      change24h: 0,
      ath: Math.max(ath, marketCap),
      boxUsd: luckyBoxUsd(marketCap, creatorTax, progress),
      holders: pair.holders,
      bundlers: pair.bundlers,
    },
  };
}

export function trenchHolders(rows: TrenchTokenDetail["holders"]): Holder[] {
  return rows.map((row, index) => ({
    rank: index + 1,
    address: row.address,
    amount: Number(row.amount) || 0,
    share: row.share,
    entry: 0,
  }));
}

export function trenchTrades(rows: TrenchTokenDetail["trades"]): TokenTrade[] {
  return rows.map((row) => ({
    id: row.id,
    side: row.side === "buy" ? "Buy" : "Sell",
    address: row.wallet,
    amount: Number(row.tokens) || 0,
    eth: Number(row.quote) || 0,
    time: row.time ? tradeClock(row.time) : `#${row.blockNumber}`,
    timestamp: row.time ? String(row.time) : row.blockNumber,
  }));
}

/** Market-cap prints. `p` is USD market cap, `v` is USD volume. */
export function trenchTicks(detail: TrenchTokenDetail): TrenchTick[] {
  const decimals = detail.pair.decimals ?? 18;
  const supply = Number(detail.pair.totalSupply ?? "0") / 10 ** decimals;
  return (detail.ticks ?? []).flatMap((tick) => {
    const price = quoteToUsd(String(tick.p), detail.pair.pairToken);
    const mcap = supply > 0 ? price * supply : price;
    if (!(mcap > 0)) return [];
    return [{ t: tick.t, p: mcap, v: quoteToUsd(String(tick.v), detail.pair.pairToken) }];
  });
}

export function trenchCandles(detail: TrenchTokenDetail): TrenchCandle[] {
  return (detail.candles ?? []).map((candle) => ({
    t: candle.t,
    o: quoteToUsd(String(candle.o), detail.pair.pairToken),
    h: quoteToUsd(String(candle.h), detail.pair.pairToken),
    l: quoteToUsd(String(candle.l), detail.pair.pairToken),
    c: quoteToUsd(String(candle.c), detail.pair.pairToken),
    v: quoteToUsd(String(candle.v), detail.pair.pairToken),
  }));
}

export function trenchPairLabel(pairToken: string) {
  if (pairToken.toLowerCase() === ZERO) return "ETH";
  return `${pairToken.slice(0, 6)}…${pairToken.slice(-4)}`;
}
