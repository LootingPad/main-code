"use client";

import { useState } from "react";
import { formatCount, leaderboard, shortAddress } from "@/lib/mock";
import { useWallet } from "./Wallet";
import { WalletAvatar } from "./WalletAvatar";

const PAGE_SIZE = 20;

const tierColor: Record<string, string> = {
  Gold: "#f5c451",
  Silver: "#d5d5d5",
  Bronze: "#d08a4c",
};

const podium = {
  1: { label: "Gold", tone: "gold" },
  2: { label: "Silver", tone: "silver" },
  3: { label: "Bronze", tone: "bronze" },
} as const;

function Trophy({ place }: { place: 1 | 2 | 3 }) {
  return (
    <span className={`lb-trophy lb-trophy-${podium[place].tone}`}>
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
        <path
          fill="currentColor"
          d="M7 3h10v2h3v3.2a5 5 0 0 1-4.1 4.9 5 5 0 0 1-2.9 3.6V19h3v2H8v-2h3v-2.3a5 5 0 0 1-2.9-3.6A5 5 0 0 1 4 8.2V5h3V3Zm0 4H6v1.2a3 3 0 0 0 2.4 2.9A5 5 0 0 1 7 8.2V7Zm10 0v1.2a5 5 0 0 1-1.4 2.9A3 3 0 0 0 18 8.2V7h-1Z"
        />
      </svg>
      {place}
    </span>
  );
}

const ranked = [
  ...leaderboard,
  ...Array.from({ length: 34 }, (_, index) => {
    const n = index + 1;
    const xp = Math.max(20, 140 - index * 3);
    const tier = xp > 90 ? "Silver" : "Bronze";
    const wallet = `0x${(BigInt(n) * 0x9e3779b97f4a7c15n).toString(16).padStart(40, "0").slice(-40)}`;
    return {
      wallet,
      tier,
      xp,
      trades: Math.max(1, 12 - Math.floor(index / 4)),
      rewards: "$0",
    };
  }),
];

export function Leaderboard() {
  const { connected, address } = useWallet();
  const [page, setPage] = useState(1);
  const pages = Math.ceil(ranked.length / PAGE_SIZE);
  const mineIndex = ranked.findIndex((row) => row.wallet.toLowerCase() === address.toLowerCase());
  const mine = mineIndex >= 0 ? ranked[mineIndex] : null;
  const mineRank = mineIndex + 1;
  const minePage = Math.ceil(mineRank / PAGE_SIZE);
  const start = (page - 1) * PAGE_SIZE;
  const visible = ranked.slice(start, start + PAGE_SIZE);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="explore-title">Leaderboard</h1>
          <p className="page-note">Season XP. Wallets, not accounts.</p>
        </div>
        {connected && mine ? null : <p className="page-note lb-you-empty">Connect a wallet to see its rank.</p>}
      </div>
      {connected && mine ? (
        <button type="button" className="sheet lb-you-card" onClick={() => setPage(minePage)}>
          <span className="lb-you-label">Your wallet</span>
          <span className="lb-you-main">
            <span className="lb-you-rank">{mineRank <= 3 ? <Trophy place={mineRank as 1 | 2 | 3} /> : `#${mineRank}`}</span>
            <WalletAvatar address={mine.wallet} />
            <span className="lb-you-id">
              <strong>{shortAddress(mine.wallet)}</strong>
              <span style={{ color: tierColor[mine.tier] }}>{mine.tier}</span>
            </span>
          </span>
          <span className="lb-you-stats">
            <strong>{formatCount(mine.xp)} XP</strong>
            <span>
              {mine.trades} trades · {mine.rewards}
            </span>
          </span>
        </button>
      ) : null}
      <div className="table-wrap">
        <table className="coin-table lb-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Wallet</th>
              <th>Tier</th>
              <th>Season XP</th>
              <th>Trades</th>
              <th>Rewards</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row, index) => {
              const rank = start + index + 1;
              const place = rank as 1 | 2 | 3;
              const medal = rank <= 3 ? podium[place] : null;
              const yours = connected && row.wallet.toLowerCase() === address.toLowerCase();
              return (
                <tr
                  key={row.wallet}
                  className={[medal ? `lb-row lb-row-${medal.tone}` : "", yours ? "lb-you" : ""].filter(Boolean).join(" ") || undefined}
                >
                  <td>{medal ? <Trophy place={place} /> : rank}</td>
                  <td className="text-left font-semibold">
                    <span className="lb-wallet">
                      <WalletAvatar address={row.wallet} />
                      {shortAddress(row.wallet)}
                      {yours ? <em className="lb-you-tag">You</em> : null}
                    </span>
                  </td>
                  <td style={{ color: tierColor[row.tier] }}>{row.tier}</td>
                  <td className="up">{formatCount(row.xp)}</td>
                  <td>{row.trades}</td>
                  <td>{row.rewards}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="app-rows">
        {visible.map((row, index) => {
          const rank = start + index + 1;
          const place = rank as 1 | 2 | 3;
          const medal = rank <= 3 ? podium[place] : null;
          const yours = connected && row.wallet.toLowerCase() === address.toLowerCase();
          return (
            <li key={row.wallet} className={[medal ? `is-${medal.tone}` : "", yours ? "is-you" : ""].filter(Boolean).join(" ") || undefined}>
              <span className="app-rank">{medal ? <Trophy place={place} /> : rank}</span>
              <WalletAvatar address={row.wallet} />
              <div>
                <strong>
                  {shortAddress(row.wallet)}
                  {yours ? <em className="lb-you-tag">You</em> : null}
                </strong>
                <span style={{ color: tierColor[row.tier] }}>{row.tier}</span>
              </div>
              <b>
                {formatCount(row.xp)} XP
                <span>{row.trades} trades</span>
              </b>
            </li>
          );
        })}
      </ul>
      {pages > 1 ? (
        <div className="data-pager">
          <button type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>
            Prev
          </button>
          {Array.from({ length: pages }, (_, index) => (
            <button
              key={index}
              type="button"
              className={page === index + 1 ? "on" : ""}
              onClick={() => setPage(index + 1)}
            >
              {index + 1}
            </button>
          ))}
          <button type="button" disabled={page === pages} onClick={() => setPage(page + 1)}>
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
