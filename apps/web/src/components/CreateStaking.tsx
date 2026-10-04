"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAppKitNetwork, useAppKitProvider } from "@reown/appkit/react";
import type { Address, EIP1193Provider } from "viem";
import { ApiError, confirmCreateStaking, getFees, getLaunches, getStakingEvents, prepareCreateStaking } from "@/lib/api";
import { robinhoodChain } from "@/lib/chains";
import { actionTxHash, isUserRejection, providerErrorText, readTokenHolding, sendWalletCalls, toRawAmount } from "@/lib/wallet-calls";
import { CREATE_STAKING_FEE_ETH } from "@/lib/fees";
import {
  DAY,
  eventAprRange,
  formatStakingDate,
  formatStakingTokens,
  STAKING_LOCK_OPTIONS,
  type StakingLockId,
} from "@/lib/staking-events";
import { useAsyncData } from "@/lib/use-async-data";
import { PageInfo, PageTitle } from "./PageInfo";
import { TokenLogo } from "./TokenLogo";
import { useWallet } from "./Wallet";

const DURATIONS = [
  { id: "30", label: "30 days", days: 30 },
  { id: "90", label: "90 days", days: 90 },
  { id: "180", label: "180 days", days: 180 },
  { id: "365", label: "1 year", days: 365 },
] as const;

const LOCK_BIT: Record<StakingLockId, number> = { flex: 1, "30": 2, "90": 4 };
const LOCK_INDEX: Record<StakingLockId, 0 | 1 | 2> = { flex: 0, "30": 1, "90": 2 };

function activeChainId(value: number | string | undefined) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.startsWith("0x")) return Number.parseInt(value, 16);
  return Number(value);
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
  return text ? text.slice(0, 180) : "Could not create the staking event.";
}

export function CreateStaking() {
  const { connected, address, connect } = useWallet();
  const { walletProvider } = useAppKitProvider<EIP1193Provider>("eip155");
  const { chainId, switchNetwork } = useAppKitNetwork();
  const { data: launches } = useAsyncData(() => getLaunches({ limit: 100 }), [], { initial: [] });
  const { data: apiEvents, reload: reloadEvents } = useAsyncData(() => getStakingEvents({ limit: 100 }), [], { initial: [] });
  const { data: fees } = useAsyncData(() => getFees(), [], {
    initial: null as Awaited<ReturnType<typeof getFees>> | null,
  });
  const createFee = fees?.CREATE_STAKING_FEE_ETH ?? CREATE_STAKING_FEE_ETH;

  const tokens = useMemo(() => launches.filter((item) => !item.draft), [launches]);
  const [symbol, setSymbol] = useState("");
  const [reward, setReward] = useState("1000000");
  const [duration, setDuration] = useState<(typeof DURATIONS)[number]["id"]>("90");
  const [locks, setLocks] = useState<StakingLockId[]>(["flex", "30", "90"]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const inflight = useRef(false);
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const [tokenDecimals, setTokenDecimals] = useState(18);
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
  const pools = apiPools;

  const parsed = Number(reward.replace(/,/g, ""));
  const value = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  const durationDays = DURATIONS.find((item) => item.id === duration)?.days ?? 90;
  const endsAt = Date.now() + durationDays * DAY;
  const ready = Boolean(coin) && value > 0 && locks.length > 0 && (tokenBalance == null || value <= tokenBalance);

  useEffect(() => {
    if (!connected || !address || !coin?.address) {
      setTokenBalance(null);
      return;
    }
    let stop = false;
    void readTokenHolding(coin.address as Address, address as Address)
      .then((holding) => {
        if (stop) return;
        setTokenBalance(holding.ui);
        setTokenDecimals(holding.decimals);
      })
      .catch(() => {
        if (!stop) setTokenBalance(null);
      });
    return () => {
      stop = true;
    };
  }, [connected, address, coin?.address]);

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

  const submit = async () => {
    if (!connected) {
      connect();
      return;
    }
    if (!coin || !ready) {
      if (tokenBalance != null && value > tokenBalance) setNotice("Amount is above the wallet balance.");
      else setNotice(locks.length === 0 ? "Pick at least one lock option." : "Enter a reward amount above 0.");
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
      const durationSeconds = durationDays * 24 * 60 * 60 - (durationDays >= 365 ? 15 * 60 : 0);
      const aprBps: [number, number, number] = [0, 0, 0];
      let lockMask = 0;
      for (const id of locks) {
        lockMask |= LOCK_BIT[id];
        const option = STAKING_LOCK_OPTIONS.find((item) => item.id === id);
        aprBps[LOCK_INDEX[id]] = (option?.rate ?? 0) * 100;
      }
      const prepared = await prepareCreateStaking({
        wallet: address,
        stakeToken: coin.address,
        rewardAmount: toRawAmount(reward, tokenDecimals),
        endsAt: Math.floor(Date.now() / 1000) + durationSeconds,
        lockMask,
        aprBps,
        idempotencyKey: crypto.randomUUID(),
      });
      const calls = [prepared.approveTx, prepared.tx].filter((call): call is NonNullable<typeof call> => Boolean(call));
      const hashes = await sendWalletCalls(walletProvider, address as Address, calls);
      const confirmed = await confirmCreateStaking({
        actionId: prepared.actionId,
        txHash: actionTxHash(hashes),
      });
      setReward("");
      setNotice(`Staking event submitted${confirmed.txHash ? ` · ${confirmed.txHash.slice(0, 10)}` : ""}. It appears after the indexer catches the event.`);
      reloadEvents();
    } catch (err) {
      setNotice(actionError(err));
    } finally {
      inflight.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="devlock-page">
      <div className="page-head">
        <PageTitle tip="Spin up a staking event for any LOOTING-launched coin. Fund rewards, pick lock options, set the window. The wallet approves the reward tokens, then pays the create fee.">
          Create Staking
        </PageTitle>
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

            <button type="button" className="devlock-submit" onClick={() => void submit()} disabled={busy}>
              {busy ? "Creating…" : "Create staking event"}
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
                <div className="page-title-row">
                  <h2>Events</h2>
                  <PageInfo tip="Pools you published from this wallet." label="Events" />
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
