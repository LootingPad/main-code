"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { launches } from "@/lib/mock";
import { SlidingTabs } from "./SlidingTabs";
import { TokenLogo } from "./TokenLogo";
import { useWallet } from "./Wallet";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-09-26T00:00:00Z");

const TIME_PRESETS = [
  { id: "30", label: "30 days", days: 30 },
  { id: "90", label: "90 days", days: 90 },
  { id: "180", label: "180 days", days: 180 },
  { id: "365", label: "1 year", days: 365 },
  { id: "custom", label: "Custom", days: 0 },
] as const;

const CLIFFS = [
  { id: "0", label: "No cliff", days: 0 },
  { id: "30", label: "30 days", days: 30 },
  { id: "90", label: "90 days", days: 90 },
] as const;

const LENGTHS = [
  { id: "180", label: "6 months", days: 180 },
  { id: "365", label: "1 year", days: 365 },
  { id: "730", label: "2 years", days: 730 },
] as const;

const CADENCES = [
  { id: "day", label: "Daily", unit: "day", days: 1 },
  { id: "week", label: "Weekly", unit: "week", days: 7 },
  { id: "month", label: "Monthly", unit: "month", days: 30 },
] as const;

type Mode = "time" | "vest";
type Cadence = (typeof CADENCES)[number]["id"];

type Lock = {
  id: string;
  address: string;
  symbol: string;
  name: string;
  mode: Mode;
  amount: number;
  claimed: number;
  start: number;
  cliff: number;
  unlock: number;
  cadence: Cadence;
};

const startBalances: Record<string, number> = {
  VAULT: 8_200_000,
  THREAD: 4_600_000,
};

