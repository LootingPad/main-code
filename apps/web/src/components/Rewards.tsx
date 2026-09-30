"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAppKitProvider } from "@reown/appkit/react";
import type { Address, EIP1193Provider, Hex } from "viem";
import { AllBoxesIcon, ClaimedIcon, HoldingIcon, IneligibleIcon, UnclaimedIcon } from "@/components/Icons";
import { PageFlash, PageInfo, PageTitle } from "@/components/PageInfo";
import { Pager } from "@/components/Pager";
import { TokenLogo } from "@/components/TokenLogo";
import { SlidingTabs } from "@/components/SlidingTabs";
import { useWallet } from "@/components/Wallet";
import {
  claimLuckyBox,
  confirmLuckyBoxClaim,
  getAnalytics,
  getRewardTable,
  getWalletLuckyBoxes,
  openLuckyBox,
  ApiError,
} from "@/lib/api";
import { formatUsd, shortAddress, formatCompactDecimal } from "@/lib/format";
import type { BoxStatus, LuckyBox } from "@/lib/types";
import { useAsyncData } from "@/lib/use-async-data";
import { robinhoodChain } from "@/lib/chains";

const FALLBACK_POOL = ["No reward"];

const statusLabel: Record<BoxStatus, string> = {
  unopened: "Unclaimed",
  opened: "Unclaimed",
  claimed: "Claimed",
  holding: "In market",
  ineligible: "Not eligible",
};

const CASE_ITEM = 128;
const CASE_GAP = 10;
const CASE_STEP = CASE_ITEM + CASE_GAP;
const BOXES_PER_PAGE = 12;

type RewardFilter = "all" | "unclaimed" | "holding" | "claimed" | "ineligible";

const rewardFilters = [
  { id: "all" as const, label: "All", icon: <AllBoxesIcon /> },
  { id: "unclaimed" as const, label: "Unclaimed", icon: <UnclaimedIcon /> },
  { id: "holding" as const, label: "In market", icon: <HoldingIcon /> },
  { id: "claimed" as const, label: "Claimed", icon: <ClaimedIcon /> },
  { id: "ineligible" as const, label: "Not eligible", icon: <IneligibleIcon /> },
];

function canClaim(box: LuckyBox) {
  return box.status === "unopened" || box.status === "opened";
}

function boxTicker(box: LuckyBox) {
  if (box.symbol) return box.symbol;
  if (box.token.startsWith("0x") && box.token.length >= 10) return shortAddress(box.token);
  return box.token;
}

function friendlyOpenError(err: { message?: string; code?: string } | Error) {
  const code = "code" in err ? String(err.code ?? "") : "";
  const raw = (err.message ?? "").trim();
  if (code === "PRIZE_SETTLE_UNAVAILABLE" || /QUOTE_FAILED|quoteExactInputSingle|no V3 route/i.test(raw)) {
    return "Prize token has no swap liquidity — we’ll pay ETH instead on retry, or try Open again.";
  }
  if (code === "PRIZE_SETTLE_ERROR" || /SETTLE|MODULE_NOT_SET|KEEPER/i.test(raw)) {
    return "Could not settle prize. Box left sealed — try Open again.";
  }
  if (code === "STILL_IN_MARKET") return "Exit the position fully before opening this box.";
  if (/reject|denied|cancel/i.test(raw)) return "Transaction cancelled.";
  if (raw.length > 160 || /viem@|Contract Function|Docs: https/i.test(raw)) {
    return "Could not open box — try again.";
  }
  return raw || "Could not open box — try again.";
}

function actionLabel(box: LuckyBox, busyLocal: boolean) {
  if (busyLocal) return box.status === "opened" ? "Claiming" : "Opening";
  if (box.status === "opened" || box.claimableOnChain) return "Claim ETH";
  return "Open";
}

function formatPrizeAmount(amount: number | undefined, symbol: string | undefined): string | null {
  if (amount == null || !Number.isFinite(amount) || amount <= 0 || !symbol) return null;
  return `${formatCompactDecimal(amount)} ${symbol}`;
}

