"use client";

import { useMemo, useState } from "react";
import { accruedFeeUsd, LOOTING_PRICE_USD } from "@/lib/fees";
import { formatCount, formatUsd, launches, leaderboard, marketStats, stagedLaunches } from "@/lib/mock";

const ETH_USD = 3500;
const DAYS = 72;

type Range = "24h" | "all";

const rows = [...launches, ...stagedLaunches].map((launch) => {
  const stats = marketStats(launch);
  const feeUsd = accruedFeeUsd(launch);
  const boxUsd = feeUsd * (launch.luckyShare / 100);
  return { launch, stats, feeUsd, boxUsd, creatorUsd: feeUsd - boxUsd };
});

const volume24h = rows.reduce((sum, row) => sum + row.stats.volume24h, 0);
const feeUsd = rows.reduce((sum, row) => sum + row.feeUsd, 0);
const boxUsd = rows.reduce((sum, row) => sum + row.boxUsd, 0);
const creatorUsd = feeUsd - boxUsd;
const traders = rows.reduce((sum, row) => sum + row.stats.traders, 0);
const graduated = rows.filter((row) => row.launch.phase === "graduated").length;
const creators = new Set(rows.map((row) => row.launch.creator)).size;
const txns = rows.reduce((sum, row) => sum + row.stats.txns, 0);
const seasonXp = leaderboard.reduce((sum, row) => sum + row.xp, 0);
const seasonTrades = leaderboard.reduce((sum, row) => sum + row.trades, 0);
const boxShare = feeUsd > 0 ? (boxUsd / feeUsd) * 100 : 0;
const creatorLines = [...rows].sort((a, b) => b.creatorUsd - a.creatorUsd).slice(0, 5);
const boxLines = [...rows].sort((a, b) => b.boxUsd - a.boxUsd).slice(0, 5);
const curveLines = [...rows].sort((a, b) => b.launch.progress - a.launch.progress).slice(0, 5);

const STAKE_LOCKS = [
  { id: "flex", label: "Flexible", rate: 8.4, staked: 12_400_000, day: 186_000 },
  { id: "30", label: "30 days", rate: 14.2, staked: 26_800_000, day: 420_000 },
  { id: "90", label: "90 days", rate: 22.0, staked: 9_400_000, day: 94_000 },
] as const;

function formatLoot(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M LOOTING`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k LOOTING`;
  return `${Math.round(value).toLocaleString("en-US")} LOOTING`;
}

function formatEth(usd: number) {
  const eth = usd / ETH_USD;
  if (eth >= 100) return `${eth.toFixed(1)} ETH`;
  if (eth >= 1) return `${eth.toFixed(2)} ETH`;
  return `${eth.toFixed(3)} ETH`;
}

function dayLabel(offset: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - (DAYS - 1 - offset));
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function series(total: number, shape: "volume" | "launches" | "staking") {
  const weights = Array.from({ length: DAYS }, (_, index) => {
    const t = index / (DAYS - 1);
    const seed = shape === "volume" ? 3 : shape === "launches" ? 11 : 5;
    const noise = 0.72 + ((index * 17 + seed) % 9) / 18;
    const volumeWave = 0.08 + Math.exp(-((t - 0.82) ** 2) / 0.012) * 1.15 + Math.exp(-((t - 0.22) ** 2) / 0.02) * 0.22;
    const launchWave =
      0.05 +
      Math.exp(-((t - 0.18) ** 2) / 0.01) * 0.55 +
      Math.exp(-((t - 0.78) ** 2) / 0.008) * 1.05 +
      (t > 0.9 ? 0.35 : 0);
    const stakingWave = 0.16 + t * 0.62 + Math.exp(-((t - 0.48) ** 2) / 0.018) * 0.55 + Math.exp(-((t - 0.86) ** 2) / 0.01) * 0.4;
    const wave = shape === "volume" ? volumeWave : shape === "launches" ? launchWave : stakingWave;
    return Math.max(0.04, wave * noise);
  });
  const weightSum = weights.reduce((sum, value) => sum + value, 0);
  return weights.map((weight) => (total * weight) / weightSum);
}

