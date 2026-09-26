"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  eventAprRange,
  formatStakingDate,
  formatStakingTokens,
  lockLabel,
  lockRate,
  publicStakingEvents,
  seedStakingPositions,
  STAKING_LOCK_OPTIONS,
  type StakingEvent,
  type StakingLockId,
  type StakingPosition,
} from "@/lib/staking-events";
import { shortAddress } from "@/lib/mock";
import { SlidingTabs } from "./SlidingTabs";
import { TokenLogo } from "./TokenLogo";
import { useWallet } from "./Wallet";

type Tab = "events" | "positions";

const YEAR_SECONDS = 365 * 24 * 60 * 60;
const EARN_PACE = 360;

function formatLive(value: number) {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function earnPerSecond(stakedAmount: number, rate: number) {
  return ((stakedAmount * (rate / 100)) / YEAR_SECONDS) * EARN_PACE;
}

export function Staking() {
  const { connected, connect } = useWallet();
  const [tab, setTab] = useState<Tab>("events");
  const [events] = useState(publicStakingEvents);
  const [positions, setPositions] = useState(seedStakingPositions);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [activePositionId, setActivePositionId] = useState(seedStakingPositions[0]?.id ?? null);
  const [side, setSide] = useState<"stake" | "unstake">("stake");
  const [lock, setLock] = useState<StakingLockId>("30");
  const [amount, setAmount] = useState("50000");
  const [balances, setBalances] = useState<Record<string, number>>({
    VAULT: 1_200_000,
    HARBOR: 640_000,
    THREAD: 480_000,
    LANTERN: 220_000,
    KEY: 910_000,
  });
  const [notice, setNotice] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const bankedRef = useRef(0);
  const anchorRef = useRef(0);
  const perSecRef = useRef(0);

  const activeEvent = useMemo(() => {
    if (activeEventId) return events.find((item) => item.id === activeEventId) ?? null;
    if (activePositionId) {
      const position = positions.find((item) => item.id === activePositionId);
      return position ? (events.find((item) => item.id === position.eventId) ?? null) : null;
    }
    return null;
  }, [activeEventId, activePositionId, events, positions]);

  const activePosition = positions.find((item) => item.id === activePositionId) ?? null;
  const targetEvent =
    activeEvent ?? (activePosition ? (events.find((item) => item.id === activePosition.eventId) ?? null) : null);
  const symbol = targetEvent?.symbol ?? activePosition?.symbol ?? "VAULT";
  const availableLocks = targetEvent?.locks ?? STAKING_LOCK_OPTIONS.map((item) => item.id);
  const selectedLock = availableLocks.includes(lock) ? lock : (availableLocks[0] as StakingLockId);
  const rate = lockRate(selectedLock);
  const walletBalance = balances[symbol] ?? 0;
  const stakedAmount = activePosition?.amount ?? 0;
  const cap = side === "stake" ? walletBalance : stakedAmount;
  const parsed = Number(amount.replace(/,/g, ""));
  const value = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  const ready = connected && Boolean(targetEvent) && value > 0 && value <= cap;

  const totalStaked = positions.reduce((sum, item) => sum + item.amount, 0);
  const marketStaked = events.reduce((sum, item) => sum + item.staked, 0);
  const livePosition = activePosition;
  const perSec = livePosition ? earnPerSecond(livePosition.amount, lockRate(livePosition.lock)) : 0;
  const liveClaimable = livePosition ? livePosition.claimable + bankedRef.current + elapsed * perSec : 0;

  useEffect(() => {
    if (!availableLocks.includes(lock) && availableLocks[0]) {
      setLock(availableLocks[0] as StakingLockId);
    }
  }, [availableLocks, lock]);

  useEffect(() => {
    const now = performance.now();
    if (anchorRef.current) {
      bankedRef.current += ((now - anchorRef.current) / 1000) * perSecRef.current;
    }
    anchorRef.current = now;
    perSecRef.current = perSec;
    setElapsed(0);
  }, [perSec, activePositionId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsed((performance.now() - anchorRef.current) / 1000);
    }, 80);
    return () => window.clearInterval(timer);
  }, []);

  const openStake = (event: StakingEvent) => {
    setActiveEventId(event.id);
    const existing = positions.find((item) => item.eventId === event.id);
    setActivePositionId(existing?.id ?? null);
    setSide("stake");
    setLock((event.locks[0] as StakingLockId) ?? "30");
    setAmount("");
    setNotice("");
    setTab("positions");
  };

  const selectPosition = (position: StakingPosition) => {
    setActivePositionId(position.id);
    setActiveEventId(position.eventId);
    setLock(position.lock);
    setSide("stake");
    setAmount("");
    setNotice("");
  };

  const fill = (share: number) => {
    setAmount(String(Math.floor(cap * share)));
    setNotice("");
  };

  const submit = () => {
    if (!connected) {
      connect();
      return;
    }
    if (!targetEvent || !ready) {
      setNotice(value > cap ? "Amount is above the available balance." : "Enter an amount above 0.");
      return;
    }

    if (side === "stake") {
      setBalances((current) => ({ ...current, [symbol]: (current[symbol] ?? 0) - value }));
      const existing = positions.find((item) => item.eventId === targetEvent.id && item.lock === selectedLock);
      if (existing) {
        setPositions((current) =>
          current.map((item) => (item.id === existing.id ? { ...item, amount: item.amount + value } : item)),
        );
        setActivePositionId(existing.id);
      } else {
        const next: StakingPosition = {
          id: `${targetEvent.id}-${selectedLock}-${positions.length + 1}`,
          eventId: targetEvent.id,
          address: targetEvent.address,
          symbol: targetEvent.symbol,
          name: targetEvent.name,
          amount: value,
          lock: selectedLock,
          claimable: 0,
          started: Date.now(),
        };
        setPositions((current) => [next, ...current]);
        setActivePositionId(next.id);
      }
      setNotice(`Staked ${formatStakingTokens(value)} ${symbol} on the ${lockLabel(selectedLock).toLowerCase()} lock.`);
    } else if (activePosition) {
      setBalances((current) => ({ ...current, [symbol]: (current[symbol] ?? 0) + value }));
      setPositions((current) =>
        current.flatMap((item) => {
          if (item.id !== activePosition.id) return [item];
          const nextAmount = item.amount - value;
          if (nextAmount <= 0) return [];
          return [{ ...item, amount: nextAmount }];
        }),
      );
      setNotice(`Unstaked ${formatStakingTokens(value)} ${symbol} back to the wallet.`);
    }
    setAmount("");
  };

  const claim = () => {
    if (!connected) {
      connect();
      return;
    }
    if (!activePosition) return;
    const payout =
      activePosition.claimable + bankedRef.current + ((performance.now() - anchorRef.current) / 1000) * perSecRef.current;
    if (payout <= 0) return;
    setBalances((current) => ({ ...current, [symbol]: (current[symbol] ?? 0) + payout }));
    setPositions((current) => current.map((item) => (item.id === activePosition.id ? { ...item, claimable: 0 } : item)));
    bankedRef.current = 0;
    anchorRef.current = performance.now();
    setElapsed(0);
    setNotice(`Claimed ${formatStakingTokens(payout)} ${symbol}.`);
  };

  return (
    <div className="staking-page">
      <div className="page-head">
        <div>
          <h1 className="explore-title">Staking</h1>
          <p className="page-note">Public pools from token creators. Stake in Events, manage what you hold in Positions.</p>
        </div>
        <SlidingTabs
          items={[
            { id: "events", label: "Events" },
            { id: "positions", label: "Positions" },
          ]}
          value={tab}
          onChange={(next) => {
            setTab(next);
            setNotice("");
          }}
          ariaLabel="Staking views"
        />
      </div>

      {tab === "events" ? (
        <>
          <section className="staking-strip">
            <article className="sheet">
              <span>Open events</span>
              <strong>{events.length}</strong>
            </article>
            <article className="sheet">
              <span>Total staked</span>
              <strong>{formatStakingTokens(marketStaked)}</strong>
            </article>
            <article className="sheet">
              <span>Reward pools</span>
              <strong>{formatStakingTokens(events.reduce((sum, item) => sum + item.reward, 0))}</strong>
            </article>
          </section>

          <section className="sheet staking-events">
            <div className="staking-table-head" aria-hidden>
              <span>Pool</span>
              <span>Staked</span>
              <span>Rewards</span>
              <span>APR</span>
              <span />
            </div>
            <ul className="staking-event-list">
              {events.map((event) => (
                <li key={event.id}>
                  <div className="staking-event-row">
                    <div className="staking-event-main">
                      <TokenLogo symbol={event.symbol} size={34} />
                      <div>
                        <b>${event.symbol}</b>
                        <span>
                          {event.name} · {shortAddress(event.creator)}
                        </span>
                      </div>
                    </div>
                    <div className="staking-event-cell">
                      <strong>{formatStakingTokens(event.staked)}</strong>
                      <span>{event.stakers} stakers</span>
                    </div>
                    <div className="staking-event-cell">
                      <strong>{formatStakingTokens(event.reward)}</strong>
                      <span>ends {formatStakingDate(event.ends)}</span>
                    </div>
                    <div className="staking-event-cell">
                      <strong className="apr">{eventAprRange(event)}</strong>
                      <span>
                        {event.locks.length} lock{event.locks.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <button type="button" className="staking-event-go" onClick={() => openStake(event)}>
                      Stake
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : (
        <div className="staking-layout">
          <section className="sheet staking-form">
            {targetEvent ? (
              <>
                <div className="staking-form-token">
                  <TokenLogo symbol={targetEvent.symbol} size={32} />
                  <div>
                    <b>${targetEvent.symbol}</b>
                    <span>
                      {targetEvent.name} · ends {formatStakingDate(targetEvent.ends)}
                    </span>
                  </div>
                  <em className="staking-form-apr">{eventAprRange(targetEvent)} APR</em>
                </div>

                <div className="staking-side" role="tablist" aria-label="Stake or unstake">
                  <button type="button" className={side === "stake" ? "on" : ""} onClick={() => setSide("stake")}>
                    Stake
                  </button>
                  <button
                    type="button"
                    className={side === "unstake" ? "on" : ""}
                    onClick={() => setSide("unstake")}
                    disabled={!activePosition}
                  >
                    Unstake
                  </button>
                </div>

                <div className="staking-balance">
                  <span>{side === "stake" ? "Wallet" : "In position"}</span>
                  <b>
                    {formatStakingTokens(cap)} {symbol}
                  </b>
                </div>

                <label className="staking-amount">
                  <span>Amount</span>
                  <input
                    value={amount}
                    inputMode="decimal"
                    placeholder="0"
                    aria-label="Stake amount"
                    onChange={(event) => {
                      setAmount(event.target.value.replace(/[^\d.]/g, ""));
                      setNotice("");
                    }}
                  />
                  <em>{symbol}</em>
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
                    {STAKING_LOCK_OPTIONS.filter((item) => availableLocks.includes(item.id)).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={selectedLock === item.id ? "on" : ""}
                        onClick={() => setLock(item.id)}
                      >
                        <span>{item.label}</span>
                        <b>{item.rate}%</b>
                      </button>
                    ))}
                  </div>
                ) : null}

                <dl className="staking-preview">
                  <div>
                    <dt>{side === "stake" ? "You lock" : "You receive"}</dt>
                    <dd>{value > 0 ? `${formatStakingTokens(value)} ${symbol}` : "—"}</dd>
                  </div>
                  <div>
                    <dt>Lock</dt>
                    <dd>{side === "stake" ? lockLabel(selectedLock) : activePosition ? lockLabel(activePosition.lock) : "—"}</dd>
                  </div>
                  <div>
                    <dt>Daily earn</dt>
                    <dd>{side === "stake" && value > 0 ? `+${formatLive((value * rate) / 100 / 365)} / day` : "—"}</dd>
                  </div>
                </dl>

                {notice ? <p className="staking-notice">{notice}</p> : null}

                <button type="button" className="staking-submit" onClick={submit}>
                  {connected ? (side === "stake" ? `Stake ${symbol}` : `Unstake ${symbol}`) : "Connect"}
                </button>
              </>
            ) : (
              <div className="staking-empty">
                <p>Pick a pool from Events to start a position.</p>
                <button type="button" className="staking-submit" onClick={() => setTab("events")}>
                  Browse events
                </button>
              </div>
            )}
          </section>

          <div className="staking-side-col">
            <section className="staking-stats">
              <article className="sheet">
                <span>Your stake</span>
                <strong>{formatStakingTokens(totalStaked)}</strong>
                <em>
                  {positions.length} position{positions.length === 1 ? "" : "s"}
                </em>
              </article>
              <article className={`sheet staking-earn${perSec > 0 ? " is-live" : ""}`}>
                <header className="earn-head">
                  <span className="earn-live">
                    {perSec > 0 ? <span className="earn-dot" /> : null}
                    Claimable
                  </span>
                  <em>{livePosition ? symbol : "—"}</em>
                </header>
                <strong>
                  {livePosition ? formatLive(liveClaimable) : "0.00"}
                  {livePosition ? ` ${symbol}` : ""}
                </strong>
                <button type="button" className="claim-btn" disabled={!livePosition || liveClaimable <= 0} onClick={claim}>
                  {liveClaimable > 0 ? "Claim" : "Claimed"}
                </button>
              </article>
            </section>

            <section className="sheet staking-position-list">
              <header>
                <h2>Positions</h2>
                <span>This wallet</span>
              </header>

              {!connected ? (
                <div className="staking-empty">
                  <p>Connect to load positions.</p>
                  <button type="button" className="staking-submit" onClick={connect}>
                    Connect
                  </button>
                </div>
              ) : positions.length === 0 ? (
                <p className="staking-empty-note">No positions yet.</p>
              ) : (
                <ul>
                  {positions.map((position) => {
                    const selected = position.id === activePositionId;
                    return (
                      <li key={position.id}>
                        <button
                          type="button"
                          className={`staking-position-row${selected ? " on" : ""}`}
                          onClick={() => selectPosition(position)}
                        >
                          <TokenLogo symbol={position.symbol} size={30} />
                          <div>
                            <b>
                              ${position.symbol}
                              <em>{lockLabel(position.lock)}</em>
                            </b>
                            <span>
                              {formatStakingTokens(position.amount)} · {formatStakingTokens(position.claimable)} ready
                            </span>
                          </div>
                          <strong>{lockRate(position.lock)}%</strong>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
