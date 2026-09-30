"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatCount, formatUsd, shortAddress } from "@/lib/format";
import { getFees } from "@/lib/api";
import { getVisibleTrenchPairs, setTrenchEthUsd, trenchAgeLabel, trenchToLaunch, trenchesSocketUrl, type TrenchPhase, type TrenchSnapshot, type TrenchUpdate } from "@/lib/trenches";
import type { LaunchWithStats } from "@/lib/types";
import { useAsyncData } from "@/lib/use-async-data";
import { PageFlash } from "./PageInfo";
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

function boardToStage(board: Board): "new" | "almost" | "migrate" | "all" {
  if (board === "New Pair") return "new";
  if (board === "Almost Graduate") return "almost";
  if (board === "Migrate") return "migrate";
  return "all";
}

const windows = [
  { id: "latest", label: "Latest", maxHours: null },
  { id: "5m", label: "5m", maxHours: 5 / 60 },
  { id: "1h", label: "1h", maxHours: 1 },
  { id: "6h", label: "6h", maxHours: 6 },
  { id: "24h", label: "24h", maxHours: 24 },
  { id: "48h", label: "48h", maxHours: 48 },
] as const;
type WindowId = (typeof windows)[number]["id"];

const TABLE_PER_PAGE = 14;
const MAX_PAGES = 2;
/** Hard cap so Explore stays light — never keep more than 2 pages of rows in memory. */
const BOARD_ROW_CAP = TABLE_PER_PAGE * MAX_PAGES;
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

function activityScore(launch: LaunchWithStats, volume: number) {
  return volume * (1 + Math.abs(launch.change1h) / 25);
}

function byActivity(a: LaunchWithStats, b: LaunchWithStats) {
  const scoreA = activityScore(a, a.stats.volume24h);
  const scoreB = activityScore(b, b.stats.volume24h);
  if (scoreB !== scoreA) return scoreB - scoreA;
  return b.marketCap - a.marketCap;
}

function ageHours(age: string) {
  const value = Number.parseFloat(age);
  if (!Number.isFinite(value)) return Number.POSITIVE_INFINITY;
  if (age.endsWith("s")) return value / 3600;
  if (age.endsWith("m")) return value / 60;
  if (age.endsWith("h")) return value;
  if (age.endsWith("d")) return value * 24;
  return value;
}

function launchMs(launch: LaunchWithStats) {
  const fromIso = launch.launchedAt ? Date.parse(launch.launchedAt) : Number.NaN;
  if (Number.isFinite(fromIso)) return fromIso;
  // Fallback for rows that only have a frozen age label.
  return Date.now() - ageHours(launch.stats.age) * 3_600_000;
}

/** % change for the selected time window (Dex fields). */
function windowChangePct(launch: LaunchWithStats, windowId: WindowId): number {
  if (windowId === "5m" || windowId === "1h") return launch.change1h || 0;
  if (windowId === "6h") return launch.stats.change6h || launch.change1h || 0;
  if (windowId === "24h" || windowId === "48h") return launch.stats.change24h || 0;
  return 0;
}

function byWindowMovers(windowId: WindowId) {
  return (a: LaunchWithStats, b: LaunchWithStats) => {
    const score = (launch: LaunchWithStats) => {
      const ch = Math.abs(windowChangePct(launch, windowId));
      return (launch.stats.volume24h || 0) * (1 + ch / 25) + ch * 100;
    };
    const d = score(b) - score(a);
    if (d !== 0) return d;
    return b.marketCap - a.marketCap;
  };
}

function byNewest(a: LaunchWithStats, b: LaunchWithStats) {
  const ageCmp = launchMs(b) - launchMs(a);
  if (ageCmp !== 0) return ageCmp;
  return a.progress - b.progress;
}

/** Session peak mcap. Sparks only after this peak is broken, then off again on a dip. */
const athPeakByToken = new Map<string, number>();
const athFreshByToken = new Map<string, boolean>();

