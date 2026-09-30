/** Frontend DTO shapes aligned with backend `fe-shape.ts`. */

export type LaunchPhase = "curve" | "graduated";
export type Tier = "Gold" | "Silver" | "Bronze";
export type BoxStatus = "unopened" | "opened" | "claimed" | "holding" | "ineligible";
export type StakingLockId = "flex" | "30" | "90";
export type DevLockMode = "time" | "vest";
export type Cadence = "day" | "week" | "month";
export type TradeSide = "Buy" | "Sell";
export type StakingHistoryKind = "stake" | "claim" | "unstake";

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
  phase: LaunchPhase;
  draft?: boolean;
  locked?: boolean;
  socialUpdated?: boolean;
  dexBoost?: number;
  /** Token image (http/ipfs gateway). */
  logoUrl?: string;
  /** ISO launch time — used to sort New Pair (age labels alone are lossy). */
  launchedAt?: string;
  /** Real price series for Explore sparkline. */
  sparkline?: number[];
};

export type MarketStats = {
  age: string;
  txns: number;
  volume24h: number;
  traders: number;
  change6h: number;
  change24h: number;
  ath: number;
  boxUsd: number;
  holders: number;
  bundlers: number;
  /** On-chain creator tax paid (quote ETH), when known from CurveBuy/Sell. */
  creatorTaxPaidEth?: number;
  /** Live RewardRouter creator claimable ETH. */
  creatorClaimableEth?: number;
  /** Live RewardRouter lucky-box pool claimable ETH. */
  luckyBoxClaimableEth?: number;
};

export type LaunchWithStats = Launch & { stats: MarketStats };

export type LeaderboardRow = {
  wallet: string;
  tier: Tier;
  xp: number;
  /** Boxes opened on the rewards leaderboard. */
  trades: number;
  rewards: string;
  boxesOpened?: number;
  rewardsWon?: number;
  ethWon?: string;
};

export type LuckyBox = {
  id: string;
  /** Launch token address (preferred) or legacy ticker. */
  token: string;
  /** Ticker for display when `token` is an address. */
  symbol?: string;
  status: BoxStatus;
  /** Sealed-table outcome label. */
  reward?: string;
  creditedWei?: string;
  /** Rolled ETH budget from the launch box pool. */
  payoutEth?: string;
  /** USD value of the ETH budget. */
  payoutUsd?: number;
  /** Live lucky-box pool for this launch (ETH). */
  boxPoolEth?: number;
  /** Live lucky-box pool for this launch (USD). */
  boxPoolUsd?: number;
  /** Token amount received (ETH or ERC-20 after swap). */
  prizeAmount?: number;
  prizeSymbol?: string;
  prizeKind?: "miss" | "eth" | "erc20";
  prizeToken?: string | null;
  claimableOnChain?: boolean;
  tx?: string;
  claimedAt?: string;
};

export type WalletProfile = LeaderboardRow & {
  seasonXp: number;
  lifetimeXp: number;
  lifetimeTradeCount: number;
  lifetimeBoxCount: number;
  luckyBoxesAvailable: number;
  rank: number | null;
  seasonId: string | null;
};

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

export type StakingHistoryRow = {
  id: string;
  eventId: string;
  address: string;
  symbol: string;
  name: string;
  kind: StakingHistoryKind;
  lock: StakingLockId;
  amount: number;
  reward: number;
  at: number;
  txHash?: string;
};

export type DevLock = {
  id: string;
  address: string;
  symbol: string;
  name: string;
  mode: DevLockMode;
  amount: number;
  claimed: number;
  start: number;
  cliff: number;
  unlock: number;
  cadence: Cadence;
  claimable?: number;
};

export type TokenTrade = {
  id: string;
  side: TradeSide;
  address: string;
  amount: number;
  eth: number;
  time: string;
  timestamp: string;
  usd?: number;
  txHash?: string;
};

export type WalletTrade = {
  id: string;
  side: TradeSide;
  amount: number;
  eth: number;
  xp: number;
  time: string;
  timestamp: string;
  launch: Launch;
  txHash?: string;
};

export type Holder = {
  rank: number;
  address: string;
  amount: number;
  share: number;
  entry: number;
  /** Avg entry in quote (ETH) per token — multiply by ETH_USD for USD entry. */
  entryQuote?: number;
};

export type FeesConfig = {
  DEV_LOCK_FEE_ETH: number;
  CREATE_STAKING_FEE_ETH: number;
  CREATOR_FEE_SHARE: number;
  PROTOCOL_BURN_SHARE: number;
  ETH_USD: number;
  LOOTING_PRICE_USD: number;
  TRADE_FEE_USD: number;
  stakingLocks: Array<{ id: StakingLockId; label: string; rate: number }>;
};

export type RewardTableOutcome = {
  label: string;
  weight: number;
  kind?: "miss" | "eth" | "erc20";
  prizeToken?: string;
  minShareBps?: number;
  maxShareBps?: number;
};

export type RewardTable = {
  id: string;
  name: string;
  seasonId: string | null;
  active: boolean;
  rewardPool: string[];
  config: unknown;
  outcomes?: RewardTableOutcome[];
};

export type AnalyticsPayload = {
  ethUsd: number;
  window: "24h" | "all";
  summary: {
    volume: number;
    launches: number;
    traders: number;
    txns: number;
    volumeDeltaPct: number;
    launchDeltaPct: number;
  };
  fees: {
    feeUsd: number;
    boxUsd: number;
    creatorUsd: number;
    boxSharePct: number;
    topCreators: Array<{ symbol: string; address: string; creatorUsd: number }>;
    topBoxes: Array<{ symbol: string; address: string; boxUsd: number }>;
    topCurves: Array<{ symbol: string; address: string; progress: number }>;
  };
  season: {
    seasonId: string | null;
    xp: number;
    trades: number;
    graduated: number;
    creators: number;
  };
  staking: {
    vaultCount: number;
    staked: number;
    rewards: number;
    stakers: number;
    byLock: Array<{ id: StakingLockId; label: string; rate: number; staked: number; day: number }>;
    topVaults: Array<{
      id: string;
      symbol: string;
      name: string;
      staked: number;
      reward: number;
      stakers: number;
      apr?: string;
    }>;
  };
  devLock: {
    locks: number;
    locksDay: number;
    timeLocks: number;
    vestLocks: number;
    tokensLocked: number;
    tokensLockedDay: number;
    claimed: number;
    claimedDay: number;
    feeEth: number;
    feeEthDay: number;
    creators: number;
    top: Array<{
      id: string;
      symbol: string;
      name: string;
      amount: number;
      mode: DevLockMode;
    }>;
  };
  series: {
    days: string[];
    volume: number[];
    launches: number[];
    staking: number[];
    devlock: number[];
  };
};
