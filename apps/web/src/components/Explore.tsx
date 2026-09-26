"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatCount, formatUsd, launches, marketStats, stagedLaunches, type Launch } from "@/lib/mock";
import { SlidingTabs } from "./SlidingTabs";
import { Sparkline } from "./Sparkline";
import { TokenLogo } from "./TokenLogo";
import { GraduateIcon, GridIcon, MigrateIcon, MoversIcon, NewPairIcon, TableIcon, TrendingIcon } from "./Icons";
import { Pager } from "./Pager";

const stages = [
  { id: "New Pair", label: "New Pair", icon: <NewPairIcon /> },
  { id: "Almost Graduate", label: "Almost Graduate", icon: <GraduateIcon /> },
  { id: "Migrate", label: "Migrate", icon: <MigrateIcon /> },
] as const;
const ranks = [
  { id: "Movers", label: "Movers", icon: <MoversIcon /> },
  { id: "Trending", label: "Trending", icon: <TrendingIcon /> },
] as const;
type Board = (typeof stages)[number]["id"] | (typeof ranks)[number]["id"];

const windows = [
  { id: "latest", label: "Latest", maxHours: null },
  { id: "5m", label: "5m", maxHours: 5 / 60 },
  { id: "1h", label: "1h", maxHours: 1 },
  { id: "6h", label: "6h", maxHours: 6 },
  { id: "24h", label: "24h", maxHours: 24 },
  { id: "48h", label: "48h", maxHours: 48 },
] as const;
type WindowId = (typeof windows)[number]["id"];

const TABLE_PER_PAGE = 15;
const GRID_CARD_WIDTH = 272;
const GRID_GAP = 8;
const GRID_ROWS = 3;
const GRID_PER_PAGE_MIN = 12;

function gridLayoutForWidth(width: number) {
  if (width < 640) return { cols: 1, perPage: GRID_PER_PAGE_MIN };
  const cols = Math.max(1, Math.floor((width + GRID_GAP) / (GRID_CARD_WIDTH + GRID_GAP)));
  return {
    cols,
    perPage: Math.max(GRID_PER_PAGE_MIN, cols * GRID_ROWS),
  };
}

const MAX_MCAP = 85_000_000;
const MAX_CHANGE = 999;

function clampMcap(value: number) {
  return Math.min(MAX_MCAP, Math.max(900, Math.round(value)));
}

function clampChange(value: number) {
  return Number(Math.max(-99, Math.min(MAX_CHANGE, value)).toFixed(1));
}

function seedVolume(launch: Launch) {
  return marketStats(launch).volume24h;
}

function activityScore(launch: Launch, volume: number) {
  return volume * (1 + Math.abs(launch.change1h) / 25);
}

function byActivity(a: Launch, b: Launch, volumes: Record<string, number>) {
  const scoreA = activityScore(a, volumes[a.address] ?? seedVolume(a));
  const scoreB = activityScore(b, volumes[b.address] ?? seedVolume(b));
  if (scoreB !== scoreA) return scoreB - scoreA;
  return b.marketCap - a.marketCap;
}

function ageHours(age: string) {
  const value = Number.parseFloat(age);
  if (age.endsWith("m")) return value / 60;
  if (age.endsWith("h")) return value;
  if (age.endsWith("d")) return value * 24;
  return value;
}

function nudge(coin: Launch, volatile = false): { coin: Launch; dir: "up" | "down" } {
  const swing = volatile ? Math.random() * 14 - 5 : Math.random() * 9 - 4;
  const delta = Number(swing.toFixed(1));
  const mcapMul = volatile ? 1 + delta / 55 : 1 + delta / 80;
  const marketCap = clampMcap(coin.marketCap * mcapMul);
  return {
    dir: marketCap >= coin.marketCap ? "up" : "down",
    coin: {
      ...coin,
      marketCap,
      change1h: clampChange(coin.change1h + delta * (volatile ? 0.55 : 0.45)),
    },
  };
}

