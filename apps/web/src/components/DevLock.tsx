"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getFees, getLaunches, getWalletDevLocks } from "@/lib/api";
import { DEV_LOCK_FEE_ETH } from "@/lib/fees";
import type { Cadence, DevLock, DevLockMode, Launch } from "@/lib/types";
import { useAsyncData } from "@/lib/use-async-data";
import { Pager } from "./Pager";
import { SlidingTabs } from "./SlidingTabs";
import { TokenLogo } from "./TokenLogo";
import { useWallet } from "./Wallet";

const DAY = 24 * 60 * 60 * 1000;
const LOCKS_PER_PAGE = 4;
const DEMO_BALANCE = 10_000_000;

const TIME_PRESETS = [
  { id: "30", label: "30 days", days: 30 },
  { id: "90", label: "90 days", days: 90 },
  { id: "180", label: "180 days", days: 180 },
  { id: "365", label: "1 year", days: 365 },
  { id: "custom", label: "Custom", days: 0 },
] as const;

const CLIFFS = [
  { id: "0", label: "No cliff", days: 0 },
  { id: "30", label: "30 days", days: 30 },
  { id: "90", label: "90 days", days: 90 },
] as const;

const LENGTHS = [
  { id: "180", label: "6 months", days: 180 },
  { id: "365", label: "1 year", days: 365 },
  { id: "730", label: "2 years", days: 730 },
] as const;

const CADENCES = [
  { id: "day", label: "Daily", unit: "day", days: 1 },
  { id: "week", label: "Weekly", unit: "week", days: 7 },
  { id: "month", label: "Monthly", unit: "month", days: 30 },
] as const;

type Mode = DevLockMode;
type Lock = DevLock;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDate(ms: number) {
  const date = new Date(ms);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

function isoDate(ms: number) {
  const date = new Date(ms);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return NaN;
  return Date.UTC(year, month - 1, day);
}

function formatTokens(value: number) {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) {
    const scaled = abs / 1_000_000;
    return `${sign}${scaled >= 10 ? scaled.toFixed(1) : scaled.toFixed(2)}M`;
  }
  if (abs >= 10_000) return `${sign}${Math.round(abs / 1000)}K`;
  return `${sign}${Math.round(abs).toLocaleString("en-US")}`;
}

function formatFull(value: number) {
  return Math.round(value).toLocaleString("en-US");
}

function daysBetween(from: number, to: number) {
  return Math.max(0, Math.round((to - from) / DAY));
}

function vestedAmount(lock: Lock, now = Date.now()) {
  if (now >= lock.unlock) return lock.amount;
  if (lock.mode === "time" || now <= lock.cliff) return 0;
  const span = lock.unlock - lock.cliff;
  if (span <= 0) return lock.amount;
  return lock.amount * ((now - lock.cliff) / span);
}

function claimableAmount(lock: Lock) {
  return Math.max(0, vestedAmount(lock) - lock.claimed);
}

function lockModeLabel(mode: Mode) {
  return mode === "time" ? "Time-based" : "Vesting";
}

function lockStatusLine(lock: Lock) {
  const now = Date.now();
  const vested = vestedAmount(lock, now);
  const left = lock.amount - vested;
  if (lock.mode === "time") {
    return left > 0
      ? `Unlocks ${formatDate(lock.unlock)} · ${daysBetween(now, lock.unlock)} days`
      : `Unlocked ${formatDate(lock.unlock)}`;
  }
  if (vested <= 1) {
    return lock.cliff > lock.start
      ? `Cliff until ${formatDate(lock.cliff)}`
      : `Vests through ${formatDate(lock.unlock)}`;
  }
  return `${formatTokens(vested)} unlocked · ends ${formatDate(lock.unlock)}`;
}

