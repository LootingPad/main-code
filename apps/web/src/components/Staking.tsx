"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getLaunches, getStakingEvents, getWalletStakingPositions } from "@/lib/api";
import { formatCount, formatUsd, shortAddress } from "@/lib/format";
import {
  DAY,
  eventAprRange,
  formatStakingDate,
  formatStakingTokens,
  lockLabel,
  lockRate,
  STAKING_LOCK_OPTIONS,
  type StakingEvent,
  type StakingLockId,
  type StakingPosition,
} from "@/lib/staking-events";
import { useAsyncData } from "@/lib/use-async-data";
import { Pager } from "./Pager";
import { SlidingTabs } from "./SlidingTabs";
import { TokenLogo } from "./TokenLogo";
import { useWallet } from "./Wallet";

type Tab = "events" | "positions";

const YEAR_SECONDS = 365 * 24 * 60 * 60;
const EARN_PACE = 360;
const EVENTS_PER_PAGE = 10;
const POSITIONS_PER_PAGE = 10;
const DEMO_PREFIX = "demo-";

function formatLive(value: number) {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function earnPerSecond(stakedAmount: number, rate: number) {
  return ((stakedAmount * (rate / 100)) / YEAR_SECONDS) * EARN_PACE;
}

function tokenPrice(symbol: string, event: StakingEvent | undefined, launches: { symbol: string; priceUsd: number }[]) {
  const launch = launches.find((entry) => entry.symbol === symbol);
  if (launch && launch.priceUsd > 0) return launch.priceUsd;
  if (event && event.marketCap > 0) return event.marketCap / 1_000_000_000;
  return 0;
}

export function Staking() {
  const { connected, connect, address } = useWallet();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>("events");
  const { data: events } = useAsyncData(() => getStakingEvents({ limit: 100 }), [], { initial: [] });
  const { data: apiPositions } = useAsyncData(
    () => getWalletStakingPositions(address),
    [address],
    { initial: [], enabled: connected },
  );
  const { data: launches } = useAsyncData(() => getLaunches({ limit: 100 }), [], { initial: [] });
  const [demoPositions, setDemoPositions] = useState<StakingPosition[]>([]);
  const [positionEdits, setPositionEdits] = useState<Record<string, StakingPosition>>({});
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [activePositionId, setActivePositionId] = useState<string | null>(null);
  const [side, setSide] = useState<"stake" | "unstake">("stake");
  const [lock, setLock] = useState<StakingLockId>("30");
  const [amount, setAmount] = useState("50000");
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [eventPage, setEventPage] = useState(1);
  const [positionPage, setPositionPage] = useState(1);
  const bankedRef = useRef(0);
  const anchorRef = useRef(0);
  const perSecRef = useRef(0);
  const openedPoolRef = useRef<string | null>(null);

  const positions = useMemo(() => {
    if (!connected) return [];
    const apiMerged = apiPositions
      .map((item) => positionEdits[item.id] ?? item)
      .filter((item) => item.amount > 0);
    const apiIds = new Set(apiMerged.map((item) => item.id));
    const demos = demoPositions.filter((item) => !apiIds.has(item.id) && item.amount > 0);
    return [...demos, ...apiMerged];
  }, [connected, apiPositions, demoPositions, positionEdits]);

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
  const symbol = targetEvent?.symbol ?? activePosition?.symbol ?? "TOKEN";
  const availableLocks = targetEvent?.locks ?? STAKING_LOCK_OPTIONS.map((item) => item.id);
  const selectedLock = availableLocks.includes(lock) ? lock : (availableLocks[0] as StakingLockId);
  const rate = lockRate(selectedLock);
  const walletBalance = balances[symbol] ?? 1_000_000;
  const stakedAmount = activePosition?.amount ?? 0;
  const cap = side === "stake" ? walletBalance : stakedAmount;
  const parsed = Number(amount.replace(/,/g, ""));
  const value = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  const ready = connected && Boolean(targetEvent) && value > 0 && value <= cap;

  const totalStaked = positions.reduce((sum, item) => sum + item.amount, 0);
  const totalStakedUsd = positions.reduce((sum, item) => {
    const event = events.find((entry) => entry.id === item.eventId);
    return sum + item.amount * tokenPrice(item.symbol, event, launches);
  }, 0);
  const marketStaked = events.reduce((sum, item) => sum + item.staked, 0);
  const eventPages = Math.max(1, Math.ceil(events.length / EVENTS_PER_PAGE));
  const safeEventPage = Math.min(eventPage, eventPages);
  const pagedEvents = events.slice((safeEventPage - 1) * EVENTS_PER_PAGE, safeEventPage * EVENTS_PER_PAGE);
  const positionPages = Math.max(1, Math.ceil(positions.length / POSITIONS_PER_PAGE));
  const safePositionPage = Math.min(positionPage, positionPages);
  const pagedPositions = positions.slice(
    (safePositionPage - 1) * POSITIONS_PER_PAGE,
    safePositionPage * POSITIONS_PER_PAGE,
  );
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

  useEffect(() => {
    const pool = searchParams.get("pool");
    if (!pool || openedPoolRef.current === pool) return;
    const event = events.find((item) => item.id === pool || item.address.toLowerCase() === pool.toLowerCase());
    if (!event) return;
    openedPoolRef.current = pool;
    openStake(event);
  }, [events, searchParams]);

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

  const patchPosition = (id: string, next: StakingPosition | null) => {
    if (id.startsWith(DEMO_PREFIX)) {
      setDemoPositions((current) => {
        if (!next) return current.filter((item) => item.id !== id);
        return current.map((item) => (item.id === id ? next : item));
      });
      return;
    }
    setPositionEdits((current) => {
      if (!next) {
        const copy = { ...current };
        delete copy[id];
        return copy;
      }
      return { ...current, [id]: next };
    });
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
      setBalances((current) => ({
        ...current,
        [symbol]: (current[symbol] ?? walletBalance) - value,
      }));
      const existing = positions.find((item) => item.eventId === targetEvent.id && item.lock === selectedLock);
      if (existing) {
        const next = { ...existing, amount: existing.amount + value };
        if (existing.id.startsWith(DEMO_PREFIX)) {
          setDemoPositions((current) => current.map((item) => (item.id === existing.id ? next : item)));
        } else {
          setPositionEdits((current) => ({ ...current, [existing.id]: next }));
        }
        setActivePositionId(existing.id);
      } else {
        const next: StakingPosition = {
          id: `${DEMO_PREFIX}${targetEvent.id}-${selectedLock}-${Date.now()}`,
          eventId: targetEvent.id,
          address: targetEvent.address,
          symbol: targetEvent.symbol,
          name: targetEvent.name,
          amount: value,
          lock: selectedLock,
          claimable: 0,
          started: Date.now(),
        };
        setDemoPositions((current) => [next, ...current]);
        setActivePositionId(next.id);
      }
      setNotice("Demo only — on-chain stake not wired");
    } else if (activePosition) {
      setBalances((current) => ({
        ...current,
        [symbol]: (current[symbol] ?? walletBalance) + value,
      }));
      const nextAmount = activePosition.amount - value;
      if (nextAmount <= 0) {
        if (activePosition.id.startsWith(DEMO_PREFIX)) {
          setDemoPositions((current) => current.filter((item) => item.id !== activePosition.id));
        } else {
          setPositionEdits((current) => ({
            ...current,
            [activePosition.id]: { ...activePosition, amount: 0, claimable: 0 },
          }));
        }
        setActivePositionId(null);
      } else {
        patchPosition(activePosition.id, { ...activePosition, amount: nextAmount });
      }
      setNotice("Demo only — on-chain stake not wired");
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
    setBalances((current) => ({
      ...current,
      [symbol]: (current[symbol] ?? walletBalance) + payout,
    }));
    patchPosition(activePosition.id, { ...activePosition, claimable: 0 });
    bankedRef.current = 0;
    anchorRef.current = performance.now();
    setElapsed(0);
    setNotice("Demo only — on-chain stake not wired");
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
              <span>MCAP</span>
              <span>Vol 24h</span>
              <span>Staked</span>
              <span>Rewards</span>
              <span>APR</span>
              <span />
            </div>
            <ul className="staking-event-list">
              {pagedEvents.map((event) => (
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
                      <strong>{formatUsd(event.marketCap)}</strong>
                      <span>Market cap</span>
                    </div>
                    <div className="staking-event-cell">
                      <strong>{formatUsd(event.volume24h)}</strong>
                      <span>24h volume</span>
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
            {events.length > EVENTS_PER_PAGE ? (
              <Pager page={safeEventPage} pages={eventPages} onChange={setEventPage} />
            ) : null}
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

                <dl className="staking-vault-stats">
                  <div>
                    <dt>Total staked</dt>
                    <dd>
                      {formatStakingTokens(targetEvent.staked)} <i>{targetEvent.symbol}</i>
                    </dd>
                  </div>
                  <div>
                    <dt>Stakers</dt>
                    <dd>{formatCount(targetEvent.stakers)}</dd>
                  </div>
                  <div>
                    <dt>Reward pool</dt>
                    <dd>{formatStakingTokens(targetEvent.reward)}</dd>
                  </div>
                  <div>
                    <dt>Days left</dt>
                    <dd>{Math.max(0, Math.ceil((targetEvent.ends - Date.now()) / DAY))}d</dd>
                  </div>
                  <div>
                    <dt>Avg stake</dt>
                    <dd>
                      {targetEvent.stakers > 0
                        ? formatStakingTokens(targetEvent.staked / targetEvent.stakers)
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>Your share</dt>
                    <dd>
                      {(() => {
                        const yours = positions
                          .filter((item) => item.eventId === targetEvent.id)
                          .reduce((sum, item) => sum + item.amount, 0);
                        if (targetEvent.staked <= 0 || yours <= 0) return "—";
                        return `${((yours / targetEvent.staked) * 100).toFixed(2)}%`;
                      })()}
                    </dd>
                  </div>
                </dl>

                <dl className="staking-vault-facts">
                  <div>
                    <dt>Duration</dt>
                    <dd>{targetEvent.durationDays}d</dd>
                  </div>
                  <div>
                    <dt>Market cap</dt>
                    <dd>{formatUsd(targetEvent.marketCap)}</dd>
                  </div>
                  <div>
                    <dt>Vol 24h</dt>
                    <dd>{formatUsd(targetEvent.volume24h)}</dd>
                  </div>
                  <div>
                    <dt>Pool CA</dt>
                    <dd className="ca">{tinyCa(targetEvent.address)}</dd>
                  </div>
                </dl>

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

                <div className="staking-form-spacer" aria-hidden />

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
              <div className="staking-stake-pair">
                <article className="sheet">
                  <span>Your stake</span>
                  <strong>{formatStakingTokens(totalStaked)}</strong>
                  <em>
                    {positions.length} position{positions.length === 1 ? "" : "s"}
                  </em>
                </article>
                <article className="sheet">
                  <span>Value Staked</span>
                  <strong className="staking-stake-usd">{formatUsd(totalStakedUsd)}</strong>
                  <em>Total USD</em>
                </article>
              </div>
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
                <span>{connected ? `${positions.length} open` : "This wallet"}</span>
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
                <div className="staking-pos-board">
                  <div className="staking-pos-head" aria-hidden>
                    <span>Token</span>
                    <span>CA</span>
                    <span>Lock</span>
                    <span>Staked</span>
                    <span>Ready</span>
                    <span>APR</span>
                  </div>
                  <ul className="staking-pos-list">
                    {pagedPositions.map((position) => {
                      const selected = position.id === activePositionId;
                      return (
                        <li key={position.id}>
                          <button
                            type="button"
                            className={`staking-pos-row${selected ? " on" : ""}`}
                            onClick={() => selectPosition(position)}
                          >
                            <span className="staking-pos-token">
                              <TokenLogo symbol={position.symbol} size={26} />
                              <b>${position.symbol}</b>
                            </span>
                            <span className="staking-pos-ca">{tinyCa(position.address)}</span>
                            <span className="staking-pos-chip">{lockLabel(position.lock)}</span>
                            <span className="num">{formatStakingTokens(position.amount)}</span>
                            <span className="num">{formatStakingTokens(position.claimable)}</span>
                            <span className="num staking-pos-apr">{lockRate(position.lock)}%</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {positions.length > POSITIONS_PER_PAGE ? (
                    <Pager page={safePositionPage} pages={positionPages} onChange={setPositionPage} />
                  ) : null}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

function tinyCa(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-3)}`;
}
