"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  getCreatorLaunches,
  getWallet,
  getWalletStakingHistory,
  getWalletTrades,
} from "@/lib/api";
import { formatCount, formatUsd, shortAddress } from "@/lib/format";
import { formatStakingTokens, lockLabel } from "@/lib/staking-events";
import type { LaunchWithStats, StakingHistoryRow, WalletProfile, WalletTrade } from "@/lib/types";
import { useAsyncData } from "@/lib/use-async-data";
import { NavIcon } from "./Icons";
import { Pager } from "./Pager";
import { SlidingTabs } from "./SlidingTabs";
import { TokenLogo } from "./TokenLogo";
import { useWallet } from "./Wallet";
import { WalletAvatar } from "./WalletAvatar";

const SILVER = 1000;
const GOLD = 5000;
const TRADES_PER_PAGE = 10;
const STAKING_PER_PAGE = 10;

const tierColor: Record<string, string> = {
  Gold: "#f5c451",
  Silver: "#d5d5d5",
  Bronze: "#d08a4c",
};

type AccountTab = "deployed" | "trades" | "staking";

export function Account() {
  const { connected, address, connect } = useWallet();
  const { data: profile, loading, error } = useAsyncData(() => getWallet(address), [address], {
    initial: null,
    enabled: connected,
  });
  const { data: deployed } = useAsyncData(() => getCreatorLaunches(address), [address], {
    initial: [],
    enabled: connected,
  });
  const { data: trades } = useAsyncData(() => getWalletTrades(address, { limit: 100 }), [address], {
    initial: [],
    enabled: connected,
  });
  const { data: staking } = useAsyncData(() => getWalletStakingHistory(address, { limit: 100 }), [address], {
    initial: [],
    enabled: connected,
  });

  return (
    <div className="account-page">
      <div className="page-head">
        <div>
          <h1 className="explore-title">Account</h1>
          <p className="page-note">Season XP, deployed tokens, trades, and staking for this wallet.</p>
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
      {!connected ? (
        <Empty onConnect={connect} />
      ) : loading && !profile ? (
        <section className="sheet account-empty">
          <p className="account-kicker">Season</p>
          <p className="account-empty-title">Loading account…</p>
          <p className="page-note">Fetching XP, launches, trades, and staking for this wallet.</p>
        </section>
      ) : error && !profile ? (
        <section className="sheet account-empty">
          <p className="account-kicker">Season</p>
          <p className="account-empty-title">Could not load account</p>
          <p className="page-note">{error}</p>
        </section>
      ) : profile ? (
        <Profile profile={profile} address={address} deployed={deployed} trades={trades} staking={staking} />
      ) : (
        <Empty onConnect={connect} />
      )}
    </div>
  );
}

function Profile({
  profile,
  address,
  deployed,
  trades,
  staking,
}: {
  profile: WalletProfile;
  address: string;
  deployed: LaunchWithStats[];
  trades: WalletTrade[];
  staking: StakingHistoryRow[];
}) {
  const [tab, setTab] = useState<AccountTab>("deployed");
  const next = profile.xp >= GOLD ? null : profile.xp >= SILVER ? GOLD : SILVER;
  const floor = profile.xp >= GOLD ? GOLD : profile.xp >= SILVER ? SILVER : 0;
  const span = next ? next - floor : 1;
  const progress = next ? Math.min(100, ((profile.xp - floor) / span) * 100) : 100;
  const nextLabel = next ? `${profile.tier === "Bronze" ? "Silver" : "Gold"} at ${formatCount(next)} XP` : "Top tier";
  const stakingRewards = staking.reduce((sum, item) => sum + item.reward, 0);
  const seasonLabel = profile.seasonId ?? "Season —";

  return (
    <>
      <article className="sheet account-hero">
        <div className="account-top">
          <WalletAvatar address={address} size={36} />
          <div className="account-who">
            <p className="account-wallet">{shortAddress(address)}</p>
            <p className="page-note">{seasonLabel}</p>
          </div>
          <span className="account-tier" style={{ color: tierColor[profile.tier] }}>
            {profile.tier}
          </span>
        </div>
        <div className="account-xp-row">
          <div>
            <p className="account-kicker">Season XP</p>
            <p className="account-xp">{formatCount(profile.xp)}</p>
          </div>
          <p className="page-note">{nextLabel}</p>
        </div>
        <div className="account-bar" aria-hidden>
          <span style={{ width: `${progress}%` }} />
        </div>
        <dl className="account-stats">
          <div>
            <dt>Lifetime XP</dt>
            <dd>{formatCount(profile.lifetimeXp)}</dd>
          </div>
          <div>
            <dt>Deployed</dt>
            <dd>{deployed.length}</dd>
          </div>
          <div>
            <dt>Trades</dt>
            <dd>{profile.trades}</dd>
          </div>
          <div>
            <dt>Rewards</dt>
            <dd>{profile.rewards}</dd>
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
              { id: "staking" as const, label: `Staking (${staking.length})` },
            ]}
            value={tab}
            onChange={setTab}
          />
          <p className="page-note">
            {tab === "deployed"
              ? "Coins this wallet launched on LOOTING."
              : tab === "trades"
                ? "Buys and sells on LOOTING tokens."
                : `Vault stakes, claims, and ${formatStakingTokens(stakingRewards)} rewards earned.`}
          </p>
        </div>

        <div key={tab} className="account-board page-swap">
          {tab === "deployed" ? (
            <DeployedBoard rows={deployed} />
          ) : tab === "trades" ? (
            <TradesBoard rows={trades} />
          ) : (
            <StakingBoard rows={staking} />
          )}
        </div>
      </section>
    </>
  );
}