function resolveAth(launch: LaunchWithStats) {
  const key = launch.address.toLowerCase();
  let fromSpark = 0;
  if (launch.priceUsd > 0 && launch.sparkline && launch.sparkline.length >= 2) {
    const sparkMax = Math.max(...launch.sparkline);
    if (sparkMax > launch.priceUsd) {
      fromSpark = launch.marketCap * (sparkMax / launch.priceUsd);
    }
  }
  const current = launch.marketCap || 0;
  const reported = Math.max(launch.stats.ath || 0, current, fromSpark);
  const seen = athPeakByToken.get(key);
  const peak = Math.max(seen ?? 0, reported);
  const broke = seen != null && reported > seen + Math.max(0.01, seen * 0.001);
  let fresh = athFreshByToken.get(key) ?? false;
  if (seen == null) fresh = false;
  if (broke) fresh = true;
  if (seen != null && current < peak) fresh = false;
  athPeakByToken.set(key, peak);
  athFreshByToken.set(key, fresh);
  const capped = Math.min(MAX_MCAP, peak);
  const progress = capped > 0 ? Math.min(100, Math.round((current / capped) * 100)) : 0;
  const atAth = fresh && capped > 0 && current >= peak;
  return { athValue: capped, progress, atAth };
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

function uniqueLaunches(rows: LaunchWithStats[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = row.address.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function Explore() {
  const router = useRouter();
  const params = useSearchParams();
  const query = (params.get("q") ?? "").trim().toLowerCase();
  const [board, setBoard] = useState<Board>("New Pair");
  const [boardTab, setBoardTab] = useState<Board>("New Pair");
  const stage = boardToStage(board);
  const [phases, setPhases] = useState<Record<TrenchPhase, LaunchWithStats[]>>({
    new: [],
    "almost migrated": [],
    migrated: [],
  });
  const [feedReady, setFeedReady] = useState(false);
  const { data: fees } = useAsyncData(() => getFees(), [], { initial: null });

  useEffect(() => {
    if (fees?.ETH_USD && fees.ETH_USD > 0) setTrenchEthUsd(fees.ETH_USD);
  }, [fees?.ETH_USD]);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let closed = false;
    let retry: number | undefined;

    const connect = () => {
      socket = new WebSocket(trenchesSocketUrl());
      socket.onmessage = (event) => {
        let message: TrenchSnapshot | TrenchUpdate;
        try {
          message = JSON.parse(String(event.data)) as TrenchSnapshot | TrenchUpdate;
        } catch {
          return;
        }
        if (message.type === "snapshot") {
          setPhases({
            new: uniqueLaunches((message.phases.new ?? []).map(trenchToLaunch)).slice(0, BOARD_ROW_CAP),
            "almost migrated": uniqueLaunches((message.phases["almost migrated"] ?? []).map(trenchToLaunch)).slice(0, BOARD_ROW_CAP),
            migrated: uniqueLaunches((message.phases.migrated ?? []).map(trenchToLaunch)).slice(0, BOARD_ROW_CAP),
          });
          setFeedReady(true);
          return;
        }
        if (message.type !== "pair" || !message.pair?.token) return;
        const row = trenchToLaunch(message.pair);
        const phase = message.phase ?? "new";
        if (phase !== "new" && phase !== "almost migrated" && phase !== "migrated") return;
        const from = message.from;
        setPhases((prev) => {
          const next = {
            new: prev.new,
            "almost migrated": prev["almost migrated"],
            migrated: prev.migrated,
          };
          if (from && from !== phase && (from === "new" || from === "almost migrated" || from === "migrated")) {
            next[from] = next[from].filter((item) => item.address.toLowerCase() !== row.address.toLowerCase());
          }
          const without = next[phase].filter((item) => item.address.toLowerCase() !== row.address.toLowerCase());
          next[phase] = [row, ...without].slice(0, BOARD_ROW_CAP);
          return next;
        });
        setFeedReady(true);
      };
      socket.onerror = () => {
        /* reconnect via onclose — don't flash a status banner */
      };
      socket.onclose = () => {
        if (closed) return;
        retry = window.setTimeout(connect, 1500);
      };
    };

    connect();
    return () => {
      closed = true;
      if (retry) window.clearTimeout(retry);
      socket?.close();
    };
  }, []);

  const feed = useMemo(() => {
    if (stage === "almost") return uniqueLaunches(phases["almost migrated"]);
    if (stage === "migrate") return uniqueLaunches(phases.migrated);
    if (stage === "new") return uniqueLaunches(phases.new);
    const merged = new Map<string, LaunchWithStats>();
    for (const row of [...phases.migrated, ...phases["almost migrated"], ...phases.new]) {
      merged.set(row.address.toLowerCase(), row);
    }
    return [...merged.values()];
  }, [phases, stage]);

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
  const rowEls = useRef(new Map<string, HTMLElement>());
  const flipTops = useRef(new Map<string, number>());
  const skipFlip = useRef(true);
  const flipBusy = useRef(false);
  const gridBoardRef = useRef<HTMLDivElement | null>(null);
  const pageFadeRef = useRef<number | null>(null);
  const viewFadeRef = useRef<number | null>(null);

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

  const rows = useMemo(() => {
    const matched = feed.filter((launch) => {
      const text = `${launch.name} ${launch.symbol} ${launch.address}`.toLowerCase();
      if (query && !text.includes(query)) return false;
      return true;
    });

    let sorted: LaunchWithStats[];
    if (windowId !== "latest") {
      sorted = [...matched].sort(byWindowMovers(windowId));
    } else if (board === "New Pair") {
      sorted = [...matched].sort(byNewest);
    } else {
      sorted = [...matched].sort(byActivity);
    }
    // Cap at 2 pages so the table / live enrich stay cheap.
    return sorted.slice(0, BOARD_ROW_CAP);
  }, [board, feed, query, windowId]);

  useEffect(() => {
    setTablePage(1);
    setGridPage(1);
    setPageOut(false);
    if (pageFadeRef.current) window.clearTimeout(pageFadeRef.current);
    skipFlip.current = true;
    flipTops.current.clear();
  }, [board, windowId, query, view]);

  const tablePages = Math.min(MAX_PAGES, Math.max(1, Math.ceil(rows.length / TABLE_PER_PAGE)));
  const safeTablePage = Math.min(tablePage, tablePages);
  const tableRows = rows.slice((safeTablePage - 1) * TABLE_PER_PAGE, safeTablePage * TABLE_PER_PAGE);

  const gridPages = Math.min(MAX_PAGES, Math.max(1, Math.ceil(rows.length / gridPerPage)));
  const safeGridPage = Math.min(gridPage, gridPages);
  const gridRows = rows.slice((safeGridPage - 1) * gridPerPage, safeGridPage * gridPerPage);
  const visibleRows = !phone && view === "table" ? tableRows : gridRows;
  const visibleKey = visibleRows.map((row) => row.address.toLowerCase()).join(",");
  const [liveByToken, setLiveByToken] = useState<Map<string, LaunchWithStats>>(() => new Map());

  useEffect(() => {
    const tokens = visibleKey ? visibleKey.split(",") : [];
    if (tokens.length === 0) return;
    let stopped = false;
    let timer = 0;
    let pending = false;
    const pull = async () => {
      if (pending) return;
      pending = true;
      try {
        const pairs = await getVisibleTrenchPairs(tokens);
        if (stopped) return;
        setLiveByToken((current) => {
          const next = new Map(current);
          for (const pair of pairs) {
            const launch = trenchToLaunch(pair);
            const prev = next.get(pair.token.toLowerCase());
            if (prev?.logoUrl && !launch.logoUrl) launch.logoUrl = prev.logoUrl;
            next.set(pair.token.toLowerCase(), launch);
          }
          return next;
        });
      } catch {
        /* keep the last chain numbers on this page */
      } finally {
        pending = false;
        if (!stopped) timer = window.setTimeout(() => void pull(), 3000);
      }
    };
    void pull();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [visibleKey]);

  const shown = (row: LaunchWithStats) => {
    const live = liveByToken.get(row.address.toLowerCase()) ?? row;
    const launchedAt = live.launchedAt ?? row.launchedAt;
    const logoUrl = live.logoUrl || row.logoUrl;
    const age = launchedAt ? trenchAgeLabel(launchedAt) : live.stats.age;
    if (
      age === live.stats.age &&
      live.launchedAt === launchedAt &&
      live.logoUrl === logoUrl
    ) {
      return live;
    }
    return {
      ...live,
      launchedAt,
      logoUrl,
      stats: { ...live.stats, age },
    };
  };

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

  useEffect(() => {
    setGridPage(1);
  }, [gridPerPage]);

  useEffect(() => {
    skipFlip.current = true;
    flipTops.current.clear();
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

  const loading = !feedReady;
  const statusNote = !loading && feed.length === 0 ? "No launches yet." : null;

  return (
    <div className="explore-page">
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
      {statusNote ? <PageFlash note={statusNote} /> : null}
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
                <th>Holder</th>
                <th>Bundler</th>
              </tr>
            </thead>
            <tbody className={`page-swap${pageOut ? " is-out" : ""}`}>
              {tableRows.map((stored, index) => {
                const launch = shown(stored);
                const { stats } = launch;
                const volume = stats.volume24h;
                const { athValue, progress, atAth } = resolveAth(launch);
                const rank = (safeTablePage - 1) * TABLE_PER_PAGE + index + 1;
                return (
                  <tr
                    key={launch.address}
                    ref={bindRow(launch.address)}
                    onClick={() => router.push(`/token/${launch.address}`)}
                  >
                    <td>
                      <Link
                        href={`/token/${launch.address}`}
                        className="coin-cell"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <span className="coin-rank">{rank}</span>
                        <TokenLogo symbol={launch.symbol} size={26} src={launch.logoUrl} address={launch.address} />
                        <span className="coin-copy">
                          <span className="coin-title-row">
                            <span className="coin-name">{launch.name}</span>
                            <span className="ticker text-[var(--muted)]">${launch.symbol}</span>
                          </span>
                          <span className="coin-ca">{shortAddress(launch.address)}</span>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <Sparkline
                        seed={launch.address}
                        width={76}
                        height={24}
                        values={launch.sparkline ?? []}
                        up={(launch.change1h || launch.stats.change24h) >= 0}
                      />
                    </td>
                    <td className={launch.change1h >= 0 ? "up" : "down"}>
                      <TickValue value={formatUsd(launch.marketCap)} />
                    </td>
                    <td>
                      <AthMeter
                        value={formatUsd(athValue)}
                        progress={progress}
                        atAth={atAth}
                        seed={launch.address}
                      />
                    </td>
                    <td>{stats.age}</td>
                    <td>{formatCount(stats.txns)}</td>
                    <td>
                      <TickValue value={formatUsd(volume)} />
                    </td>
                    <td>
                      <TickValue value={formatUsd(stats.boxUsd)} />
                    </td>
                    <td>{formatCount(stats.holders)}</td>
                    <td>{formatCount(stats.bundlers)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          {tablePages > 1 ? (
            <Pager page={safeTablePage} pages={tablePages} onChange={(page) => goPage("table", page)} />
          ) : null}
        </div>
      ) : (
        <div className="pair-grid-shell" ref={gridBoardRef}>
          <div className="pair-grid-panel">
            <div className={`pair-grid page-swap${pageOut ? " is-out" : ""}`}>
            {gridRows.map((stored) => {
              const launch = shown(stored);
              const { stats } = launch;
              const volume = stats.volume24h;
              const { athValue, progress, atAth } = resolveAth(launch);
              return (
                <Link
                  key={launch.address}
                  href={`/token/${launch.address}`}
                  ref={bindRow(launch.address)}
                  className="pair-card"
                >
                  <div className="pair-head">
                    <TokenLogo symbol={launch.symbol} size={40} src={launch.logoUrl} address={launch.address} />
                    <div className="pair-id">
                      <p>{launch.name}</p>
                      <p className="pair-symbol">${launch.symbol}</p>
                      <p className="pair-ca">{shortAddress(launch.address)}</p>
                    </div>
                    <p className={launch.change1h >= 0 ? "pair-chg up" : "pair-chg down"}>
                      {launch.change1h >= 0 ? "↑" : "↓"} {Math.abs(launch.change1h).toFixed(1)}%
                    </p>
                  </div>
                  <div className="pair-chart">
                    <Sparkline
                      seed={launch.address}
                      width={240}
                      height={36}
                      fluid
                      values={launch.sparkline ?? []}
                      up={(launch.change1h || launch.stats.change24h) >= 0}
                    />
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
                      <dd>{formatUsd(stats.boxUsd)}</dd>
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
      {!loading && feed.length > 0 && rows.length === 0 && (
        <p className="mt-8 text-sm text-[var(--muted)]">
          {query ? "No coins match that search." : "No coins in that window."}
        </p>
      )}
    </div>
  );
}
