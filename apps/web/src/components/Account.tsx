"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCount, launches, leaderboard, shortAddress } from "@/lib/mock";
import { NavIcon } from "./Icons";
import { TokenLogo } from "./TokenLogo";
import { useWallet } from "./Wallet";
import { WalletAvatar } from "./WalletAvatar";

const SILVER = 1000;
const GOLD = 5000;

const tierColor: Record<string, string> = {
  Gold: "#f5c451",
  Silver: "#d5d5d5",
  Bronze: "#d08a4c",
};

export function Account() {
  const { connected, address, connect } = useWallet();
  const row = leaderboard.find((item) => item.wallet.toLowerCase() === address.toLowerCase());

  return (
    <div className="account-page">
      <div className="page-head">
        <div>
          <h1 className="explore-title">Account</h1>
          <p className="page-note">Season XP, tier, and trades for this wallet.</p>
        </div>
      </div>
      <nav className="account-more" aria-label="More">
        <Link href="/staking">
          <NavIcon name="Staking" size={18} />
          Staking
        </Link>
        <Link href="/devlock">
          <NavIcon name="Dev Lock" size={18} />
          Dev Lock
        </Link>
        <Link href="/analytics">
          <NavIcon name="Analytics" size={18} />
          Analytics
        </Link>
      </nav>
      {connected && row ? <Profile row={row} address={address} /> : <Empty onConnect={connect} />}
    </div>
  );
}

function Profile({ row, address }: { row: (typeof leaderboard)[number]; address: string }) {
  const router = useRouter();
  const next = row.xp >= GOLD ? null : row.xp >= SILVER ? GOLD : SILVER;
  const floor = row.xp >= GOLD ? GOLD : row.xp >= SILVER ? SILVER : 0;
  const span = next ? next - floor : 1;
  const progress = next ? Math.min(100, ((row.xp - floor) / span) * 100) : 100;
  const nextLabel = next ? `${row.tier === "Bronze" ? "Silver" : "Gold"} at ${formatCount(next)} XP` : "Top tier";
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
            <dt>Boxes</dt>
            <dd>5</dd>
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
      <section>
        <div className="account-table-head">
          <h2>Trades</h2>
          <p className="page-note">Buys and sells on tokens launched through LOOTING.</p>
        </div>
        <div className="table-wrap">
          <table className="coin-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Token</th>
                <th>Amount</th>
                <th>ETH</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade) => (
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
                  <td className="num">{formatTokens(trade.amount)}</td>
                  <td className="num">{trade.eth.toFixed(3)}</td>
                  <td>{trade.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="app-rows">
          {trades.map((trade) => (
            <li key={trade.id} onClick={() => router.push(`/token/${trade.launch.address}`)}>
              <span className={trade.side === "Buy" ? "side-pill buy" : "side-pill sell"}>{trade.side}</span>
              <TokenLogo symbol={trade.launch.symbol} size={28} />
              <div>
                <strong>${trade.launch.symbol}</strong>
                <span>{formatTokens(trade.amount)}</span>
              </div>
              <b>
                {trade.eth.toFixed(3)} ETH
                <span>{trade.time}</span>
              </b>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function Empty({ onConnect }: { onConnect: () => void }) {
  return (
    <section className="sheet account-empty">
      <p className="account-kicker">Season 01</p>
      <p className="account-empty-title">Connect to see your XP</p>
      <p className="page-note">Tier, boxes, and trades on LOOTING tokens show up here.</p>
      <button type="button" className="claim-btn claim-all" onClick={onConnect}>
        Connect
      </button>
    </section>
  );
}

function historyFor() {
  const minutes = [4, 12, 26, 41, 58, 96, 140, 210];
  return launches
    .filter((launch) => !launch.draft && launch.priceUsd > 0 && launch.marketCap > 0)
    .slice(0, 8)
    .map((launch, index) => {
      const supply = launch.marketCap / launch.priceUsd;
      const amount = supply * (0.004 + (index % 3) * 0.0018);
      const minute = minutes[index] ?? 30;
      return {
        id: `${launch.address}-${index}`,
        launch,
        side: index % 2 === 0 ? "Buy" : "Sell",
        amount,
        eth: (amount * launch.priceUsd) / 3500,
        time: minute < 60 ? `${minute}m` : `${Math.floor(minute / 60)}h`,
      };
    });
}

function formatTokens(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toFixed(0);
}