function DeployedBoard({ rows }: { rows: LaunchWithStats[] }) {
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
            {rows.map((launch) => (
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
                <td>{launch.stats.age}</td>
              </tr>
            ))}
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

function TradesBoard({ rows }: { rows: WalletTrade[] }) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(rows.length / TRADES_PER_PAGE));
  const safePage = Math.min(page, pages);
  const paged = rows.slice((safePage - 1) * TRADES_PER_PAGE, safePage * TRADES_PER_PAGE);

  if (rows.length === 0) {
    return (
      <div className="sheet account-blank">
        <p className="account-blank-title">No trades yet</p>
        <p className="page-note">Buys and sells on LOOTING tokens will show up here with XP.</p>
        <Link href="/" className="claim-btn claim-all">
          Explore launches
        </Link>
      </div>
    );
  }

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

function StakingBoard({ rows }: { rows: StakingHistoryRow[] }) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(rows.length / STAKING_PER_PAGE));
  const safePage = Math.min(page, pages);
  const paged = rows.slice((safePage - 1) * STAKING_PER_PAGE, safePage * STAKING_PER_PAGE);

  if (rows.length === 0) {
    return (
      <div className="sheet account-blank">
        <p className="account-blank-title">No staking history yet</p>
        <p className="page-note">Stakes, claims, and rewards from public vaults will show up here.</p>
        <Link href="/staking" className="claim-btn claim-all">
          Browse staking
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="table-wrap">
        <table className="coin-table account-staking-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Token</th>
              <th>CA</th>
              <th>Lock</th>
              <th>Amount</th>
              <th>Reward</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((row) => (
              <tr
                key={row.id}
                onClick={() => router.push(`/staking?pool=${encodeURIComponent(row.eventId)}`)}
              >
                <td>
                  <span className={`side-pill ${row.kind}`}>{stakingKindLabel(row.kind)}</span>
                </td>
                <td>
                  <Link
                    href={`/staking?pool=${encodeURIComponent(row.eventId)}`}
                    className="account-token"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <TokenLogo symbol={row.symbol} size={22} />
                    <span>${row.symbol}</span>
                  </Link>
                </td>
                <td className="account-ca">{tinyCa(row.address)}</td>
                <td>{lockLabel(row.lock)}</td>
                <td className="num">
                  {row.amount > 0 ? formatStakingTokens(row.amount) : "—"}
                </td>
                <td className={`num${row.reward > 0 ? " account-xp-cell" : " text-mute"}`}>
                  {row.reward > 0 ? `+${formatStakingTokens(row.reward)}` : "—"}
                </td>
                <td>{relativeAge(row.at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > STAKING_PER_PAGE ? (
          <Pager page={safePage} pages={pages} onChange={setPage} />
        ) : null}
      </div>
      <ul className="app-rows">
        {paged.map((row) => (
          <li
            key={row.id}
            onClick={() => router.push(`/staking?pool=${encodeURIComponent(row.eventId)}`)}
          >
            <span className={`side-pill ${row.kind}`}>{stakingKindLabel(row.kind)}</span>
            <TokenLogo symbol={row.symbol} size={28} />
            <div>
              <strong>${row.symbol}</strong>
              <span>
                {lockLabel(row.lock)}
                {row.reward > 0 ? ` · +${formatStakingTokens(row.reward)} reward` : ""}
              </span>
            </div>
            <b>
              {row.kind === "claim"
                ? `+${formatStakingTokens(row.reward)}`
                : formatStakingTokens(row.amount)}
              <span>{relativeAge(row.at)}</span>
            </b>
          </li>
        ))}
      </ul>
      {rows.length > STAKING_PER_PAGE ? (
        <div className="account-mobile-pager">
          <Pager page={safePage} pages={pages} onChange={setPage} />
        </div>
      ) : null}
    </>
  );
}

function Empty({ onConnect }: { onConnect: () => void }) {
  return (
    <section className="sheet account-empty">
      <p className="account-kicker">Season 01</p>
      <p className="account-empty-title">Connect to see your account</p>
      <p className="page-note">Deployed tokens, tier, boxes, trades, and staking on LOOTING show up here.</p>
      <button type="button" className="claim-btn claim-all" onClick={onConnect}>
        Connect
      </button>
    </section>
  );
}

function formatTokens(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toFixed(0);
}

function tinyCa(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-3)}`;
}

function stakingKindLabel(kind: StakingHistoryRow["kind"]) {
  if (kind === "stake") return "Stake";
  if (kind === "claim") return "Claim";
  return "Unstake";
}

function relativeAge(at: number) {
  const minute = Math.max(1, Math.round((Date.now() - at) / 60_000));
  if (minute < 60) return `${minute}m`;
  if (minute < 1440) return `${Math.floor(minute / 60)}h`;
  return `${Math.floor(minute / 1440)}d`;
}
