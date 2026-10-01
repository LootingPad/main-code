"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useAppKitNetwork, useAppKitProvider } from "@reown/appkit/react";
import {
  ApiError,
  claimCreatorFee,
  emptyStats,
  getFees,
  getLaunchHolders,
  getLaunchTrades,
  getWalletLuckyBoxes,
  prepareTrade,
  confirmTrade,
} from "@/lib/api";
import { robinhoodChain } from "@/lib/chains";
import { DRAFT_KEY } from "@/lib/draft";
import { feePoolsFromTaxEth, feePoolsFromVolumeUsd, TRADE_FEE_USD } from "@/lib/fees";
import { PageFlash, PageInfo } from "@/components/PageInfo";
import { formatPrice, formatUsd, shortAddress } from "@/lib/format";
import { PONS_LAUNCH_WINDOW } from "@/lib/launch-window";
import { getTrenchToken, setTrenchEthUsd, trenchHolders, trenchTicks, trenchToLaunch, trenchTrades, avgEntryFromTrades, type TrenchTick } from "@/lib/trenches";
import type { Holder, Launch, LaunchWithStats, LuckyBox, MarketStats, TokenTrade } from "@/lib/types";
import { useAsyncData } from "@/lib/use-async-data";
import { GiftIcon, WalletIcon } from "./Icons";
import { Pager } from "./Pager";
import { SlidingTabs } from "./SlidingTabs";
import { CandleChart } from "./CandleChart";
import { TokenLogo } from "./TokenLogo";
import { useWallet } from "./Wallet";
import { createPublicClient, formatUnits, http, type Address, type EIP1193Provider, type Hash, type Hex } from "viem";

const erc20BalanceAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
] as const;

function feeClaimKey(kind: "creator" | "pool", token: string, wallet: string) {
  return `looting-fee-claim:${kind}:${token.toLowerCase()}:${wallet.toLowerCase()}`;
}

function boxClaimable(box: LuckyBox) {
  return box.status === "unopened" || box.status === "opened";
}

function boxHolding(box: LuckyBox) {
  return box.status === "holding";
}

function boxForLaunch(box: LuckyBox, launch: { address: string; symbol: string }) {
  const key = box.token.toLowerCase();
  return (
    key === launch.address.toLowerCase() ||
    key === launch.symbol.toLowerCase() ||
    (box.symbol != null && box.symbol.toLowerCase() === launch.symbol.toLowerCase())
  );
}

function resolveStats(launch: Launch | LaunchWithStats, initialStats?: MarketStats): MarketStats {
  if (initialStats) return initialStats;
  if ("stats" in launch && launch.stats) return launch.stats;
  return emptyStats();
}

