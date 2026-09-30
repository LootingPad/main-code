"use client";

import { useState } from "react";
import { getLeaderboard } from "@/lib/api";
import { formatCount, shortAddress } from "@/lib/format";
import type { LeaderboardRow } from "@/lib/types";
import { useAsyncData } from "@/lib/use-async-data";
import { PageFlash, PageInfo, PageTitle } from "./PageInfo";
import { Pager } from "./Pager";
import { useWallet } from "./Wallet";
import { WalletAvatar } from "./WalletAvatar";

const PAGE_SIZE = 20;

const podium = {
  1: { label: "Gold", tone: "gold" },
  2: { label: "Silver", tone: "silver" },
  3: { label: "Bronze", tone: "bronze" },
} as const;

const emptyBoard = {
  seasonId: null as string | null,
  data: [] as LeaderboardRow[],
  you: null as LeaderboardRow | null,
  limit: 100,
  offset: 0,
};

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

function openedCount(row: LeaderboardRow) {
  return row.boxesOpened ?? row.trades ?? 0;
}

function wonCount(row: LeaderboardRow) {
  return row.rewardsWon ?? 0;
}

export function Leaderboard() {
  const { connected, address } = useWallet();
  const [page, setPage] = useState(1);
  const { data: board, error, loading } = useAsyncData(
    () => getLeaderboard({ limit: 100, wallet: connected ? address : undefined }),
    [connected, address],
    { initial: emptyBoard },
  );
  const ranked = board.data;
  const you = board.you;
  const pages = Math.max(1, Math.ceil(ranked.length / PAGE_SIZE));
  const mineIndex = you
    ? ranked.findIndex((row) => row.wallet.toLowerCase() === you.wallet.toLowerCase())
    : -1;
  const mineRank = mineIndex >= 0 ? mineIndex + 1 : null;
  const minePage = mineRank != null ? Math.ceil(mineRank / PAGE_SIZE) : null;
  const start = (page - 1) * PAGE_SIZE;
  const visible = ranked.slice(start, start + PAGE_SIZE);
  const statusNote = loading
    ? "Loading leaderboard…"
    : error
      ? error
      : ranked.length === 0
        ? "No Lucky Box rewards yet. Rankings appear when wallets open boxes and win."
        : null;

  return (
    <div>
      <div className="page-head">
        <PageTitle tip="Lucky Box rewards won. Ranked by opens that hit a prize.">Leaderboard</PageTitle>
        {connected && you ? null : (
          <PageInfo
            tip={
              connected
                ? "Open a Lucky Box and win a reward to appear here."
                : "Connect a wallet to see its rank."
            }
            label="Your rank"
          />
        )}
      </div>
      {connected && you ? (
        <button
          type="button"
          className="sheet lb-you-card"
          onClick={() => {
            if (minePage != null) setPage(minePage);
          }}
        >
          <span className="lb-you-label">Your wallet</span>
          <span className="lb-you-main">
            <span className="lb-you-rank">
              {mineRank != null && mineRank <= 3 ? (
                <Trophy place={mineRank as 1 | 2 | 3} />
              ) : mineRank != null ? (
                `#${mineRank}`
              ) : (
                "—"
              )}
            </span>
            <WalletAvatar address={you.wallet} />
            <span className="lb-you-id">
              <strong>{shortAddress(you.wallet)}</strong>
              <span>{you.rewards}</span>
            </span>
          </span>
          <span className="lb-you-stats">
            <strong>{formatCount(wonCount(you))} won</strong>
            <span>
              {formatCount(openedCount(you))} opened
              {you.ethWon && you.ethWon !== "—" ? ` · ${you.ethWon}` : ""}
            </span>
          </span>
        </button>
      ) : null}
      {statusNote ? <PageFlash note={statusNote} /> : null}
      {!loading && !error && ranked.length > 0 ? (
        <>
          <div className="table-wrap">
            <table className="coin-table lb-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Wallet</th>
                  <th>Rewards won</th>
                  <th>Boxes opened</th>
                  <th>ETH won</th>
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
                      className={
                        [medal ? `lb-row lb-row-${medal.tone}` : "", yours ? "lb-you" : ""]
                          .filter(Boolean)
                          .join(" ") || undefined
                      }
                    >
                      <td>{medal ? <Trophy place={place} /> : rank}</td>
                      <td className="text-left font-semibold">
                        <span className="lb-wallet">
                          <WalletAvatar address={row.wallet} />
                          {shortAddress(row.wallet)}
                          {yours ? <em className="lb-you-tag">You</em> : null}
                        </span>
                      </td>
                      <td className="up">{formatCount(wonCount(row))}</td>
                      <td>{formatCount(openedCount(row))}</td>
                      <td>{row.ethWon && row.ethWon !== "—" ? row.ethWon : "—"}</td>
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
                <li
                  key={row.wallet}
                  className={
                    [medal ? `is-${medal.tone}` : "", yours ? "is-you" : ""].filter(Boolean).join(" ") ||
                    undefined
                  }
                >
                  <span className="app-rank">{medal ? <Trophy place={place} /> : rank}</span>
                  <WalletAvatar address={row.wallet} />
                  <div>
                    <strong>
                      {shortAddress(row.wallet)}
                      {yours ? <em className="lb-you-tag">You</em> : null}
                    </strong>
                    <span>
                      {formatCount(openedCount(row))} opened
                      {row.ethWon && row.ethWon !== "—" ? ` · ${row.ethWon}` : ""}
                    </span>
                  </div>
                  <b>
                    {formatCount(wonCount(row))} won
                    <span>rewards</span>
                  </b>
                </li>
              );
            })}
          </ul>
          {pages > 1 ? <Pager page={page} pages={pages} onChange={setPage} /> : null}
        </>
      ) : null}
    </div>
  );
}