function digitFrames(before: string, after: string, dir?: "up" | "down") {
  const width = Math.max(before.length, after.length);
  const prev = before.padStart(width, " ");
  const next = after.padStart(width, " ");
  const frames: {
    from: string;
    to: string;
    roll: boolean;
    delay: number;
    slot: number;
  }[] = [];
  let changedDigits = 0;
  for (let index = width - 1; index >= 0; index -= 1) {
    if (next[index] === " ") continue;
    const from = prev[index] === " " ? next[index] : prev[index];
    const to = next[index];
    const changed = from !== to && /\d/.test(to) && /\d/.test(from);
    const roll = Boolean(dir && changed);
    if (roll) changedDigits += 1;
    frames.push({
      from,
      to,
      roll,
      delay: roll ? (changedDigits - 1) * 16 : 0,
      slot: width - index,
    });
  }
  frames.reverse();
  return frames;
}

type AthSpark = {
  rotation: number;
  delay: number;
  speed: number;
  travel: number;
  hue: number;
  sat: number;
  lit: number;
};

function athSparks(seed: string, count = 40): AthSpark[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const next = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
  return Array.from({ length: count }, () => {
    const rotation = next() % 360;
    const delay = (next() % 1000) / 1000;
    const speed = 0.25 + (next() % 55) / 100;
    const travel = 12 + (next() % 36);
    const hue = 21 + (next() % 40);
    const sat = 55 + (next() % 45);
    const lit = 55 + (next() % 42);
    return { rotation, delay, speed, travel, hue, sat, lit };
  });
}

function AthMeter({
  value,
  progress,
  atAth,
  burst,
  seed,
}: {
  value: string;
  progress: number;
  atAth: boolean;
  burst?: number;
  seed: string;
}) {
  const sparks = useMemo(() => athSparks(seed), [seed]);
  return (
    <span className={`ath${atAth ? " is-ath" : ""}`}>
      <TickValue value={value} dir={burst ? "up" : undefined} nonce={burst} />
      <i>
        <span className="ath-fill" style={{ width: `${progress}%` }} />
        {atAth ? (
          <b className="ath-sparks" aria-hidden>
            {sparks.map((spark, index) => (
              <em
                key={index}
                className="ath-spark"
                style={
                  {
                    "--rotation": `${spark.rotation}deg`,
                    "--delay": spark.delay,
                    "--speed": spark.speed,
                    "--travel": spark.travel,
                    "--h": spark.hue,
                    "--s": `${spark.sat}%`,
                    "--l": `${spark.lit}%`,
                  } as CSSProperties
                }
              />
            ))}
          </b>
        ) : null}
      </i>
    </span>
  );
}

const REEL_MS = 240;

function TickValue({
  value,
  dir,
  nonce,
  tone = "money",
}: {
  value: string;
  dir?: "up" | "down";
  nonce?: number;
  tone?: "money" | "pct";
}) {
  const [shown, setShown] = useState(value);
  const [roll, setRoll] = useState<{ from: string; to: string; dir: "up" | "down"; token: number } | null>(null);
  const shownRef = useRef(value);
  const busyRef = useRef(false);
  const pendingRef = useRef<{ value: string; dir?: "up" | "down" } | null>(null);
  const tokenRef = useRef(0);

  useEffect(() => {
    if (value === shownRef.current) return;

    const play = (next: string, nextDir?: "up" | "down") => {
      const from = shownRef.current;
      shownRef.current = next;
      setShown(next);
      if (!nextDir || from === next || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        busyRef.current = false;
        setRoll(null);
        return;
      }
      busyRef.current = true;
      tokenRef.current += 1;
      const token = tokenRef.current;
      setRoll({ from, to: next, dir: nextDir, token });
      window.setTimeout(() => {
        if (tokenRef.current !== token) return;
        setRoll(null);
        busyRef.current = false;
        const pending = pendingRef.current;
        if (pending && pending.value !== shownRef.current) {
          pendingRef.current = null;
          play(pending.value, pending.dir);
        } else {
          pendingRef.current = null;
        }
      }, REEL_MS + 40);
    };

    if (busyRef.current) {
      pendingRef.current = { value, dir };
      return;
    }
    play(value, dir);
  }, [value, dir, nonce]);

  const frames = digitFrames(roll?.from ?? shown, roll?.to ?? shown, roll?.dir);

  return (
    <span className={`amt-slot amt-${tone}`}>
      {frames.map((frame) =>
        frame.roll && roll ? (
          <span className="amt-char is-rolling" key={frame.slot}>
            <span
              key={`${roll.token}-${frame.from}-${frame.to}-${roll.dir}`}
              className={`amt-reel tick-${roll.dir}`}
              style={{ animationDelay: `${frame.delay}ms`, animationDuration: `${REEL_MS}ms` }}
            >
              {roll.dir === "up" ? (
                <>
                  <span>{frame.from}</span>
                  <span>{frame.to}</span>
                </>
              ) : (
                <>
                  <span>{frame.to}</span>
                  <span>{frame.from}</span>
                </>
              )}
            </span>
          </span>
        ) : (
          <span className="amt-char" key={frame.slot}>
            <span>{frame.to}</span>
          </span>
        ),
      )}
    </span>
  );
}

