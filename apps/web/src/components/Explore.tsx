"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatCount, formatUsd, launches, marketStats, stagedLaunches, type Launch } from "@/lib/mock";
import { SlidingTabs } from "./SlidingTabs";
import { Sparkline } from "./Sparkline";
import { TokenLogo } from "./TokenLogo";
import { GraduateIcon, GridIcon, MigrateIcon, MoversIcon, NewPairIcon, TableIcon, TrendingIcon } from "./Icons";

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

function ageHours(age: string) {
  const value = Number.parseFloat(age);
  if (age.endsWith("m")) return value / 60;
  if (age.endsWith("h")) return value;
  if (age.endsWith("d")) return value * 24;
  return value;
}

function nudge(coin: Launch): { coin: Launch; dir: "up" | "down" } {
  const delta = Number((Math.random() * 9 - 4).toFixed(1));
  const marketCap = Math.max(900, Math.round(coin.marketCap * (1 + delta / 80)));
  return {
    dir: marketCap >= coin.marketCap ? "up" : "down",
    coin: {
      ...coin,
      marketCap,
      change1h: Number((coin.change1h + delta * 0.45).toFixed(1)),
    },
  };
}

function digitFrames(before: string, after: string, dir?: "up" | "down") {
  const width = Math.max(before.length, after.length);
  const prev = before.padStart(width, " ");
  const next = after.padStart(width, " ");
  const frames: { ch: string; roll: boolean; delay: number; slot: number }[] = [];
  let changedDigits = 0;
  for (let index = width - 1; index >= 0; index -= 1) {
    if (next[index] === " ") continue;
    const changed = prev[index] !== next[index] && /\d/.test(next[index]);
    const roll = Boolean(dir && changed);
    if (roll) changedDigits += 1;
    frames.push({
      ch: next[index],
      roll,
      delay: roll ? (changedDigits - 1) * 38 : 0,
      slot: width - index,
    });
  }
  frames.reverse();
  return frames;
}

function TickValue({
  value,
  dir,
  nonce,
}: {
  value: string;
  dir?: "up" | "down";
  nonce?: number;
}) {
  const cache = useRef({ value, nonce, before: value });
  if (cache.current.value !== value || cache.current.nonce !== nonce) {
    cache.current = { value, nonce, before: cache.current.value };
  }
  const rolling = cache.current.before !== value ? dir : undefined;
  const frames = digitFrames(cache.current.before, value, rolling);

  return (
    <span className="amt-slot">
      {frames.map((frame) => (
        <span className="amt-char" key={frame.slot}>
          <span
            key={frame.roll ? `${nonce}-${frame.ch}` : "stay"}
            className={frame.roll ? `tick-${rolling}` : undefined}
            style={frame.roll ? { animationDelay: `${frame.delay}ms` } : undefined}
          >
            {frame.ch}
          </span>
        </span>
      ))}
    </span>
  );
}

