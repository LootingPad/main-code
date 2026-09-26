"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatCount, formatUsd, launches, leaderboard, marketStats, shortAddress, type Launch } from "@/lib/mock";
import { NavIcon } from "./Icons";
import { Pager } from "./Pager";
import { SlidingTabs } from "./SlidingTabs";
import { TokenLogo } from "./TokenLogo";
import { useWallet } from "./Wallet";
import { WalletAvatar } from "./WalletAvatar";

const SILVER = 1000;
const GOLD = 5000;
const TRADES_PER_PAGE = 10;

const tierColor: Record<string, string> = {
  Gold: "#f5c451",
  Silver: "#d5d5d5",
  Bronze: "#d08a4c",
};

type AccountTab = "deployed" | "trades";

export function Account() {
  const { connected, address, connect } = useWallet();
  const row = leaderboard.find((item) => item.wallet.toLowerCase() === address.toLowerCase());

  return (
    <div className="account-page">
      <div className="page-head">
        <div>
          <h1 className="explore-title">Account</h1>
          <p className="page-note">Season XP, deployed tokens, and trades for this wallet.</p>
        </div>
      </div>
      <nav className="account-more" aria-label="More">
        <Link href="/staking">
          <NavIcon name="Staking" size={18} />
          Staking
        </Link>
        <Link href="/analytics">
          <NavIcon name="Analytics" size={18} />
          Analytics
        </Link>
        <Link href="/devlock">
          <NavIcon name="Dev Lock" size={18} />
          Dev Lock
        </Link>
        <Link href="/create-staking">
          <NavIcon name="Create Staking" size={18} />
          Create Staking
        </Link>
      </nav>
      {connected && row ? <Profile row={row} address={address} /> : <Empty onConnect={connect} />}
    </div>
  );
}

function Profile({ row, address }: { row: (typeof leaderboard)[number]; address: string }) {
  const [tab, setTab] = useState<AccountTab>("deployed");
  const next = row.xp >= GOLD ? null : row.xp >= SILVER ? GOLD : SILVER;
  const floor = row.xp >= GOLD ? GOLD : row.xp >= SILVER ? SILVER : 0;
  const span = next ? next - floor : 1;
  const progress = next ? Math.min(100, ((row.xp - floor) / span) * 100) : 100;
  const nextLabel = next ? `${row.tier === "Bronze" ? "Silver" : "Gold"} at ${formatCount(next)} XP` : "Top tier";
  const deployed = deployedFor(address);
  const trades = historyFor();

  return (
    <>
      <article className="sheet account-hero">
        <div className="account-top">
          <WalletAvatar address={address} size={36} />
          <div className="account-who">
            <p className="account-wallet">{shortAddress(address)}</p>
            <p className="page-note">Season 01</p>
          </div>
          <span className="account-tier" style={{ color: tierColor[row.tier] }}>
            {row.tier}
          </span>
        </div>
        <div className="account-xp-row">
          <div>
            <p className="account-kicker">Season XP</p>
            <p className="account-xp">{formatCount(row.xp)}</p>
          </div>
          <p className="page-note">{nextLabel}</p>
        </div>
        <div className="account-bar" aria-hidden>
          <span style={{ width: `${progress}%` }} />
        </div>
        <dl className="account-stats">
          <div>
            <dt>Lifetime XP</dt>
            <dd>{formatCount(18420)}</dd>
          </div>
          <div>
            <dt>Deployed</dt>
            <dd>{deployed.length}</dd>
          </div>
          <div>
            <dt>Trades</dt>
            <dd>{row.trades}</dd>
          </div>
          <div>
            <dt>Rewards</dt>
            <dd>{row.rewards}</dd>
          </div>
        </dl>
      </article>

      <section className="account-section">
        <div className="account-board-head">
          <SlidingTabs
            ariaLabel="Account activity"
            tone="quiet"
            items={[
              { id: "deployed" as const, label: `Deployed (${deployed.length})` },
              { id: "trades" as const, label: `Trades (${trades.length})` },
            ]}
            value={tab}
            onChange={setTab}
          />
          <p className="page-note">
            {tab === "deployed" ? "Coins this wallet launched on LOOTING." : "Buys and sells on LOOTING tokens."}
          </p>
        </div>

        <div key={tab} className="account-board page-swap">
          {tab === "deployed" ? <DeployedBoard rows={deployed} /> : <TradesBoard rows={trades} />}
        </div>
      </section>
    </>
  );
}