export function Terminal({
  launch: initialLaunch,
  meta,
  initialStats,
  chain = false,
  holders: seededHolders,
  trades: seededTrades,
  ticks: seededTicks,
  feePending = false,
}: {
  launch: Launch | LaunchWithStats;
  initialStats?: MarketStats;
  chain?: boolean;
  holders?: Holder[];
  trades?: TokenTrade[];
  ticks?: TrenchTick[];
  feePending?: boolean;
  meta?: {
    website?: string;
    twitter?: string;
    telegram?: string;
    discord?: string;
    farcaster?: string;
    initialBuy?: string;
    pair?: string;
    holders?: string;
    wallet?: string;
    exempt?: string;
  };
}) {
  const [shown, setShown] = useState(initialLaunch);
  const [chainHolders, setChainHolders] = useState(seededHolders ?? []);
  const [chainTrades, setChainTrades] = useState(seededTrades ?? []);
  const [ticks, setTicks] = useState(seededTicks ?? []);
  const launch = chain ? shown : initialLaunch;
  const router = useRouter();
  const { connected, address, connect } = useWallet();
  const { walletProvider } = useAppKitProvider<EIP1193Provider>("eip155");
  const { chainId, switchNetwork } = useAppKitNetwork();
  const quoteAsset = meta?.pair || "ETH";
  const stats = resolveStats(launch, chain ? ("stats" in shown ? shown.stats : initialStats) : initialStats);
  const { data: fees } = useAsyncData(() => getFees(), [], {
    initial: null as Awaited<ReturnType<typeof getFees>> | null,
  });
  const ethUsd = fees?.ETH_USD && fees.ETH_USD > 0 ? fees.ETH_USD : 0;
  const tradeFeeUsd = fees?.TRADE_FEE_USD ?? TRADE_FEE_USD;
  useEffect(() => {
    if (ethUsd > 0) setTrenchEthUsd(ethUsd);
  }, [ethUsd]);
  const { data: remoteHolders, reload: reloadHolders } = useAsyncData(
    () => getLaunchHolders(launch.address),
    [launch.address],
    { initial: [] as Holder[], enabled: !launch.draft && !chain },
  );
  const { data: remoteTrades, reload: reloadTrades } = useAsyncData(
    () => getLaunchTrades(launch.address, { limit: 50 }),
    [launch.address],
    { initial: [] as TokenTrade[], enabled: !launch.draft && !chain },
  );
  const { data: myBoxes, reload: reloadBoxes } = useAsyncData(() => getWalletLuckyBoxes(address), [address], {
    initial: [] as LuckyBox[],
    enabled: connected,
    pollMs: 15_000,
  });
  const holders = chain ? chainHolders : remoteHolders;
  const trades = chain ? chainTrades : remoteTrades;
  // After a full exit, trench fills can lag — keep the wallet out of holders briefly.
  const fullExitUntilRef = useRef<{ token: string; wallet: string; until: number } | null>(null);
  function applyHolders(next: Holder[]) {
    const exit = fullExitUntilRef.current;
    if (exit && Date.now() < exit.until) {
      return next.filter((row) => row.address.toLowerCase() !== exit.wallet);
    }
    if (exit && Date.now() >= exit.until) fullExitUntilRef.current = null;
    return next;
  }
  useEffect(() => {
    setShown(initialLaunch);
    setChainHolders(seededHolders ?? []);
    setChainTrades(seededTrades ?? []);
    setTicks(seededTicks ?? []);
    fullExitUntilRef.current = null;
  }, [initialLaunch.address]);
  useEffect(() => {
    if (!chain) return;
    let stop = false;
    let busy = false;
    const tick = async () => {
      if (busy) return;
      busy = true;
      try {
        const detail = await getTrenchToken(initialLaunch.address);
        if (!detail || stop) return;
        setShown(trenchToLaunch(detail.pair));
        const nextTicks = trenchTicks(detail);
        if (nextTicks.length > 0) setTicks(nextTicks);
        if (detail.holders) setChainHolders(applyHolders(trenchHolders(detail.holders)));
        if (detail.trades.length > 0) setChainTrades(trenchTrades(detail.trades));
      } catch {
        /* keep the last chain snapshot */
      } finally {
        busy = false;
      }
    };
    void tick();
    const id = window.setInterval(tick, 2000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [chain, initialLaunch.address]);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [dockOpen, setDockOpen] = useState(false);
  const [slippage, setSlippage] = useState("10");
  const [gwei, setGwei] = useState("30.05");
  const [setup, setSetup] = useState<"slip" | "gwei" | "tpsl" | null>(null);
  const [orderMode, setOrderMode] = useState<"instant" | "market" | "limit">("instant");
  const [priority, setPriority] = useState<"P1" | "P2" | "P3">("P1");
  const [autoSlip, setAutoSlip] = useState(true);
  const [mevOn, setMevOn] = useState(true);
  const [tp, setTp] = useState("");
  const [sl, setSl] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [amount, setAmount] = useState(meta?.initialBuy || "0.1");
  const [trading, setTrading] = useState(false);
  const [tradeError, setTradeError] = useState("");
  // Live ERC-20 balance for the connected wallet — holders-from-fills can lag / mis-order.
  const [walletTokenBal, setWalletTokenBal] = useState<number | null>(null);
  useEffect(() => {
    if (!connected || !address || launch.draft) {
      setWalletTokenBal(null);
      return;
    }
    let stop = false;
    const rpc = robinhoodChain.rpcUrls.default.http[0];
    const reader = createPublicClient({ chain: robinhoodChain, transport: http(rpc) });
    const pull = async () => {
      try {
        const [raw, decimals] = await Promise.all([
          reader.readContract({
            address: launch.address as Address,
            abi: erc20BalanceAbi,
            functionName: "balanceOf",
            args: [address as Address],
          }),
          reader.readContract({
            address: launch.address as Address,
            abi: erc20BalanceAbi,
            functionName: "decimals",
          }),
        ]);
        if (stop) return;
        const next = Number(formatUnits(raw, decimals));
        setWalletTokenBal(Number.isFinite(next) ? next : 0);
        const walletLc = address.toLowerCase();
        const dust = !(next > 0) || (launch.priceUsd > 0 && next * launch.priceUsd < 0.01);
        if (dust) {
          // Strip ghost holder rows when chain says we exited.
          fullExitUntilRef.current = {
            token: launch.address.toLowerCase(),
            wallet: walletLc,
            until: Date.now() + 30_000,
          };
          if (chain) {
            setChainHolders((prev) =>
              prev.some((row) => row.address.toLowerCase() === walletLc)
                ? prev.filter((row) => row.address.toLowerCase() !== walletLc)
                : prev,
            );
          }
        } else if (fullExitUntilRef.current?.wallet === walletLc) {
          fullExitUntilRef.current = null;
        }
      } catch {
        /* keep last known balance */
      }
    };
    void pull();
    const id = window.setInterval(pull, 4_000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [connected, address, launch.address, launch.draft, launch.priceUsd, chain]);
  const [photo, setPhoto] = useState("");
  const [dataTab, setDataTab] = useState<"holders" | "tx">("holders");
  const [page, setPage] = useState(1);
  const [caCopied, setCaCopied] = useState(false);
  const mineFromHolders = connected
    ? holders.find((row) => row.address.toLowerCase() === address.toLowerCase())
    : undefined;
  const liveAmount =
    walletTokenBal != null && Number.isFinite(walletTokenBal) ? walletTokenBal : mineFromHolders?.amount ?? 0;
  const entryFromQuote =
    mineFromHolders?.entryQuote != null && mineFromHolders.entryQuote > 0 && ethUsd > 0
      ? mineFromHolders.entryQuote * ethUsd
      : 0;
  const entryFromTrades = connected ? avgEntryFromTrades(trades, address, ethUsd) : 0;
  const myEntry =
    (mineFromHolders?.entry && mineFromHolders.entry > 0 ? mineFromHolders.entry : 0) ||
    entryFromQuote ||
    entryFromTrades ||
    0;
  const mine =
    connected && liveAmount > 0
      ? {
          rank: mineFromHolders?.rank ?? 0,
          address,
          amount: liveAmount,
          share: mineFromHolders?.share ?? 0,
          entry: myEntry,
        }
      : undefined;
  const balance = mine?.amount ?? 0;
  // Hide open-position after full exit / dust leftover from rounding.
  const positionOpen =
    Boolean(mine) && balance > 0 && (launch.priceUsd <= 0 || balance * launch.priceUsd >= 0.01);
  const quote = useMemo(() => {
    if (side === "sell" && amount === "max") {
      if (!(balance > 0) || launch.priceUsd <= 0) return 0;
      const received = (balance * launch.priceUsd) / ethUsd;
      return quoteAsset === "ETH" ? Math.max(0, received - tradeFeeUsd / ethUsd) : received;
    }
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0 || launch.priceUsd <= 0) return 0;
    if (side === "buy") return (value * ethUsd) / launch.priceUsd;
    const received = (value * launch.priceUsd) / ethUsd;
    return quoteAsset === "ETH" ? Math.max(0, received - tradeFeeUsd / ethUsd) : received;
  }, [amount, balance, ethUsd, launch.priceUsd, quoteAsset, side, tradeFeeUsd]);

  const spendUsd = useMemo(() => {
    if (side === "sell" && amount === "max") {
      return balance > 0 && launch.priceUsd > 0 ? balance * launch.priceUsd : 0;
    }
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return 0;
    if (side === "buy") return quoteAsset === "ETH" ? value * ethUsd : 0;
    return launch.priceUsd > 0 ? value * launch.priceUsd : 0;
  }, [amount, balance, ethUsd, launch.priceUsd, quoteAsset, side]);

  const up = chain ? launch.marketCap >= (stats.ath || launch.marketCap) : launch.change1h >= 0;
  const creatorShare = 100 - launch.luckyShare;

  useEffect(() => {
    if (!launch.draft) return;
    try {
      const raw = window.sessionStorage.getItem(DRAFT_KEY);
      const parsed = raw ? (JSON.parse(raw) as { symbol?: string; image?: string }) : null;
      if (parsed?.symbol === launch.symbol && parsed.image) setPhoto(parsed.image);
    } catch {
      setPhoto("");
    }
  }, [launch.draft, launch.symbol]);

  const links = socials(launch, meta, chain);

  const [presets, setPresets] = useState(["0.1", "0.25", "0.5", "1"]);
  const [sellPercents, setSellPercents] = useState([25, 50, 75, 100]);
  const [presetOpen, setPresetOpen] = useState(false);
  const [presetDraft, setPresetDraft] = useState(["0.1", "0.25", "0.5", "1"]);
  const [presetError, setPresetError] = useState("");
  const presetRef = useRef<HTMLDivElement>(null);
  const creatorFeeShare = fees?.CREATOR_FEE_SHARE ?? 0.8;
  const tradesVolumeUsd = trades.reduce((sum, row) => {
    if (typeof row.usd === "number" && Number.isFinite(row.usd)) return sum + Math.abs(row.usd);
    if (Number.isFinite(row.eth) && row.eth !== 0) return sum + Math.abs(row.eth) * ethUsd;
    return sum;
  }, 0);
  // Prefer live RewardRouter claimables (including 0). Only fall back to estimates when unknown.
  const hasLiveCreator = stats.creatorClaimableEth != null;
  const hasLivePool = stats.luckyBoxClaimableEth != null;
  const liveCreatorEth = stats.creatorClaimableEth ?? 0;
  const livePoolEth = stats.luckyBoxClaimableEth ?? 0;
  const onChainTaxEth = stats.creatorTaxPaidEth ?? 0;
  const volumeUsd = Math.max(stats.volume24h || 0, tradesVolumeUsd);
  const rate = ethUsd;
  const onChainPools =
    onChainTaxEth > 0 ? feePoolsFromTaxEth(onChainTaxEth, launch.luckyShare) : null;
  const estimatePools =
    volumeUsd > 0 && rate > 0
      ? feePoolsFromVolumeUsd(volumeUsd, launch.creatorTax, launch.luckyShare, creatorFeeShare)
      : null;
  const creatorEth = hasLiveCreator
    ? liveCreatorEth
    : onChainPools
      ? onChainPools.creatorEth
      : estimatePools && rate > 0
        ? estimatePools.creatorUsd / rate
        : 0;
  const poolEth = hasLivePool
    ? livePoolEth
    : onChainPools
      ? onChainPools.poolEth
      : estimatePools && rate > 0
        ? estimatePools.poolUsd / rate
        : 0;
  const feeSource = hasLiveCreator || hasLivePool
    ? "onchain"
    : onChainPools
      ? "onchain"
      : estimatePools
        ? "volume"
        : "none";
  const creatorUsd = rate > 0 ? creatorEth * rate : 0;
  const poolUsd = rate > 0 ? poolEth * rate : 0;
  const pageSize = 10;
  const dataRows = dataTab === "holders" ? holders : trades;
  const pages = Math.max(1, Math.ceil(dataRows.length / pageSize));
  const currentPage = Math.min(page, pages);
  const pageStart = (currentPage - 1) * pageSize;
  const visibleHolders = holders.slice(pageStart, pageStart + pageSize);
  const visibleTrades = trades.slice(pageStart, pageStart + pageSize);
  const runningPnl = mine && mine.entry > 0 ? ((launch.priceUsd - mine.entry) / mine.entry) * 100 : null;
  const runningDelta = mine ? mine.amount * (launch.priceUsd - mine.entry) : null;
  const tokensFor = (percent: number) => {
    if (percent >= 100) return "max";
    const tokens = (balance * percent) / 100;
    if (!Number.isFinite(tokens) || tokens <= 0) return "0";
    if (tokens >= 100) return String(Math.round(tokens * 100) / 100);
    // Fixed decimals — never scientific notation (BE parseHuman rejects `e`).
    const fixed = tokens.toFixed(8).replace(/\.?0+$/, "");
    return fixed || "0";
  };
  const sellActive = (percent: number) => {
    if (percent >= 100) return amount === "max";
    const target = Number(tokensFor(percent));
    const current = Number(amount);
    return target > 0 && Number.isFinite(current) && Math.abs(current - target) / target < 0.0005;
  };
  const isCreator = connected && address.toLowerCase() === launch.creator.toLowerCase();
  const launchBoxes = myBoxes.filter((box) => boxForLaunch(box, launch));
  const tokenBoxes = launchBoxes.filter(boxClaimable);
  const holdingBoxes = launchBoxes.filter(boxHolding);
  const hasTradeBoxes = launchBoxes.length > 0;
  const [creatorClaimed, setCreatorClaimed] = useState(false);
  const [poolClaimed, setPoolClaimed] = useState(false);
  const [claimBusy, setClaimBusy] = useState<"creator" | null>(null);
  const [feeNote, setFeeNote] = useState("");
  useEffect(() => {
    if (!connected || !address) {
      setCreatorClaimed(false);
      setPoolClaimed(false);
      return;
    }
    // Live claimable wins over a stale local "claimed" flag from older UI bugs.
    const flaggedCreator =
      window.localStorage.getItem(feeClaimKey("creator", launch.address, address)) === "1";
    setCreatorClaimed(flaggedCreator && !(creatorEth > 0));
    setPoolClaimed(window.localStorage.getItem(feeClaimKey("pool", launch.address, address)) === "1");
  }, [connected, address, launch.address, creatorEth]);
  // Always allow creator to try Claim — prepare settles pending tax first.
  // Disable only when already marked claimed with no live balance.
  const canClaimCreator =
    !connected || (isCreator && !claimBusy && !(creatorClaimed && hasLiveCreator && liveCreatorEth <= 0));

  async function onClaimCreator() {
    if (!connected) {
      connect();
      return;
    }
    if (!isCreator || creatorClaimed || claimBusy) return;
    if (!walletProvider) {
      setFeeNote("Connect a wallet that can sign transactions.");
      return;
    }
    setClaimBusy("creator");
    setFeeNote("");
    try {
      if (activeChainId(chainId) !== robinhoodChain.id) await switchNetwork(robinhoodChain);

      // Prepare settles pending tax (sweep/harvest/allocate) then returns claimCreator calldata.
      const res = await claimCreatorFee({ wallet: address, token: launch.address });
      const calls = (res.data.calls ?? []).map((call) => ({
        to: call.to as Address,
        data: (call.data || "0x") as Hex,
        value: call.value || "0",
      }));
      if (calls.length === 0) {
        setFeeNote(res.data.message || "No creator fee claimable on-chain yet.");
        return;
      }

      const hashes = await sendTradeCalls(walletProvider, address as Address, calls);
      const rpc = robinhoodChain.rpcUrls.default.http[0];
      const reader = createPublicClient({ chain: robinhoodChain, transport: http(rpc) });
      await Promise.all(
        hashes.map((hash) => reader.waitForTransactionReceipt({ hash, timeout: 180_000 })),
      );

      const claimedEth = res.data.claimableEth ? Number(res.data.claimableEth) : liveCreatorEth;
      window.localStorage.setItem(feeClaimKey("creator", launch.address, address), "1");
      setCreatorClaimed(true);
      setFeeNote(
        `Claimed ${formatEth(Number.isFinite(claimedEth) ? claimedEth : 0)} creator fee${
          hashes[0] ? ` · ${shortAddress(hashes[0])}` : ""
        }.`,
      );
    } catch (err) {
      setFeeNote(err instanceof ApiError ? err.message : tradeErrorText(err));
    } finally {
      setClaimBusy(null);
    }
  }

  function applySlippage(next: string) {
    const clean = next.replace(/[^\d.]/g, "");
    setSlippage(clean);
    const value = Math.round(Number(clean) * 10) / 10;
    if (value > 0 && value <= 50) window.localStorage.setItem("looting-slippage", String(value));
  }

  function applyGwei(next: string) {
    const clean = next.replace(/[^\d.]/g, "");
    setGwei(clean);
    const value = Number(clean);
    if (value > 0) window.localStorage.setItem("looting-gwei", clean);
  }

  useEffect(() => {
    const storedSlip = window.localStorage.getItem("looting-slippage");
    const storedGwei = window.localStorage.getItem("looting-gwei");
    if (storedSlip && Number(storedSlip) > 0 && Number(storedSlip) <= 50) setSlippage(storedSlip);
    if (storedGwei && Number(storedGwei) > 0) setGwei(storedGwei);
  }, []);

  useEffect(() => {
    try {
      const buy = window.localStorage.getItem("looting-buy-presets");
      const sell = window.localStorage.getItem("looting-sell-presets");
      const buyParsed = buy ? (JSON.parse(buy) as unknown) : null;
      const sellParsed = sell ? (JSON.parse(sell) as unknown) : null;
      if (Array.isArray(buyParsed) && buyParsed.length === 4 && buyParsed.every((value) => Number(value) > 0)) {
        setPresets(buyParsed.map(String));
      }
      if (Array.isArray(sellParsed) && sellParsed.length === 4 && sellParsed.every((value) => Number(value) > 0 && Number(value) <= 100)) {
        setSellPercents(sellParsed.map(Number));
      }
    } catch {
      /* keep defaults */
    }
  }, []);

  useEffect(() => {
    if (!presetOpen) return;
    function close(event: MouseEvent) {
      if (presetRef.current && !presetRef.current.contains(event.target as Node)) {
        setPresetOpen(false);
        setPresetError("");
      }
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [presetOpen]);

  function editLane(next: "buy" | "sell") {
    setSide(next);
    setPresetDraft(next === "buy" ? [...presets] : sellPercents.map(String));
    setPresetError("");
    setPresetOpen(true);
    setSetup(null);
  }

  function cyclePriority() {
    const order = ["P1", "P2", "P3"] as const;
    const next = order[(order.indexOf(priority) + 1) % order.length];
    const fees = { P1: "5", P2: "15", P3: "30.05" };
    setPriority(next);
    applyGwei(fees[next]);
  }

  function openDock(next: "buy" | "sell") {
    setPresetOpen(false);
    setPresetError("");
    setSide(next);
    setAmount(next === "buy" ? presets[0] || meta?.initialBuy || "0.1" : tokensFor(sellPercents[0] ?? 25));
    setDockOpen(true);
  }

  function openPresets() {
    setPresetDraft(side === "buy" ? [...presets] : sellPercents.map(String));
    setPresetError("");
    setPresetOpen(true);
  }

  async function submitTrade() {
    setTradeError("");
    if (!connected) {
      connect();
      return;
    }
    const isMaxSell = side === "sell" && amount === "max";
    const value = isMaxSell ? balance : Number(amount);
    if (!(value > 0)) {
      setTradeError("Enter an amount above 0.");
      return;
    }
    // Only block when we have a mid price and the UI estimate is clearly dust.
    // If priceUsd is missing, let the backend FEE_EXCEEDS_OUTPUT decide.
    if (
      side === "sell" &&
      quoteAsset === "ETH" &&
      launch.priceUsd > 0 &&
      quote <= 0
    ) {
      setTradeError("Amount is below the $0.056 fee.");
      return;
    }
    setTrading(true);
    let sent = 0;
    let callCount = 0;
    try {
      const prepared = await prepareTrade({
        token: launch.address,
        side,
        amount,
        wallet: address,
        slippageBps: Math.min(5000, Math.max(0, Math.round(Number(slippage) * 100) || 1000)),
      });
      if (!walletProvider) {
        connect();
        return;
      }
      if (activeChainId(chainId) !== robinhoodChain.id) await switchNetwork(robinhoodChain);
      const rpc = robinhoodChain.rpcUrls.default.http[0];
      const reader = createPublicClient({ chain: robinhoodChain, transport: http(rpc) });
      callCount = prepared.calls.length;
      const hashes = await sendTradeCalls(walletProvider, address as Address, prepared.calls);
      for (const hash of hashes) {
        const receipt = await reader.waitForTransactionReceipt({ hash, timeout: 120_000 });
        if (receipt.status === "reverted") throw new Error("Transaction reverted.");
        sent += 1;
        try {
          const confirmed = await confirmTrade({ token: launch.address, wallet: address, txHash: hash });
          reloadBoxes();
          const minted = confirmed.data?.boxesMinted ?? 0;
          const unlocked = confirmed.data?.boxesUnlocked ?? 0;
          if (minted > 0) {
            setFeeNote(`Lucky Box earned — sell 100% to unlock on Rewards.`);
          } else if (unlocked > 0) {
            setFeeNote(`${unlocked} Lucky Box${unlocked === 1 ? "" : "es"} unlocked — open on Rewards.`);
          }
        } catch {
          /* indexer will catch up; don't fail the trade UI */
        }
      }

      // Keep Open position in sync immediately — holders poll can lag a few seconds.
      if (chain) {
        const walletLc = address.toLowerCase();
        let remaining: number | null = null;
        try {
          const [raw, decimals] = await Promise.all([
            reader.readContract({
              address: launch.address as Address,
              abi: erc20BalanceAbi,
              functionName: "balanceOf",
              args: [address as Address],
            }),
            reader.readContract({
              address: launch.address as Address,
              abi: erc20BalanceAbi,
              functionName: "decimals",
            }),
          ]);
          remaining = Number(formatUnits(raw, decimals));
          if (Number.isFinite(remaining)) setWalletTokenBal(remaining);
        } catch {
          /* fall back to amount-based optimistic update */
        }

        const dust =
          remaining !== null &&
          (!(remaining > 0) || (launch.priceUsd > 0 && remaining * launch.priceUsd < 0.01));
        const fullExit = side === "sell" && (isMaxSell || dust);

        if (fullExit) {
          fullExitUntilRef.current = {
            token: launch.address.toLowerCase(),
            wallet: walletLc,
            until: Date.now() + 90_000,
          };
          setChainHolders((prev) => prev.filter((row) => row.address.toLowerCase() !== walletLc));
        } else if (side === "sell" && remaining !== null) {
          setChainHolders((prev) =>
            prev
              .map((row) =>
                row.address.toLowerCase() === walletLc ? { ...row, amount: Math.max(0, remaining) } : row,
              )
              .filter((row) => row.amount > 0),
          );
        } else if (side === "sell") {
          const sold = Number(amount);
          if (Number.isFinite(sold) && sold > 0) {
            setChainHolders((prev) =>
              prev
                .map((row) =>
                  row.address.toLowerCase() === walletLc
                    ? { ...row, amount: Math.max(0, row.amount - sold) }
                    : row,
                )
                .filter((row) => row.amount > 0),
            );
          }
        }

        try {
          const detail = await getTrenchToken(launch.address);
          if (detail) {
            setShown(trenchToLaunch(detail.pair));
            if (detail.holders) setChainHolders(applyHolders(trenchHolders(detail.holders)));
            if (detail.trades.length > 0) setChainTrades(trenchTrades(detail.trades));
          }
        } catch {
          /* optimistic local holders already applied */
        }
      } else {
        reloadHolders();
        reloadTrades();
      }
    } catch (err) {
      if (sent > 0 && sent < callCount) setTradeError("The trade was not completed.");
      else setTradeError(tradeErrorText(err));
    } finally {
      setTrading(false);
    }
  }

  function savePresets() {
    const next = presetDraft.map((value) => value.trim());
    if (side === "buy") {
      if (next.some((value) => !(Number(value) > 0))) {
        setPresetError("Use amounts above 0");
        return;
      }
      setPresets(next);
      window.localStorage.setItem("looting-buy-presets", JSON.stringify(next));
    } else {
      const percents = next.map(Number);
      if (percents.some((value) => !(value > 0) || value > 100)) {
        setPresetError("Use 1 to 100");
        return;
      }
      setSellPercents(percents);
      window.localStorage.setItem("looting-sell-presets", JSON.stringify(percents));
    }
    setPresetOpen(false);
  }

  return (
    <div className={`token-page${dockOpen ? " trade-open" : ""}`}>
      <div className="token-stack">
        {!launch.draft ? (
        <>
        <div className="fee-pair">
          <article className="sheet fee-card">
            <span className="fee-icon" aria-hidden>
              <WalletIcon />
            </span>
            <div className="fee-label">
              <span className="fee-title">Creator Fee</span>
              <PageInfo
                tip={
                  creatorClaimed || (hasLiveCreator && liveCreatorEth <= 0)
                    ? "Nothing claimable right now. New trade tax settles into LootingRewardRouter after sweep — Claim lights up when balance is live."
                    : feeSource === "onchain"
                      ? "On-chain creator tax ready to claim from LootingRewardRouter."
                      : feeSource === "volume"
                        ? "Estimated from trading volume until live claimable balances sync."
                        : "Waiting on trade volume."
                }
                label="Creator fee info"
              />
            </div>
            <div className="fee-actions">
              <div className="fee-amount">
                <strong>{formatEth(creatorEth)}</strong>
                {creatorUsd > 0 ? <em className="fee-usd">{formatUsd(creatorUsd)}</em> : null}
              </div>
              <button
                type="button"
                className="fee-claim"
                disabled={!canClaimCreator || claimBusy === "creator"}
                onClick={() => void onClaimCreator()}
                title={isCreator || !connected ? "Claim creator fees" : "Only the creator can claim"}
              >
                {claimBusy === "creator" ? "…" : creatorClaimed ? "Claimed" : connected ? "Claim" : "Connect"}
              </button>
            </div>
          </article>
          <article className="sheet fee-card">
            <span className="fee-icon" aria-hidden>
              <GiftIcon />
            </span>
            <div className="fee-label">
              <span className="fee-title">Lucky Box Pool</span>
              <PageInfo
                tip={
                  hasTradeBoxes
                    ? tokenBoxes.length > 0
                      ? `${tokenBoxes.length} box${tokenBoxes.length === 1 ? "" : "es"} ready — open on Rewards.`
                      : holdingBoxes.length > 0
                        ? "Sell 100% to unlock, then open on Rewards."
                        : "Open Rewards to see your Lucky Boxes for this token."
                    : "Pool accrual from creator tax. Boxes unlock after a qualifying buy and full exit."
                }
                label="Lucky Box pool info"
              />
            </div>
            <div className="fee-actions">
              <div className="fee-amount">
                <strong>{formatEth(poolEth)}</strong>
                {poolUsd > 0 ? <em className="fee-usd">{formatUsd(poolUsd)}</em> : null}
              </div>
              <button
                type="button"
                className="fee-claim"
                onClick={() => {
                  if (!connected) {
                    connect();
                    return;
                  }
                  if (hasTradeBoxes) {
                    router.push("/rewards");
                    return;
                  }
                  setFeeNote(
                    "No Lucky Box yet. Buy ≥ $5 on this token, then sell 100% to unlock a box on Rewards.",
                  );
                }}
                title={
                  hasTradeBoxes
                    ? "Open Rewards for your Lucky Boxes"
                    : "Lucky Boxes need a qualifying buy + full exit"
                }
              >
                {!connected
                  ? "Connect"
                  : tokenBoxes.length > 0
                    ? "Open"
                    : holdingBoxes.length > 0
                      ? "Locked"
                      : hasTradeBoxes
                        ? "Rewards"
                        : "No box"}
              </button>
            </div>
          </article>
        </div>
        {feeNote ? <PageFlash note={feeNote} onClear={() => setFeeNote("")} /> : null}
        </>
        ) : null}
      <section className="sheet token-main">
        <header className="token-head">
          {photo ? (
            <img src={photo} alt="" className="token-mark object-cover" width={64} height={64} decoding="async" onError={() => setPhoto("")} />
          ) : (
            <TokenLogo symbol={launch.symbol} size={64} src={launch.logoUrl} address={launch.address} priority />
          )}
          <div className="token-id">
            <div className="token-title">
              <h1>{launch.name}</h1>
              <span>${launch.symbol}</span>
            </div>
            <p>{launch.description}</p>
          </div>
          <div className="token-head-actions">
            {(launch.locked || launch.socialUpdated || (launch.dexBoost ?? 0) > 0) && (
              <div className="token-badges" aria-label="Token signals">
                {launch.locked ? (
                  <span className="token-badge is-lock" data-tip="Token Locked" aria-label="Token Locked">
                    <LockBadgeIcon />
                  </span>
                ) : null}
                {launch.socialUpdated ? (
                  <a
                    className="token-badge is-social"
                    href={`https://dexscreener.com/search?q=${encodeURIComponent(launch.address)}`}
                    target="_blank"
                    rel="noreferrer"
                    data-tip="Dex profile updated"
                    aria-label="Dex profile updated"
                  >
                    <DexscreenerBadgeIcon />
                  </a>
                ) : null}
                {(launch.dexBoost ?? 0) > 0 ? (
                  <a
                    className="token-badge is-boost"
                    href={`https://dexscreener.com/search?q=${encodeURIComponent(launch.address)}`}
                    target="_blank"
                    rel="noreferrer"
                    data-tip={`DexBoost ${launch.dexBoost}x`}
                    aria-label={`DexBoost ${launch.dexBoost}x`}
                  >
                    <BoostBadgeIcon />
                  </a>
                ) : null}
              </div>
            )}
            {links.length > 0 && (
              <div className="token-link-card">
                {links.map((item) => (
                  <a key={item.label} href={item.href} target="_blank" rel="noreferrer" aria-label={item.label} title={item.label}>
                    <LinkGlyph label={item.label} />
                  </a>
                ))}
              </div>
            )}
            {launch.draft && <span className="token-pill is-draft">Draft</span>}
          </div>
        </header>

        {feePending ? (
          <PageFlash note="Token launched. LOOTING create fee (0.00035 ETH) was not confirmed in wallet — send it from create next time, or ignore if you already paid." />
        ) : null}

        {launch.draft ? (
          <ul className="preview-meta token-draft-meta">
            <li>
              <span>Creator tax</span>
              <b className="num">{launch.creatorTax.toFixed(2)}%</b>
            </li>
            <li>
              <span>Lucky Boxes</span>
              <b className="num">{launch.luckyShare}%</b>
            </li>
            <li className="preview-meta-stack">
              <div className="preview-meta-row">
                <span>{PONS_LAUNCH_WINDOW.label}</span>
                <b className="num">{PONS_LAUNCH_WINDOW.shortValue}</b>
              </div>
              <p className="preview-meta-detail">{PONS_LAUNCH_WINDOW.detail}</p>
            </li>
          </ul>
        ) : null}

        <div className="token-metrics">
          <div className="token-metric hero">
            <span>Price</span>
            <strong>{formatPrice(launch.priceUsd)}</strong>
          </div>
          <div className="token-metric">
            <span>Market cap</span>
            <strong>{formatUsd(launch.marketCap)}</strong>
          </div>
          <div className="token-metric">
            {chain ? (
              <>
                <span>Volume</span>
                <strong>{formatUsd(stats.volume24h)}</strong>
              </>
            ) : (
              <>
                <span>1h</span>
                <strong className={up ? "is-up" : "is-down"}>
                  {up ? "+" : ""}
                  {launch.change1h.toFixed(1)}%
                </strong>
              </>
            )}
          </div>
          <div className="token-metric token-metric-ca">
            <span>CA</span>
            <button
              type="button"
              className="token-ca-copy"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(launch.address);
                  setCaCopied(true);
                  window.setTimeout(() => setCaCopied(false), 1600);
                } catch {
                  /* ignore */
                }
              }}
              title={launch.address}
              aria-label={caCopied ? "Contract address copied" : "Copy contract address"}
            >
              <strong>{caCopied ? "Copied" : shortAddress(launch.address)}</strong>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
                <path
                  d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>

        <dl className="token-facts-strip" aria-label="Token facts">
          <Fact label="Creator" value={shortAddress(launch.creator)} />
          <Fact label="Creator tax" value={`${launch.creatorTax.toFixed(2)}%`} />
          <Fact label="Creator keeps" value={`${creatorShare}%`} />
          <Fact label="Lucky Boxes" value={`${launch.luckyShare}%`} />
          {chain ? <Fact label="Age" value={stats.age} /> : null}
          {chain ? <Fact label="Txns" value={stats.txns.toLocaleString("en-US")} /> : null}
          {chain ? <Fact label="Holders" value={stats.holders.toLocaleString("en-US")} /> : null}
          {chain ? <Fact label="ATH" value={formatUsd(stats.ath)} /> : null}
          {meta?.pair ? <Fact label="Pair" value={meta.pair} /> : null}
          {meta?.holders === "1" || meta?.holders === "0" ? <Fact label="Fees to" value={meta.holders === "1" ? "Holders" : "Creator"} /> : null}
          {meta?.wallet ? <Fact label="Creator wallet" value={shortAddress(meta.wallet)} /> : null}
          {launch.draft ? <Fact label="Launch fee" value="0.00085 ETH" /> : null}
          {launch.draft ? (
            <Fact
              label={PONS_LAUNCH_WINDOW.label}
              value={`${PONS_LAUNCH_WINDOW.shortValue} · snipe decay`}
            />
          ) : null}
          {launch.draft ? (
            <Fact label="Graduation" value={!meta?.pair || meta.pair === "ETH" ? "On-chain threshold" : `In ${meta.pair}`} />
          ) : null}
          {launch.draft ? <Fact label="Liquidity" value="Locked" /> : null}
        </dl>

        <div className="token-chart">
          {chain ? (
            <CandleChart symbol={launch.symbol} ticks={ticks} spot={launch.marketCap} />
          ) : (
            <p className="page-note">No live chart yet.</p>
          )}
        </div>

        <div className="token-progress">
          <div>
            <span>{launch.phase === "graduated" ? "Graduated" : "To graduation"}</span>
            <b>{launch.progress}%</b>
          </div>
          <div className="token-bar">
            <i style={{ width: `${launch.progress}%` }} />
          </div>
        </div>
      </section>

      <section className="sheet holder-card">
        <header className="data-head">
          <h2>Data</h2>
          <SlidingTabs
            ariaLabel="Token data"
            tone="quiet"
            value={dataTab}
            onChange={(tab) => {
              setDataTab(tab);
              setPage(1);
            }}
            items={[
              { id: "holders", label: "Top Holder" },
              { id: "tx", label: "Transaction" },
            ]}
          />
        </header>
        {dataTab === "holders" ? (
          holders.length === 0 ? (
            <p className="holder-empty">No holders yet.</p>
          ) : (
            <table className="holders">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Wallet</th>
                  <th>Amount</th>
                  <th>Share</th>
                </tr>
              </thead>
              <tbody>
                {visibleHolders.map((row) => {
                  const yours = mine?.address === row.address;
                  return (
                    <tr key={row.rank} className={yours ? "is-you" : ""}>
                      <td>{row.rank}</td>
                      <td>{yours ? "You" : shortAddress(row.address)}</td>
                      <td>{formatAmount(row.amount)}</td>
                      <td>{row.share.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        ) : trades.length === 0 ? (
          <p className="holder-empty">No transactions yet.</p>
        ) : (
          <table className="holders">
            <thead>
              <tr>
                <th>Type</th>
                <th>Wallet</th>
                <th>Amount</th>
                <th>ETH</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {visibleTrades.map((row) => {
                const yours = connected && row.address.toLowerCase() === address.toLowerCase();
                return (
                  <tr key={row.id}>
                    <td className={row.side === "Buy" ? "is-buy" : "is-sell"}>{row.side}</td>
                    <td>{yours ? "You" : shortAddress(row.address)}</td>
                    <td>
                      {formatAmount(row.amount)} {launch.symbol}
                    </td>
                    <td>
                      <QuoteAmount value={row.eth} />
                    </td>
                    <td>{row.time}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {pages > 1 ? <Pager page={currentPage} pages={pages} onChange={setPage} /> : null}
      </section>
      </div>

      <div className="trade-stack">
      <aside className={`sheet token-trade${dockOpen ? " is-open" : ""}`}>
        <div className="trade-launch">
          <button type="button" className="dock-buy" onClick={() => openDock("buy")}>
            Buy
          </button>
          <button type="button" className="dock-sell" onClick={() => openDock("sell")}>
            Sell
          </button>
        </div>
        <div className="trade-board">
          <header className="trade-board-bar">
            <button type="button" className="trade-close" aria-label="Close trade" onClick={() => { setDockOpen(false); setSetup(null); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M6 9.5 12 15.5 18 9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="trade-modes" role="tablist" aria-label="Order type">
              {(["instant", "market", "limit"] as const).map((mode) => (
                <button key={mode} type="button" role="tab" aria-selected={orderMode === mode} className={orderMode === mode ? "on" : ""} onClick={() => setOrderMode(mode)}>
                  {mode === "instant" ? "Instant" : mode === "market" ? "Market" : "Limit"}
                </button>
              ))}
            </div>
            <button type="button" className="trade-pill" onClick={() => { if (!connected) connect(); }}>
              {connected ? shortAddress(address) : "Wallet"}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M6 9.5 12 15.5 18 9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            <button type="button" className="trade-pill" onClick={cyclePriority}>
              {priority}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M6 9.5 12 15.5 18 9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            <button type="button" className={`trade-gear${setup === "slip" ? " on" : ""}`} aria-label="Slippage settings" onClick={() => setSetup((current) => (current === "slip" ? null : "slip"))}>
              <GearIcon />
            </button>
          </header>
          {setup === "slip" ? (
            <div className="trade-setup-edit">
              {["5", "10", "15", "20"].map((value) => (
                <button key={value} type="button" className={slippage === value ? "on" : ""} onClick={() => { applySlippage(value); setAutoSlip(false); }}>
                  {value}%
                </button>
              ))}
              <input value={slippage} inputMode="decimal" aria-label="Slippage percent" onChange={(event) => { applySlippage(event.target.value); setAutoSlip(false); }} />
            </div>
          ) : null}
          {setup === "gwei" ? (
            <label className="trade-setup-edit">
              <span>Gwei</span>
              <input value={gwei} inputMode="decimal" aria-label="Gas gwei" onChange={(event) => applyGwei(event.target.value)} />
            </label>
          ) : null}
          {setup === "tpsl" ? (
            <div className="trade-setup-edit">
              <label>
                <span>TP %</span>
                <input value={tp} inputMode="decimal" aria-label="Take profit percent" onChange={(event) => setTp(event.target.value.replace(/[^\d.]/g, ""))} />
              </label>
              <label>
                <span>SL %</span>
                <input value={sl} inputMode="decimal" aria-label="Stop loss percent" onChange={(event) => setSl(event.target.value.replace(/[^\d.]/g, ""))} />
              </label>
            </div>
          ) : null}
          {orderMode !== "instant" ? (
            <div className="trade-mode-fields">
              {orderMode === "limit" ? (
                <label>
                  <span>Limit</span>
                  <input value={limitPrice} inputMode="decimal" aria-label="Limit price" placeholder="0.00" onChange={(event) => setLimitPrice(event.target.value.replace(/[^\d.]/g, ""))} />
                </label>
              ) : null}
              <label>
                <span>{side === "buy" ? quoteAsset : launch.symbol}</span>
                <input value={amount} inputMode="decimal" aria-label="Order amount" onChange={(event) => setAmount(event.target.value)} />
              </label>
            </div>
          ) : null}
          <div className="trade-lane buy">
            <div className="lane-head">
              <button type="button" className="lane-name" onClick={() => editLane("buy")}>
                Buy
                <PencilIcon />
              </button>
              {runningPnl !== null ? (
                <span className={`lane-delta${runningPnl >= 0 ? " is-up" : " is-down"}`}>
                  <i className="trade-pnl-dot" />
                  PnL {runningPnl >= 0 ? "+" : ""}
                  {runningPnl.toFixed(1)}%
                  {runningDelta !== null ? (
                    <em>
                      {runningDelta >= 0 ? "+" : "−"}
                      {formatUsd(Math.abs(runningDelta))}
                    </em>
                  ) : null}
                </span>
              ) : null}
              <span className="lane-balance">
                Balance ($) {connected ? "—" : "0"}
                <button type="button" className="lane-plus" aria-label={connected ? "Connected wallet" : "Connect wallet"} onClick={() => { if (!connected) connect(); }}>
                  +
                </button>
              </span>
            </div>
            <div className="token-chips">
              {presetOpen && side === "buy"
                ? presetDraft.map((value, index) => (
                    <input key={index} value={value} inputMode="decimal" aria-label={`Buy amount ${index + 1}`} onChange={(event) => setPresetDraft((current) => current.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)))} />
                  ))
                : presets.map((preset) => (
                    <button key={preset} type="button" className={side === "buy" && amount === preset ? "on" : ""} onClick={() => { setSide("buy"); setAmount(preset); }}>
                      {preset}
                    </button>
                  ))}
            </div>
            <div className="lane-meta">
              <button type="button" className={autoSlip ? "on" : ""} onClick={() => setAutoSlip((value) => !value)}>
                <ZapIcon />
                {autoSlip ? "Auto" : `${slippage || "0"}%`}
              </button>
              <button type="button" className={setup === "gwei" ? "on" : ""} onClick={() => setSetup((current) => (current === "gwei" ? null : "gwei"))}>
                <FuelIcon />
                {gwei || "0"}
              </button>
              <button type="button" className={mevOn ? "on" : ""} onClick={() => setMevOn((value) => !value)}>
                <ShieldIcon />
                {mevOn ? "ON" : "OFF"}
              </button>
              <button type="button" className="lane-extra" onClick={() => setSetup((current) => (current === "tpsl" ? null : "tpsl"))}>
                {tp || sl ? `TP ${tp || "—"} / SL ${sl || "—"}` : "TP/SL Not Set"}
              </button>
            </div>
          </div>
          <div className="trade-lane sell">
            <div className="lane-head">
              <button type="button" className="lane-name" onClick={() => editLane("sell")}>
                Sell
                <PencilIcon />
              </button>
              <span className="lane-balance">
                Balance {formatAmount(balance)} {launch.symbol} (($) {formatUsd(balance * launch.priceUsd).replace("$", "")})
              </span>
            </div>
            <div className="token-chips">
              {presetOpen && side === "sell"
                ? presetDraft.map((value, index) => (
                    <input key={index} value={value} inputMode="decimal" aria-label={`Sell percent ${index + 1}`} onChange={(event) => setPresetDraft((current) => current.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)))} />
                  ))
                : sellPercents.map((percent) => (
                    <button key={percent} type="button" className={side === "sell" && sellActive(percent) ? "on" : ""} onClick={() => { setSide("sell"); setAmount(tokensFor(percent)); }}>
                      {percent}%
                    </button>
                  ))}
            </div>
            <div className="lane-meta">
              <button type="button" className={autoSlip ? "on" : ""} onClick={() => setAutoSlip((value) => !value)}>
                <ZapIcon />
                {autoSlip ? "Auto" : `${slippage || "0"}%`}
              </button>
              <button type="button" className={setup === "gwei" ? "on" : ""} onClick={() => setSetup((current) => (current === "gwei" ? null : "gwei"))}>
                <FuelIcon />
                {gwei || "0"}
              </button>
              <button type="button" className={mevOn ? "on" : ""} onClick={() => setMevOn((value) => !value)}>
                <ShieldIcon />
                {mevOn ? "ON" : "OFF"}
              </button>
            </div>
          </div>
          {presetOpen ? (
            <button type="button" className="lane-save" onClick={savePresets}>
              Save amounts
            </button>
          ) : null}
        </div>
        <div className="trade-setup">
          <div className="trade-setup-row">
            <button type="button" className={setup === "slip" ? "on" : ""} onClick={() => setSetup((current) => (current === "slip" ? null : "slip"))}>
              Slip {slippage || "0"}%
            </button>
            <button type="button" className={setup === "gwei" ? "on" : ""} onClick={() => setSetup((current) => (current === "gwei" ? null : "gwei"))}>
              {gwei || "0"} gwei
            </button>
            <span className={`trade-pnl${runningPnl === null ? "" : runningPnl >= 0 ? " is-up" : " is-down"}`}>
              {runningPnl !== null ? <i className="trade-pnl-dot" /> : null}
              PnL {runningPnl === null ? "—" : `${runningPnl >= 0 ? "+" : ""}${runningPnl.toFixed(1)}%`}
              {runningDelta !== null ? <em>{`${runningDelta >= 0 ? "+" : "−"}${formatUsd(Math.abs(runningDelta))}`}</em> : null}
            </span>
          </div>
          {setup === "slip" ? (
            <div className="trade-setup-edit">
              {["5", "10", "15", "20"].map((value) => (
                <button key={value} type="button" className={slippage === value ? "on" : ""} onClick={() => applySlippage(value)}>
                  {value}%
                </button>
              ))}
              <input value={slippage} inputMode="decimal" aria-label="Slippage percent" onChange={(event) => applySlippage(event.target.value)} />
            </div>
          ) : null}
          {setup === "gwei" ? (
            <label className="trade-setup-edit">
              <span>Priority gwei</span>
              <input value={gwei} inputMode="decimal" aria-label="Gas gwei" onChange={(event) => applyGwei(event.target.value)} />
            </label>
          ) : null}
        </div>
        <div className={`seg trade${side === "sell" ? " is-sell" : ""}`}>
          {(["buy", "sell"] as const).map((item) => (
            <button
              key={item}
              type="button"
              className={side === item ? "on" : ""}
              onClick={() => {
                setPresetOpen(false);
                setPresetError("");
                setSide(item);
                setAmount(item === "buy" ? meta?.initialBuy || "0.1" : tokensFor(100));
              }}
            >
              {item === "buy" ? "Buy" : "Sell"}
            </button>
          ))}
        </div>
        <div className={`trade-amount${presetOpen ? " is-editing" : ""}`} ref={presetRef}>
          <div className="token-amount">
            <div className="amount-head">
              <span>{side === "buy" ? `${quoteAsset} to spend` : `${launch.symbol} to sell`}</span>
              <button type="button" className={`chip-settings${presetOpen ? " on" : ""}`} aria-label={presetOpen ? "Save quick amounts" : "Edit quick amounts"} aria-expanded={presetOpen} onClick={() => (presetOpen ? savePresets() : openPresets())}>
                {presetOpen ? <CheckIcon /> : <GearIcon />}
              </button>
            </div>
            <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" className="field" aria-label={side === "buy" ? `${quoteAsset} to spend` : `${launch.symbol} to sell`} />
            <div className="amount-usd" aria-live="polite">
              {spendUsd > 0 ? `≈ ${formatUsd(spendUsd)}` : "≈ $0.00"}
            </div>
          </div>
          <div className="token-chips">
            {presetOpen
              ? presetDraft.map((value, index) => (
                  <input
                    key={index}
                    value={value}
                    inputMode="decimal"
                    aria-label={side === "buy" ? `Amount ${index + 1}` : `Percent ${index + 1}`}
                    onChange={(event) => setPresetDraft((current) => current.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)))}
                  />
                ))
              : side === "buy"
                ? presets.map((preset) => (
                    <button key={preset} type="button" className={amount === preset ? "on" : ""} onClick={() => setAmount(preset)}>
                      {preset}
                    </button>
                  ))
                : sellPercents.map((percent) => (
                    <button key={percent} type="button" className={sellActive(percent) ? "on" : ""} onClick={() => setAmount(tokensFor(percent))}>
                      {percent}%
                    </button>
                  ))}
          </div>
          {presetError ? <p className="preset-error">{presetError}</p> : null}
        </div>
        <div className="token-quote">
          <span>Fee</span>
          <b>${tradeFeeUsd.toFixed(3)}</b>
        </div>
        <div className="token-quote">
          <span>You receive</span>
          <b>{quote === 0 ? "—" : side === "buy" ? `${formatAmount(quote)} ${launch.symbol}` : `${quote.toFixed(6)} ${quoteAsset}`}</b>
        </div>
        <button type="button" className={`btn${side === "sell" ? " sell" : ""}`} disabled={trading} onClick={() => void submitTrade()}>
          {trading ? "Confirm in wallet" : side === "buy" ? `Buy ${launch.symbol}` : `Sell ${launch.symbol}`}
        </button>
        {tradeError ? <p className="trade-note">{tradeError}</p> : null}
      </aside>
      {positionOpen && mine ? (
        <Position
          symbol={launch.symbol}
          price={launch.priceUsd}
          marketCap={launch.marketCap}
          ath={stats.ath}
          ethUsd={ethUsd}
          amount={mine.amount}
          entry={mine.entry}
          wallet={address}
        />
      ) : null}
      </div>
    </div>
  );
}

const pnlScenes = ["/pnlcard.png", "/pnlcard2.png", "/pnlcard3.png", "/pnlcard4.png", "/pnlcard5.png"];

const pnlFields = [
  ["symbol", "Ticker"],
  ["pnl", "PnL"],
  ["value", "Value"],
  ["multiple", "Multiple"],
  ["wallet", "Wallet"],
  ["entry", "Entry"],
  ["ath", "ATH"],
] as const;

type PnlField = (typeof pnlFields)[number][0];

function hexValue(value: string) {
  return `0x${BigInt(value).toString(16)}`;
}

function txValue(value: string): Hex | undefined {
  if (!value || value === "0" || value === "0x0" || value === "0x") return undefined;
  return hexValue(value) as Hex;
}

async function sendTradeCalls(
  provider: EIP1193Provider,
  from: Address,
  calls: { to: Address; data: Hex; value: string }[],
): Promise<Hash[]> {
  if (calls.length === 0) throw new Error("Nothing to send.");

  // One MetaMask confirm for approve + sell + fee (msg.sender stays the user —
  // unlike Multicall3). Fall back to sequential only if the wallet can't batch.
  if (calls.length > 1) {
    for (const atomicRequired of [true, false] as const) {
      try {
        const sent = (await (provider as EIP1193Provider).request({
          method: "wallet_sendCalls",
          params: [
            {
              version: "2.0.0",
              from,
              chainId: `0x${robinhoodChain.id.toString(16)}` as Hex,
              atomicRequired,
              calls: calls.map((item) => {
                const value = txValue(item.value);
                return {
                  to: item.to,
                  data: (item.data || "0x") as Hex,
                  ...(value ? { value } : {}),
                };
              }),
            },
          ],
        // viem EIP-5792 typings lag wallet implementations
        } as never)) as { id?: string } | string;
        const id = typeof sent === "string" ? sent : sent.id;
        if (!id) continue;
        return waitForCallHashes(provider, id);
      } catch (err) {
        if (isUserRejection(err)) throw err;
      }
    }
  }

  const hashes: Hash[] = [];
  for (const call of calls) {
    try {
      const value = txValue(call.value);
      const hash = (await provider.request({
        method: "eth_sendTransaction",
        params: [
          {
            from,
            to: call.to,
            data: (call.data || "0x") as Hex,
            ...(value ? { value } : {}),
            chainId: `0x${robinhoodChain.id.toString(16)}`,
          },
        ],
      })) as Hash;
      hashes.push(hash);
    } catch (err) {
      if (hashes.length > 0) {
        throw new Error(`Partially sent (${hashes.length}/${calls.length}). ${tradeErrorText(err)}`);
      }
      throw err;
    }
  }
  return hashes;
}

async function waitForCallHashes(provider: EIP1193Provider, id: string): Promise<Hash[]> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const status = (await provider.request({
      method: "wallet_getCallsStatus",
      params: [id],
    })) as { status?: number | string; receipts?: { transactionHash?: Hash }[] };
    const code = Number(status.status);
    if (code === 200 || status.status === "CONFIRMED") {
      const hashes = (status.receipts ?? [])
        .map((receipt) => receipt.transactionHash)
        .filter((hash): hash is Hash => Boolean(hash));
      if (hashes.length === 0) throw new Error("Transaction was not broadcast.");
      return hashes;
    }
    if (code >= 400) throw new Error("Transaction failed.");
    await new Promise((resolve) => window.setTimeout(resolve, 1200));
  }
  throw new Error("Transaction is still pending.");
}

function isUserRejection(err: unknown) {
  const text = providerErrorText(err);
  if (/reject|denied|cancel|user.?refus/i.test(text)) return true;
  if (err && typeof err === "object" && "code" in err) {
    const code = Number((err as { code: unknown }).code);
    if (code === 4001 || code === 5000) return true;
  }
  return false;
}

function providerErrorText(err: unknown): string {
  if (!err) return "";
  if (typeof err === "string") return err;
  if (err instanceof Error) {
    const extra = err as Error & { cause?: unknown; details?: unknown; shortMessage?: string };
    return (
      extra.shortMessage ||
      err.message ||
      providerErrorText(extra.cause) ||
      providerErrorText(extra.details)
    );
  }
  if (typeof err === "object") {
    const o = err as Record<string, unknown>;
    for (const key of ["shortMessage", "message", "reason", "error", "data", "cause", "info"] as const) {
      const value = o[key];
      if (typeof value === "string" && value.trim()) return value;
      if (value && typeof value === "object") {
        const nested = providerErrorText(value);
        if (nested) return nested;
      }
    }
  }
  return "";
}

function activeChainId(value: number | string | undefined) {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const raw = value.includes(":") ? value.split(":").pop() : value;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function tradeErrorText(err: unknown) {
  if (err instanceof ApiError) return err.message || "Could not prepare the trade.";
  const text = providerErrorText(err);
  if (/reject|denied|cancel|user.?refus/i.test(text)) return "Transaction cancelled.";
  if (/insufficient|fund|balance/i.test(text)) {
    return "Wallet needs a little ETH for the $0.056 fee plus gas.";
  }
  return text ? text.slice(0, 160) : "Trade failed.";
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12.5 9.2 17 19 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function ZapIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M13 3 5 14h7l-1 7 8-11h-7l1-7Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function FuelIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 20V6a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v14M4 20h13M15 10h2.5a2 2 0 0 1 2 2v3.5a1.5 1.5 0 0 0 3 0V9l-3-3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3 5 6v6c0 4.2 2.8 7.2 7 8.8 4.2-1.6 7-4.6 7-8.8V6l-7-3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function dottedAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function Position({
  symbol,
  price,
  marketCap,
  ath,
  ethUsd,
  amount,
  entry,
  wallet,
}: {
  symbol: string;
  price: number;
  marketCap: number;
  ath: number;
  ethUsd: number;
  amount: number;
  entry: number;
  wallet: string;
}) {
  const value = amount * price;
  const cost = entry > 0 ? amount * entry : 0;
  const delta = entry > 0 ? value - cost : value;
  const pnl = entry > 0 && price > 0 ? ((price - entry) / entry) * 100 : null;
  const entryMcap = entry > 0 && price > 0 ? marketCap * (entry / price) : 0;
  const multiple = entry > 0 && price > 0 ? price / entry : null;
  const up = pnl === null ? true : pnl >= 0;
  const [unit, setUnit] = useState<"usd" | "eth">("usd");
  const [shareOpen, setShareOpen] = useState(false);
  const [shown, setShown] = useState<Record<PnlField, boolean>>({
    symbol: true,
    pnl: true,
    value: true,
    multiple: true,
    wallet: true,
    entry: true,
    ath: true,
  });
  const scene = useMemo(() => pnlScenes[Math.floor(Math.random() * pnlScenes.length)], [symbol]);
  const money = (usd: number) => (unit === "usd" ? formatUsd(usd) : formatEth(usd / ethUsd));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [portalReady, setPortalReady] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const multipleLabel =
    multiple === null ? "—" : multiple >= 10 ? `${multiple.toFixed(1)}x` : `${multiple.toFixed(2)}x`;
  const pnlLabel = pnl === null ? "—" : `${up ? "+" : ""}${pnl.toFixed(1)}%`;
  const valueLabel = money(value);
  const shareText = `$${symbol} ${pnlLabel} · ${valueLabel} on LOOTING`;
  const sharePayload = useMemo(
    () => ({
      scene,
      symbol,
      pnlLabel,
      up,
      valueLabel,
      multipleLabel,
      walletLabel: dottedAddress(wallet),
      entryLabel: entry > 0 ? `Entry ${formatUsd(entryMcap)}` : "Entry —",
      athLabel: `ATH ${formatUsd(ath)}`,
      shown,
    }),
    [ath, entry, entryMcap, multipleLabel, pnlLabel, scene, shown, symbol, up, valueLabel, wallet],
  );

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!shareOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancel = false;
    void paintPnlShareCard(sharePayload, canvas).then(() => {
      if (cancel) return;
    });
    return () => {
      cancel = true;
    };
  }, [shareOpen, sharePayload]);

  useEffect(() => {
    if (!shareOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [shareOpen]);

  async function makeShareBlob() {
    const canvas = canvasRef.current;
    if (!canvas) return paintPnlShareCard(sharePayload);
    await paintPnlShareCard(sharePayload, canvas);
    return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  }

  async function saveImage() {
    if (busy) return;
    setBusy(true);
    setNote("");
    try {
      const blob = await makeShareBlob();
      if (!blob) return;
      downloadBlob(blob, `looting-${symbol.toLowerCase()}-pnl.png`);
      setNote("Image saved");
    } finally {
      setBusy(false);
    }
  }

  async function shareTwitter() {
    if (busy) return;
    setBusy(true);
    setNote("");
    try {
      const blob = await makeShareBlob();
      if (!blob) return;
      const file = new File([blob], `looting-${symbol.toLowerCase()}-pnl.png`, { type: "image/png" });
      const payload = { files: [file], title: "LOOTING position", text: shareText };
      if (navigator.canShare?.(payload)) {
        try {
          await navigator.share(payload);
          setNote("Shared");
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
        }
      }
      downloadBlob(blob, file.name);
      window.open(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`,
        "_blank",
        "noopener,noreferrer",
      );
      setNote("Image saved — attach it on X");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="sheet position-card">
        <div className="position-head">
          <h2>Open position</h2>
          <span className={`position-pill${pnl === null ? "" : up ? " is-up" : " is-down"}`}>
            {pnl === null ? "—" : `${up ? "+" : ""}${pnl.toFixed(1)}%`}
          </span>
        </div>
        <strong className="position-value">{formatUsd(value)}</strong>
        <p className="position-balance">
          {formatAmount(amount)} {symbol}
        </p>
        <dl>
          <div>
            <dt>Entry</dt>
            <dd>{entry > 0 ? formatPrice(entry) : "—"}</dd>
          </div>
          <div>
            <dt>Cost</dt>
            <dd>{entry > 0 ? formatUsd(cost) : "—"}</dd>
          </div>
          <div>
            <dt>PnL</dt>
            <dd className={pnl === null ? undefined : up ? "is-up" : "is-down"}>
              {pnl === null ? "—" : `${up ? "+" : "−"}${formatUsd(Math.abs(delta))}`}
            </dd>
          </div>
        </dl>
        <button
          type="button"
          className="position-share"
          onClick={() => {
            setShareOpen(true);
            setNote("");
          }}
        >
          Share
        </button>
      </section>

      {shareOpen && portalReady
        ? createPortal(
            <div
              className="position-share-overlay"
              role="dialog"
              aria-modal="true"
              aria-label="Share position"
              onClick={() => setShareOpen(false)}
            >
              <div className="position-share-pop" onClick={(event) => event.stopPropagation()}>
                <header className="position-share-head">
                  <span>Share card</span>
                  <button type="button" className="position-share-close" onClick={() => setShareOpen(false)} aria-label="Close">
                    Close
                  </button>
                </header>
                <canvas
                  ref={canvasRef}
                  className="pnl-card pnl-share-canvas"
                  aria-label={`Share card for $${symbol}`}
                />
                <div className="pnl-controls">
                  <div className="pnl-setting">
                    <span>Show in</span>
                    <div className="seg pnl-unit">
                      <button type="button" className={unit === "usd" ? "on" : ""} onClick={() => setUnit("usd")}>
                        $
                      </button>
                      <button type="button" className={unit === "eth" ? "on" : ""} onClick={() => setUnit("eth")}>
                        ETH
                      </button>
                    </div>
                  </div>
                  <div className="pnl-flags">
                    {pnlFields.map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        className={shown[key] ? "on" : ""}
                        aria-pressed={shown[key]}
                        onClick={() => setShown((current) => ({ ...current, [key]: !current[key] }))}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="position-share-actions">
                  <button type="button" className="position-share-x" disabled={busy} onClick={shareTwitter}>
                    Share on X
                  </button>
                  <button type="button" className="position-share-save" disabled={busy} onClick={saveImage}>
                    Save image
                  </button>
                </div>
                {note ? <p className="position-share-note">{note}</p> : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load ${src}`));
    image.src = src;
  });
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

type PnlSharePaint = {
  scene: string;
  symbol: string;
  pnlLabel: string;
  up: boolean;
  valueLabel: string;
  multipleLabel: string;
  walletLabel: string;
  entryLabel: string;
  athLabel: string;
  shown: Record<PnlField, boolean>;
};

async function paintPnlShareCard(input: PnlSharePaint, target?: HTMLCanvasElement) {
  const [sceneImg, mark] = await Promise.all([loadImage(input.scene), loadImage("/logo-wordmark.png")]);
  const width = 1920;
  const height = 1080;
  // Match CSS preview proportions (card ~388px wide in popup).
  const s = width / 388;
  const canvas = target ?? document.createElement("canvas");
  const pixel = Math.max(2, Math.min(3, Math.round(window.devicePixelRatio || 2)));
  canvas.width = width * pixel;
  canvas.height = height * pixel;
  if (target) {
    canvas.style.width = "100%";
    canvas.style.height = "auto";
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(pixel, 0, 0, pixel, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.fillStyle = "#09090b";
  ctx.fillRect(0, 0, width, height);

  // object-fit: cover; object-position: left center
  const cover = Math.max(width / sceneImg.naturalWidth, height / sceneImg.naturalHeight);
  const drawW = sceneImg.naturalWidth * cover;
  const drawH = sceneImg.naturalHeight * cover;
  ctx.drawImage(sceneImg, 0, (height - drawH) / 2, drawW, drawH);

  const fade = ctx.createLinearGradient(width * 0.02, 0, width * 0.78, 0);
  fade.addColorStop(0, "rgba(9, 9, 11, 0)");
  fade.addColorStop(0.12, "rgba(9, 9, 11, 0.015)");
  fade.addColorStop(0.24, "rgba(9, 9, 11, 0.04)");
  fade.addColorStop(0.36, "rgba(9, 9, 11, 0.09)");
  fade.addColorStop(0.48, "rgba(9, 9, 11, 0.18)");
  fade.addColorStop(0.58, "rgba(9, 9, 11, 0.3)");
  fade.addColorStop(0.68, "rgba(9, 9, 11, 0.46)");
  fade.addColorStop(0.78, "rgba(9, 9, 11, 0.64)");
  fade.addColorStop(0.88, "rgba(9, 9, 11, 0.82)");
  fade.addColorStop(0.95, "rgba(9, 9, 11, 0.93)");
  fade.addColorStop(1, "#09090b");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, width, height);

  const floorH = 48 * s;
  const floor = ctx.createLinearGradient(0, height - floorH, 0, height);
  floor.addColorStop(0, "rgba(9, 9, 11, 0)");
  floor.addColorStop(0.35, "rgba(9, 9, 11, 0.12)");
  floor.addColorStop(0.7, "rgba(9, 9, 11, 0.45)");
  floor.addColorStop(1, "#09090b");
  ctx.fillStyle = floor;
  ctx.fillRect(0, height - floorH, width, floorH);

  const family = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
  const logoH = 12 * s;
  const logoW = mark.naturalWidth > 0 ? (mark.naturalWidth / mark.naturalHeight) * logoH : 0;
  if (logoW > 0) {
    const padX = 8 * s;
    const wrapH = 22 * s;
    const boxW = logoW + padX * 2;
    const boxX = 16 * s;
    const boxY = 8 * s;
    ctx.fillStyle = "rgba(9, 9, 11, 0.72)";
    roundRectPath(ctx, boxX, boxY, boxW, wrapH, wrapH / 2);
    ctx.fill();
    ctx.drawImage(mark, boxX + padX, boxY + (wrapH - logoH) / 2, logoW, logoH);
  }

  const inset = 16 * s;
  const right = width - inset;
  const copyTop = 16 * s;
  const copyBottom = 30 * s;
  const lines: { text: string; size: number; weight: string; color: string; gap: number }[] = [];
  if (input.shown.symbol) lines.push({ text: `$${input.symbol}`, size: 12 * s, weight: "600", color: "#fff", gap: 2 * s });
  if (input.shown.pnl) {
    lines.push({
      text: input.pnlLabel,
      size: 30 * s,
      weight: "700",
      color: input.up ? "#ccff00" : "#ff4d4d",
      gap: 4 * s,
    });
  }
  if (input.shown.value) lines.push({ text: input.valueLabel, size: 13 * s, weight: "600", color: "#fff", gap: 3 * s });
  if (input.shown.multiple) lines.push({ text: input.multipleLabel, size: 12 * s, weight: "600", color: "#fff", gap: 0 });

  const blockH = lines.reduce((sum, line, index) => sum + line.size + (index < lines.length - 1 ? line.gap : 0), 0);
  const areaH = height - copyTop - copyBottom;
  let y = copyTop + Math.max(0, (areaH - blockH) / 2);
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  for (const line of lines) {
    ctx.fillStyle = line.color;
    ctx.font = `${line.weight} ${line.size}px ${family}`;
    ctx.fillText(line.text, right, y);
    y += line.size + line.gap;
  }

  if (input.shown.wallet || input.shown.entry || input.shown.ath) {
    ctx.fillStyle = "#fff";
    ctx.font = `300 ${8 * s}px ${family}`;
    ctx.textBaseline = "bottom";
    const footY = height - 12 * s;
    if (input.shown.wallet) {
      ctx.textAlign = "left";
      ctx.fillText(input.walletLabel, inset, footY);
    }
    if (input.shown.entry) {
      ctx.textAlign = "center";
      ctx.fillText(input.entryLabel, width / 2, footY);
    }
    if (input.shown.ath) {
      ctx.textAlign = "right";
      ctx.fillText(input.athLabel, width - inset, footY);
    }
  }

  if (target) return null;
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function socials(
  launch: Launch,
  meta?: { website?: string; twitter?: string; telegram?: string; discord?: string; farcaster?: string },
  chain = false,
) {
  const provided = [
    linkChip("Website", meta?.website),
    linkChip("X", meta?.twitter),
    linkChip("Telegram", meta?.telegram),
    linkChip("Discord", meta?.discord),
    linkChip("Farcaster", meta?.farcaster),
  ].filter((item): item is { label: string; href: string } => Boolean(item));
  if (provided.length > 0 || launch.draft || chain) return provided;
  const slug = launch.symbol.toLowerCase();
  return [
    { label: "Website", href: `https://${slug}.lootingpad.com` },
    { label: "X", href: `https://x.com/${slug}` },
    { label: "Telegram", href: `https://t.me/${slug}` },
    { label: "Discord", href: `https://discord.gg/${slug}` },
  ];
}

function linkChip(label: string, value?: string) {
  const clean = value?.trim();
  if (!clean) return null;
  if (clean.startsWith("http")) return { label, href: clean };
  const handle = clean.replace(/^@/, "");
  const host =
    label === "X"
      ? "https://x.com/"
      : label === "Telegram"
        ? "https://t.me/"
        : label === "Discord"
          ? "https://discord.gg/"
          : label === "Farcaster"
            ? "https://warpcast.com/"
            : "https://";
  return { label, href: `${host}${handle}` };
}

function LinkGlyph({ label }: { label: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden>
      {label === "Website" && (
        <>
          <circle cx="12" cy="12" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <ellipse cx="12" cy="12" rx="3.4" ry="8.25" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path d="M3.75 12h16.5M5.1 8.1h13.8M5.1 15.9h13.8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </>
      )}
      {label === "X" && (
        <path
          fill="currentColor"
          d="M14.23 10.16 20.57 3h-1.5l-5.51 6.21L8.92 3H3.5l6.64 9.38L3.5 21h1.5l5.8-6.55L14.7 21h5.42l-6.89-10.84Zm-2.05 2.32-.67-.93-5.35-7.42h2.3l4.31 5.99.67.93 5.61 7.8h-2.3l-4.57-6.37Z"
        />
      )}
      {label === "Telegram" && (
        <path
          fill="currentColor"
          d="M21.2 4.6 2.9 11.7c-1.25.49-1.24 1.17-.23 1.48l4.7 1.47 10.87-6.86c.51-.31.98-.14.6.2l-8.8 7.94-.34 4.55c.46 0 .66-.21.92-.46l2.2-2.14 4.58 3.38c.84.46 1.45.22 1.66-.78l3-14.55c.31-1.24-.47-1.8-1.26-1.43Z"
        />
      )}
      {label === "Discord" && (
        <path
          fill="currentColor"
          d="M18.59 5.67A16.3 16.3 0 0 0 14.9 4.4l-.3.6a15 15 0 0 0-4.2 0l-.3-.6a16.2 16.2 0 0 0-3.7 1.27C3.7 9.5 3.1 13.2 3.4 16.86a16.6 16.6 0 0 0 4.95 2.5l.6-1c-.9-.34-1.75-.76-2.55-1.28l.32-.24c3.3 1.53 6.86 1.53 10.1 0l.33.24c-.8.52-1.66.94-2.56 1.28l.6 1a16.5 16.5 0 0 0 4.96-2.5c.4-4.2-.68-7.86-2.86-11.19ZM9.18 14.7c-.86 0-1.57-.8-1.57-1.77s.7-1.77 1.57-1.77 1.58.8 1.57 1.77-.7 1.77-1.57 1.77Zm5.64 0c-.86 0-1.57-.8-1.57-1.77s.7-1.77 1.57-1.77 1.58.8 1.57 1.77-.7 1.77-1.57 1.77Z"
        />
      )}
      {label === "Farcaster" && (
        <path
          fill="currentColor"
          d="M17.2 6.2h-2.1V4.4H8.9v1.8H6.8v8.2c0 1.7.7 2.6 2.1 2.6h.7v2.6h4.8v-2.6h.7c1.4 0 2.1-.9 2.1-2.6V6.2Zm-7.5 0h4.6V5.6H9.7v.6Z"
        />
      )}
    </svg>
  );
}

function LockBadgeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="10" width="14" height="11" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M8 10V8.2A4 4 0 0 1 12 4a4 4 0 0 1 4 4.2V10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="12" cy="15" r="1.35" fill="currentColor" />
    </svg>
  );
}

function DexscreenerBadgeIcon() {
  return <img src="/dexscreener.png" alt="" width={16} height={16} className="token-badge-img" decoding="async" />;
}

function BoostBadgeIcon() {
  // DexScreener Boost bolt (filled yellow lightning used on DS badges)
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M13.05 2.1 5.7 13.28c-.22.34.02.82.43.82h4.62l-1.1 7.66c-.08.55.6.9.97.5l8.05-11.18c.25-.35 0-.88-.43-.88h-4.9l1.28-7.6c.1-.55-.58-.92-.97-.5Z"
      />
    </svg>
  );
}

function QuoteAmount({ value }: { value: number }) {
  const amount = compactQuote(value);
  if (amount.kind === "plain") return <>{amount.text}</>;
  return (
    <span className="tiny-amt" title={value.toString()} aria-label={value.toString()}>
      {amount.sign}0.0<span className="tiny-zero">{amount.zeros}</span>
      {amount.digits}
    </span>
  );
}

function compactQuote(value: number):
  | { kind: "plain"; text: string }
  | { kind: "tiny"; sign: string; zeros: number; digits: string } {
  if (!Number.isFinite(value)) return { kind: "plain", text: "0" };
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs === 0) return { kind: "plain", text: "0" };
  if (abs >= 0.01) {
    const digits = abs >= 100 ? 2 : abs >= 1 ? 3 : 4;
    return { kind: "plain", text: `${sign}${trimZeros(abs.toFixed(digits))}` };
  }
  if (abs >= 0.001) {
    const truncated = Math.floor(abs * 1e4 + 1e-8) / 1e4;
    return { kind: "plain", text: `${sign}${trimZeros(truncated.toFixed(4))}` };
  }
  const [mantissa, expRaw] = abs.toExponential(3).split("e");
  const zeros = Math.abs(Number(expRaw)) - 1;
  const digits = mantissa.replace(".", "").replace(/0+$/, "").slice(0, 4);
  if (zeros < 3 || !digits) return { kind: "plain", text: `${sign}${trimZeros((Math.floor(abs * 1e4 + 1e-8) / 1e4).toFixed(4))}` };
  return { kind: "tiny", sign, zeros, digits };
}

function trimZeros(text: string) {
  return text.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

function formatEth(value: number) {
  if (!(value > 0) || !Number.isFinite(value)) return "0 ETH";
  if (value >= 100) return `${value.toFixed(1)} ETH`;
  if (value >= 1) return `${value.toFixed(2)} ETH`;
  if (value >= 0.01) return `${value.toFixed(4)} ETH`;
  if (value >= 0.0001) return `${value.toFixed(6)} ETH`;
  return `${value.toFixed(8)} ETH`;
}

function formatAmount(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toFixed(2);
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
