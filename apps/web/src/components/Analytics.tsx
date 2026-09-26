"use client";

import { useMemo, useState } from "react";
import { accruedFeeUsd, DEV_LOCK_FEE_ETH } from "@/lib/fees";
import { formatCount, formatUsd, launches, leaderboard, marketStats, stagedLaunches } from "@/lib/mock";
import { eventAprRange, publicStakingEvents, STAKING_LOCK_OPTIONS } from "@/lib/staking-events";

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

const vaultEvents = publicStakingEvents;
const vaultStaked = vaultEvents.reduce((sum, event) => sum + event.staked, 0);
const vaultRewards = vaultEvents.reduce((sum, event) => sum + event.reward, 0);
const vaultStakers = vaultEvents.reduce((sum, event) => sum + event.stakers, 0);
const topVaults = [...vaultEvents].sort((a, b) => b.staked - a.staked).slice(0, 5);

const STAKE_BY_LOCK = STAKING_LOCK_OPTIONS.map((lock) => {
  const enabled = vaultEvents.filter((event) => event.locks.includes(lock.id));
  const staked = enabled.reduce((sum, event) => sum + event.staked / event.locks.length, 0);
  return {
    id: lock.id,
    label: lock.label,
    rate: lock.rate,
    staked: Math.round(staked),
    day: Math.round(staked * 0.018),
  };
});

/** Season mock aggregate for Dev Lock (protocol totals). */
const DEV_LOCK = {
  locks: 186,
  locksDay: 7,
  timeLocks: 112,
  vestLocks: 74,
  tokensLocked: 48_600_000,
  tokensLockedDay: 1_240_000,
  claimed: 6_820_000,
  claimedDay: 186_000,
  feeEth: 186 * DEV_LOCK_FEE_ETH,
  feeEthDay: 7 * DEV_LOCK_FEE_ETH,
  creators: 42,
  top: [
    { symbol: "VAULT", amount: 12_400_000, mode: "Time-based" },
    { symbol: "THREAD", amount: 9_100_000, mode: "Vesting" },
    { symbol: "HARBOR", amount: 7_600_000, mode: "Time-based" },
    { symbol: "KEY", amount: 5_800_000, mode: "Vesting" },
    { symbol: "LANTERN", amount: 4_200_000, mode: "Time-based" },
  ],
};

function formatTokens(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 10_000) return `${Math.round(value / 1000)}K`;
  return Math.round(value).toLocaleString("en-US");
}

function formatEth(usdOrEth: number, asEth = false) {
  const eth = asEth ? usdOrEth : usdOrEth / ETH_USD;
  if (eth >= 100) return `${eth.toFixed(1)} ETH`;
  if (eth >= 1) return `${eth.toFixed(2)} ETH`;
  if (eth >= 0.001) return `${eth.toFixed(4)} ETH`;
  return `${eth.toFixed(6)} ETH`;
}

