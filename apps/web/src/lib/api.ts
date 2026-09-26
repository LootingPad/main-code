import type {
  AnalyticsPayload,
  FeesConfig,
  Holder,
  Launch,
  LaunchWithStats,
  LeaderboardRow,
  LuckyBox,
  RewardTable,
  StakingEvent,
  StakingHistoryRow,
  StakingPosition,
  TokenTrade,
  WalletProfile,
  WalletTrade,
  DevLock,
} from "./types";

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message?: string) {
    super(message ?? code);
    this.status = status;
    this.code = code;
  }
}

function apiBase() {
  // Browser: hit Next rewrite `/backend-api/*` → Fastify (avoids CORS).
  if (typeof window !== "undefined") {
    return "/backend-api";
  }
  // Server components / RSC: call Fastify directly.
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:8080";
  return raw.replace(/\/$/, "");
}

/** Direct Fastify origin for SSE (Next rewrite can buffer streams). */
export function exploreStreamUrl() {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:8080";
  return `${raw.replace(/\/$/, "")}/api/explore/stream`;
}

type Query = Record<string, string | number | boolean | undefined | null>;

function withQuery(path: string, query?: Query) {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${apiBase()}${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "NETWORK", `Could not reach API at ${apiBase()}`);
  }

  const body = (await response.json().catch(() => ({}))) as {
    data?: unknown;
    error?: string;
    message?: string;
    [key: string]: unknown;
  };

  if (!response.ok) {
    throw new ApiError(response.status, body.error ?? "REQUEST_FAILED", body.message);
  }

  return body as T;
}

/** Most routes return `{ data: T }`. */
async function apiGetData<T>(path: string, query?: Query): Promise<T> {
  const body = await apiFetch<{ data: T }>(withQuery(path, query));
  return body.data;
}

async function apiGetList<T>(
  path: string,
  query?: Query,
): Promise<{ data: T[]; limit?: number; offset?: number; [key: string]: unknown }> {
  return apiFetch(withQuery(path, query));
}

export async function getHealth() {
  return apiFetch<{ ok: boolean; chainId: number }>("/health");
}

export async function getFees() {
  return apiGetData<FeesConfig>("/api/fees");
}

export async function getLaunches(opts?: {
  limit?: number;
  offset?: number;
  status?: string;
  stage?: "new" | "almost" | "migrate" | "all";
}) {
  const res = await apiGetList<LaunchWithStats>("/api/launches", opts);
  return res.data ?? [];
}

export async function getLaunch(token: string) {
  return apiGetData<LaunchWithStats>(`/api/launches/${encodeURIComponent(token)}`);
}

export async function getLaunchTrades(token: string, opts?: { limit?: number; offset?: number }) {
  const res = await apiGetList<TokenTrade>(`/api/launches/${encodeURIComponent(token)}/trades`, opts);
  return res.data ?? [];
}

export async function getLaunchHolders(token: string) {
  return apiGetData<Holder[]>(`/api/launches/${encodeURIComponent(token)}/holders`);
}

export async function getCreatorLaunches(address: string) {
  return apiGetData<LaunchWithStats[]>(`/api/creator/${encodeURIComponent(address)}/launches`);
}

export async function getLeaderboard(opts?: { limit?: number; offset?: number; wallet?: string }) {
  const res = await apiFetch<{
    seasonId: string | null;
    data: LeaderboardRow[];
    you: LeaderboardRow | null;
    limit: number;
    offset: number;
  }>(withQuery("/api/leaderboard/current", opts));
  return res;
}

export async function getWallet(address: string) {
  return apiGetData<WalletProfile>(`/api/wallet/${encodeURIComponent(address)}`);
}

export async function getWalletLuckyBoxes(address: string) {
  return apiGetData<LuckyBox[]>(`/api/wallet/${encodeURIComponent(address)}/lucky-boxes`);
}

export async function getWalletStakingPositions(address: string) {
  return apiGetData<StakingPosition[]>(`/api/wallet/${encodeURIComponent(address)}/staking-positions`);
}

export async function getWalletStakingHistory(address: string, opts?: { limit?: number; offset?: number }) {
  const res = await apiGetList<StakingHistoryRow>(
    `/api/wallet/${encodeURIComponent(address)}/staking-history`,
    opts,
  );
  return res.data ?? [];
}

export async function getWalletDevLocks(address: string) {
  return apiGetData<DevLock[]>(`/api/wallet/${encodeURIComponent(address)}/dev-locks`);
}

export async function getWalletTrades(address: string, opts?: { limit?: number; offset?: number }) {
  const res = await apiGetList<WalletTrade>(`/api/wallet/${encodeURIComponent(address)}/trades`, opts);
  return res.data ?? [];
}

export async function getStakingEvents(opts?: { limit?: number; offset?: number; token?: string }) {
  const res = await apiGetList<StakingEvent>("/api/staking/events", opts);
  return res.data ?? [];
}

export async function getStakingConfig() {
  return apiGetData<{ locks: FeesConfig["stakingLocks"] }>("/api/staking/config");
}

export async function getRewardTable() {
  return apiGetData<RewardTable>("/api/reward-table");
}

export async function getAnalytics(window: "24h" | "all" = "24h") {
  return apiGetData<AnalyticsPayload>("/api/analytics", { window });
}

export async function getSeasonCurrent() {
  return apiGetData<{
    seasonId: string;
    startsAt: string;
    endsAt: string;
    status: string;
    configHash: string | null;
    thresholds: unknown;
  }>("/api/seasons/current");
}

export async function openLuckyBox(boxId: string, wallet?: string) {
  return apiFetch<{ data: LuckyBox; reward?: string; digest?: string; tableId?: string }>(
    `/api/lucky-boxes/${encodeURIComponent(boxId)}/open`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(wallet ? { wallet } : {}),
    },
  );
}

/** Draft / preview helper when API has no row yet. */
export function draftLaunch(partial: Partial<Launch> & { address: string }): Launch {
  return {
    address: partial.address,
    name: partial.name || "Untitled",
    symbol: (partial.symbol || "NEW").toUpperCase(),
    description: partial.description || "Draft coin. Not launched yet.",
    creator: partial.creator || "0x0000000000000000000000000000000000000000",
    marketCap: partial.marketCap ?? 0,
    progress: partial.progress ?? 0,
    change1h: partial.change1h ?? 0,
    priceUsd: partial.priceUsd ?? 0.000001,
    luckyShare: partial.luckyShare ?? 20,
    creatorTax: partial.creatorTax ?? 1,
    phase: partial.phase ?? "curve",
    draft: true,
  };
}

export function emptyStats(): LaunchWithStats["stats"] {
  return {
    age: "0m",
    txns: 0,
    volume24h: 0,
    traders: 0,
    change6h: 0,
    change24h: 0,
    ath: 0,
    boxUsd: 0,
  };
}