function prizeHeadline(box: LuckyBox): string {
  const label = box.reward;
  if (!label) {
    if (box.status === "ineligible") return "—";
    if (box.status === "claimed") return "No reward";
    return "Sealed";
  }
  if (label.toLowerCase() === "no reward") return label;
  const amt = formatPrizeAmount(box.prizeAmount, box.prizeSymbol);
  if (amt) return amt;
  // Prefer the prize label over raw pool-ETH spend for ERC-20 wins.
  if (box.prizeKind === "erc20") return label;
  if (box.payoutEth) return box.payoutEth;
  return label;
}

function prizeDisplay(box: LuckyBox): string {
  const head = prizeHeadline(box);
  if (box.payoutUsd != null && box.payoutUsd > 0 && head.toLowerCase() !== "no reward" && head !== "—" && head !== "Sealed") {
    return `${head} · ${formatUsd(box.payoutUsd)}`;
  }
  return head;
}

function boxPoolDisplay(box: LuckyBox): string {
  if (box.boxPoolUsd != null && box.boxPoolUsd > 0) return formatUsd(box.boxPoolUsd);
  if (box.boxPoolEth != null && box.boxPoolEth > 0) return `${formatCompactDecimal(box.boxPoolEth)} ETH`;
  return "—";
}

function ShareCard({
  token,
  boxId,
  reward,
  children,
}: {
  token: string;
  boxId: string;
  reward: string;
  children?: ReactNode;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancel = false;
    const mark = new Image();
    const scene = new Image();
    mark.src = "/logo-wordmark.png";
    scene.src = "/sharecard-bg.png";

    const paint = () => {
      if (cancel) return;
      if (!mark.complete || !scene.complete) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const width = 1920;
      const height = 1080;
      const pixel = 2;
      canvas.width = width * pixel;
      canvas.height = height * pixel;
      ctx.setTransform(pixel, 0, 0, pixel, 0, 0);

      ctx.fillStyle = "#09090b";
      ctx.fillRect(0, 0, width, height);

      if (scene.naturalWidth > 0) {
        ctx.drawImage(scene, 0, 0, scene.naturalWidth, scene.naturalHeight, 0, 0, width, height);
        // Wide ease-in fade so the art → black blend stays soft (no hard edge).
        const fade = ctx.createLinearGradient(20, 0, 1320, 0);
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
        const floor = ctx.createLinearGradient(0, 900, 0, height);
        floor.addColorStop(0, "rgba(9, 9, 11, 0)");
        floor.addColorStop(0.35, "rgba(9, 9, 11, 0.12)");
        floor.addColorStop(0.7, "rgba(9, 9, 11, 0.4)");
        floor.addColorStop(1, "rgba(9, 9, 11, 0.78)");
        ctx.fillStyle = floor;
        ctx.fillRect(0, 900, width, height - 900);
      }

      const family = getComputedStyle(document.body).fontFamily;
      ctx.textBaseline = "top";

      const logoH = 58;
      const logoW = mark.naturalWidth > 0 ? (mark.naturalWidth / mark.naturalHeight) * logoH : 0;
      if (logoW > 0) ctx.drawImage(mark, width - 88 - logoW, 72, logoW, logoH);

      const centerX = 1460;
      ctx.textAlign = "center";

      const claimedSize = 32;
      const claimed = "Just Claimed";
      let prizeSize = 112;
      ctx.font = `700 ${prizeSize}px ${family}`;
      while (ctx.measureText(reward).width > 760 && prizeSize > 64) {
        prizeSize -= 2;
        ctx.font = `700 ${prizeSize}px ${family}`;
      }
      const metaSize = 30;
      const meta = `Box #${boxId}`;
      const ctaSize = 36;
      const cta = "Claim your Lucky box now";
      const blockH = claimedSize + 22 + prizeSize + 20 + metaSize + 28 + ctaSize;
      let y = Math.round((height - blockH) / 2) + 12;

      ctx.fillStyle = "#f5f5f5";
      ctx.font = `600 ${claimedSize}px ${family}`;
      ctx.fillText(claimed, centerX, y);
      y += claimedSize + 22;

      ctx.fillStyle = reward === "No reward" ? "#9b9b9b" : "#ccff00";
      ctx.font = `700 ${prizeSize}px ${family}`;
      ctx.fillText(reward, centerX, y);
      y += prizeSize + 20;

      ctx.fillStyle = "#9a9aa2";
      ctx.font = `500 ${metaSize}px ${family}`;
      ctx.fillText(meta, centerX, y);
      y += metaSize + 28;

      ctx.fillStyle = "#f5f5f5";
      ctx.font = `600 ${ctaSize}px ${family}`;
      ctx.fillText(cta, centerX, y);

      ctx.textBaseline = "alphabetic";
      ctx.font = `500 24px ${family}`;
      ctx.fillStyle = "#b4b4bc";
      ctx.textAlign = "right";
      ctx.fillText("lootingpad.com  |  Robinhood Chain", width - 72, 1032);
    };

    mark.onload = paint;
    scene.onload = paint;
    mark.onerror = paint;
    scene.onerror = paint;
    paint();

    return () => {
      cancel = true;
    };
  }, [boxId, reward, token]);

  async function share() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;
    const file = new File([blob], `looting-${token.toLowerCase()}-box-${boxId}.png`, { type: "image/png" });
    const payload = { files: [file], title: "LOOTING Lucky Box", text: `Lucky box $${token}: ${reward}` };
    if (navigator.canShare?.(payload)) {
      try {
        await navigator.share(payload);
        setNote("Shared");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    link.click();
    URL.revokeObjectURL(url);
    setNote("Image saved");
  }

  return (
    <div className="share-card">
      <canvas ref={canvasRef} className="share-canvas" aria-label={`Share card, ${reward}`} />
      <div className="claim-actions">
        <button type="button" className="claim-btn claim-all" onClick={share}>
          Share
        </button>
        {children}
      </div>
      {note ? <p className="page-note">{note}</p> : null}
    </div>
  );
}