function LockShareCard({
  lock,
  onClose,
  launches,
}: {
  lock: Lock;
  onClose: () => void;
  launches: Launch[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [note, setNote] = useState("");
  const now = Date.now();
  const vested = vestedAmount(lock, now);
  const progress = lock.amount > 0 ? vested / lock.amount : 0;
  const unlockedPct = Math.round(progress * 100);
  const modeLabel = lockModeLabel(lock.mode);
  const daysLeft = daysBetween(now, lock.unlock);
  const unlockLine =
    daysLeft > 0
      ? `Unlocks ${formatDate(lock.unlock)} · ${daysLeft} days`
      : `Unlocked ${formatDate(lock.unlock)}`;
  const amountLabel = `${formatTokens(lock.amount)} ${lock.symbol}`;
  const launch = launches.find((item) => item.address === lock.address || item.symbol === lock.symbol);
  const totalSupply = launch && launch.priceUsd > 0 ? launch.marketCap / launch.priceUsd : 0;
  const supplyPct = totalSupply > 0 ? (lock.amount / totalSupply) * 100 : 0;
  const supplyPctLabel =
    supplyPct >= 10 ? supplyPct.toFixed(1) : supplyPct >= 1 ? supplyPct.toFixed(2) : supplyPct.toFixed(3);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancel = false;
    const mark = new Image();
    mark.src = "/logo-wordmark.png";

    const paint = async () => {
      if (cancel) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const root = getComputedStyle(document.documentElement);
      const soraName = root.getPropertyValue("--font-sora").trim() || "Sora";
      const jakartaName = root.getPropertyValue("--font-jakarta").trim() || "Plus Jakarta Sans";
      const display = `${soraName}, system-ui, sans-serif`;
      const sans = `${jakartaName}, system-ui, sans-serif`;
      try {
        await document.fonts.ready;
        await Promise.all([
          document.fonts.load(`700 128px ${display}`),
          document.fonts.load(`700 72px ${display}`),
          document.fonts.load(`700 36px ${display}`),
          document.fonts.load(`600 30px ${sans}`),
          document.fonts.load(`500 24px ${sans}`),
        ]);
      } catch {
        /* canvas still paints with fallbacks */
      }
      if (cancel) return;

      const width = 1920;
      const height = 1080;
      const pixel = Math.max(2, Math.min(3, Math.round(window.devicePixelRatio || 2)));
      canvas.width = width * pixel;
      canvas.height = height * pixel;
      canvas.style.width = "100%";
      canvas.style.height = "auto";
      ctx.setTransform(pixel, 0, 0, pixel, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      ctx.fillStyle = "#050505";
      ctx.fillRect(0, 0, width, height);

      const glow = ctx.createRadialGradient(width / 2, height + 120, 80, width / 2, height + 80, 1100);
      glow.addColorStop(0, "rgba(204, 255, 0, 0.22)");
      glow.addColorStop(0.22, "rgba(204, 255, 0, 0.1)");
      glow.addColorStop(0.48, "rgba(204, 255, 0, 0.045)");
      glow.addColorStop(0.72, "rgba(204, 255, 0, 0.015)");
      glow.addColorStop(1, "rgba(204, 255, 0, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      const haze = ctx.createLinearGradient(0, height * 0.55, 0, height);
      haze.addColorStop(0, "rgba(204, 255, 0, 0)");
      haze.addColorStop(0.55, "rgba(204, 255, 0, 0.03)");
      haze.addColorStop(1, "rgba(204, 255, 0, 0.08)");
      ctx.fillStyle = haze;
      ctx.fillRect(0, height * 0.55, width, height * 0.45);

      const accent = "#ccff00";
      const corner = 56;
      const arm = 36;
      ctx.strokeStyle = "rgba(204, 255, 0, 0.45)";
      ctx.lineWidth = 2;
      ctx.lineCap = "square";
      ctx.beginPath();
      ctx.moveTo(corner, corner + arm);
      ctx.lineTo(corner, corner);
      ctx.lineTo(corner + arm, corner);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(width - corner - arm, corner);
      ctx.lineTo(width - corner, corner);
      ctx.lineTo(width - corner, corner + arm);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(corner, height - corner - arm);
      ctx.lineTo(corner, height - corner);
      ctx.lineTo(corner + arm, height - corner);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(width - corner - arm, height - corner);
      ctx.lineTo(width - corner, height - corner);
      ctx.lineTo(width - corner, height - corner - arm);
      ctx.stroke();

      const logoH = 58;
      const logoW = mark.naturalWidth > 0 ? (mark.naturalWidth / mark.naturalHeight) * logoH : 0;
      const cx = Math.round(width / 2);
      if (logoW > 0) ctx.drawImage(mark, Math.round(cx - logoW / 2), 64, logoW, logoH);

      if (logoW > 0) {
        ctx.strokeStyle = "rgba(204, 255, 0, 0.35)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - 48, 64 + logoH + 18);
        ctx.lineTo(cx + 48, 64 + logoH + 18);
        ctx.stroke();
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(cx, 64 + logoH + 18, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      const title = `$${lock.symbol}`;
      const amountWithDays =
        daysLeft > 0
          ? `${amountLabel} / ${supplyPctLabel}% - ${daysLeft} Days`
          : `${amountLabel} / ${supplyPctLabel}% - Unlocked`;
      const meta = `${modeLabel} · ${unlockedPct}% unlocked`;

      let titleSize = 128;
      ctx.font = `700 ${titleSize}px ${display}`;
      while (ctx.measureText(title).width > 1200 && titleSize > 84) {
        titleSize -= 2;
        ctx.font = `700 ${titleSize}px ${display}`;
      }

      let amountSize = 64;
      ctx.font = `700 ${amountSize}px ${display}`;
      while (ctx.measureText(amountWithDays).width > 1400 && amountSize > 42) {
        amountSize -= 2;
        ctx.font = `700 ${amountSize}px ${display}`;
      }

      const kickerSize = 30;
      const metaSize = 26;
      const siteSize = 22;
      const gapAfterKicker = 28;
      const gapAfterTitle = 36;
      const iconSize = Math.round(titleSize * 0.62);
      const iconGap = Math.round(titleSize * 0.16);
      const stackH = kickerSize + gapAfterKicker + titleSize + gapAfterTitle + amountSize;
      let y = Math.round((height - stackH) / 2) + 20;

      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.lineWidth = 1;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";

      ctx.font = `700 ${kickerSize}px ${display}`;
      const kicker = "Locked Supply";
      const kickerW = ctx.measureText(kicker).width;
      ctx.fillStyle = "rgba(204, 255, 0, 0.7)";
      const tickY = y + kickerSize / 2;
      ctx.fillRect(cx - kickerW / 2 - 36, tickY - 1, 18, 2);
      ctx.fillRect(cx + kickerW / 2 + 18, tickY - 1, 18, 2);
      ctx.beginPath();
      ctx.arc(cx - kickerW / 2 - 42, tickY, 2.5, 0, Math.PI * 2);
      ctx.arc(cx + kickerW / 2 + 42, tickY, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = accent;
      ctx.fillText(kicker, cx, y);
      y += kickerSize + gapAfterKicker;

      const isLocked = daysLeft > 0;
      ctx.font = `700 ${titleSize}px ${display}`;
      const titleW = ctx.measureText(title).width;
      const rowW = iconSize + iconGap + titleW;
      const rowX = Math.round(cx - rowW / 2);
      const iconY = Math.round(y + (titleSize - iconSize) / 2 - titleSize * 0.04);
      drawPadlockIcon(ctx, rowX, iconY, iconSize, isLocked, isLocked ? accent : "#a1a1aa");

      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#ffffff";
      ctx.font = `700 ${titleSize}px ${display}`;
      ctx.fillText(title, Math.round(rowX + iconSize + iconGap), y);
      ctx.textAlign = "center";
      y += titleSize + gapAfterTitle;

      ctx.fillStyle = accent;
      ctx.font = `700 ${amountSize}px ${display}`;
      ctx.fillText(amountWithDays, cx, y);

      const ruleY = y + amountSize + 28;
      ctx.strokeStyle = "rgba(204, 255, 0, 0.28)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 120, ruleY);
      ctx.lineTo(cx + 120, ruleY);
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(cx, ruleY, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#ffffff";
      ctx.font = `600 ${metaSize}px ${sans}`;
      ctx.fillText(meta, cx, height - 78);
      ctx.font = `500 ${siteSize}px ${sans}`;
      ctx.fillText("lootingpad.com  |  Robinhood Chain", cx, height - 44);
    };

    mark.onload = () => {
      void paint();
    };
    mark.onerror = () => {
      void paint();
    };
    void paint();

    return () => {
      cancel = true;
    };
  }, [amountLabel, daysLeft, lock.symbol, modeLabel, supplyPctLabel, unlockLine, unlockedPct]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function share() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;
    const file = new File([blob], `looting-${lock.symbol.toLowerCase()}-lock.png`, { type: "image/png" });
    const payload = {
      files: [file],
      title: "LOOTING Dev Lock",
      text: `Dev Lock $${lock.symbol}: ${amountLabel} · ${modeLabel} · ${unlockLine}`,
    };
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
    <div className="devlock-share-overlay" role="dialog" aria-modal="true" aria-label="Share Dev Lock" onClick={onClose}>
      <div className="devlock-share-sheet sheet" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <p className="kicker">Share card</p>
            <h2>
              ${lock.symbol} · {modeLabel}
            </h2>
          </div>
          <button type="button" className="devlock-share-close" onClick={onClose} aria-label="Close">
            Close
          </button>
        </header>
        <canvas ref={canvasRef} className="share-canvas" aria-label={`Dev Lock share card for $${lock.symbol}`} />
        <div className="claim-actions">
          <button type="button" className="claim-btn claim-all" onClick={share}>
            Share image
          </button>
        </div>
        {note ? <p className="page-note">{note}</p> : null}
      </div>
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawPadlockIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  locked: boolean,
  color: string,
) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const ringW = Math.max(2.5, size * 0.07);
  const lockSize = size * 0.48;
  const lockX = cx - lockSize / 2;
  const lockY = cy - lockSize / 2;

  ctx.save();

  ctx.strokeStyle = color;
  ctx.lineWidth = ringW;
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2 - ringW / 2, 0, Math.PI * 2);
  ctx.stroke();

  const bodyW = lockSize * 0.7;
  const bodyH = lockSize * 0.52;
  const bodyX = lockX + (lockSize - bodyW) / 2;
  const bodyY = lockY + lockSize * 0.4;
  const lx = lockX + lockSize / 2;
  const outerR = lockSize * 0.26;
  const innerR = lockSize * 0.14;

  ctx.fillStyle = color;
  ctx.beginPath();
  if (locked) {
    ctx.arc(lx, bodyY, outerR, Math.PI, 0, false);
    ctx.arc(lx, bodyY, innerR, 0, Math.PI, true);
  } else {
    const ox = lx + lockSize * 0.16;
    ctx.arc(ox, bodyY - lockSize * 0.02, outerR, Math.PI * 0.95, Math.PI * 1.9, false);
    ctx.arc(ox, bodyY - lockSize * 0.02, innerR, Math.PI * 1.9, Math.PI * 0.95, true);
  }
  ctx.closePath();
  ctx.fill();

  roundRect(ctx, bodyX, bodyY, bodyW, bodyH, lockSize * 0.1);
  ctx.fill();

  ctx.fillStyle = "#050505";
  ctx.beginPath();
  ctx.arc(lx, bodyY + bodyH * 0.36, lockSize * 0.07, 0, Math.PI * 2);
  ctx.fill();
  roundRect(ctx, lx - lockSize * 0.035, bodyY + bodyH * 0.36, lockSize * 0.07, bodyH * 0.38, lockSize * 0.02);
  ctx.fill();

  ctx.restore();
}

export function DevLock() {
  const { connected, address, connect } = useWallet();
  const { data: launches } = useAsyncData(() => getLaunches({ limit: 100 }), [], { initial: [] });
  const { data: apiLocks } = useAsyncData(
    () => getWalletDevLocks(address),
    [address],
    { initial: [], enabled: connected },
  );
  const { data: fees } = useAsyncData(() => getFees(), [], {
    initial: null as Awaited<ReturnType<typeof getFees>> | null,
  });
  const lockFee = fees?.DEV_LOCK_FEE_ETH ?? DEV_LOCK_FEE_ETH;

  const [mode, setMode] = useState<Mode>("time");
  const [symbol, setSymbol] = useState("");
  const [amount, setAmount] = useState("1000000");
  const [preset, setPreset] = useState<(typeof TIME_PRESETS)[number]["id"]>("90");
  const [customDate, setCustomDate] = useState(() => isoDate(Date.now() + 90 * DAY));
  const [cliff, setCliff] = useState<(typeof CLIFFS)[number]["id"]>("30");
  const [length, setLength] = useState<(typeof LENGTHS)[number]["id"]>("365");
  const [cadence, setCadence] = useState<Cadence>("month");
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [localLocks, setLocalLocks] = useState<Lock[]>([]);
  const [lockEdits, setLockEdits] = useState<Record<string, Lock>>({});
  const [hiddenLockIds, setHiddenLockIds] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [shareLock, setShareLock] = useState<Lock | null>(null);
  const [lockPage, setLockPage] = useState(1);
  const [tokenOpen, setTokenOpen] = useState(false);
  const [tokenUp, setTokenUp] = useState(false);
  const tokenRef = useRef<HTMLDivElement>(null);

  const coins = useMemo(
    () => launches.filter((launch) => launch.creator.toLowerCase() === address.toLowerCase() && !launch.draft),
    [address, launches],
  );

  useEffect(() => {
    if (!symbol && coins[0]) setSymbol(coins[0].symbol);
  }, [symbol, coins]);

  const locks = useMemo(() => {
    if (!connected) return localLocks;
    const hidden = new Set(hiddenLockIds);
    const apiMerged = apiLocks
      .filter((item) => !hidden.has(item.id))
      .map((item) => lockEdits[item.id] ?? item);
    const apiIds = new Set(apiMerged.map((item) => item.id));
    const locals = localLocks.filter((item) => !apiIds.has(item.id) && !hidden.has(item.id));
    return [...locals, ...apiMerged];
  }, [connected, apiLocks, localLocks, lockEdits, hiddenLockIds]);

  const coin = coins.find((item) => item.symbol === symbol) ?? coins[0];
  const balance = coin ? (balances[coin.symbol] ?? DEMO_BALANCE) : 0;
  const parsed = Number(amount.replace(/,/g, ""));
  const value = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;

  const now = Date.now();
  const cliffDays = CLIFFS.find((item) => item.id === cliff)?.days ?? 0;
  const lengthDays = LENGTHS.find((item) => item.id === length)?.days ?? 365;
  const cadenceDays = CADENCES.find((item) => item.id === cadence)?.days ?? 30;
  const presetDays = TIME_PRESETS.find((item) => item.id === preset)?.days ?? 90;
  const customMs = parseDate(customDate);
  const unlockAt = mode === "time" ? (preset === "custom" ? customMs : now + presetDays * DAY) : now + (cliffDays + lengthDays) * DAY;
  const cliffAt = mode === "vest" ? now + cliffDays * DAY : now;
  const periods = Math.max(1, Math.round(lengthDays / cadenceDays));
  const perSlice = value > 0 ? value / periods : 0;
  const dateOk = Number.isFinite(unlockAt) && unlockAt > now;
  const ready = Boolean(coin) && value > 0 && value <= balance && dateOk;

  const lockedNow = locks.reduce((sum, lock) => sum + (lock.amount - vestedAmount(lock)), 0);
  const released = locks.reduce((sum, lock) => sum + vestedAmount(lock), 0);
  const waiting = locks.reduce((sum, lock) => sum + claimableAmount(lock), 0);
  const lockPages = Math.max(1, Math.ceil(locks.length / LOCKS_PER_PAGE));
  const safeLockPage = Math.min(lockPage, lockPages);
  const pagedLocks = locks.slice((safeLockPage - 1) * LOCKS_PER_PAGE, safeLockPage * LOCKS_PER_PAGE);

  useEffect(() => {
    if (lockPage > lockPages) setLockPage(lockPages);
  }, [lockPage, lockPages]);

  useEffect(() => {
    if (!tokenOpen) return;
    const close = (event: MouseEvent) => {
      if (tokenRef.current && !tokenRef.current.contains(event.target as Node)) setTokenOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTokenOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [tokenOpen]);

  const toggleTokens = () => {
    if (tokenOpen) {
      setTokenOpen(false);
      return;
    }
    const rect = tokenRef.current?.getBoundingClientRect();
    if (rect) {
      const below = window.innerHeight - rect.bottom;
      const above = rect.top;
      setTokenUp(below < 280 && above > below);
    }
    setTokenOpen(true);
  };

  const chooseToken = (next: string) => {
    setSymbol(next);
    setNotice("");
    setTokenOpen(false);
  };

  const fill = (share: number) => {
    setAmount(String(Math.floor(balance * share)));
    setNotice("");
  };

  const submit = () => {
    if (!connected) {
      connect();
      return;
    }
    if (!coin || !ready) {
      if (!dateOk) setNotice("Pick an unlock date in the future.");
      else if (value > balance) setNotice("Amount is above the wallet balance.");
      else setNotice("Enter an amount above 0.");
      return;
    }
    const next: Lock = {
      id: `local-${coin.symbol}-${Date.now()}`,
      address: coin.address,
      symbol: coin.symbol,
      name: coin.name,
      mode,
      amount: value,
      claimed: 0,
      start: now,
      cliff: cliffAt,
      unlock: unlockAt,
      cadence,
    };
    setLocalLocks((current) => [next, ...current]);
    setBalances((current) => ({ ...current, [coin.symbol]: (current[coin.symbol] ?? DEMO_BALANCE) - value }));
    setAmount("");
    setLockPage(1);
    setNotice(
      mode === "time"
        ? `Demo only — on-chain lock not wired. Preview: locked ${formatTokens(value)} ${coin.symbol} until ${formatDate(unlockAt)}.`
        : `Demo only — on-chain lock not wired. Preview: vesting ${formatTokens(value)} ${coin.symbol} through ${formatDate(unlockAt)}.`,
    );
  };

  const claim = (lock: Lock) => {
    const payout = claimableAmount(lock);
    if (payout <= 0) return;
    setBalances((current) => ({ ...current, [lock.symbol]: (current[lock.symbol] ?? DEMO_BALANCE) + payout }));
    const claimed = lock.claimed + payout;
    const next = claimed >= lock.amount - 1 ? null : { ...lock, claimed };
    if (lock.id.startsWith("local-")) {
      setLocalLocks((current) => {
        if (!next) return current.filter((item) => item.id !== lock.id);
        return current.map((item) => (item.id === lock.id ? next : item));
      });
    } else if (!next) {
      setHiddenLockIds((current) => [...current, lock.id]);
      setLockEdits((current) => {
        const copy = { ...current };
        delete copy[lock.id];
        return copy;
      });
    } else {
      setLockEdits((current) => ({ ...current, [lock.id]: next }));
    }
    setNotice(`Demo only — on-chain claim not wired. Preview: claimed ${formatTokens(payout)} ${lock.symbol}.`);
  };

  const schedule = scheduleParts(mode, cliffDays, lengthDays);

  return (
    <div className="devlock-page">
      <div className="page-head">
        <div>
          <h1 className="explore-title">Dev Lock</h1>
          <p className="page-note">Lock tokens from coins you launched. Time-based unlocks once. Vesting releases on a schedule.</p>
        </div>
        <SlidingTabs
          items={[
            { id: "time", label: "Time-based" },
            { id: "vest", label: "Vesting" },
          ]}
          value={mode}
          onChange={(next) => {
            setMode(next);
            setNotice("");
          }}
          ariaLabel="Lock type"
        />
      </div>

      {connected && coin ? (
        <div className="devlock-layout">
          <section className="sheet devlock-form">
            <div className={`devlock-token${tokenOpen ? " is-open" : ""}${tokenUp ? " is-up" : ""}`} ref={tokenRef}>
              <button
                type="button"
                className="devlock-token-trigger"
                aria-haspopup="listbox"
                aria-expanded={tokenOpen}
                aria-label="Coin to lock"
                onClick={toggleTokens}
              >
                <TokenLogo symbol={coin.symbol} size={28} />
                <span>
                  <b>${coin.symbol}</b>
                  <em>{coin.name}</em>
                </span>
                <svg className="devlock-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M6 9.5 12 15.5 18 9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {tokenOpen ? (
                <div className="devlock-token-menu" role="listbox" aria-label="Coin to lock">
                  {coins.map((item) => (
                    <button
                      key={item.address}
                      type="button"
                      role="option"
                      aria-selected={item.symbol === coin.symbol}
                      className={item.symbol === coin.symbol ? "on" : ""}
                      onClick={() => chooseToken(item.symbol)}
                    >
                      <TokenLogo symbol={item.symbol} size={28} />
                      <span>
                        <b>${item.symbol}</b>
                        <em>{item.name}</em>
                      </span>
                      <strong>{formatTokens(balances[item.symbol] ?? DEMO_BALANCE)}</strong>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="devlock-balance">
              <span>Wallet</span>
              <b>
                {formatTokens(balance)} {coin.symbol}
              </b>
            </div>

            <label className="devlock-amount">
              <span>Amount</span>
              <input
                value={amount}
                inputMode="decimal"
                placeholder="0"
                aria-label="Token amount"
                onChange={(event) => {
                  setAmount(event.target.value.replace(/[^\d.]/g, ""));
                  setNotice("");
                }}
              />
              <em>{coin.symbol}</em>
            </label>

            <div className="devlock-chips">
              {[0.25, 0.5, 0.75, 1].map((share) => (
                <button key={share} type="button" onClick={() => fill(share)}>
                  {share === 1 ? "Max" : `${share * 100}%`}
                </button>
              ))}
            </div>

            {mode === "time" ? (
              <fieldset className="devlock-field">
                <legend>Unlock</legend>
                <div className="devlock-choices">
                  {TIME_PRESETS.map((item) => (
                    <button key={item.id} type="button" className={preset === item.id ? "on" : ""} onClick={() => setPreset(item.id)}>
                      {item.label}
                    </button>
                  ))}
                </div>
                {preset === "custom" ? (
                  <input
                    className="devlock-date"
                    type="date"
                    value={customDate}
                    min={isoDate(now + DAY)}
                    aria-label="Unlock date"
                    onChange={(event) => setCustomDate(event.target.value)}
                  />
                ) : null}
              </fieldset>
            ) : (
              <>
                <fieldset className="devlock-field">
                  <legend>Cliff</legend>
                  <div className="devlock-choices cols-3">
                    {CLIFFS.map((item) => (
                      <button key={item.id} type="button" className={cliff === item.id ? "on" : ""} onClick={() => setCliff(item.id)}>
                        {item.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="devlock-field">
                  <legend>Length</legend>
                  <div className="devlock-choices cols-3">
                    {LENGTHS.map((item) => (
                      <button key={item.id} type="button" className={length === item.id ? "on" : ""} onClick={() => setLength(item.id)}>
                        {item.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="devlock-field">
                  <legend>Release</legend>
                  <div className="devlock-choices cols-3">
                    {CADENCES.map((item) => (
                      <button key={item.id} type="button" className={cadence === item.id ? "on" : ""} onClick={() => setCadence(item.id)}>
                        {item.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
              </>
            )}

            <div className="devlock-schedule" aria-hidden>
              <i className="devlock-bar">
                {schedule.map((part) => (
                  <span key={part.id} className={part.id} style={{ width: `${part.share * 100}%` }} />
                ))}
              </i>
              <div>
                <span>Today</span>
                {mode === "vest" && cliffDays > 0 ? <span>Cliff {formatDate(cliffAt)}</span> : null}
                <span>{formatDate(unlockAt)}</span>
              </div>
            </div>

            <dl className="devlock-preview">
              <div>
                <dt>You lock</dt>
                <dd>{value > 0 ? `${formatFull(value)} ${coin.symbol}` : "—"}</dd>
              </div>
              <div>
                <dt>{mode === "time" ? "Unlocks" : "Fully vested"}</dt>
                <dd>{dateOk ? formatDate(unlockAt) : "—"}</dd>
              </div>
              <div>
                <dt>{mode === "time" ? "Release" : "Each slice"}</dt>
                <dd>
                  {mode === "time"
                    ? "All at once"
                    : value > 0
                      ? `${formatTokens(perSlice)} / ${CADENCES.find((item) => item.id === cadence)?.unit}`
                      : "—"}
                </dd>
              </div>
              <div>
                <dt>Fee Lock</dt>
                <dd>{lockFee} ETH</dd>
              </div>
            </dl>

            {notice ? <p className="devlock-notice">{notice}</p> : null}

            <button type="button" className="devlock-submit" onClick={submit}>
              {mode === "time" ? "Lock until date" : "Start vesting"}
            </button>
            <p className="devlock-fine">
              A lock cannot be cancelled early. Creating a lock costs a flat {lockFee} ETH Fee Lock. Tokens return to this wallet only as they unlock.
            </p>
          </section>

          <div className="devlock-side">
            <section className="devlock-stats">
              <article className="sheet">
                <span>Still locked</span>
                <strong>{formatTokens(lockedNow)}</strong>
                <em>Across {locks.length} {locks.length === 1 ? "position" : "positions"}</em>
              </article>
              <article className="sheet">
                <span>Unlocked</span>
                <strong>{formatTokens(released)}</strong>
                <em>{waiting > 0 ? `${formatTokens(waiting)} ready to claim` : "Nothing waiting"}</em>
              </article>
              <article className="sheet">
                <span>Wallet</span>
                <strong>
                  {formatTokens(
                    coins.reduce((sum, item) => sum + (balances[item.symbol] ?? DEMO_BALANCE), 0) ||
                      Object.values(balances).reduce((sum, item) => sum + item, 0),
                  )}
                </strong>
                <em>Unlocked balance</em>
              </article>
            </section>

            <section className="sheet devlock-list">
              <header>
                <h2>Locks</h2>
                <span>This wallet</span>
              </header>
              {locks.length === 0 ? <p className="devlock-empty-note">No locks yet.</p> : null}
              <ul>
                {pagedLocks.map((lock) => {
                  const vested = vestedAmount(lock);
                  const claimable = claimableAmount(lock);
                  const progress = lock.amount > 0 ? (vested / lock.amount) * 100 : 0;
                  return (
                    <li key={lock.id}>
                      <div className="devlock-row">
                        <TokenLogo symbol={lock.symbol} size={28} />
                        <div>
                          <b>
                            ${lock.symbol}
                            <em>{lockModeLabel(lock.mode)}</em>
                          </b>
                          <span>{lockStatusLine(lock)}</span>
                        </div>
                        <div className="devlock-row-end">
                          <strong>{formatTokens(lock.amount - lock.claimed)}</strong>
                          <div className="devlock-actions">
                            {claimable > 1 ? (
                              <button type="button" className="devlock-claim" onClick={() => claim(lock)}>
                                Claim {formatTokens(claimable)}
                              </button>
                            ) : null}
                            <button type="button" className="devlock-share" onClick={() => setShareLock(lock)}>
                              Share
                            </button>
                          </div>
                        </div>
                      </div>
                      <i className="devlock-bar slim" aria-hidden>
                        <span className="release" style={{ width: `${progress}%` }} />
                      </i>
                    </li>
                  );
                })}
              </ul>
              {locks.length > LOCKS_PER_PAGE ? (
                <Pager page={safeLockPage} pages={lockPages} onChange={setLockPage} />
              ) : null}
            </section>
          </div>
        </div>
      ) : connected ? (
        <section className="sheet devlock-gate">
          <h2>No launched coins</h2>
          <p>This wallet has not launched a coin yet. Dev Lock is only available for coins you created.</p>
        </section>
      ) : (
        <section className="sheet devlock-gate">
          <h2>Connect the launching wallet</h2>
          <p>Dev Lock only lists coins this wallet created. Pick a time-based date or a vesting schedule, then lock the balance you still hold.</p>
          <button type="button" className="devlock-submit" onClick={connect}>
            Connect
          </button>
        </section>
      )}
      {shareLock ? <LockShareCard lock={shareLock} onClose={() => setShareLock(null)} launches={launches} /> : null}
    </div>
  );
}

function scheduleParts(mode: Mode, cliffDays: number, lengthDays: number) {
  if (mode === "time") return [{ id: "hold", share: 1 }];
  const total = cliffDays + lengthDays;
  if (total <= 0) return [{ id: "release", share: 1 }];
  const cliffShare = cliffDays / total;
  return [
    ...(cliffShare > 0 ? [{ id: "cliff", share: cliffShare }] : []),
    { id: "release", share: 1 - cliffShare },
  ];
}
