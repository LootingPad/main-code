"use client";

import Link from "next/link";
import { useState } from "react";
import { formatCount, formatUsd, shortAddress } from "@/lib/format";
import {
  LOOTING_TOKEN,
  lootingBurnHistory,
  lootingCumulativeSeries,
  lootingDailyBurnSeries,
  lootingRevenueAllocSeries,
  lootingWalletSeries,
} from "@/lib/looting-token";
import {
  LootingCumulativeChart,
  LootingDailyBurnChart,
  LootingRevenueAllocChart,
  LootingWalletsChart,
} from "./LootingBurnChart";
import { Pager } from "./Pager";
import { TokenLogo } from "./TokenLogo";

const BURNS_PER_PAGE = 10;

function formatTokens(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toLocaleString("en-US");
}

function formatPrice(value: number) {
  if (value >= 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(6)}`;
}

function CopyIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.5 5.5V4.2A1.7 1.7 0 0 0 8.8 2.5H4.2A1.7 1.7 0 0 0 2.5 4.2v4.6A1.7 1.7 0 0 0 4.2 10.5H5.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function LootingToken() {
  const [page, setPage] = useState(1);
  const [monthlyRevenue, setMonthlyRevenue] = useState(1_550_000);
  const [assumedMcap, setAssumedMcap] = useState<number>(LOOTING_TOKEN.marketCap);
  const [copied, setCopied] = useState(false);

  const pages = Math.max(1, Math.ceil(lootingBurnHistory.length / BURNS_PER_PAGE));
  const safePage = Math.min(page, pages);
  const pagedBurns = lootingBurnHistory.slice(
    (safePage - 1) * BURNS_PER_PAGE,
    safePage * BURNS_PER_PAGE,
  );

  const annualRevenue = monthlyRevenue * 12;
  const buybackUsd = annualRevenue * (LOOTING_TOKEN.burnAllocationPct / 100);
  const revenueMultiple = assumedMcap > 0 ? assumedMcap / annualRevenue : 0;
  const buybackYield = assumedMcap > 0 ? (buybackUsd / assumedMcap) * 100 : 0;
  const impliedPrice = LOOTING_TOKEN.circulating > 0 ? assumedMcap / LOOTING_TOKEN.circulating : 0;
  const latestDaily = lootingDailyBurnSeries[lootingDailyBurnSeries.length - 1];
  const latestWallet = lootingWalletSeries[lootingWalletSeries.length - 1];
  const latestCumulative = lootingCumulativeSeries[lootingCumulativeSeries.length - 1];

  async function copyCa() {
    try {
      await navigator.clipboard.writeText(LOOTING_TOKEN.address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="looting-token-page">
      <section className="sheet looting-token-hero">
        <div className="looting-token-hero-copy">
          <div className="looting-token-hero-meta">
            <span className="looting-token-kicker">$LOOTING</span>
          </div>
          <h1>{LOOTING_TOKEN.tagline}</h1>
          <p>{LOOTING_TOKEN.blurb}</p>
          <div className="looting-token-hero-actions">
            <Link href={`/token/${LOOTING_TOKEN.address}`} className="claim-btn claim-all">
              Buy $LOOTING
            </Link>
            <Link href="/" className="looting-hero-secondary">
              Explore launches
            </Link>
            <Link href="/docs" className="looting-hero-secondary">
              About LOOTING
            </Link>
            <button
              type="button"
              className={`looting-ca-badge ${copied ? "is-copied" : ""}`}
              onClick={copyCa}
              title={LOOTING_TOKEN.address}
              aria-label={`Copy contract address ${LOOTING_TOKEN.address}`}
            >
              <em>CA</em>
              <code>{shortAddress(LOOTING_TOKEN.address)}</code>
              <CopyIcon />
              <span className="looting-ca-toast">{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>
        </div>
        <div className="looting-token-hero-mark">
          <TokenLogo symbol="LOOTING" size={88} />
          <strong>${LOOTING_TOKEN.symbol}</strong>
          <em>Robinhood Chain</em>
        </div>
      </section>

      <section className="looting-token-spotlight">
        <article className="sheet looting-stat-card">
          <span>Annualized protocol revenue</span>
          <strong>{formatUsd(LOOTING_TOKEN.annualizedRevenue)}</strong>
          <em>≈ {formatUsd(LOOTING_TOKEN.revenuePerDay)} / day · tracked fee flow</em>
        </article>
        <article className="sheet looting-stat-card">
          <span>Protocol burn share settled</span>
          <strong>{formatUsd(LOOTING_TOKEN.burnedUsd)}</strong>
          <em>
            {formatTokens(LOOTING_TOKEN.burned)} $LOOTING · {LOOTING_TOKEN.burnShareOfSupply.toFixed(2)}% supply
            offset
          </em>
        </article>
      </section>

      <section className="looting-token-metrics">
        <article className="sheet looting-stat-card">
          <span>Cumulative burns</span>
          <strong>{formatUsd(LOOTING_TOKEN.burnedUsd)}</strong>
          <em>USD deployed to burn accounting</em>
        </article>
        <article className="sheet looting-stat-card">
          <span>$LOOTING FDV</span>
          <strong>{formatUsd(LOOTING_TOKEN.fdv)}</strong>
          <em>Fully diluted valuation</em>
        </article>
        <article className="sheet looting-stat-card">
          <span>Daily burn share</span>
          <strong>{formatUsd(LOOTING_TOKEN.dailyBurnUsd)}</strong>
          <em>Latest day · protocol burn path</em>
        </article>
        <article className="sheet looting-stat-card">
          <span>Revenue to burn</span>
          <strong>{LOOTING_TOKEN.burnAllocationPct}%</strong>
          <em>Protocol burn share of accrued tax</em>
        </article>
      </section>

      <section className="looting-chart-grid">
        <article className="sheet looting-chart-card">
          <header>
            <div>
              <h2>Daily burn &amp; buyback</h2>
              <p>USD settled per day through protocol burn share.</p>
            </div>
            <div className="looting-chart-kpi accent">
              <strong>{formatUsd(latestDaily?.value ?? LOOTING_TOKEN.dailyBurnUsd)}</strong>
              <span>latest</span>
            </div>
          </header>
          <LootingDailyBurnChart data={lootingDailyBurnSeries} />
        </article>

        <article className="sheet looting-chart-card">
          <header>
            <div>
              <h2>Revenue allocated to burn</h2>
              <p>% of daily protocol revenue routed to burn.</p>
            </div>
            <em className="looting-target-badge">{LOOTING_TOKEN.burnAllocationPct}% target</em>
          </header>
          <LootingRevenueAllocChart
            data={lootingRevenueAllocSeries}
            targetPct={LOOTING_TOKEN.burnAllocationPct}
          />
        </article>

        <article className="sheet looting-chart-card looting-chart-wide">
          <header>
            <div>
              <h2>Active wallets</h2>
              <p>Daily active wallets on Robinhood Chain, with and without LOOTING activity.</p>
            </div>
            <div className="looting-token-legend looting-wallet-legend">
              <span className="on-burn">
                Robinhood Chain {formatCount(latestWallet?.chain ?? LOOTING_TOKEN.activeWallets)}
              </span>
              <span className="on-fee">
                with LOOTING {formatCount(latestWallet?.looting ?? LOOTING_TOKEN.lootingWallets)}
              </span>
              <i>Data as of {LOOTING_TOKEN.asOf}</i>
            </div>
          </header>
          <LootingWalletsChart data={lootingWalletSeries} />
        </article>

        <article className="sheet looting-chart-card looting-chart-wide">
          <header>
            <div>
              <h2>Cumulative burn &amp; fees</h2>
              <p>Total USD routed through fees and burn share over time.</p>
            </div>
            <div className="looting-token-chart-stats">
              <div>
                <span>Burn / buyback</span>
                <strong>{formatUsd(latestCumulative?.burnUsd ?? LOOTING_TOKEN.burnedUsd)}</strong>
              </div>
              <div>
                <span>Fees</span>
                <strong>{formatUsd(latestCumulative?.feeUsd ?? LOOTING_TOKEN.feesUsd)}</strong>
              </div>
            </div>
          </header>
          <div className="looting-token-legend" aria-hidden>
            <span className="on-burn">Burn / buyback</span>
            <span className="on-fee">Protocol fees</span>
          </div>
          <LootingCumulativeChart data={lootingCumulativeSeries} />
        </article>
      </section>

      <section className="sheet looting-token-calc">
        <header>
          <div>
            <h2>Run the numbers</h2>
            <p>Illustrative earnings vs circulating valuation. Not a forecast.</p>
          </div>
          <em>Hypothetical</em>
        </header>
        <div className="looting-token-calc-grid">
          <label>
            <span>Monthly protocol revenue</span>
            <input
              type="number"
              min={0}
              step={50_000}
              value={monthlyRevenue}
              onChange={(event) => setMonthlyRevenue(Math.max(0, Number(event.target.value) || 0))}
            />
          </label>
          <label>
            <span>Assumed circulating market cap</span>
            <input
              type="number"
              min={0}
              step={1_000_000}
              value={assumedMcap}
              onChange={(event) => setAssumedMcap(Math.max(0, Number(event.target.value) || 0))}
            />
          </label>
          <div>
            <span>Allocated to burn</span>
            <strong>{LOOTING_TOKEN.burnAllocationPct}%</strong>
          </div>
        </div>
        <dl className="looting-token-calc-out">
          <div>
            <dt>Revenue multiple</dt>
            <dd>{revenueMultiple.toFixed(1)}x</dd>
            <em>mcap ÷ annual revenue</em>
          </div>
          <div>
            <dt>Annual revenue</dt>
            <dd>{formatUsd(annualRevenue)}</dd>
          </div>
          <div>
            <dt>Implied $LOOTING price</dt>
            <dd>{formatPrice(impliedPrice)}</dd>
          </div>
          <div>
            <dt>Burn yield on mcap</dt>
            <dd>{buybackYield.toFixed(1)}%</dd>
          </div>
        </dl>
      </section>

      <section className="sheet looting-token-history">
        <header>
          <div>
            <h2>Every burn, on-chain</h2>
            <p>Daily protocol burn share settlements (mock seed for UI).</p>
          </div>
        </header>
        <div className="table-wrap">
          <table className="coin-table looting-burn-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>$LOOTING burned</th>
                <th>ETH spent</th>
                <th>USD</th>
                <th>Price</th>
                <th>% of revenue</th>
              </tr>
            </thead>
            <tbody>
              {pagedBurns.map((row) => (
                <tr key={row.id}>
                  <td>{row.date}</td>
                  <td className="num">{formatTokens(row.burned)}</td>
                  <td className="num">{row.ethSpent.toFixed(2)}</td>
                  <td className="num">{formatUsd(row.usd)}</td>
                  <td className="num">{formatPrice(row.price)}</td>
                  <td className="num">{row.revenuePct.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {lootingBurnHistory.length > BURNS_PER_PAGE ? (
          <Pager page={safePage} pages={pages} onChange={setPage} />
        ) : null}
      </section>

      <section className="looting-token-market">
        <article className="sheet">
          <header>
            <h2>Live $LOOTING market</h2>
            <p>Price, chart context, and supply stats.</p>
          </header>
          <dl>
            <div>
              <dt>Price</dt>
              <dd>{formatPrice(LOOTING_TOKEN.priceUsd)}</dd>
            </div>
            <div>
              <dt>Market cap</dt>
              <dd>{formatUsd(LOOTING_TOKEN.marketCap)}</dd>
            </div>
            <div>
              <dt>Fully diluted</dt>
              <dd>{formatUsd(LOOTING_TOKEN.fdv)}</dd>
            </div>
            <div>
              <dt>24h volume</dt>
              <dd>{formatUsd(LOOTING_TOKEN.volume24h)}</dd>
            </div>
            <div>
              <dt>Holders</dt>
              <dd>{formatCount(LOOTING_TOKEN.holders)}</dd>
            </div>
            <div>
              <dt>Circulating</dt>
              <dd>{formatTokens(LOOTING_TOKEN.circulating)}</dd>
            </div>
            <div>
              <dt>Total supply</dt>
              <dd>{formatTokens(LOOTING_TOKEN.totalSupply)}</dd>
            </div>
            <div>
              <dt>Burned</dt>
              <dd>{formatTokens(LOOTING_TOKEN.burned)}</dd>
            </div>
          </dl>
        </article>
        <article className="sheet looting-token-why">
          <h2>Why $LOOTING</h2>
          <p>
            LOOTING is the Robinhood Chain launchpad where qualified trades feed Season XP, Lucky Boxes, and a
            verifiable reward economy. Protocol burn share is separate from creator-side and Lucky Box cuts —
            tracked so the token layer stays transparent.
          </p>
          <ul>
            <li>Launch + discovery on LOOTING</li>
            <li>Trade anywhere on Robinhood Chain</li>
            <li>20% protocol burn share of accrued tax</li>
            <li>Rewards can include $LOOTING, stocks, and RWAs</li>
          </ul>
          <p className="looting-token-disclaimer">
            Illustrative UI seed. $LOOTING does not represent a right to revenues. Figures are mock until live
            indexing is wired. Not financial advice.
          </p>
        </article>
      </section>
    </div>
  );
}
