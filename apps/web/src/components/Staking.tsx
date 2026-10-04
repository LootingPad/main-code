"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAppKitNetwork, useAppKitProvider } from "@reown/appkit/react";
import type { Address, EIP1193Provider } from "viem";
import {
  ApiError,
  confirmStake,
  confirmStakingClaim,
  confirmUnstake,
  getLaunches,
  getStakingEvents,
  getWalletStakingPositions,
  prepareStake,
  prepareStakingClaim,
  prepareUnstake,
} from "@/lib/api";
import { robinhoodChain } from "@/lib/chains";
import { actionTxHash, isUserRejection, providerErrorText, readTokenHolding, sendWalletCalls, toRawAmount } from "@/lib/wallet-calls";
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
import { PageTitle } from "./PageInfo";
import { Pager } from "./Pager";
import { SlidingTabs } from "./SlidingTabs";
import { TokenLogo } from "./TokenLogo";
import { useWallet } from "./Wallet";

type Tab = "events" | "positions";

const EVENTS_PER_PAGE = 10;
const POSITIONS_PER_PAGE = 10;

function formatLive(value: number) {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function activeChainId(value: number | string | undefined) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.startsWith("0x")) return Number.parseInt(value, 16);
  return Number(value);
}

function unstakeBlocked(position: StakingPosition | null) {
  if (!position || position.lock === "flex") return false;
  if (!position.started) return true;
  const days = position.lock === "30" ? 30 : 90;
  return Date.now() < position.started + days * DAY;
}

function actionError(err: unknown) {
  if (isUserRejection(err)) return "Transaction cancelled.";
  if (err instanceof ApiError) {
    if (err.status === 503 || err.code === "CONTRACTS_NOT_CONFIGURED") {
      return "Staking contracts are not configured yet.";
    }
    return err.message || err.code;
  }
  const text = providerErrorText(err);
  return text ? text.slice(0, 180) : "Staking action failed.";
}

function tokenPrice(symbol: string, event: StakingEvent | undefined, launches: { symbol: string; priceUsd: number }[]) {
  const launch = launches.find((entry) => entry.symbol === symbol);
  if (launch && launch.priceUsd > 0) return launch.priceUsd;
  if (event && event.marketCap > 0) return event.marketCap / 1_000_000_000;
  return 0;
}