export function Explore() {
  const router = useRouter();
  const params = useSearchParams();
  const query = (params.get("q") ?? "").trim().toLowerCase();
  const [board, setBoard] = useState<Board>("New Pair");
  const [boardTab, setBoardTab] = useState<Board>("New Pair");
  const [windowId, setWindowId] = useState<WindowId>("latest");
  const [windowTab, setWindowTab] = useState<WindowId>("latest");
  const [view, setView] = useState<"table" | "grid">("table");
  const [viewTab, setViewTab] = useState<"table" | "grid">("table");
  const [tablePage, setTablePage] = useState(1);
  const [gridPage, setGridPage] = useState(1);
  const [pageOut, setPageOut] = useState(false);
  const [viewOut, setViewOut] = useState(false);
  const [gridPerPage, setGridPerPage] = useState(GRID_PER_PAGE_MIN);
  const [phone, setPhone] = useState(false);
  const [feed, setFeed] = useState(launches);
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  const [athBurst, setAthBurst] = useState<Record<string, number>>({});
  const [ticks, setTicks] = useState<Record<string, { dir: "up" | "down"; n: number }>>({});
  const [volumes, setVolumes] = useState<Record<string, number>>(() => {
    const next: Record<string, number> = {};
    [...launches, ...stagedLaunches].forEach((coin) => {
      next[coin.address] = seedVolume(coin);
    });
    return next;
  });
  const feedRef = useRef(launches);
  const volumesRef = useRef(volumes);
  volumesRef.current = volumes;
  const visibleRef = useRef<string[]>([]);
  const hotRef = useRef<string[]>([]);
  const rowEls = useRef(new Map<string, HTMLElement>());
  const flipTops = useRef(new Map<string, number>());
  const skipFlip = useRef(true);
  const flipBusy = useRef(false);
  const gridBoardRef = useRef<HTMLDivElement | null>(null);
  const pageFadeRef = useRef<number | null>(null);
  const viewFadeRef = useRef<number | null>(null);
  const queueRef = useRef(stagedLaunches);
  const athRef = useRef<Map<string, number> | null>(null);
  if (!athRef.current) {
    const ath = new Map<string, number>();
    // Seed ATH just above live mcap so breakouts can fire often in the mock feed.
    launches.forEach((coin) => ath.set(coin.address, Math.max(coin.marketCap, Math.round(coin.marketCap * 1.02))));
    athRef.current = ath;
  }
  const bornRef = useRef<Map<string, number> | null>(null);
  if (!bornRef.current) {
    const born = new Map<string, number>();
    launches.forEach((coin, index) => born.set(coin.address, index + 1));
    bornRef.current = born;
  }
  const nextBorn = useRef(launches.length + 1);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 860px)");
    const sync = () => setPhone(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const node = gridBoardRef.current;
    const apply = (width: number) => {
      const layout = gridLayoutForWidth(width);
      if (node) node.style.setProperty("--pair-cols", String(layout.cols));
      setGridPerPage((current) => (current === layout.perPage ? current : layout.perPage));
    };

    if (!node) {
      apply(window.innerWidth);
      return;
    }

    if (typeof ResizeObserver === "undefined") {
      apply(node.clientWidth || window.innerWidth);
      return;
    }

    apply(node.clientWidth || window.innerWidth);
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? node.clientWidth;
      apply(width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [phone, view]);

  // Soft-reset any runaway mock values from a hot reload.
  useEffect(() => {
    setFeed((current) => {
      const next = current.map((coin) => ({
        ...coin,
        marketCap: clampMcap(coin.marketCap),
        change1h: clampChange(coin.change1h),
      }));
      feedRef.current = next;
      return next;
    });
    setVolumes((current) => {
      const next: Record<string, number> = {};
      Object.entries(current).forEach(([address, value]) => {
        const coin = feedRef.current.find((item) => item.address === address);
        const ceiling = Math.min(MAX_MCAP * 3, Math.max((coin?.marketCap ?? 10_000) * 6, 8_000));
        next[address] = Math.min(value, ceiling);
      });
      volumesRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    const timers: number[] = [];
    const markFresh = (address: string) => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      setFresh((current) => new Set(current).add(address));
      timers.push(
        window.setTimeout(() => {
          setFresh((current) => {
            const next = new Set(current);
            next.delete(address);
            return next;
          });
        }, 5200),
      );
    };

    const markAthBurst = (address: string) => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      setAthBurst((current) => ({ ...current, [address]: (current[address] ?? 0) + 1 }));
      timers.push(
        window.setTimeout(() => {
          setAthBurst((current) => {
            const next = { ...current };
            delete next[address];
            return next;
          });
        }, 700),
      );
    };

    const markTick = (address: string, dir: "up" | "down") => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      setTicks((current) => ({
        ...current,
        [address]: { dir, n: (current[address]?.n ?? 0) + 1 },
      }));
    };

    const bumpVolume = (address: string, boost = false) => {
      setVolumes((current) => {
        const coin = feedRef.current.find((item) => item.address === address);
        const ceiling = Math.min(MAX_MCAP * 3, Math.max((coin?.marketCap ?? 10_000) * 6, 8_000));
        const prev = Math.min(ceiling, current[address] ?? volumesRef.current[address] ?? 1_000);
        const delta = boost ? 0.06 + Math.random() * 0.12 : Math.random() * 0.05 - 0.015;
        const next = Math.min(ceiling, Math.max(400, Math.round(prev * (1 + delta))));
        const book = { ...current, [address]: next };
        volumesRef.current = book;
        return book;
      });
    };

    const applyCoin = (target: Launch, coin: Launch, hitAth: boolean, dir: "up" | "down") => {
      const safe = {
        ...coin,
        marketCap: clampMcap(coin.marketCap),
        change1h: clampChange(coin.change1h),
      };
      const athBook = athRef.current ?? new Map<string, number>();
      let ath = athBook.get(target.address) ?? target.marketCap;
      if (safe.marketCap > ath) {
        ath = safe.marketCap;
        hitAth = true;
      }
      athBook.set(target.address, Math.min(MAX_MCAP, ath));
      athRef.current = athBook;
      const next = feedRef.current.map((item) => (item.address === target.address ? safe : item));
      feedRef.current = next;
      setFeed(next);
      bumpVolume(safe.address, hitAth || dir === "up");
      markTick(safe.address, hitAth || dir === "up" ? "up" : dir);
      if (hitAth) markAthBurst(safe.address);
    };

    const pushAthBreak = (target: Launch) => {
      if (target.marketCap >= MAX_MCAP * 0.98) {
        applyCoin(target, nudge(target, true).coin, false, "up");
        return;
      }
      const athBook = athRef.current ?? new Map<string, number>();
      const prev = athBook.get(target.address) ?? target.marketCap;
      const nextAth = clampMcap(prev * (1.015 + Math.random() * 0.03));
      const coin = {
        ...target,
        marketCap: nextAth,
        change1h: clampChange(Math.abs(target.change1h) + 1.2 + Math.random() * 3),
      };
      applyCoin(target, coin, true, "up");
    };

    const pickHot = (visible: string[]) => {
      const keep = hotRef.current.filter((address) => visible.includes(address));
      const need = Math.min(2, visible.length);
      while (keep.length < need) {
        const pool = visible.filter((address) => !keep.includes(address));
        if (!pool.length) break;
        // Prefer top-of-list slots so volatility stays on-screen.
        keep.push(pool[Math.floor(Math.random() * Math.min(4, pool.length))]);
      }
      hotRef.current = keep.slice(0, need);
    };

    const step = { current: 0 };
    const id = window.setInterval(() => {
      step.current += 1;
      const spawn = queueRef.current[0];
      // Rare spawn so the volatile pair stays the focus.
      if (spawn && step.current % 28 === 0) {
        queueRef.current = queueRef.current.slice(1);
        bornRef.current?.set(spawn.address, nextBorn.current);
        nextBorn.current += 1;
        athRef.current?.set(spawn.address, Math.max(spawn.marketCap, Math.round(spawn.marketCap * 1.02)));
        setVolumes((current) => {
          const book = { ...current, [spawn.address]: seedVolume(spawn) };
          volumesRef.current = book;
          return book;
        });
        const next = [spawn, ...feedRef.current];
        feedRef.current = next;
        setFeed(next);
        markFresh(spawn.address);
        return;
      }

      const visible = visibleRef.current;
      if (!visible.length) return;
      if (step.current === 1 || step.current % 18 === 0 || hotRef.current.length === 0) {
        pickHot(visible);
      } else {
        // Drop any hot coin that scrolled off the page.
        hotRef.current = hotRef.current.filter((address) => visible.includes(address));
        if (hotRef.current.length < Math.min(2, visible.length)) pickHot(visible);
      }

      const hot = hotRef.current;
      if (!hot.length) return;

      // Alternate the 1–2 hot rows so only they tick — fast + volatile.
      const address = hot[step.current % hot.length];
      const target = feedRef.current.find((item) => item.address === address);
      if (!target) return;

      if (Math.random() > 0.72) {
        pushAthBreak(target);
        return;
      }

      const updated = nudge(target, true);
      applyCoin(target, updated.coin, false, updated.dir);
    }, 320);

    return () => {
      window.clearInterval(id);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  const rows = useMemo(() => {
    const maxHours = windows.find((item) => item.id === windowId)?.maxHours ?? null;
    const matched = feed.filter((launch) => {
      const text = `${launch.name} ${launch.symbol}`.toLowerCase();
      if (query && !text.includes(query)) return false;
      if (maxHours != null && ageHours(marketStats(launch).age) > maxHours) return false;
      if (board === "Movers" || board === "Trending") return true;
      if (board === "Migrate") return launch.phase === "graduated";
      if (board === "Almost Graduate") return launch.phase !== "graduated" && launch.progress >= 70;
      return launch.phase !== "graduated" && launch.progress < 50;
    });
    if (board === "New Pair") {
      const born = bornRef.current ?? new Map<string, number>();
      const liveAfter = launches.length;
      return [...matched].sort((a, b) => {
        const aBorn = born.get(a.address) ?? 0;
        const bBorn = born.get(b.address) ?? 0;
        const aLive = aBorn > liveAfter;
        const bLive = bBorn > liveAfter;
        if (aLive || bLive) return bBorn - aBorn;
        return a.progress - b.progress;
      });
    }
    // Almost Graduate / Migrate / Movers / Trending: busiest volume + move first.
    return [...matched].sort((a, b) => byActivity(a, b, volumes));
  }, [board, feed, query, volumes, windowId]);

  useEffect(() => {
    setTablePage(1);
    setGridPage(1);
    setPageOut(false);
    if (pageFadeRef.current) window.clearTimeout(pageFadeRef.current);
    skipFlip.current = true;
    flipTops.current.clear();
  }, [board, windowId, query, view]);

  const tablePages = Math.max(1, Math.ceil(rows.length / TABLE_PER_PAGE));
  const safeTablePage = Math.min(tablePage, tablePages);
  const tableRows = rows.slice((safeTablePage - 1) * TABLE_PER_PAGE, safeTablePage * TABLE_PER_PAGE);

  const gridPages = Math.max(1, Math.ceil(rows.length / gridPerPage));
  const safeGridPage = Math.min(gridPage, gridPages);
  const gridRows = rows.slice((safeGridPage - 1) * gridPerPage, safeGridPage * gridPerPage);

  const softSwap = (
    timerRef: { current: number | null },
    setOut: (value: boolean) => void,
    action: () => void,
  ) => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    skipFlip.current = true;
    flipTops.current.clear();
    if (reduceMotion) {
      action();
      setOut(false);
      return;
    }
    setOut(true);
    timerRef.current = window.setTimeout(() => {
      action();
      timerRef.current = window.setTimeout(() => setOut(false), 32);
    }, 170);
  };

  const goPage = (mode: "table" | "grid", next: number) => {
    const current = mode === "table" ? safeTablePage : safeGridPage;
    if (next === current) return;
    softSwap(pageFadeRef, setPageOut, () => {
      if (mode === "table") setTablePage(next);
      else setGridPage(next);
    });
  };

  const goBoard = (next: Board) => {
    if (next === boardTab) return;
    setBoardTab(next);
    softSwap(viewFadeRef, setViewOut, () => setBoard(next));
  };

  const goView = (next: "table" | "grid") => {
    if (next === viewTab) return;
    setViewTab(next);
    softSwap(viewFadeRef, setViewOut, () => setView(next));
  };

  const goWindow = (next: WindowId) => {
    if (next === windowTab) return;
    setWindowTab(next);
    softSwap(viewFadeRef, setViewOut, () => setWindowId(next));
  };

  useEffect(() => {
    return () => {
      if (pageFadeRef.current) window.clearTimeout(pageFadeRef.current);
      if (viewFadeRef.current) window.clearTimeout(viewFadeRef.current);
    };
  }, []);

  const useGrid = phone || view === "grid";
  const shown = useGrid ? gridRows : tableRows;
  visibleRef.current = shown.map((launch) => launch.address);

  const liveVolume = (launch: Launch) => {
    const raw = volumes[launch.address] ?? marketStats(launch).volume24h;
    return Math.min(raw, Math.max(launch.marketCap * 6, 8_000), MAX_MCAP * 3);
  };

  useEffect(() => {
    setGridPage(1);
  }, [gridPerPage]);

  useEffect(() => {
    skipFlip.current = true;
    flipTops.current.clear();
    hotRef.current = [];
  }, [safeTablePage, safeGridPage, phone, board]);

  useLayoutEffect(() => {
    const nodes = rowEls.current;
    const nextTops = new Map<string, number>();
    nodes.forEach((el, address) => {
      nextTops.set(address, el.getBoundingClientRect().top);
    });

    if (skipFlip.current || flipBusy.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      flipTops.current = nextTops;
      skipFlip.current = false;
      return;
    }

    let moved = false;
    const timers: number[] = [];
    nodes.forEach((el, address) => {
      const prev = flipTops.current.get(address);
      const next = nextTops.get(address);
      if (prev == null || next == null) return;
      const dy = prev - next;
      if (Math.abs(dy) < 2) return;
      moved = true;

      el.style.transition = "none";
      el.style.transform = `translateY(${dy}px)`;
      void el.offsetHeight;
      el.style.transition = "transform 380ms cubic-bezier(0.22, 1, 0.36, 1)";
      el.style.transform = "translateY(0)";

      if (dy > 2) {
        el.classList.add("is-climb");
        timers.push(
          window.setTimeout(() => {
            el.classList.remove("is-climb");
            el.style.transition = "";
            el.style.transform = "";
          }, 400),
        );
      } else {
        timers.push(
          window.setTimeout(() => {
            el.style.transition = "";
            el.style.transform = "";
          }, 400),
        );
      }
    });

    flipTops.current = nextTops;
    if (moved) {
      flipBusy.current = true;
      timers.push(
        window.setTimeout(() => {
          flipBusy.current = false;
        }, 420),
      );
    }

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [tableRows, gridRows, board, view, phone]);

  const bindRow = (address: string) => (node: HTMLElement | null) => {
    if (node) rowEls.current.set(address, node);
    else rowEls.current.delete(address);
  };

  return (
    <div>
      <div className="page-head">
        <h1 className="explore-title">Explore coins</h1>
        {phone ? null : (
          <SlidingTabs
            ariaLabel="Layout"
            tone="quiet"
            items={[
              { id: "grid" as const, label: "Grid", icon: <GridIcon /> },
              { id: "table" as const, label: "Table", icon: <TableIcon /> },
            ]}
            value={viewTab}
            onChange={goView}
          />
        )}
      </div>
      <div className="explore-tools">
        <SlidingTabs
          ariaLabel="Launch stage"
          items={stages}
          value={
            boardTab === "New Pair" || boardTab === "Almost Graduate" || boardTab === "Migrate"
              ? boardTab
              : null
          }
          onChange={goBoard}
        />
        <SlidingTabs
          ariaLabel="Ranking"
          tone="quiet"
          items={ranks}
          value={boardTab === "Movers" || boardTab === "Trending" ? boardTab : null}
          onChange={goBoard}
        />
        <div className="time-window">
          <SlidingTabs
            ariaLabel="Time window"
            tone="quiet"
            items={windows}
            value={windowTab}
            onChange={goWindow}
          />
        </div>
      </div>

      <div className={`view-swap${viewOut ? " is-out" : ""}`}>
      {!phone && view === "table" ? (
        <div className="table-wrap explore-table-board">
          <div className="explore-table-scroller">
          <table className="coin-table">
            <thead>
              <tr>
                <th>Coin</th>
                <th>Graph</th>
                <th>Mcap</th>
                <th>ATH</th>
                <th>Age</th>
                <th>Txns</th>
                <th>24h vol</th>
                <th>Box</th>
                <th>1h</th>
                <th>24h</th>
              </tr>
            </thead>
            <tbody className={`page-swap${pageOut ? " is-out" : ""}`}>
              {tableRows.map((launch, index) => {
                const stats = marketStats(launch);
                const volume = liveVolume(launch);
                const athValue = Math.min(
                  MAX_MCAP,
                  athRef.current?.get(launch.address) ?? stats.ath,
                );
                const progress = Math.min(100, Math.round((launch.marketCap / athValue) * 100));
                const arrived = board === "New Pair" && fresh.has(launch.address);
                const burst = athBurst[launch.address];
                const atAth = progress >= 99 || Boolean(burst);
                const tick = ticks[launch.address];
                const rank = (safeTablePage - 1) * TABLE_PER_PAGE + index + 1;
                return (
                  <tr
                    key={launch.address}
                    ref={bindRow(launch.address)}
                    className={arrived ? "is-new" : undefined}
                    onClick={() => router.push(`/token/${launch.address}`)}
                  >
                    <td>
                      <Link
                        href={`/token/${launch.address}`}
                        className="coin-cell"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <span className="num w-6 text-[var(--muted)]">{rank}</span>
                        <TokenLogo symbol={launch.symbol} size={26} />
                        <span className="coin-name">{launch.name}</span>
                        <span className="ticker text-[var(--muted)]">${launch.symbol}</span>
                      </Link>
                    </td>
                    <td>
                      <Sparkline seed={launch.symbol} width={76} height={24} />
                    </td>
                    <td className={launch.change1h >= 0 ? "up" : "down"}>
                      <TickValue value={formatUsd(launch.marketCap)} dir={tick?.dir} nonce={tick?.n} />
                    </td>
                    <td>
                      <AthMeter
                        value={formatUsd(athValue)}
                        progress={progress}
                        atAth={atAth}
                        burst={burst}
                        seed={launch.address}
                      />
                    </td>
                    <td>{stats.age}</td>
                    <td>{formatCount(stats.txns)}</td>
                    <td>
                      <TickValue value={formatUsd(volume)} dir={tick?.dir} nonce={tick?.n} />
                    </td>
                    <td>
                      <TickValue value={formatUsd(stats.boxUsd)} dir={tick?.dir} nonce={tick?.n} />
                    </td>
                    <td className={launch.change1h >= 0 ? "up" : "down"}>
                      <TickValue
                        value={`${launch.change1h >= 0 ? "↑" : "↓"} ${Math.abs(launch.change1h).toFixed(1)}%`}
                        dir={tick?.dir}
                        nonce={tick?.n}
                        tone="pct"
                      />
                    </td>
                    <td className={stats.change24h >= 0 ? "up" : "down"}>
                      <TickValue
                        value={`${stats.change24h >= 0 ? "↑" : "↓"} ${Math.abs(stats.change24h).toFixed(1)}%`}
                        dir={tick?.dir}
                        nonce={tick?.n}
                        tone="pct"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          {rows.length > TABLE_PER_PAGE ? (
            <Pager page={safeTablePage} pages={tablePages} onChange={(page) => goPage("table", page)} />
          ) : null}
        </div>
      ) : (
        <div className="pair-grid-shell" ref={gridBoardRef}>
          <div className="pair-grid-panel">
            <div className={`pair-grid page-swap${pageOut ? " is-out" : ""}`}>
            {gridRows.map((launch) => {
              const stats = marketStats(launch);
              const volume = liveVolume(launch);
              const athValue = Math.min(MAX_MCAP, athRef.current?.get(launch.address) ?? stats.ath);
              const progress = Math.min(100, Math.round((launch.marketCap / athValue) * 100));
              const arrived = board === "New Pair" && fresh.has(launch.address);
              const burst = athBurst[launch.address];
              const atAth = progress >= 99 || Boolean(burst);
              return (
                <Link
                  key={launch.address}
                  href={`/token/${launch.address}`}
                  ref={bindRow(launch.address)}
                  className={`pair-card${arrived ? " is-new" : ""}`}
                >
                  <div className="pair-head">
                    <TokenLogo symbol={launch.symbol} size={40} />
                    <div className="pair-id">
                      <p>{launch.name}</p>
                      <p>${launch.symbol}</p>
                    </div>
                    <p className={launch.change1h >= 0 ? "pair-chg up" : "pair-chg down"}>
                      {launch.change1h >= 0 ? "↑" : "↓"} {Math.abs(launch.change1h).toFixed(1)}%
                    </p>
                  </div>
                  <div className="pair-chart">
                    <Sparkline seed={launch.symbol} width={240} height={36} fluid />
                    <div className="pair-mcap">
                      <span>Mcap</span>
                      <strong className={launch.change1h >= 0 ? "up" : "down"}>{formatUsd(launch.marketCap)}</strong>
                    </div>
                  </div>
                  <div className="pair-bond">
                    <div>
                      <span>{launch.phase === "graduated" ? "Graduated" : "Bonding"}</span>
                      <b>{launch.progress}%</b>
                    </div>
                    <i>
                      <span style={{ width: `${launch.progress}%` }} />
                    </i>
                  </div>
                  <dl className="pair-meta">
                    <div>
                      <dt>ATH</dt>
                      <dd>
                        <AthMeter
                          value={formatUsd(athValue)}
                          progress={progress}
                          atAth={atAth}
                          burst={burst}
                          seed={launch.address}
                        />
                      </dd>
                    </div>
                    <div>
                      <dt>Vol</dt>
                      <dd>{formatUsd(volume)}</dd>
                    </div>
                    <div>
                      <dt>Age</dt>
                      <dd>{stats.age}</dd>
                    </div>
                    <div>
                      <dt>Txns</dt>
                      <dd>{formatCount(stats.txns)}</dd>
                    </div>
                    <div>
                      <dt>Box</dt>
                      <dd>{launch.luckyShare}%</dd>
                    </div>
                    <div>
                      <dt>24h</dt>
                      <dd className={stats.change24h >= 0 ? "up" : "down"}>
                        {stats.change24h >= 0 ? "↑" : "↓"} {Math.abs(stats.change24h).toFixed(1)}%
                      </dd>
                    </div>
                  </dl>
                </Link>
              );
            })}
          </div>
          {rows.length > gridPerPage ? (
            <Pager page={safeGridPage} pages={gridPages} onChange={(page) => goPage("grid", page)} />
          ) : null}
          </div>
        </div>
      )}
      </div>
      {rows.length === 0 && (
        <p className="mt-8 text-sm text-[var(--muted)]">
          {query ? "No coins match that search." : "No coins in that window."}
        </p>
      )}
    </div>
  );
}
