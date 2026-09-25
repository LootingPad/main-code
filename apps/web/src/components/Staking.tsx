"use client";

import { useEffect, useRef, useState } from "react";
import { LOOTING_PRICE_USD } from "@/lib/fees";
import { formatUsd } from "@/lib/mock";
import { useWallet } from "./Wallet";

const LOCKS = [
  { id: "flex", label: "Flexible", rate: 8.4 },
  { id: "30", label: "30 days", rate: 14.2 },
  { id: "90", label: "90 days", rate: 22.0 },
] as const;

type LockId = (typeof LOCKS)[number]["id"];

const startBalance = 1_840_000;
const startStaked = 620_000;
const startClaimable = 18_420;

const history = [
  { when: "6h ago", amount: 420, note: "Flexible rewards" },
  { when: "1d ago", amount: 1_180, note: "30 day rewards" },
  { when: "3d ago", amount: 980, note: "30 day rewards" },
  { when: "7d ago", amount: 2_140, note: "Claimed to wallet" },
];

const YEAR_SECONDS = 365 * 24 * 60 * 60;
const EARN_PACE = 360;

function formatLoot(value: number) {
  return `${Math.round(value).toLocaleString("en-US")} LOOTING`;
}

function formatLive(value: number) {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function lootUsd(value: number) {
  return formatUsd(value * LOOTING_PRICE_USD);
}

function earnPerSecond(stakedAmount: number, rate: number) {
  return ((stakedAmount * (rate / 100)) / YEAR_SECONDS) * EARN_PACE;
}

export function Staking() {
  const { connected, connect } = useWallet();
  const [side, setSide] = useState<"stake" | "unstake">("stake");
  const [lock, setLock] = useState<LockId>("30");
  const [amount, setAmount] = useState("50000");
  const [balance, setBalance] = useState(startBalance);
  const [staked, setStaked] = useState(startStaked);
  const [banked, setBanked] = useState(startClaimable);
  const [elapsed, setElapsed] = useState(0);
  const [notice, setNotice] = useState("");
  const bankedRef = useRef(startClaimable);
  const anchorRef = useRef(0);
  const perSecRef = useRef(0);

  const lockRate = LOCKS.find((item) => item.id === lock)?.rate ?? LOCKS[0].rate;
  const perSec = earnPerSecond(staked, lockRate);
  const claimable = banked + elapsed * perSec;
  const perMinute = perSec * 60;
  const parsed = Number(amount.replace(/,/g, ""));
  const value = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  const cap = side === "stake" ? balance : staked;
  const ready = connected && value > 0 && value <= cap;

  useEffect(() => {
    const now = performance.now();
    if (anchorRef.current) {
      bankedRef.current += ((now - anchorRef.current) / 1000) * perSecRef.current;
      setBanked(bankedRef.current);
    }
    anchorRef.current = now;
    perSecRef.current = perSec;
    setElapsed(0);
  }, [perSec]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsed((performance.now() - anchorRef.current) / 1000);
    }, 80);
    return () => window.clearInterval(timer);
  }, []);

  const fill = (share: number) => {
    const next = Math.floor(cap * share);
    setAmount(String(next));
    setNotice("");
  };

  const submit = () => {
    if (!connected) {
      connect();
      return;
    }
    if (!ready) {
      setNotice(value > cap ? "Amount is above the available balance." : "Enter an amount above 0.");
      return;
    }
    if (side === "stake") {
      setBalance((current) => current - value);
      setStaked((current) => current + value);
      setNotice(`Staked ${formatLoot(value)} on the ${LOCKS.find((item) => item.id === lock)?.label.toLowerCase()} lock.`);
    } else {
      setStaked((current) => current - value);
      setBalance((current) => current + value);
      setNotice(`Unstaked ${formatLoot(value)} back to the wallet.`);
    }
    setAmount("");
  };

  const claim = () => {
    if (!connected) {
      connect();
      return;
    }
    const payout = bankedRef.current + ((performance.now() - anchorRef.current) / 1000) * perSecRef.current;
    if (payout <= 0) return;
    setBalance((current) => current + payout);
    setNotice(`Claimed ${formatLoot(payout)}.`);
    bankedRef.current = 0;
    anchorRef.current = performance.now();
    setBanked(0);
    setElapsed(0);
  };

  return (
    <div className="staking-page">
      <div className="page-head">
        <div>
          <h1 className="explore-title">Staking</h1>
          <p className="page-note">Lock LOOTING and claim rewards from this wallet.</p>
        </div>
      </div>

      <div className="staking-layout">
        <section className="sheet staking-form">
          <div className="staking-side" role="tablist" aria-label="Stake or unstake">
            <button type="button" className={side === "stake" ? "on" : ""} onClick={() => setSide("stake")}>
              Stake
            </button>
            <button type="button" className={side === "unstake" ? "on" : ""} onClick={() => setSide("unstake")}>
              Unstake
            </button>
          </div>

          <div className="staking-balance">
            <span>{side === "stake" ? "Wallet" : "Staked"}</span>
            <b>{formatLoot(cap)}</b>
          </div>

          <label className="staking-amount">
            <span>Amount</span>
            <input
              value={amount}
              inputMode="decimal"
              placeholder="0"
              aria-label="LOOTING amount"
              onChange={(event) => {
                setAmount(event.target.value.replace(/[^\d.]/g, ""));
                setNotice("");
              }}
            />
            <em>LOOTING</em>
          </label>

          <div className="staking-chips">
            {[0.25, 0.5, 0.75, 1].map((share) => (
              <button key={share} type="button" onClick={() => fill(share)}>
                {share === 1 ? "Max" : `${share * 100}%`}
              </button>
            ))}
          </div>

          {side === "stake" ? (
            <div className="staking-locks" role="tablist" aria-label="Lock length">
              {LOCKS.map((item) => (
                <button key={item.id} type="button" className={lock === item.id ? "on" : ""} onClick={() => setLock(item.id)}>
                  <span>{item.label}</span>
                  <b>{item.rate.toFixed(1)}%</b>
                </button>
              ))}
            </div>
          ) : null}

          <dl className="staking-preview">
            <div>
              <dt>{side === "stake" ? "You lock" : "You receive"}</dt>
              <dd>{value > 0 ? formatLoot(value) : "—"}</dd>
            </div>
            <div>
              <dt>Value</dt>
              <dd>{value > 0 ? lootUsd(value) : "—"}</dd>
            </div>
            <div>
              <dt>{side === "stake" ? "Daily earn" : "Reward rate"}</dt>
              <dd key={side === "stake" ? `${lock}-${Math.floor(value)}` : "unstake"} className={side === "stake" && value > 0 ? "earn-roll" : ""}>
                {side === "stake" && value > 0 ? `+${formatLive((value * lockRate) / 100 / 365)} / day` : "—"}
              </dd>
            </div>
          </dl>

          {notice ? <p className="staking-notice">{notice}</p> : null}

          <button type="button" className="staking-submit" onClick={submit}>
            {connected ? (side === "stake" ? "Stake LOOTING" : "Unstake LOOTING") : "Connect"}
          </button>
        </section>

        <div className="staking-side-col">
          <section className="staking-stats">
            <article className="sheet">
              <span>Staked</span>
              <strong>{formatLoot(staked)}</strong>
              <em>{lootUsd(staked)}</em>
            </article>
            <article className={`sheet staking-earn${perSec > 0 ? " is-live" : ""}`}>
              <header className="earn-head">
                <span className="earn-live">
                  {perSec > 0 ? <span className="earn-dot" /> : null}
                  Claimable
                </span>
                <em>{perSec > 0 ? `+${formatLive(perMinute)} / min` : lootUsd(claimable)}</em>
              </header>
              <strong>{formatLive(claimable)} LOOTING</strong>
              <button type="button" className="claim-btn" disabled={claimable <= 0} onClick={claim}>
                {claimable > 0 ? "Claim" : "Claimed"}
              </button>
            </article>
            <article className="sheet">
              <span>Wallet</span>
              <strong>{formatLoot(balance)}</strong>
              <em>{lootUsd(balance)}</em>
            </article>
          </section>

          <section className="sheet staking-history">
            <header>
              <h2>Rewards</h2>
              <span>This wallet</span>
            </header>
            <ul>
              {history.map((row) => (
                <li key={`${row.when}-${row.amount}`}>
                  <div>
                    <b>{row.note}</b>
                    <span>{row.when}</span>
                  </div>
                  <em className={row.note.startsWith("Claimed") ? "" : "up"}>+{formatLoot(row.amount)}</em>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
