"use client";

import { useState } from "react";
import { getAnalytics, getFees } from "@/lib/api";
import { DEV_LOCK_FEE_ETH } from "@/lib/fees";
import { formatCount, formatUsd } from "@/lib/format";
import type { AnalyticsPayload } from "@/lib/types";
import { useAsyncData } from "@/lib/use-async-data";

type Range = "24h" | "all";

function formatTokens(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 10_000) return `${Math.round(value / 1000)}K`;
  return Math.round(value).toLocaleString("en-US");
}

function formatEth(usdOrEth: number, ethUsd: number, asEth = false) {
  const eth = asEth ? usdOrEth : usdOrEth / Math.max(1, ethUsd);
  if (eth >= 100) return `${eth.toFixed(1)} ETH`;
  if (eth >= 1) return `${eth.toFixed(2)} ETH`;
  if (eth >= 0.001) return `${eth.toFixed(4)} ETH`;
  return `${eth.toFixed(6)} ETH`;
}

function formatDay(iso: string) {
  const date = new Date(`${iso}T00:00:00.000Z`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function lockModeLabel(mode: string) {
  if (mode === "vest" || mode === "Vesting") return "Vesting";
  if (mode === "time" || mode === "Time-based") return "Time-based";
  return mode;
}

export function Analytics() {
  const [range, setRange] = useState<Range>("24h");
  const { data, error, loading } = useAsyncData(() => getAnalytics(range), [range], {
    initial: null,
  });
  const { data: feesConfig } = useAsyncData(() => getFees(), [], {
    initial: null,
  });
  const feeLockRate = feesConfig?.DEV_LOCK_FEE_ETH ?? DEV_LOCK_FEE_ETH;

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

      {loading && !data ? (
        <section className="sheet analytics-card">
          <p className="analytics-note">Loading analytics…</p>
        </section>
      ) : null}

      {error && !data ? (
        <section className="sheet analytics-card">
          <p className="analytics-note">{error}</p>
        </section>
      ) : null}

      {data ? <AnalyticsBody data={data} range={range} feeLockRate={feeLockRate} /> : null}
    </div>
  );
}

function AnalyticsBody({
  data,
  range,
  feeLockRate,
}: {
  data: AnalyticsPayload;
  range: Range;
  feeLockRate: number;
}) {
  const allTime = range === "all";
  const ethUsd = data.ethUsd > 0 ? data.ethUsd : 3500;
  const { summary, fees, season, staking, devLock, series } = data;

  const volume = summary.volume;
  const launchCount = summary.launches;
  const traderCount = summary.traders;
  const volumeDelta = summary.volumeDeltaPct;
  const launchDelta = summary.launchDeltaPct;
  const boxShare = fees.boxSharePct;
  const onCurve = Math.max(0, allTime ? summary.launches - season.graduated : summary.launches);

  const stakeRows = staking.byLock.map((lock) => ({
    ...lock,
    amount: allTime ? lock.staked : lock.day,
  }));
  const stakeAmountTotal = stakeRows.reduce((sum, row) => sum + row.amount, 0);
  const stakedTotal = allTime ? staking.staked : stakeAmountTotal || Math.round(staking.staked * 0.018);
  const rewardsTotal = staking.rewards;
  const stakerCount = staking.stakers;
  const vaultCount = staking.vaultCount;
  const avgRate =
    stakeAmountTotal > 0
      ? stakeRows.reduce((sum, row) => sum + row.amount * row.rate, 0) / stakeAmountTotal
      : 0;

  const lockCount = allTime ? devLock.locks : devLock.locksDay;
  const lockedTokens = allTime ? devLock.tokensLocked : devLock.tokensLockedDay;
  const claimedTokens = allTime ? devLock.claimed : devLock.claimedDay;
  const feeLockEth = allTime ? devLock.feeEth : devLock.feeEthDay;
  const timeShare = devLock.locks > 0 ? (devLock.timeLocks / devLock.locks) * 100 : 0;
  const vestShare = 100 - timeShare;
  const timeLocksShown = allTime ? devLock.timeLocks : Math.round(devLock.timeLocks * (devLock.locks > 0 ? devLock.locksDay / devLock.locks : 0));
  const vestLocksShown = allTime ? devLock.vestLocks : Math.round(devLock.vestLocks * (devLock.locks > 0 ? devLock.locksDay / devLock.locks : 0));
  const creatorsShown = allTime ? devLock.creators : Math.min(devLock.creators, Math.max(0, lockCount));

  const volumeBars = series.volume;
  const launchBars = series.launches;
  const stakeBars = series.staking;
  const lockBars = series.devlock;
  const days = series.days;
  const dayCount = Math.max(1, days.length);
  const volumePeak = Math.max(1, ...volumeBars);
  const launchPeak = Math.max(1, ...launchBars);
  const stakePeak = Math.max(1, ...stakeBars);
  const lockPeak = Math.max(1, ...lockBars);
  const ticks = [0, Math.floor((dayCount - 1) / 2), dayCount - 1].filter((v, i, arr) => arr.indexOf(v) === i);

  return (
    <>
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
              {launchDelta >= 0 ? "+" : ""}
              {launchDelta.toFixed(1)}% from prior {allTime ? "window" : "day"}
            </em>
          </article>
          <article>
            <span>{allTime ? "Traders" : "Active traders"}</span>
            <strong>{formatCount(traderCount)}</strong>
            <em>{allTime ? `${formatCount(summary.txns)} trades` : `${season.creators} token creators`}</em>
          </article>
        </div>
        <p className="analytics-note">Totals are summed from live launches. The 24h view uses the latest completed day.</p>
      </section>

      <section className="sheet analytics-card">
        <header className="analytics-card-head">
          <h2>Creator fees</h2>
          <span>{formatEth(fees.feeUsd, ethUsd)} accrued</span>
        </header>
        <div className="analytics-bar" aria-hidden>
          <i className="creator" style={{ width: `${100 - boxShare}%` }} />
          <i className="box" style={{ width: `${boxShare}%` }} />
        </div>
        <div className="analytics-stats">
          <article>
            <span>Creator share</span>
            <strong>{formatUsd(fees.creatorUsd)}</strong>
            <em>{formatEth(fees.creatorUsd, ethUsd)} claimable</em>
            <ul>
              {fees.topCreators.map((row) => (
                <li key={row.address}>
                  <span>${row.symbol}</span>
                  <b>{formatUsd(row.creatorUsd)}</b>
                </li>
              ))}
            </ul>
          </article>
          <article>
            <span>Lucky Boxes</span>
            <strong>{formatUsd(fees.boxUsd)}</strong>
            <em>{formatEth(fees.boxUsd, ethUsd)} funded</em>
            <ul>
              {fees.topBoxes.map((row) => (
                <li key={row.address}>
                  <span>${row.symbol}</span>
                  <b>{formatUsd(row.boxUsd)}</b>
                </li>
              ))}
            </ul>
          </article>
          <article>
            <span>Curve</span>
            <strong>{onCurve}</strong>
            <em>{season.graduated} graduated</em>
            <ul>
              {fees.topCurves.map((row) => (
                <li key={row.address}>
                  <span>${row.symbol}</span>
                  <b>{row.progress}%</b>
                </li>
              ))}
            </ul>
          </article>
        </div>
        <dl className="analytics-side">
          <div>
            <dt>Season XP</dt>
            <dd>{formatCount(season.xp)}</dd>
          </div>
          <div>
            <dt>Qualifying trades</dt>
            <dd>{formatCount(season.trades)}</dd>
          </div>
          <div>
            <dt>Trades</dt>
            <dd>{formatCount(summary.txns)}</dd>
          </div>
          <div>
            <dt>Creators</dt>
            <dd>{season.creators}</dd>
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
              style={{ width: `${stakeAmountTotal > 0 ? (row.amount / stakeAmountTotal) * 100 : 0}%` }}
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
              {staking.topVaults.map((event) => (
                <li key={event.id}>
                  <span>${event.symbol}</span>
                  <b>
                    {formatTokens(event.staked)} · {event.apr ?? "—"}
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
              {[...staking.topVaults]
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
            {formatTokens(lockedTokens)} locked · {formatEth(feeLockEth, ethUsd, true)} fees
          </span>
        </header>
        <div className="analytics-bar" aria-hidden>
          <i className="dev-time" style={{ width: `${timeShare}%` }} />
          <i className="dev-vest" style={{ width: `${vestShare}%` }} />
        </div>
        <div className="analytics-stats">
          <article>
            <span>Time-based</span>
            <strong>{formatCount(timeLocksShown)}</strong>
            <em>{timeShare.toFixed(0)}% of locks</em>
          </article>
          <article>
            <span>Vesting</span>
            <strong>{formatCount(vestLocksShown)}</strong>
            <em>{vestShare.toFixed(0)}% of locks</em>
          </article>
          <article>
            <span>Fee Lock</span>
            <strong>{formatEth(feeLockEth, ethUsd, true)}</strong>
            <em>{feeLockRate} ETH flat per create</em>
          </article>
        </div>
        <div className="analytics-stats analytics-vault-top">
          <article>
            <span>Top locked tokens</span>
            <ul>
              {devLock.top.map((row) => (
                <li key={row.id ?? row.symbol}>
                  <span>${row.symbol}</span>
                  <b>
                    {formatTokens(row.amount)} · {lockModeLabel(row.mode)}
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
                <b>{formatCount(creatorsShown)}</b>
              </li>
              <li>
                <span>Fee rate</span>
                <b>{feeLockRate} ETH</b>
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
            <dd>{formatEth(feeLockEth, ethUsd, true)}</dd>
          </div>
        </dl>
      </section>

      <div className="analytics-charts">
        <ChartCard
          title="Trading volume"
          note="Daily volume across the season."
          value={formatUsd(volume)}
          bars={volumeBars}
          days={days}
          peak={volumePeak}
          ticks={ticks}
          format={formatUsd}
        />
        <ChartCard
          title="Token launches"
          note="Daily launches across the season."
          value={formatCount(launchCount)}
          bars={launchBars}
          days={days}
          peak={launchPeak}
          ticks={ticks}
          format={(amount) => (amount >= 10 ? formatCount(Math.round(amount)) : amount.toFixed(1))}
        />
        <ChartCard
          title="Staking vaults"
          note="Daily token staked across public vaults."
          value={formatTokens(stakedTotal)}
          bars={stakeBars}
          days={days}
          peak={stakePeak}
          ticks={ticks}
          format={formatTokens}
        />
        <ChartCard
          title="Dev Lock"
          note="Daily creator tokens locked via Dev Lock."
          value={formatTokens(lockedTokens)}
          bars={lockBars}
          days={days}
          peak={lockPeak}
          ticks={ticks}
          format={formatTokens}
        />
      </div>
    </>
  );
}

function ChartCard({
  title,
  note,
  value,
  bars,
  days,
  peak,
  ticks,
  format,
}: {
  title: string;
  note: string;
  value: string;
  bars: number[];
  days: string[];
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
      <div className="analytics-bars" role="img" aria-label={`${title} over the last ${days.length} days`}>
        {bars.map((valueBar, index) => (
          <button
            key={days[index] ?? index}
            type="button"
            style={{ height: `${Math.max(6, (valueBar / peak) * 100)}%` }}
            aria-label={`${days[index] ? formatDay(days[index]) : `Day ${index + 1}`} ${format(valueBar)}`}
          >
            <span className="analytics-tip">
              <b>{format(valueBar)}</b>
              <em>{days[index] ? formatDay(days[index]) : `Day ${index + 1}`}</em>
            </span>
          </button>
        ))}
      </div>
      <div className="analytics-axis">
        {ticks.map((index) => (
          <span key={index}>{days[index] ? formatDay(days[index]) : ""}</span>
        ))}
      </div>
    </section>
  );
}