export function Explore() {
  const router = useRouter();
  const params = useSearchParams();
  const query = (params.get("q") ?? "").trim().toLowerCase();
  const [board, setBoard] = useState<Board>("New Pair");
  const [windowId, setWindowId] = useState<WindowId>("latest");
  const [view, setView] = useState<"table" | "grid">("table");
  const [phone, setPhone] = useState(false);
  const [feed, setFeed] = useState(launches);
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  const [ticks, setTicks] = useState<Record<string, { dir: "up" | "down"; n: number }>>({});
  const feedRef = useRef(launches);
  const queueRef = useRef(stagedLaunches);
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

    const markTick = (address: string, dir: "up" | "down") => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      setTicks((current) => ({
        ...current,
        [address]: { dir, n: (current[address]?.n ?? 0) + 1 },
      }));
    };

    const step = { current: 0 };
    const id = window.setInterval(() => {
      step.current += 1;
      const spawn = queueRef.current[0];
      if (spawn && (step.current === 1 || Math.random() > 0.45)) {
        queueRef.current = queueRef.current.slice(1);
        bornRef.current?.set(spawn.address, nextBorn.current);
        nextBorn.current += 1;
        const next = [spawn, ...feedRef.current];
        feedRef.current = next;
        setFeed(next);
        markFresh(spawn.address);
        return;
      }
      const current = feedRef.current;
      if (current.length === 0) return;
      const index = Math.floor(Math.random() * current.length);
      const updated = nudge(current[index]);
      const next = current.map((item, itemIndex) => (itemIndex === index ? updated.coin : item));
      feedRef.current = next;
      setFeed(next);
      markTick(updated.coin.address, updated.dir);
    }, 2400);

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
    if (board === "Almost Graduate") return [...matched].sort((a, b) => b.progress - a.progress);
    if (board === "Movers") return [...matched].sort((a, b) => Math.abs(b.change1h) - Math.abs(a.change1h));
    if (board === "Trending") return [...matched].sort((a, b) => b.change1h - a.change1h);
    return [...matched].sort((a, b) => b.marketCap - a.marketCap);
  }, [board, feed, query, windowId]);

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
            value={view}
            onChange={setView}
          />
        )}
      </div>
      <div className="explore-tools">
        <SlidingTabs
          ariaLabel="Launch stage"
          items={stages}
          value={board === "New Pair" || board === "Almost Graduate" || board === "Migrate" ? board : null}
          onChange={setBoard}
        />
        <SlidingTabs
          ariaLabel="Ranking"
          tone="quiet"
          items={ranks}
          value={board === "Movers" || board === "Trending" ? board : null}
          onChange={setBoard}
        />
        <div className="time-window">
          <SlidingTabs
            ariaLabel="Time window"
            tone="quiet"
            items={windows}
            value={windowId}
            onChange={setWindowId}
          />
        </div>
      </div>

      <div key={`${board}-${phone ? "grid" : view}`} className="view-swap">
      {!phone && view === "table" ? (
        <div className="table-wrap">
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
            <tbody>
              {rows.map((launch, index) => {
                const stats = marketStats(launch);
                const progress = Math.min(100, Math.round((launch.marketCap / stats.ath) * 100));
                const arrived = fresh.has(launch.address);
                const tick = ticks[launch.address];
                return (
                  <tr
                    key={launch.address}
                    className={arrived ? "is-new" : undefined}
                    onClick={() => router.push(`/token/${launch.address}`)}
                  >
                    <td>
                      <Link
                        href={`/token/${launch.address}`}
                        className="coin-cell"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <span className="num w-6 text-[var(--muted)]">{index + 1}</span>
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
                      <span className="ath">
                        {formatUsd(stats.ath)}
                        <i>
                          <span style={{ width: `${progress}%` }} />
                        </i>
                      </span>
                    </td>
                    <td>{stats.age}</td>
                    <td>{formatCount(stats.txns)}</td>
                    <td>
                      <TickValue value={formatUsd(stats.volume24h)} dir={tick?.dir} nonce={tick?.n} />
                    </td>
                    <td>
                      <TickValue value={formatUsd(stats.boxUsd)} dir={tick?.dir} nonce={tick?.n} />
                    </td>
                    <td className={launch.change1h >= 0 ? "up" : "down"}>
                      <TickValue
                        value={`${launch.change1h >= 0 ? "↑" : "↓"} ${Math.abs(launch.change1h).toFixed(1)}%`}
                        dir={tick?.dir}
                        nonce={tick?.n}
                      />
                    </td>
                    <td className={stats.change24h >= 0 ? "up" : "down"}>
                      <TickValue
                        value={`${stats.change24h >= 0 ? "↑" : "↓"} ${Math.abs(stats.change24h).toFixed(1)}%`}
                        dir={tick?.dir}
                        nonce={tick?.n}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="pair-grid">
          {rows.map((launch) => {
            const stats = marketStats(launch);
            return (
              <Link
                key={launch.address}
                href={`/token/${launch.address}`}
                className={`sheet pair-card ${fresh.has(launch.address) ? "is-new" : ""}`}
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
                    <dd>{formatUsd(stats.ath)}</dd>
                  </div>
                  <div>
                    <dt>Vol</dt>
                    <dd>{formatUsd(stats.volume24h)}</dd>
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