export function Analytics() {
  const [range, setRange] = useState<Range>("24h");
  const allTime = range === "all";
  const volume = allTime ? volume24h * 18 : volume24h;
  const launchCount = allTime ? rows.length * 24 : rows.length;
  const traderCount = allTime ? traders * 6 : traders;
  const volumeDelta = allTime ? 12.4 : -1.3;
  const launchDelta = allTime ? 4.1 : 8.7;

  const volumeBars = useMemo(() => series(volume, "volume"), [volume]);
  const launchBars = useMemo(() => series(launchCount, "launches"), [launchCount]);
  const stakeRows = STAKE_LOCKS.map((lock) => ({ ...lock, amount: allTime ? lock.staked : lock.day }));
  const stakedTotal = stakeRows.reduce((sum, row) => sum + row.amount, 0);
  const avgRate = stakedTotal > 0 ? stakeRows.reduce((sum, row) => sum + row.amount * row.rate, 0) / stakedTotal : 0;
  const stakeBars = useMemo(() => series(stakedTotal, "staking"), [stakedTotal]);
  const volumePeak = Math.max(...volumeBars);
  const launchPeak = Math.max(...launchBars);
  const stakePeak = Math.max(...stakeBars);
  const ticks = [0, Math.floor(DAYS / 2), DAYS - 1];

  return (
    <div className="analytics-page">
      <div className="page-head">
        <div>
          <h1 className="explore-title">Analytics</h1>
          <p className="page-note">Season 01 protocol totals across every launch.</p>
        </div>
        <div className="analytics-range" role="group" aria-label="Time range">
          <button type="button" className={range === "24h" ? "on" : ""} onClick={() => setRange("24h")}>
            24h
          </button>
          <button type="button" className={range === "all" ? "on" : ""} onClick={() => setRange("all")}>
            All time
          </button>
        </div>
      </div>

      <section className="sheet analytics-card">
        <div className="analytics-stats">
          <article>
            <span>{allTime ? "Volume" : "24h volume"}</span>
            <strong>{formatUsd(volume)}</strong>
            <em className={volumeDelta >= 0 ? "up" : "down"}>
              {volumeDelta >= 0 ? "+" : ""}
              {volumeDelta.toFixed(1)}% from prior {allTime ? "window" : "day"}
            </em>
          </article>
          <article>
            <span>{allTime ? "Launches" : "24h launches"}</span>
            <strong>{formatCount(launchCount)}</strong>
            <em className={launchDelta >= 0 ? "up" : "down"}>
              +{launchDelta.toFixed(1)}% from prior {allTime ? "window" : "day"}
            </em>
          </article>
          <article>
            <span>{allTime ? "Traders" : "Active traders"}</span>
            <strong>{formatCount(traderCount)}</strong>
            <em>{allTime ? `${formatCount(txns)} trades` : `${creators} token creators`}</em>
          </article>
        </div>
        <p className="analytics-note">Totals are summed from live launches. The 24h view uses the latest completed day.</p>
      </section>

      <section className="sheet analytics-card">
        <header className="analytics-card-head">
          <h2>Creator fees</h2>
          <span>{formatEth(feeUsd)} accrued</span>
        </header>
        <div className="analytics-bar" aria-hidden>
          <i className="creator" style={{ width: `${100 - boxShare}%` }} />
          <i className="box" style={{ width: `${boxShare}%` }} />
        </div>
        <div className="analytics-stats">
          <article>
            <span>Creator share</span>
            <strong>{formatUsd(creatorUsd)}</strong>
            <em>{formatEth(creatorUsd)} claimable</em>
            <ul>
              {creatorLines.map((row) => (
                <li key={row.launch.address}>
                  <span>${row.launch.symbol}</span>
                  <b>{formatUsd(row.creatorUsd)}</b>
                </li>
              ))}
            </ul>
          </article>
          <article>
            <span>Lucky Boxes</span>
            <strong>{formatUsd(boxUsd)}</strong>
            <em>{formatEth(boxUsd)} funded</em>
            <ul>
              {boxLines.map((row) => (
                <li key={row.launch.address}>
                  <span>${row.launch.symbol}</span>
                  <b>{formatUsd(row.boxUsd)}</b>
                </li>
              ))}
            </ul>
          </article>
          <article>
            <span>Curve</span>
            <strong>{rows.length - graduated}</strong>
            <em>{graduated} graduated</em>
            <ul>
              {curveLines.map((row) => (
                <li key={row.launch.address}>
                  <span>${row.launch.symbol}</span>
                  <b>{row.launch.progress}%</b>
                </li>
              ))}
            </ul>
          </article>
        </div>
        <dl className="analytics-side">
          <div>
            <dt>Season XP</dt>
            <dd>{formatCount(seasonXp)}</dd>
          </div>
          <div>
            <dt>Qualifying trades</dt>
            <dd>{formatCount(seasonTrades)}</dd>
          </div>
          <div>
            <dt>Trades</dt>
            <dd>{formatCount(allTime ? txns * 6 : txns)}</dd>
          </div>
          <div>
            <dt>Creators</dt>
            <dd>{creators}</dd>
          </div>
        </dl>
      </section>

      <section className="sheet analytics-card">
        <header className="analytics-card-head">
          <h2>Staking</h2>
          <span>{formatLoot(stakedTotal)} staked</span>
        </header>
        <div className="analytics-bar" aria-hidden>
          {stakeRows.map((row) => (
            <i key={row.id} className={row.id === "flex" ? "flex" : row.id === "30" ? "lock30" : "lock90"} style={{ width: `${(row.amount / stakedTotal) * 100}%` }} />
          ))}
        </div>
        <div className="analytics-stats">
          {stakeRows.map((row) => (
            <article key={row.id}>
              <span>{row.label}</span>
              <strong>{formatLoot(row.amount)}</strong>
              <em>
                {row.rate.toFixed(1)}% · {formatUsd(row.amount * LOOTING_PRICE_USD)}
              </em>
            </article>
          ))}
        </div>
        <dl className="analytics-side">
          <div>
            <dt>Stakers</dt>
            <dd>{formatCount(allTime ? 1284 : 42)}</dd>
          </div>
          <div>
            <dt>{allTime ? "Rewards paid" : "Rewards earned"}</dt>
            <dd>{formatLoot(allTime ? 6_420_000 : 86_400)}</dd>
          </div>
          <div>
            <dt>Claimable</dt>
            <dd>{formatLoot(allTime ? 1_842_000 : 128_400)}</dd>
          </div>
          <div>
            <dt>Avg rate</dt>
            <dd>{avgRate.toFixed(1)}%</dd>
          </div>
        </dl>
      </section>

      <div className="analytics-charts">
        <ChartCard
          title="Trading volume"
          note="Daily volume across the season."
          value={formatUsd(volume)}
          bars={volumeBars}
          peak={volumePeak}
          ticks={ticks}
          format={formatUsd}
        />
        <ChartCard
          title="Token launches"
          note="Daily launches across the season."
          value={formatCount(launchCount)}
          bars={launchBars}
          peak={launchPeak}
          ticks={ticks}
          format={(amount) => (amount >= 10 ? formatCount(Math.round(amount)) : amount.toFixed(1))}
        />
        <ChartCard
          title="Staking"
          note="Daily LOOTING staked across the season."
          value={formatLoot(stakedTotal)}
          bars={stakeBars}
          peak={stakePeak}
          ticks={ticks}
          format={formatLoot}
        />
      </div>
    </div>
  );
}

function ChartCard({
  title,
  note,
  value,
  bars,
  peak,
  ticks,
  format,
}: {
  title: string;
  note: string;
  value: string;
  bars: number[];
  peak: number;
  ticks: number[];
  format: (amount: number) => string;
}) {
  return (
    <section className="sheet analytics-chart">
      <header>
        <div>
          <h2>{title}</h2>
          <p>{note}</p>
        </div>
        <strong>{value}</strong>
      </header>
      <div className="analytics-bars" role="img" aria-label={`${title} over the last ${DAYS} days`}>
        {bars.map((valueBar, index) => (
          <button
            key={index}
            type="button"
            style={{ height: `${Math.max(6, (valueBar / peak) * 100)}%` }}
            aria-label={`${dayLabel(index)} ${format(valueBar)}`}
          >
            <span className="analytics-tip">
              <b>{format(valueBar)}</b>
              <em>{dayLabel(index)}</em>
            </span>
          </button>
        ))}
      </div>
      <div className="analytics-axis">
        {ticks.map((index) => (
          <span key={index}>{dayLabel(index)}</span>
        ))}
      </div>
    </section>
  );
}