function dayLabel(offset: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - (DAYS - 1 - offset));
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function series(total: number, shape: "volume" | "launches" | "staking" | "devlock") {
  const weights = Array.from({ length: DAYS }, (_, index) => {
    const t = index / (DAYS - 1);
    const seed = shape === "volume" ? 3 : shape === "launches" ? 11 : shape === "staking" ? 5 : 13;
    const noise = 0.72 + ((index * 17 + seed) % 9) / 18;
    const volumeWave = 0.08 + Math.exp(-((t - 0.82) ** 2) / 0.012) * 1.15 + Math.exp(-((t - 0.22) ** 2) / 0.02) * 0.22;
    const launchWave =
      0.05 +
      Math.exp(-((t - 0.18) ** 2) / 0.01) * 0.55 +
      Math.exp(-((t - 0.78) ** 2) / 0.008) * 1.05 +
      (t > 0.9 ? 0.35 : 0);
    const stakingWave = 0.16 + t * 0.62 + Math.exp(-((t - 0.48) ** 2) / 0.018) * 0.55 + Math.exp(-((t - 0.86) ** 2) / 0.01) * 0.4;
    const lockWave = 0.12 + t * 0.55 + Math.exp(-((t - 0.36) ** 2) / 0.015) * 0.5 + Math.exp(-((t - 0.74) ** 2) / 0.012) * 0.45;
    const wave =
      shape === "volume" ? volumeWave : shape === "launches" ? launchWave : shape === "staking" ? stakingWave : lockWave;
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

  const stakeRows = STAKE_BY_LOCK.map((lock) => ({ ...lock, amount: allTime ? lock.staked : lock.day }));
  const stakedTotal = allTime ? vaultStaked : Math.round(vaultStaked * 0.018);
  const rewardsTotal = allTime ? vaultRewards : Math.round(vaultRewards * 0.04);
  const stakerCount = allTime ? vaultStakers : Math.max(12, Math.round(vaultStakers * 0.05));
  const vaultCount = allTime ? vaultEvents.length : Math.min(vaultEvents.length, 3);
  const avgRate =
    stakeRows.reduce((sum, row) => sum + row.amount, 0) > 0
      ? stakeRows.reduce((sum, row) => sum + row.amount * row.rate, 0) / stakeRows.reduce((sum, row) => sum + row.amount, 0)
      : 0;

  const lockCount = allTime ? DEV_LOCK.locks : DEV_LOCK.locksDay;
  const lockedTokens = allTime ? DEV_LOCK.tokensLocked : DEV_LOCK.tokensLockedDay;
  const claimedTokens = allTime ? DEV_LOCK.claimed : DEV_LOCK.claimedDay;
  const feeLockEth = allTime ? DEV_LOCK.feeEth : DEV_LOCK.feeEthDay;
  const timeShare = (DEV_LOCK.timeLocks / DEV_LOCK.locks) * 100;
  const vestShare = 100 - timeShare;

  const volumeBars = useMemo(() => series(volume, "volume"), [volume]);
  const launchBars = useMemo(() => series(launchCount, "launches"), [launchCount]);
  const stakeBars = useMemo(() => series(stakedTotal, "staking"), [stakedTotal]);
  const lockBars = useMemo(() => series(lockedTokens, "devlock"), [lockedTokens]);
  const volumePeak = Math.max(...volumeBars);
  const launchPeak = Math.max(...launchBars);
  const stakePeak = Math.max(...stakeBars);
  const lockPeak = Math.max(...lockBars);
  const ticks = [0, Math.floor(DAYS / 2), DAYS - 1];

  return (
    <div className="analytics-page">
      <div className="page-head">
        <div>
          <h1 className="explore-title">Analytics</h1>
          <p className="page-note">Season 01 totals across launches, staking vaults, and Dev Lock.</p>
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
          <h2>Staking vaults</h2>
          <span>
            {vaultCount} open · {formatTokens(stakedTotal)} staked
          </span>
        </header>
        <div className="analytics-bar" aria-hidden>
          {stakeRows.map((row) => (
            <i
              key={row.id}
              className={row.id === "flex" ? "flex" : row.id === "30" ? "lock30" : "lock90"}
              style={{ width: `${stakedTotal > 0 ? (row.amount / stakeRows.reduce((s, r) => s + r.amount, 0)) * 100 : 0}%` }}
            />
          ))}
        </div>
        <div className="analytics-stats">
          {stakeRows.map((row) => (
            <article key={row.id}>
              <span>{row.label}</span>
              <strong>{formatTokens(row.amount)}</strong>
              <em>{row.rate}% APR · across vaults</em>
            </article>
          ))}
        </div>
        <div className="analytics-stats analytics-vault-top">
          <article>
            <span>Top vaults</span>
            <ul>
              {topVaults.map((event) => (
                <li key={event.id}>
                  <span>${event.symbol}</span>
                  <b>
                    {formatTokens(event.staked)} · {eventAprRange(event)}
                  </b>
                </li>
              ))}
            </ul>
          </article>
          <article>
            <span>Reward pools</span>
            <strong>{formatTokens(rewardsTotal)}</strong>
            <em>Funded across Create Staking events</em>
            <ul>
              {[...vaultEvents]
                .sort((a, b) => b.reward - a.reward)
                .slice(0, 5)
                .map((event) => (
                  <li key={`reward-${event.id}`}>
                    <span>${event.symbol}</span>
                    <b>{formatTokens(event.reward)}</b>
                  </li>
                ))}
            </ul>
          </article>
        </div>
        <dl className="analytics-side">
          <div>
            <dt>Open vaults</dt>
            <dd>{vaultCount}</dd>
          </div>
          <div>
            <dt>Stakers</dt>
            <dd>{formatCount(stakerCount)}</dd>
          </div>
          <div>
            <dt>Reward funded</dt>
            <dd>{formatTokens(rewardsTotal)}</dd>
          </div>
          <div>
            <dt>Avg APR</dt>
            <dd>{avgRate.toFixed(1)}%</dd>
          </div>
        </dl>
      </section>

      <section className="sheet analytics-card">
        <header className="analytics-card-head">
          <h2>Dev Lock</h2>
          <span>
            {formatTokens(lockedTokens)} locked · {formatEth(feeLockEth, true)} fees
          </span>
        </header>
        <div className="analytics-bar" aria-hidden>
          <i className="dev-time" style={{ width: `${timeShare}%` }} />
          <i className="dev-vest" style={{ width: `${vestShare}%` }} />
        </div>
        <div className="analytics-stats">
          <article>
            <span>Time-based</span>
            <strong>{formatCount(allTime ? DEV_LOCK.timeLocks : Math.round(DEV_LOCK.timeLocks * 0.04))}</strong>
            <em>{timeShare.toFixed(0)}% of locks</em>
          </article>
          <article>
            <span>Vesting</span>
            <strong>{formatCount(allTime ? DEV_LOCK.vestLocks : Math.round(DEV_LOCK.vestLocks * 0.04))}</strong>
            <em>{vestShare.toFixed(0)}% of locks</em>
          </article>
          <article>
            <span>Fee Lock</span>
            <strong>{formatEth(feeLockEth, true)}</strong>
            <em>{DEV_LOCK_FEE_ETH} ETH flat per create</em>
          </article>
        </div>
        <div className="analytics-stats analytics-vault-top">
          <article>
            <span>Top locked tokens</span>
            <ul>
              {DEV_LOCK.top.map((row) => (
                <li key={row.symbol}>
                  <span>${row.symbol}</span>
                  <b>
                    {formatTokens(row.amount)} · {row.mode}
                  </b>
                </li>
              ))}
            </ul>
          </article>
          <article>
            <span>Unlocked / claimed</span>
            <strong>{formatTokens(claimedTokens)}</strong>
            <em>Returned to creator wallets</em>
            <ul>
              <li>
                <span>Active locks</span>
                <b>{formatCount(lockCount)}</b>
              </li>
              <li>
                <span>Creators locking</span>
                <b>{formatCount(allTime ? DEV_LOCK.creators : 4)}</b>
              </li>
              <li>
                <span>Fee rate</span>
                <b>{DEV_LOCK_FEE_ETH} ETH</b>
              </li>
            </ul>
          </article>
        </div>
        <dl className="analytics-side">
          <div>
            <dt>Active locks</dt>
            <dd>{formatCount(lockCount)}</dd>
          </div>
          <div>
            <dt>Still locked</dt>
            <dd>{formatTokens(lockedTokens)}</dd>
          </div>
          <div>
            <dt>Claimed</dt>
            <dd>{formatTokens(claimedTokens)}</dd>
          </div>
          <div>
            <dt>Fee Lock</dt>
            <dd>{formatEth(feeLockEth, true)}</dd>
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
          title="Staking vaults"
          note="Daily token staked across public vaults."
          value={formatTokens(stakedTotal)}
          bars={stakeBars}
          peak={stakePeak}
          ticks={ticks}
          format={formatTokens}
        />
        <ChartCard
          title="Dev Lock"
          note="Daily creator tokens locked via Dev Lock."
          value={formatTokens(lockedTokens)}
          bars={lockBars}
          peak={lockPeak}
          ticks={ticks}
          format={formatTokens}
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