function DeployedBoard({ rows }: { rows: Launch[] }) {
  const router = useRouter();

  if (rows.length === 0) {
    return (
      <div className="sheet account-blank">
        <p className="account-blank-title">No launches yet</p>
        <p className="page-note">Tokens you deploy will show up here with curve progress and fee settings.</p>
        <Link href="/create" className="claim-btn claim-all">
          Launch a coin
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="table-wrap">
        <table className="coin-table account-deploy-table">
          <thead>
            <tr>
              <th>Token</th>
              <th>Phase</th>
              <th>Mcap</th>
              <th>Curve</th>
              <th>Tax</th>
              <th>Boxes</th>
              <th>1h</th>
              <th>Age</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((launch) => {
              const stats = marketStats(launch);
              return (
                <tr key={launch.address} onClick={() => router.push(`/token/${launch.address}`)}>
                  <td>
                    <Link
                      href={`/token/${launch.address}`}
                      className="account-token"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <TokenLogo symbol={launch.symbol} size={22} />
                      <span className="account-token-meta">
                        <strong>{launch.name}</strong>
                        <em>${launch.symbol}</em>
                      </span>
                    </Link>
                  </td>
                  <td>
                    <span className={`phase-pill ${launch.phase === "graduated" ? "grad" : "curve"}`}>
                      {launch.phase === "graduated" ? "Graduated" : "Curve"}
                    </span>
                  </td>
                  <td className="num">{formatUsd(launch.marketCap)}</td>
                  <td>
                    <div className="account-curve" aria-label={`${launch.progress}%`}>
                      <i>
                        <span style={{ width: `${Math.min(100, launch.progress)}%` }} />
                      </i>
                      <em className="num">{launch.progress}%</em>
                    </div>
                  </td>
                  <td className="num">{launch.creatorTax.toFixed(1)}%</td>
                  <td className="num">{launch.luckyShare}%</td>
                  <td className={launch.change1h >= 0 ? "up" : "down"}>
                    {launch.change1h >= 0 ? "↑" : "↓"} {Math.abs(launch.change1h).toFixed(1)}%
                  </td>
                  <td>{stats.age}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="app-rows">
        {rows.map((launch) => (
          <li key={launch.address} onClick={() => router.push(`/token/${launch.address}`)}>
            <TokenLogo symbol={launch.symbol} size={28} />
            <div>
              <strong>{launch.name}</strong>
              <span>
                ${launch.symbol} · {launch.phase === "graduated" ? "Graduated" : `${launch.progress}% curve`}
              </span>
            </div>
            <b className={launch.change1h >= 0 ? "up" : "down"}>
              {formatUsd(launch.marketCap)}
              <span>
                {launch.change1h >= 0 ? "↑" : "↓"} {Math.abs(launch.change1h).toFixed(1)}%
              </span>
            </b>
          </li>
        ))}
      </ul>
    </>
  );
}

function TradesBoard({ rows }: { rows: TradeRow[] }) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(rows.length / TRADES_PER_PAGE));
  const safePage = Math.min(page, pages);
  const paged = rows.slice((safePage - 1) * TRADES_PER_PAGE, safePage * TRADES_PER_PAGE);

  return (
    <>
      <div className="table-wrap">
        <table className="coin-table account-trades-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Token</th>
              <th>CA</th>
              <th>Amount</th>
              <th>ETH</th>
              <th>XP</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((trade) => (
              <tr key={trade.id} onClick={() => router.push(`/token/${trade.launch.address}`)}>
                <td>
                  <span className={trade.side === "Buy" ? "side-pill buy" : "side-pill sell"}>{trade.side}</span>
                </td>
                <td>
                  <Link
                    href={`/token/${trade.launch.address}`}
                    className="account-token"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <TokenLogo symbol={trade.launch.symbol} size={22} />
                    <span>${trade.launch.symbol}</span>
                  </Link>
                </td>
                <td className="account-ca">{tinyCa(trade.launch.address)}</td>
                <td className="num">{formatTokens(trade.amount)}</td>
                <td className="num">{trade.eth.toFixed(3)}</td>
                <td className={`num${trade.xp > 0 ? " account-xp-cell" : " text-mute"}`}>
                  {trade.xp > 0 ? `+${trade.xp}` : "—"}
                </td>
                <td>{trade.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > TRADES_PER_PAGE ? (
          <Pager page={safePage} pages={pages} onChange={setPage} />
        ) : null}
      </div>
      <ul className="app-rows">
        {paged.map((trade) => (
          <li key={trade.id} onClick={() => router.push(`/token/${trade.launch.address}`)}>
            <span className={trade.side === "Buy" ? "side-pill buy" : "side-pill sell"}>{trade.side}</span>
            <TokenLogo symbol={trade.launch.symbol} size={28} />
            <div>
              <strong>${trade.launch.symbol}</strong>
              <span>
                {tinyCa(trade.launch.address)} · {trade.xp > 0 ? `+${trade.xp} XP` : "No XP"}
              </span>
            </div>
            <b>
              {trade.eth.toFixed(3)} ETH
              <span>{trade.time}</span>
            </b>
          </li>
        ))}
      </ul>
      {rows.length > TRADES_PER_PAGE ? (
        <div className="account-mobile-pager">
          <Pager page={safePage} pages={pages} onChange={setPage} />
        </div>
      ) : null}
    </>
  );
}

type TradeRow = {
  id: string;
  launch: Launch;
  side: "Buy" | "Sell";
  amount: number;
  eth: number;
  xp: number;
  time: string;
};

function Empty({ onConnect }: { onConnect: () => void }) {
  return (
    <section className="sheet account-empty">
      <p className="account-kicker">Season 01</p>
      <p className="account-empty-title">Connect to see your account</p>
      <p className="page-note">Deployed tokens, tier, boxes, and trades on LOOTING show up here.</p>
      <button type="button" className="claim-btn claim-all" onClick={onConnect}>
        Connect
      </button>
    </section>
  );
}

function deployedFor(address: string): Launch[] {
  return launches
    .filter((launch) => !launch.draft && launch.creator.toLowerCase() === address.toLowerCase())
    .sort((a, b) => b.marketCap - a.marketCap);
}

function xpForTrade(side: "Buy" | "Sell", usd: number) {
  if (side !== "Buy" || usd < 5) return 0;
  if (usd < 25) return 10;
  if (usd < 100) return 15;
  if (usd < 250) return 25;
  if (usd < 500) return 40;
  if (usd < 1000) return 60;
  return 100;
}

function historyFor(): TradeRow[] {
  const pool = launches.filter((launch) => !launch.draft && launch.priceUsd > 0 && launch.marketCap > 0);
  const total = 28;
  return Array.from({ length: total }, (_, index) => {
    const launch = pool[index % pool.length];
    const supply = launch.marketCap / launch.priceUsd;
    const amount = supply * (0.0032 + (index % 5) * 0.0014);
    const eth = (amount * launch.priceUsd) / 3500;
    const usd = eth * 3500;
    const side: "Buy" | "Sell" = index % 3 === 2 ? "Sell" : "Buy";
    const minute = 3 + index * 17;
    return {
      id: `${launch.address}-${index}`,
      launch,
      side,
      amount,
      eth,
      xp: xpForTrade(side, usd),
      time: minute < 60 ? `${minute}m` : minute < 1440 ? `${Math.floor(minute / 60)}h` : `${Math.floor(minute / 1440)}d`,
    };
  });
}

function formatTokens(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toFixed(0);
}

function tinyCa(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-3)}`;
}