export function Staking() {
  const { connected, connect, address } = useWallet();
  const { walletProvider } = useAppKitProvider<EIP1193Provider>("eip155");
  const { chainId, switchNetwork } = useAppKitNetwork();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>("events");
  const { data: events, reload: reloadEvents } = useAsyncData(() => getStakingEvents({ limit: 100 }), [], { initial: [] });
  const { data: apiPositions, reload: reloadPositions } = useAsyncData(
    () => getWalletStakingPositions(address),
    [address],
    { initial: [], enabled: connected },
  );
  const { data: launches } = useAsyncData(() => getLaunches({ limit: 100 }), [], { initial: [] });
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [activePositionId, setActivePositionId] = useState<string | null>(null);
  const [side, setSide] = useState<"stake" | "unstake">("stake");
  const [lock, setLock] = useState<StakingLockId>("30");
  const [amount, setAmount] = useState("");
  const [walletBalance, setWalletBalance] = useState(0);
  const [tokenDecimals, setTokenDecimals] = useState(18);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const inflight = useRef(false);
  const [eventPage, setEventPage] = useState(1);
  const [positionPage, setPositionPage] = useState(1);
  const openedPoolRef = useRef<string | null>(null);

  const positions = useMemo(() => {
    if (!connected) return [];
    return apiPositions.filter((item) => item.amount > 0);
  }, [connected, apiPositions]);

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
  const stakedAmount = activePosition?.amount ?? 0;
  const cap = side === "stake" ? walletBalance : stakedAmount;
  const parsed = Number(amount.replace(/,/g, ""));
  const value = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  const eventEnded = Boolean(targetEvent && targetEvent.ends <= Date.now());
  const lockedOut = side === "unstake" && unstakeBlocked(activePosition);
  const ready =
    connected &&
    Boolean(targetEvent) &&
    value > 0 &&
    value <= cap &&
    !(side === "stake" && eventEnded) &&
    !lockedOut;

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
  const chainClaimable = livePosition?.claimable ?? 0;

  useEffect(() => {
    if (!availableLocks.includes(lock) && availableLocks[0]) {
      setLock(availableLocks[0] as StakingLockId);
    }
  }, [availableLocks, lock]);

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

  const tokenAddress = targetEvent?.address ?? activePosition?.address ?? "";

  useEffect(() => {
    if (!connected || !address || !tokenAddress) {
      setWalletBalance(0);
      return;
    }
    let stop = false;
    void readTokenHolding(tokenAddress as Address, address as Address)
      .then((holding) => {
        if (stop) return;
        setWalletBalance(holding.ui);
        setTokenDecimals(holding.decimals);
      })
      .catch(() => {
        if (!stop) setWalletBalance(0);
      });
    return () => {
      stop = true;
    };
  }, [connected, address, tokenAddress]);

  const submit = async () => {
    if (!connected) {
      connect();
      return;
    }
    if (!targetEvent || !ready) {
      if (side === "stake" && eventEnded) setNotice("This event has ended.");
      else if (lockedOut) setNotice("This lock has not finished yet.");
      else setNotice(value > cap ? "Amount is above the available balance." : "Enter an amount above 0.");
      return;
    }
    if (!walletProvider) {
      setNotice("Wallet is not ready.");
      return;
    }
    if (inflight.current) return;
    inflight.current = true;
    setBusy(true);
    setNotice("");
    try {
      if (activeChainId(chainId) !== robinhoodChain.id) await switchNetwork(robinhoodChain);
      const raw = toRawAmount(amount, tokenDecimals);
      const lockId = side === "unstake" && activePosition ? activePosition.lock : selectedLock;
      const prepared =
        side === "stake"
          ? await prepareStake({
              wallet: address,
              vaultId: targetEvent.id,
              amount: raw,
              lock: lockId,
              idempotencyKey: crypto.randomUUID(),
            })
          : await prepareUnstake({
              wallet: address,
              vaultId: targetEvent.id,
              amount: raw,
              lock: lockId,
              idempotencyKey: crypto.randomUUID(),
            });
      const calls = [prepared.approveTx, prepared.tx].filter((call): call is NonNullable<typeof call> => Boolean(call));
      const hashes = await sendWalletCalls(walletProvider, address as Address, calls);
      const confirmed =
        side === "stake"
          ? await confirmStake({ actionId: prepared.actionId, txHash: actionTxHash(hashes) })
          : await confirmUnstake({ actionId: prepared.actionId, txHash: actionTxHash(hashes) });
      setAmount("");
      setNotice(`${side === "stake" ? "Stake" : "Unstake"} submitted${confirmed.txHash ? ` · ${confirmed.txHash.slice(0, 10)}` : ""}.`);
      reloadEvents();
      reloadPositions();
    } catch (err) {
      setNotice(actionError(err));
    } finally {
      inflight.current = false;
      setBusy(false);
    }
  };

  const claim = async () => {
    if (!connected) {
      connect();
      return;
    }
    if (!targetEvent || !activePosition || activePosition.claimable <= 0) {
      setNotice("Nothing to claim yet.");
      return;
    }
    if (!walletProvider) {
      setNotice("Wallet is not ready.");
      return;
    }
    if (inflight.current) return;
    inflight.current = true;
    setBusy(true);
    setNotice("");
    try {
      if (activeChainId(chainId) !== robinhoodChain.id) await switchNetwork(robinhoodChain);
      const prepared = await prepareStakingClaim({
        wallet: address,
        vaultId: targetEvent.id,
        lock: activePosition.lock,
        idempotencyKey: crypto.randomUUID(),
      });
      const hashes = await sendWalletCalls(walletProvider, address as Address, [prepared.tx]);
      const confirmed = await confirmStakingClaim({ actionId: prepared.actionId, txHash: actionTxHash(hashes) });
      setNotice(`Claim submitted${confirmed.txHash ? ` · ${confirmed.txHash.slice(0, 10)}` : ""}.`);
      reloadPositions();
    } catch (err) {
      setNotice(actionError(err));
    } finally {
      inflight.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="staking-page">
      <div className="page-head">
        <PageTitle tip="Public pools from token creators. Stake in Events, manage what you hold in Positions. New rows show up after the indexer sees the transaction.">
          Staking
        </PageTitle>
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

                <button type="button" className="staking-submit" onClick={() => void submit()} disabled={busy}>
                  {busy ? "Confirm in wallet…" : connected ? (side === "stake" ? `Stake ${symbol}` : `Unstake ${symbol}`) : "Connect"}
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
              <article className={`sheet staking-earn${chainClaimable > 0 ? " is-live" : ""}`}>
                <header className="earn-head">
                  <span className="earn-live">
                    {chainClaimable > 0 ? <span className="earn-dot" /> : null}
                    Claimable
                  </span>
                  <em>{livePosition ? symbol : "—"}</em>
                </header>
                <strong>
                  {livePosition ? formatLive(chainClaimable) : "0.00"}
                  {livePosition ? ` ${symbol}` : ""}
                </strong>
                <button
                  type="button"
                  className="claim-btn"
                  disabled={busy || !livePosition || chainClaimable <= 0}
                  onClick={() => void claim()}
                >
                  {chainClaimable > 0 ? "Claim" : "Claimed"}
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