const seedLocks: Lock[] = [
  {
    id: "vault-time",
    address: "0x7a31c8e14b0d9f6a2c55e81d4b90aa1100c0ff21",
    symbol: "VAULT",
    name: "Night Vault",
    mode: "time",
    amount: 2_500_000,
    claimed: 0,
    start: NOW - 12 * DAY,
    cliff: NOW - 12 * DAY,
    unlock: NOW + 78 * DAY,
    cadence: "day",
  },
  {
    id: "thread-vest",
    address: "0x12ab90ff33c1d8e774aa0199bb221100de44a901",
    symbol: "THREAD",
    name: "Gold Thread",
    mode: "vest",
    amount: 6_000_000,
    claimed: 0,
    start: NOW - 60 * DAY,
    cliff: NOW - 30 * DAY,
    unlock: NOW + 335 * DAY,
    cadence: "month",
  },
  {
    id: "vault-ready",
    address: "0x7a31c8e14b0d9f6a2c55e81d4b90aa1100c0ff21",
    symbol: "VAULT",
    name: "Night Vault",
    mode: "time",
    amount: 500_000,
    claimed: 0,
    start: NOW - 34 * DAY,
    cliff: NOW - 34 * DAY,
    unlock: NOW - 4 * DAY,
    cadence: "day",
  },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDate(ms: number) {
  const date = new Date(ms);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

function isoDate(ms: number) {
  const date = new Date(ms);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return NaN;
  return Date.UTC(year, month - 1, day);
}

function formatTokens(value: number) {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) {
    const scaled = abs / 1_000_000;
    return `${sign}${scaled >= 10 ? scaled.toFixed(1) : scaled.toFixed(2)}M`;
  }
  if (abs >= 10_000) return `${sign}${Math.round(abs / 1000)}K`;
  return `${sign}${Math.round(abs).toLocaleString("en-US")}`;
}

function formatFull(value: number) {
  return Math.round(value).toLocaleString("en-US");
}

function daysBetween(from: number, to: number) {
  return Math.max(0, Math.round((to - from) / DAY));
}

function vestedAmount(lock: Lock, now = NOW) {
  if (now >= lock.unlock) return lock.amount;
  if (lock.mode === "time" || now <= lock.cliff) return 0;
  const span = lock.unlock - lock.cliff;
  if (span <= 0) return lock.amount;
  return lock.amount * ((now - lock.cliff) / span);
}

function claimableAmount(lock: Lock) {
  return Math.max(0, vestedAmount(lock) - lock.claimed);
}

export function DevLock() {
  const { connected, address, connect } = useWallet();
  const [mode, setMode] = useState<Mode>("time");
  const [symbol, setSymbol] = useState("VAULT");
  const [amount, setAmount] = useState("1000000");
  const [preset, setPreset] = useState<(typeof TIME_PRESETS)[number]["id"]>("90");
  const [customDate, setCustomDate] = useState(isoDate(NOW + 90 * DAY));
  const [cliff, setCliff] = useState<(typeof CLIFFS)[number]["id"]>("30");
  const [length, setLength] = useState<(typeof LENGTHS)[number]["id"]>("365");
  const [cadence, setCadence] = useState<Cadence>("month");
  const [balances, setBalances] = useState(startBalances);
  const [locks, setLocks] = useState(seedLocks);
  const [notice, setNotice] = useState("");
  const [tokenOpen, setTokenOpen] = useState(false);
  const [tokenUp, setTokenUp] = useState(false);
  const tokenRef = useRef<HTMLDivElement>(null);

  const coins = useMemo(
    () => launches.filter((launch) => launch.creator.toLowerCase() === address.toLowerCase() && !launch.draft),
    [address],
  );
  const coin = coins.find((item) => item.symbol === symbol) ?? coins[0];
  const balance = coin ? (balances[coin.symbol] ?? 0) : 0;
  const parsed = Number(amount.replace(/,/g, ""));
  const value = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;

  const cliffDays = CLIFFS.find((item) => item.id === cliff)?.days ?? 0;
  const lengthDays = LENGTHS.find((item) => item.id === length)?.days ?? 365;
  const cadenceDays = CADENCES.find((item) => item.id === cadence)?.days ?? 30;
  const presetDays = TIME_PRESETS.find((item) => item.id === preset)?.days ?? 90;
  const customMs = parseDate(customDate);
  const unlockAt = mode === "time" ? (preset === "custom" ? customMs : NOW + presetDays * DAY) : NOW + (cliffDays + lengthDays) * DAY;
  const cliffAt = mode === "vest" ? NOW + cliffDays * DAY : NOW;
  const periods = Math.max(1, Math.round(lengthDays / cadenceDays));
  const perSlice = value > 0 ? value / periods : 0;
  const dateOk = Number.isFinite(unlockAt) && unlockAt > NOW;
  const ready = Boolean(coin) && value > 0 && value <= balance && dateOk;

  const lockedNow = locks.reduce((sum, lock) => sum + (lock.amount - vestedAmount(lock)), 0);
  const released = locks.reduce((sum, lock) => sum + vestedAmount(lock), 0);
  const waiting = locks.reduce((sum, lock) => sum + claimableAmount(lock), 0);

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

  const chooseToken = (next: string) => {
    setSymbol(next);
    setNotice("");
    setTokenOpen(false);
  };

  const fill = (share: number) => {
    setAmount(String(Math.floor(balance * share)));
    setNotice("");
  };

  const submit = () => {
    if (!connected) {
      connect();
      return;
    }
    if (!coin || !ready) {
      if (!dateOk) setNotice("Pick an unlock date in the future.");
      else if (value > balance) setNotice("Amount is above the wallet balance.");
      else setNotice("Enter an amount above 0.");
      return;
    }
    const next: Lock = {
      id: `${coin.symbol}-${locks.length + 1}`,
      address: coin.address,
      symbol: coin.symbol,
      name: coin.name,
      mode,
      amount: value,
      claimed: 0,
      start: NOW,
      cliff: cliffAt,
      unlock: unlockAt,
      cadence,
    };
    setLocks((current) => [next, ...current]);
    setBalances((current) => ({ ...current, [coin.symbol]: (current[coin.symbol] ?? 0) - value }));
    setAmount("");
    setNotice(
      mode === "time"
        ? `Locked ${formatTokens(value)} ${coin.symbol} until ${formatDate(unlockAt)}.`
        : `Vesting ${formatTokens(value)} ${coin.symbol} through ${formatDate(unlockAt)}.`,
    );
  };

  const release = (lock: Lock) => {
    const payout = claimableAmount(lock);
    if (payout <= 0) return;
    setBalances((current) => ({ ...current, [lock.symbol]: (current[lock.symbol] ?? 0) + payout }));
    setLocks((current) =>
      current.flatMap((item) => {
        if (item.id !== lock.id) return [item];
        const claimed = item.claimed + payout;
        if (claimed >= item.amount - 1) return [];
        return [{ ...item, claimed }];
      }),
    );
    setNotice(`Released ${formatTokens(payout)} ${lock.symbol} back to the wallet.`);
  };

  const schedule = scheduleParts(mode, cliffDays, lengthDays);

  return (
    <div className="devlock-page">
      <div className="page-head">
        <div>
          <h1 className="explore-title">Dev Lock</h1>
          <p className="page-note">Lock tokens from coins you launched. Time-based unlocks once. Vesting releases on a schedule.</p>
        </div>
        <SlidingTabs
          items={[
            { id: "time", label: "Time-based" },
            { id: "vest", label: "Vesting" },
          ]}
          value={mode}
          onChange={(next) => {
            setMode(next);
            setNotice("");
          }}
          ariaLabel="Lock type"
        />
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
                aria-label="Coin to lock"
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
                <div className="devlock-token-menu" role="listbox" aria-label="Coin to lock">
                  {coins.map((item) => (
                    <button
                      key={item.address}
                      type="button"
                      role="option"
                      aria-selected={item.symbol === coin.symbol}
                      className={item.symbol === coin.symbol ? "on" : ""}
                      onClick={() => chooseToken(item.symbol)}
                    >
                      <TokenLogo symbol={item.symbol} size={28} />
                      <span>
                        <b>${item.symbol}</b>
                        <em>{item.name}</em>
                      </span>
                      <strong>{formatTokens(balances[item.symbol] ?? 0)}</strong>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="devlock-balance">
              <span>Wallet</span>
              <b>
                {formatTokens(balance)} {coin.symbol}
              </b>
            </div>

            <label className="devlock-amount">
              <span>Amount</span>
              <input
                value={amount}
                inputMode="decimal"
                placeholder="0"
                aria-label="Token amount"
                onChange={(event) => {
                  setAmount(event.target.value.replace(/[^\d.]/g, ""));
                  setNotice("");
                }}
              />
              <em>{coin.symbol}</em>
            </label>

            <div className="devlock-chips">
              {[0.25, 0.5, 0.75, 1].map((share) => (
                <button key={share} type="button" onClick={() => fill(share)}>
                  {share === 1 ? "Max" : `${share * 100}%`}
                </button>
              ))}
            </div>

            {mode === "time" ? (
              <fieldset className="devlock-field">
                <legend>Unlock</legend>
                <div className="devlock-choices">
                  {TIME_PRESETS.map((item) => (
                    <button key={item.id} type="button" className={preset === item.id ? "on" : ""} onClick={() => setPreset(item.id)}>
                      {item.label}
                    </button>
                  ))}
                </div>
                {preset === "custom" ? (
                  <input
                    className="devlock-date"
                    type="date"
                    value={customDate}
                    min={isoDate(NOW + DAY)}
                    aria-label="Unlock date"
                    onChange={(event) => setCustomDate(event.target.value)}
                  />
                ) : null}
              </fieldset>
            ) : (
              <>
                <fieldset className="devlock-field">
                  <legend>Cliff</legend>
                  <div className="devlock-choices cols-3">
                    {CLIFFS.map((item) => (
                      <button key={item.id} type="button" className={cliff === item.id ? "on" : ""} onClick={() => setCliff(item.id)}>
                        {item.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="devlock-field">
                  <legend>Length</legend>
                  <div className="devlock-choices cols-3">
                    {LENGTHS.map((item) => (
                      <button key={item.id} type="button" className={length === item.id ? "on" : ""} onClick={() => setLength(item.id)}>
                        {item.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="devlock-field">
                  <legend>Release</legend>
                  <div className="devlock-choices cols-3">
                    {CADENCES.map((item) => (
                      <button key={item.id} type="button" className={cadence === item.id ? "on" : ""} onClick={() => setCadence(item.id)}>
                        {item.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
              </>
            )}

            <div className="devlock-schedule" aria-hidden>
              <i className="devlock-bar">
                {schedule.map((part) => (
                  <span key={part.id} className={part.id} style={{ width: `${part.share * 100}%` }} />
                ))}
              </i>
              <div>
                <span>Today</span>
                {mode === "vest" && cliffDays > 0 ? <span>Cliff {formatDate(cliffAt)}</span> : null}
                <span>{formatDate(unlockAt)}</span>
              </div>
            </div>

            <dl className="devlock-preview">
              <div>
                <dt>You lock</dt>
                <dd>{value > 0 ? `${formatFull(value)} ${coin.symbol}` : "—"}</dd>
              </div>
              <div>
                <dt>{mode === "time" ? "Unlocks" : "Fully vested"}</dt>
                <dd>{dateOk ? formatDate(unlockAt) : "—"}</dd>
              </div>
              <div>
                <dt>{mode === "time" ? "Release" : "Each slice"}</dt>
                <dd>
                  {mode === "time"
                    ? "All at once"
                    : value > 0
                      ? `${formatTokens(perSlice)} / ${CADENCES.find((item) => item.id === cadence)?.unit}`
                      : "—"}
                </dd>
              </div>
            </dl>

            {notice ? <p className="devlock-notice">{notice}</p> : null}

            <button type="button" className="devlock-submit" onClick={submit}>
              {mode === "time" ? "Lock until date" : "Start vesting"}
            </button>
            <p className="devlock-fine">A lock cannot be cancelled early. Tokens return to this wallet only as they unlock.</p>
          </section>

          <div className="devlock-side">
            <section className="devlock-stats">
              <article className="sheet">
                <span>Still locked</span>
                <strong>{formatTokens(lockedNow)}</strong>
                <em>Across {locks.length} {locks.length === 1 ? "position" : "positions"}</em>
              </article>
              <article className="sheet">
                <span>Released</span>
                <strong>{formatTokens(released)}</strong>
                <em>{waiting > 0 ? `${formatTokens(waiting)} ready` : "Nothing waiting"}</em>
              </article>
              <article className="sheet">
                <span>Wallet</span>
                <strong>{formatTokens(Object.values(balances).reduce((sum, item) => sum + item, 0))}</strong>
                <em>Unlocked balance</em>
              </article>
            </section>

            <section className="sheet devlock-list">
              <header>
                <h2>Locks</h2>
                <span>This wallet</span>
              </header>
              {locks.length === 0 ? <p className="devlock-empty-note">No locks yet.</p> : null}
              <ul>
                {locks.map((lock) => {
                  const vested = vestedAmount(lock);
                  const claimable = claimableAmount(lock);
                  const left = lock.amount - vested;
                  const progress = lock.amount > 0 ? (vested / lock.amount) * 100 : 0;
                  return (
                    <li key={lock.id}>
                      <div className="devlock-row">
                        <TokenLogo symbol={lock.symbol} size={32} />
                        <div>
                          <b>
                            ${lock.symbol}
                            <em>{lock.mode === "time" ? "Time-based" : "Vesting"}</em>
                          </b>
                          <span>
                            {lock.mode === "time"
                              ? left > 0
                                ? `Unlocks ${formatDate(lock.unlock)} · ${daysBetween(NOW, lock.unlock)} days`
                                : `Unlocked ${formatDate(lock.unlock)}`
                              : vested <= 1
                                ? lock.cliff > lock.start
                                  ? `Cliff until ${formatDate(lock.cliff)}`
                                  : `Releases through ${formatDate(lock.unlock)}`
                                : `${formatTokens(vested)} released · ends ${formatDate(lock.unlock)}`}
                          </span>
                        </div>
                        <strong>{formatTokens(lock.amount - lock.claimed)}</strong>
                      </div>
                      <i className="devlock-bar slim" aria-hidden>
                        <span className="release" style={{ width: `${progress}%` }} />
                      </i>
                      {claimable > 1 ? (
                        <button type="button" className="devlock-release" onClick={() => release(lock)}>
                          Release {formatTokens(claimable)}
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        </div>
      ) : connected ? (
        <section className="sheet devlock-gate">
          <h2>No launched coins</h2>
          <p>This wallet has not launched a coin yet. Dev Lock is only available for coins you created.</p>
        </section>
      ) : (
        <section className="sheet devlock-gate">
          <h2>Connect the launching wallet</h2>
          <p>Dev Lock only lists coins this wallet created. Pick a time-based date or a vesting schedule, then lock the balance you still hold.</p>
          <button type="button" className="devlock-submit" onClick={connect}>
            Connect
          </button>
        </section>
      )}
    </div>
  );
}

function scheduleParts(mode: Mode, cliffDays: number, lengthDays: number) {
  if (mode === "time") return [{ id: "hold", share: 1 }];
  const total = cliffDays + lengthDays;
  if (total <= 0) return [{ id: "release", share: 1 }];
  const cliffShare = cliffDays / total;
  return [
    ...(cliffShare > 0 ? [{ id: "cliff", share: cliffShare }] : []),
    { id: "release", share: 1 - cliffShare },
  ];
}
