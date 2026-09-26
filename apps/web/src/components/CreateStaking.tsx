"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getFees, getLaunches, getStakingEvents } from "@/lib/api";
import { CREATE_STAKING_FEE_ETH } from "@/lib/fees";
import {
  DAY,
  eventAprRange,
  formatStakingDate,
  formatStakingTokens,
  STAKING_LOCK_OPTIONS,
  type StakingEvent,
  type StakingLockId,
} from "@/lib/staking-events";
import { useAsyncData } from "@/lib/use-async-data";
import { TokenLogo } from "./TokenLogo";
import { useWallet } from "./Wallet";

const DURATIONS = [
  { id: "30", label: "30 days", days: 30 },
  { id: "90", label: "90 days", days: 90 },
  { id: "180", label: "180 days", days: 180 },
  { id: "365", label: "1 year", days: 365 },
] as const;

export function CreateStaking() {
  const { connected, address, connect } = useWallet();
  const { data: launches } = useAsyncData(() => getLaunches({ limit: 100 }), [], { initial: [] });
  const { data: apiEvents } = useAsyncData(() => getStakingEvents({ limit: 100 }), [], { initial: [] });
  const { data: fees } = useAsyncData(() => getFees(), [], {
    initial: null as Awaited<ReturnType<typeof getFees>> | null,
  });
  const createFee = fees?.CREATE_STAKING_FEE_ETH ?? CREATE_STAKING_FEE_ETH;

  const tokens = useMemo(() => launches.filter((item) => !item.draft), [launches]);
  const [symbol, setSymbol] = useState("");
  const [reward, setReward] = useState("1000000");
  const [duration, setDuration] = useState<(typeof DURATIONS)[number]["id"]>("90");
  const [locks, setLocks] = useState<StakingLockId[]>(["flex", "30", "90"]);
  const [localPools, setLocalPools] = useState<StakingEvent[]>([]);
  const [notice, setNotice] = useState("");
  const [tokenOpen, setTokenOpen] = useState(false);
  const [tokenUp, setTokenUp] = useState(false);
  const tokenRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!symbol && tokens[0]) setSymbol(tokens[0].symbol);
  }, [symbol, tokens]);

  const coin = tokens.find((item) => item.symbol === symbol) ?? tokens[0];
  const apiPools = useMemo(
    () =>
      apiEvents
        .filter((item) => item.creator.toLowerCase() === address.toLowerCase())
        .slice(0, 20),
    [apiEvents, address],
  );
  const pools = useMemo(() => [...localPools, ...apiPools], [localPools, apiPools]);

  const parsed = Number(reward.replace(/,/g, ""));
  const value = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  const durationDays = DURATIONS.find((item) => item.id === duration)?.days ?? 90;
  const endsAt = Date.now() + durationDays * DAY;
  const ready = Boolean(coin) && value > 0 && locks.length > 0;

  useEffect(() => {
    if (!tokenOpen) return;
    const close = (event: MouseEvent) => {
      if (tokenRef.current && !tokenRef.current.contains(event.target as Node)) setTokenOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTokenOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [tokenOpen]);

  const toggleTokens = () => {
    if (tokenOpen) {
      setTokenOpen(false);
      return;
    }
    const rect = tokenRef.current?.getBoundingClientRect();
    if (rect) {
      const below = window.innerHeight - rect.bottom;
      const above = rect.top;
      setTokenUp(below < 280 && above > below);
    }
    setTokenOpen(true);
  };

  const toggleLock = (id: StakingLockId) => {
    setLocks((current) => {
      if (current.includes(id)) {
        if (current.length === 1) return current;
        return current.filter((item) => item !== id);
      }
      return [...current, id];
    });
    setNotice("");
  };

  const submit = () => {
    if (!connected) {
      connect();
      return;
    }
    if (!coin || !ready) {
      setNotice(locks.length === 0 ? "Pick at least one lock option." : "Enter a reward amount above 0.");
      return;
    }
    const next: StakingEvent = {
      id: `local-${coin.symbol}-${Date.now()}`,
      address: coin.address,
      symbol: coin.symbol,
      name: coin.name,
      creator: address,
      reward: value,
      staked: 0,
      stakers: 0,
      marketCap: coin.marketCap,
      volume24h: coin.stats?.volume24h ?? 0,
      durationDays,
      locks: [...locks],
      ends: endsAt,
    };
    setLocalPools((current) => [next, ...current]);
    setReward("");
    setNotice(
      `Demo only — on-chain create not wired. Preview: ${formatStakingTokens(value)} ${coin.symbol} through ${formatStakingDate(endsAt)}.`,
    );
  };

  return (
    <div className="devlock-page">
      <div className="page-head">
        <div>
          <h1 className="explore-title">Create Staking</h1>
          <p className="page-note">Spin up a staking event for any LOOTING-launched coin. Fund rewards, pick lock options, set the window.</p>
        </div>
      </div>

      {connected && coin ? (
        <div className="devlock-layout">
          <section className="sheet devlock-form">
            <div className={`devlock-token${tokenOpen ? " is-open" : ""}${tokenUp ? " is-up" : ""}`} ref={tokenRef}>
              <button
                type="button"
                className="devlock-token-trigger"
                aria-haspopup="listbox"
                aria-expanded={tokenOpen}
                aria-label="Coin to stake"
                onClick={toggleTokens}
              >
                <TokenLogo symbol={coin.symbol} size={28} />
                <span>
                  <b>${coin.symbol}</b>
                  <em>{coin.name}</em>
                </span>
                <svg className="devlock-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M6 9.5 12 15.5 18 9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {tokenOpen ? (
                <div className="devlock-token-menu" role="listbox" aria-label="Coin to stake">
                  {tokens.map((item) => (
                    <button
                      key={item.address}
                      type="button"
                      role="option"
                      aria-selected={item.symbol === coin.symbol}
                      className={item.symbol === coin.symbol ? "on" : ""}
                      onClick={() => {
                        setSymbol(item.symbol);
                        setTokenOpen(false);
                        setNotice("");
                      }}
                    >
                      <TokenLogo symbol={item.symbol} size={28} />
                      <span>
                        <b>${item.symbol}</b>
                        <em>{item.name}</em>
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <label className="devlock-amount">
              <span>Reward pool</span>
              <input
                value={reward}
                inputMode="decimal"
                placeholder="0"
                aria-label="Reward pool amount"
                onChange={(event) => {
                  setReward(event.target.value.replace(/[^\d.]/g, ""));
                  setNotice("");
                }}
              />
              <em>{coin.symbol}</em>
            </label>

            <fieldset className="devlock-field">
              <legend>Event length</legend>
              <div className="devlock-choices">
                {DURATIONS.map((item) => (
                  <button key={item.id} type="button" className={duration === item.id ? "on" : ""} onClick={() => setDuration(item.id)}>
                    {item.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="devlock-field">
              <legend>Lock options</legend>
              <div className="devlock-choices cols-3">
                {STAKING_LOCK_OPTIONS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={locks.includes(item.id) ? "on" : ""}
                    onClick={() => toggleLock(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <dl className="devlock-preview">
              <div>
                <dt>Reward pool</dt>
                <dd>{value > 0 ? `${formatStakingTokens(value)} ${coin.symbol}` : "—"}</dd>
              </div>
              <div>
                <dt>Ends</dt>
                <dd>{formatStakingDate(endsAt)}</dd>
              </div>
              <div>
                <dt>Locks</dt>
                <dd>
                  {STAKING_LOCK_OPTIONS.filter((item) => locks.includes(item.id))
                    .map((item) => `${item.label} ${item.rate}%`)
                    .join(" · ") || "—"}
                </dd>
              </div>
              <div>
                <dt>Create fee</dt>
                <dd>{createFee} ETH</dd>
              </div>
            </dl>

            {notice ? <p className="devlock-notice">{notice}</p> : null}

            <button type="button" className="devlock-submit" onClick={submit}>
              Create staking event
            </button>
            <p className="devlock-fine">
              Creating a vault costs a flat {createFee} ETH create fee. Published events show on the public Staking page so anyone can stake into your pool.
            </p>
          </section>

          <div className="devlock-side">
            <section className="devlock-stats">
              <article className="sheet">
                <span>Your events</span>
                <strong>{pools.length}</strong>
                <em>Live staking pools</em>
              </article>
              <article className="sheet">
                <span>Rewards funded</span>
                <strong>{formatStakingTokens(pools.reduce((sum, pool) => sum + pool.reward, 0))}</strong>
                <em>Across all events</em>
              </article>
              <article className="sheet">
                <span>Next end</span>
                <strong>{pools.length ? formatStakingDate(Math.min(...pools.map((pool) => pool.ends))) : "—"}</strong>
                <em>Soonest closing pool</em>
              </article>
            </section>

            <section className="sheet create-staking-events">
              <header>
                <div>
                  <h2>Events</h2>
                  <p className="page-note">Pools you published from this wallet.</p>
                </div>
                <span className="create-staking-count">{pools.length}</span>
              </header>
              {pools.length === 0 ? (
                <p className="devlock-empty-note">No staking events yet.</p>
              ) : (
                <ul className="create-staking-pool-list">
                  {pools.map((pool) => {
                    const lockOpts = STAKING_LOCK_OPTIONS.filter((item) => pool.locks.includes(item.id));
                    return (
                      <li key={pool.id} className="create-staking-pool">
                        <div className="create-staking-pool-top">
                          <TokenLogo symbol={pool.symbol} size={36} />
                          <div className="create-staking-pool-id">
                            <strong>${pool.symbol}</strong>
                            <span>{pool.name}</span>
                          </div>
                          <em className="create-staking-duration">{pool.durationDays}d</em>
                        </div>
                        <dl className="create-staking-pool-stats">
                          <div>
                            <dt>Staked</dt>
                            <dd>{formatStakingTokens(pool.staked)}</dd>
                          </div>
                          <div>
                            <dt>Stakers</dt>
                            <dd>{pool.stakers}</dd>
                          </div>
                          <div>
                            <dt>Rewards</dt>
                            <dd>{formatStakingTokens(pool.reward)}</dd>
                          </div>
                          <div>
                            <dt>APR</dt>
                            <dd className="apr">{eventAprRange(pool)}</dd>
                          </div>
                        </dl>
                        <div className="create-staking-pool-foot">
                          <span>Ends {formatStakingDate(pool.ends)}</span>
                          <div className="create-staking-pool-locks">
                            {lockOpts.map((item) => (
                              <span key={item.id}>
                                {item.label} <b>{item.rate}%</b>
                              </span>
                            ))}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </div>
      ) : connected ? (
        <section className="sheet devlock-gate">
          <h2>No launched coins</h2>
          <p>No LOOTING launches are available yet. Launch a coin first, then create a staking event.</p>
        </section>
      ) : (
        <section className="sheet devlock-gate">
          <h2>Connect to create</h2>
          <p>Create a staking event for any LOOTING-launched coin. Fund the reward pool, choose lock options, and publish the window.</p>
          <button type="button" className="devlock-submit" onClick={connect}>
            Connect
          </button>
        </section>
      )}
    </div>
  );
}