function PrizeReveal({
  reward,
  rewardPool,
  box,
  onDone,
}: {
  reward: string;
  rewardPool: string[];
  box: LuckyBox;
  onDone: () => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const pool = rewardPool.length > 0 ? rewardPool : FALLBACK_POOL;
  const copies = 12;
  const strip = useRef(Array.from({ length: copies }, () => pool).flat()).current;
  const winner = Math.max(0, pool.indexOf(reward));
  const landIndex = (copies - 2) * pool.length + winner;
  const startIndex = Math.max(0, landIndex - pool.length * 7);

  const [shift, setShift] = useState(0);
  const [ready, setReady] = useState(false);
  const [landed, setLanded] = useState(false);
  const empty = reward === "No reward";
  const amountLine = formatPrizeAmount(box.prizeAmount, box.prizeSymbol) ?? (empty ? null : reward);
  const usdLine =
    !empty && box.payoutUsd != null && box.payoutUsd > 0 ? formatUsd(box.payoutUsd) : null;

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const center = track.clientWidth / 2 - CASE_ITEM / 2;
    const from = center - startIndex * CASE_STEP;
    const to = center - landIndex * CASE_STEP;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      setShift(to);
      setReady(true);
      setLanded(true);
      const id = window.setTimeout(() => doneRef.current(), 500);
      return () => window.clearTimeout(id);
    }

    setShift(from);
    setReady(false);
    const start = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setReady(true);
        setShift(to);
      });
    });
    const lock = window.setTimeout(() => setLanded(true), 3400);
    const done = window.setTimeout(() => doneRef.current(), 5600);
    return () => {
      window.cancelAnimationFrame(start);
      window.clearTimeout(lock);
      window.clearTimeout(done);
    };
  }, [landIndex, startIndex]);

  return (
    <div className={`case-open${landed ? " is-landed" : ""}${empty ? " is-empty" : ""}`}>
      <div className="case-track" ref={trackRef}>
        <div className="case-fade case-fade-left" aria-hidden />
        <div className="case-fade case-fade-right" aria-hidden />
        <div className="case-needle" aria-hidden />
        <div
          className={`case-strip${ready ? " is-running" : ""}`}
          style={{ transform: `translate3d(${shift}px, 0, 0)` }}
        >
          {strip.map((prize, index) => {
            const isWin = landed && index === landIndex;
            return (
              <div
                key={`${prize}-${index}`}
                className={`case-item${prize === "No reward" ? " is-miss" : ""}${isWin ? " is-win" : ""}`}
              >
                <span>{prize}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="case-meta">
        {landed ? (
          <>
            <strong className="case-prize">{amountLine ?? reward}</strong>
            {usdLine ? <p className="case-prize-usd">{usdLine}</p> : null}
            <p className="page-note">
              {empty ? "No reward this time" : usdLine ? "Prize value in USD" : "Prize locked in"}
            </p>
          </>
        ) : (
          <p className="page-note">Opening box…</p>
        )}
      </div>
    </div>
  );
}

export function Rewards() {
  const { connected, address, connect } = useWallet();
  const { walletProvider } = useAppKitProvider<EIP1193Provider>("eip155");
  const {
    data: remoteBoxes,
    loading: boxesLoading,
    error: boxesError,
    reload: reloadBoxes,
  } = useAsyncData(() => getWalletLuckyBoxes(address), [address], {
    initial: [],
    enabled: connected,
    pollMs: 3_000,
  });
  const { data: rewardTable } = useAsyncData(() => getRewardTable(), [], {
    initial: null,
  });
  const { data: analytics, reload: reloadAnalytics } = useAsyncData(() => getAnalytics("all"), [], {
    initial: null,
    pollMs: 3_000,
  });
  const rewardPool = rewardTable?.rewardPool?.length ? rewardTable.rewardPool : FALLBACK_POOL;
  // Prefer live sum of launch pools on this page when available; fall back to analytics.
  const livePoolsUsd = (() => {
    const seen = new Set<string>();
    let sum = 0;
    for (const box of remoteBoxes) {
      const key = (box.token || box.symbol || box.id).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      if (box.boxPoolUsd != null && box.boxPoolUsd > 0) sum += box.boxPoolUsd;
    }
    return sum;
  })();
  const poolUsd = livePoolsUsd > 0 ? livePoolsUsd : (analytics?.fees?.boxUsd ?? 0);

  const [boxes, setBoxes] = useState<LuckyBox[]>([]);
  const [filter, setFilter] = useState<RewardFilter>("all");
  const [page, setPage] = useState(1);
  const [reel, setReel] = useState<{
    box: LuckyBox;
    reward: string;
    phase: "spin" | "land";
    needsClaim: boolean;
    claimed: boolean;
  } | null>(null);
  const [opening, setOpening] = useState(false);
  const [claimNote, setClaimNote] = useState("");
  const queueRef = useRef<LuckyBox[]>([]);
  const granted = useRef(new Set<string>());

  function refreshRewards() {
    void reloadBoxes();
    void reloadAnalytics();
  }

  useEffect(() => {
    if (!connected) {
      setBoxes([]);
      return;
    }
    setBoxes((prev) => {
      if (prev.length === 0) return remoteBoxes;
      const localById = new Map(prev.map((box) => [box.id, box]));
      return remoteBoxes.map((remote) => {
        const local = localById.get(remote.id);
        if (!local) return remote;
        // Keep optimistic claim while indexer/API catches up; always take live pool.
        if (granted.current.has(remote.id) && local.status === "claimed" && remote.status !== "claimed") {
          return {
            ...local,
            boxPoolEth: remote.boxPoolEth ?? local.boxPoolEth,
            boxPoolUsd: remote.boxPoolUsd ?? local.boxPoolUsd,
          };
        }
        return remote;
      });
    });
  }, [connected, address, remoteBoxes]);

  useEffect(() => {
    granted.current = new Set();
    setFilter("all");
    setPage(1);
  }, [connected, address]);

  useEffect(() => {
    setPage(1);
  }, [filter]);

  const ready = boxes.filter(canClaim).length;
  const claimed = boxes.filter((box) => box.status === "claimed").length;
  const holding = boxes.filter((box) => box.status === "holding").length;
  const visible = boxes.filter((box) => {
    if (filter === "unclaimed") return canClaim(box);
    if (filter === "holding") return box.status === "holding";
    if (filter === "claimed") return box.status === "claimed";
    if (filter === "ineligible") return box.status === "ineligible";
    return true;
  });
  const pages = Math.max(1, Math.ceil(visible.length / BOXES_PER_PAGE));
  const safePage = Math.min(page, pages);
  const paged = visible.slice((safePage - 1) * BOXES_PER_PAGE, safePage * BOXES_PER_PAGE);
  const busy = Boolean(reel) || opening;

  function grant(box: LuckyBox, reward: string, patch?: Partial<LuckyBox>) {
    if (granted.current.has(box.id)) return;
    granted.current.add(box.id);
    setBoxes((current) =>
      current.map((item) =>
        item.id === box.id
          ? {
              ...item,
              ...patch,
              status: "claimed",
              reward,
              claimableOnChain: false,
              tx: patch?.tx ?? item.tx,
              claimedAt: patch?.claimedAt ?? item.claimedAt ?? "now",
            }
          : item,
      ),
    );
  }

  async function settleOnChainClaim(box: LuckyBox): Promise<string | undefined> {
    if (!walletProvider || !address) return undefined;
    const prepared = await claimLuckyBox(box.id, address);
    if (!prepared.onChain || !prepared.calls?.length) {
      await confirmLuckyBoxClaim(box.id, { wallet: address });
      return undefined;
    }
    const call = prepared.calls[0];
    const txHash = (await walletProvider.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: address as Address,
          to: call.to,
          data: call.data as Hex,
          value: call.value && call.value !== "0" ? `0x${BigInt(call.value).toString(16)}` : undefined,
          chainId: `0x${robinhoodChain.id.toString(16)}`,
        },
      ],
    })) as string;
    await confirmLuckyBoxClaim(box.id, { wallet: address, txHash });
    return txHash;
  }

  async function openReel(box: LuckyBox) {
    // Already opened with pending ETH — animate reveal, Collect triggers wallet sign.
    if (box.status === "opened" || box.claimableOnChain) {
      const reward = box.reward ?? "ETH prize";
      setReel({
        box: { ...box, reward },
        reward,
        phase: "spin",
        needsClaim: true,
        claimed: false,
      });
      return;
    }

    let next: LuckyBox = { ...box };
    let claimableOnChain = false;
    try {
      const res = await openLuckyBox(box.id, address);
      next = {
        ...box,
        ...res.data,
        reward: res.data?.reward ?? res.reward ?? box.reward,
        prizeKind: res.data?.prizeKind ?? res.kind ?? box.prizeKind,
        creditedWei: res.creditedWei ?? res.data?.creditedWei,
        payoutUsd: res.payoutUsd ?? res.data?.payoutUsd ?? undefined,
        prizeAmount: res.prizeAmount ?? res.data?.prizeAmount ?? undefined,
        prizeSymbol: res.prizeSymbol ?? res.data?.prizeSymbol ?? undefined,
        claimableOnChain: Boolean(res.claimableOnChain ?? res.data?.claimableOnChain),
        tx: res.swapTx ?? res.creditTx ?? res.data?.tx ?? box.tx,
        status: Boolean(res.claimableOnChain ?? res.data?.claimableOnChain)
          ? "opened"
          : (res.data?.status ?? box.status),
      };
      claimableOnChain = Boolean(next.claimableOnChain);
      setBoxes((current) => current.map((item) => (item.id === box.id ? next : item)));
      refreshRewards();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? friendlyOpenError(err)
          : err instanceof Error
            ? friendlyOpenError(err)
            : "Could not open box — try again.";
      setClaimNote(msg);
      return;
    }

    const reward = next.reward ?? "";
    if (!reward) {
      setClaimNote("Open succeeded but no reward label was returned.");
      return;
    }

    if (next.prizeKind === "erc20" && next.prizeSymbol) {
      setClaimNote(`Won ${formatPrizeAmount(next.prizeAmount, next.prizeSymbol) ?? next.prizeSymbol}.`);
    } else if (next.prizeKind === "miss" || reward.toLowerCase() === "no reward") {
      setClaimNote("No prize this time — pool share stays for other boxes.");
    } else if (claimableOnChain) {
      setClaimNote("Prize ready — Collect to claim into your wallet.");
    } else if (next.prizeKind === "eth" || next.payoutEth) {
      setClaimNote("Prize ready.");
    }

    // Animate first. Wallet sign happens on Collect when ETH still needs claim.
    setReel({
      box: { ...next, reward },
      reward,
      phase: "spin",
      needsClaim: claimableOnChain,
      claimed: !claimableOnChain,
    });
  }

  async function claimMany(list: LuckyBox[]) {
    const targets = list.filter((box) => canClaim(box) && !granted.current.has(box.id));
    if (targets.length === 0 || busy) return;
    if (!walletProvider) {
      connect();
      return;
    }
    queueRef.current = targets.slice(1);
    setOpening(true);
    setClaimNote("");
    try {
      await openReel(targets[0]);
    } finally {
      setOpening(false);
    }
  }

  function finishSpin() {
    setReel((current) => {
      if (!current || current.phase === "land") return current;
      // ETH still needs a wallet claim — keep box opened, don't mark claimed yet.
      if (!current.needsClaim) {
        grant(current.box, current.box.reward ?? current.reward, {
          tx: current.box.tx,
          payoutEth: current.box.payoutEth,
          payoutUsd: current.box.payoutUsd,
          prizeAmount: current.box.prizeAmount,
          prizeSymbol: current.box.prizeSymbol,
          prizeKind: current.box.prizeKind,
          creditedWei: current.box.creditedWei,
          boxPoolEth: current.box.boxPoolEth,
          boxPoolUsd: current.box.boxPoolUsd,
        });
        refreshRewards();
      } else {
        setBoxes((boxesNow) =>
          boxesNow.map((item) =>
            item.id === current.box.id
              ? {
                  ...item,
                  ...current.box,
                  status: "opened",
                  claimableOnChain: true,
                  reward: current.box.reward ?? current.reward,
                }
              : item,
          ),
        );
      }
      return { ...current, phase: "land" };
    });
  }

  function closeReel() {
    setReel(null);
    queueRef.current = [];
    refreshRewards();
  }

  async function collect() {
    if (!reel) return;

    // Collect = wallet sign for ETH prizes that were credited at open.
    if (reel.needsClaim && !reel.claimed) {
      if (!walletProvider) {
        connect();
        return;
      }
      setOpening(true);
      try {
        const claimTx = await settleOnChainClaim(reel.box);
        const reward = reel.box.reward ?? reel.reward;
        grant(reel.box, reward, {
          tx: claimTx,
          payoutEth: reel.box.payoutEth,
          payoutUsd: reel.box.payoutUsd,
          prizeAmount: reel.box.prizeAmount,
          prizeSymbol: reel.box.prizeSymbol,
          prizeKind: reel.box.prizeKind,
          creditedWei: reel.box.creditedWei,
          boxPoolEth: reel.box.boxPoolEth,
          boxPoolUsd: reel.box.boxPoolUsd,
        });
        setClaimNote(
          reel.box.payoutEth
            ? `Claimed ${reel.box.payoutEth} from the launch box pool.`
            : "ETH prize claimed on-chain.",
        );
        refreshRewards();
        setReel({
          ...reel,
          box: { ...reel.box, status: "claimed", claimableOnChain: false, tx: claimTx },
          claimed: true,
          needsClaim: false,
          phase: "land",
        });
      } catch (err) {
        setClaimNote(err instanceof Error ? err.message : "On-chain claim failed — try Collect again.");
      } finally {
        setOpening(false);
      }
      return;
    }

    const next = queueRef.current.shift();
    if (!next) {
      setReel(null);
      return;
    }
    setOpening(true);
    try {
      await openReel(next);
    } finally {
      setOpening(false);
    }
  }

  useEffect(() => {
    if (!reel) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeReel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reel]);

  return (
    <div className="rewards-page">
      <div className="page-head">
        <PageTitle tip="Season 01 · Buy ≥ $5, exit, then open. Wins roll a random share of that launch’s box pool (fair share = pool ÷ unopened boxes). ETH prizes need a wallet claim; ERC-20 prizes settle at open.">
          Lucky Boxes
        </PageTitle>
        <div className="rewards-stats">
          <button type="button" className={filter === "unclaimed" ? "is-ready on" : "is-ready"} onClick={() => setFilter("unclaimed")}>
            <span>Ready</span>
            <strong>{ready}</strong>
          </button>
          <button type="button" className={filter === "holding" ? "on" : ""} onClick={() => setFilter("holding")}>
            <span>In market</span>
            <strong>{holding}</strong>
          </button>
          <button type="button" className={filter === "claimed" ? "on" : ""} onClick={() => setFilter("claimed")}>
            <span>Claimed</span>
            <strong>{claimed}</strong>
          </button>
          <div
            className="rewards-stat is-pool"
            title="Remaining on-chain Lucky Box pool across tokens you've traded (one pool per token, summed). Each claim takes a share — leftover stays on that token for later boxes."
          >
            <span>Left</span>
            <strong>{formatUsd(poolUsd)}</strong>
          </div>
        </div>
      </div>
      <PageFlash note={claimNote} onClear={() => setClaimNote("")} />
      {!connected ? (
        <section className="sheet rewards-gate">
          <p className="account-kicker">Holding history</p>
          <div className="page-title-row">
            <p className="rewards-gate-title">Connect to check eligibility</p>
            <PageInfo tip="A box opens after you exit a token launched on LOOTING. A wallet that never bought one is not eligible." label="Eligibility" />
          </div>
          <button type="button" className="claim-btn claim-all" onClick={connect}>
            Connect
          </button>
        </section>
      ) : null}
      {connected ? <SlidingTabs ariaLabel="Box status" items={rewardFilters} value={filter} onChange={setFilter} /> : null}
      {connected ? (
        <>
      <div className="table-wrap rewards-board">
        <table className="coin-table rewards-table">
          <thead>
            <tr>
              <th>Box</th>
              <th>Coin</th>
              <th title="Remaining Lucky Box pool on this token (same for every box of that coin)">Left</th>
              <th>Reward</th>
              <th>Txn</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {boxesLoading ? (
              <tr>
                <td className="rewards-empty" colSpan={7}>
                  Loading boxes…
                </td>
              </tr>
            ) : null}
            {!boxesLoading && boxesError ? (
              <tr>
                <td className="rewards-empty" colSpan={7}>
                  {boxesError}
                </td>
              </tr>
            ) : null}
            {!boxesLoading && !boxesError && paged.length === 0 ? (
              <tr>
                <td className="rewards-empty" colSpan={7}>
                  No boxes yet — buy ≥ $5 on a LOOTING launch, then exit to unlock.
                </td>
              </tr>
            ) : null}
            {!boxesLoading && !boxesError
              ? paged.map((box) => {
                  const open = canClaim(box);
                  const active = reel?.box.id === box.id;
                  const prize = prizeDisplay(box);
                  const sealed = !box.reward && box.status !== "claimed" && box.status !== "ineligible";
                  const poolLabel = boxPoolDisplay(box);
                  return (
                    <tr key={box.id} className={active && reel?.phase === "land" ? "is-claiming" : undefined}>
                      <td className="num text-left">
                        <span className="box-id">#{box.id}</span>
                      </td>
                      <td className="text-left">
                        <span className="reward-coin">
                          <TokenLogo symbol={boxTicker(box)} size={28} />${boxTicker(box)}
                        </span>
                      </td>
                      <td className="text-left">
                        <span className={`reward-pool${poolLabel === "—" ? " is-empty" : ""}`} title="Remaining Lucky Box pool on this token">
                          {poolLabel}
                        </span>
                      </td>
                      <td className="text-left">
                        <span
                          className={`reward-prize${
                            sealed
                              ? " is-hidden"
                              : prize.toLowerCase() === "no reward" || prize === "—"
                                ? " is-empty"
                                : " is-won"
                          }`}
                        >
                          {prize}
                        </span>
                      </td>
                      <td className="text-left">
                        {box.tx ? (
                          <span className="reward-tx">
                            {shortAddress(box.tx)}
                            <span>{box.claimedAt ?? (box.payoutEth ? "payout" : "")}</span>
                          </span>
                        ) : (
                          <span className="reward-idle">—</span>
                        )}
                      </td>
                      <td className="text-left">
                        <span className={`status ${box.status === "opened" ? "unopened" : box.status}`}>{statusLabel[box.status]}</span>
                      </td>
                      <td className="text-right">
                        {open ? (
                          <button type="button" className="claim-btn" disabled={busy} onClick={() => void claimMany([box])}>
                            {actionLabel(box, active || (opening && !reel))}
                          </button>
                        ) : (
                          <span className="reward-idle">{box.status === "holding" ? "Exit to open" : "—"}</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              : null}
          </tbody>
        </table>
        {visible.length > BOXES_PER_PAGE ? (
          <Pager page={safePage} pages={pages} onChange={setPage} />
        ) : null}
      </div>
      <section className="sheet rewards-mobile-board">
        <ul className="app-rows">
          {boxesLoading ? <li className="is-empty">Loading boxes…</li> : null}
          {!boxesLoading && boxesError ? <li className="is-empty">{boxesError}</li> : null}
          {!boxesLoading && !boxesError && paged.length === 0 ? (
            <li className="is-empty">No boxes yet — buy ≥ $5 on a LOOTING launch, then exit to unlock.</li>
          ) : null}
          {!boxesLoading && !boxesError
            ? paged.map((box) => {
                const open = canClaim(box);
                const active = reel?.box.id === box.id;
                const prize = prizeDisplay(box);
                const poolLabel = boxPoolDisplay(box);
                return (
                  <li key={box.id}>
                    <TokenLogo symbol={boxTicker(box)} size={32} />
                    <div>
                      <strong>${boxTicker(box)}</strong>
                      <span>
                        #{box.id} · {statusLabel[box.status]}
                        {poolLabel !== "—" ? ` · Left ${poolLabel}` : ""}
                        {box.reward || box.status === "claimed" ? ` · ${prize}` : ""}
                      </span>
                    </div>
                    {open ? (
                      <button type="button" className="claim-btn" disabled={busy} onClick={() => void claimMany([box])}>
                        {actionLabel(box, active || (opening && !reel))}
                      </button>
                    ) : (
                      <b>{box.status === "holding" ? "Exit" : box.status === "claimed" ? "Done" : "—"}</b>
                    )}
                  </li>
                );
              })
            : null}
        </ul>
        {visible.length > BOXES_PER_PAGE ? (
          <Pager page={safePage} pages={pages} onChange={setPage} />
        ) : null}
      </section>
        </>
      ) : null}
      {reel && (
        <div className="claim-pop" role="dialog" aria-modal="true" aria-label={`Lucky box ${boxTicker(reel.box)}`}>
          <button type="button" className="claim-pop-backdrop" aria-label="Close" onClick={closeReel} />
          <div className="claim-card">
            {reel.phase === "land" ? (
              <>
                <p className="kicker">{reel.needsClaim && !reel.claimed ? "Prize ready" : "Share card"}</p>
                <h2 className="claim-title case-prize">{prizeDisplay(reel.box)}</h2>
                <ShareCard
                  token={boxTicker(reel.box)}
                  boxId={reel.box.id}
                  reward={prizeDisplay(reel.box)}
                >
                  <button type="button" className="claim-btn" disabled={opening} onClick={() => void collect()}>
                    {opening
                      ? "Confirm in wallet…"
                      : reel.needsClaim && !reel.claimed
                        ? "Collect"
                        : queueRef.current.length > 0
                          ? "Next box"
                          : "Done"}
                  </button>
                </ShareCard>
              </>
            ) : (
              <>
                <p className="kicker">Lucky box</p>
                <h2 className="claim-title">${boxTicker(reel.box)}</h2>
                <PrizeReveal
                  key={`${reel.box.id}-${reel.reward}`}
                  reward={reel.reward}
                  rewardPool={rewardPool}
                  box={reel.box}
                  onDone={finishSpin}
                />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
