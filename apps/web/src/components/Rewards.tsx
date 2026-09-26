"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AllBoxesIcon, ClaimedIcon, HoldingIcon, IneligibleIcon, UnclaimedIcon } from "@/components/Icons";
import { Pager } from "@/components/Pager";
import { TokenLogo } from "@/components/TokenLogo";
import { SlidingTabs } from "@/components/SlidingTabs";
import { useWallet } from "@/components/Wallet";
import { getRewardTable, getWalletLuckyBoxes, openLuckyBox } from "@/lib/api";
import { shortAddress } from "@/lib/format";
import type { BoxStatus, LuckyBox } from "@/lib/types";
import { useAsyncData } from "@/lib/use-async-data";

const FALLBACK_POOL = ["No reward"];

const statusLabel: Record<BoxStatus, string> = {
  unopened: "Unclaimed",
  opened: "Unclaimed",
  claimed: "Claimed",
  holding: "In market",
  ineligible: "Not eligible",
};

const CASE_ITEM = 128;
const CASE_GAP = 10;
const CASE_STEP = CASE_ITEM + CASE_GAP;
const BOXES_PER_PAGE = 12;

type RewardFilter = "all" | "unclaimed" | "holding" | "claimed" | "ineligible";

const rewardFilters = [
  { id: "all" as const, label: "All", icon: <AllBoxesIcon /> },
  { id: "unclaimed" as const, label: "Unclaimed", icon: <UnclaimedIcon /> },
  { id: "holding" as const, label: "In market", icon: <HoldingIcon /> },
  { id: "claimed" as const, label: "Claimed", icon: <ClaimedIcon /> },
  { id: "ineligible" as const, label: "Not eligible", icon: <IneligibleIcon /> },
];

function claimHash(id: string) {
  const n = Number(id);
  const head = (0x8f3a21 + n * 0x11d).toString(16).padStart(6, "0");
  const tail = (0xa801 + n).toString(16).padStart(4, "0");
  return `0x${head}bb90de44a90112ab90ff33c1d8e774${tail}`;
}

function canClaim(box: LuckyBox) {
  return box.status === "unopened" || box.status === "opened";
}

function prizeFor(box: LuckyBox, pool: string[]) {
  const labels = pool.length > 0 ? pool : FALLBACK_POOL;
  return box.reward ?? labels[Number(box.id) % labels.length] ?? "No reward";
}

function ShareCard({
  token,
  boxId,
  reward,
  children,
}: {
  token: string;
  boxId: string;
  reward: string;
  children?: ReactNode;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancel = false;
    const mark = new Image();
    const scene = new Image();
    mark.src = "/logo-wordmark.png";
    scene.src = "/sharecard-bg.png";

    const paint = () => {
      if (cancel) return;
      if (!mark.complete || !scene.complete) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const width = 1920;
      const height = 1080;
      const pixel = 2;
      canvas.width = width * pixel;
      canvas.height = height * pixel;
      ctx.setTransform(pixel, 0, 0, pixel, 0, 0);

      ctx.fillStyle = "#09090b";
      ctx.fillRect(0, 0, width, height);

      if (scene.naturalWidth > 0) {
        ctx.drawImage(scene, 0, 0, scene.naturalWidth, scene.naturalHeight, 0, 0, width, height);
        const fade = ctx.createLinearGradient(60, 0, 1020, 0);
        fade.addColorStop(0, "rgba(9, 9, 11, 0)");
        fade.addColorStop(0.22, "rgba(9, 9, 11, 0.04)");
        fade.addColorStop(0.46, "rgba(9, 9, 11, 0.18)");
        fade.addColorStop(0.68, "rgba(9, 9, 11, 0.48)");
        fade.addColorStop(0.86, "rgba(9, 9, 11, 0.82)");
        fade.addColorStop(1, "#09090b");
        ctx.fillStyle = fade;
        ctx.fillRect(60, 0, width - 60, height);
        const floor = ctx.createLinearGradient(0, 980, 0, height);
        floor.addColorStop(0, "rgba(9, 9, 11, 0)");
        floor.addColorStop(1, "rgba(9, 9, 11, 0.72)");
        ctx.fillStyle = floor;
        ctx.fillRect(0, 980, width, height - 980);
      }

      const family = getComputedStyle(document.body).fontFamily;
      ctx.textBaseline = "top";

      const logoH = 58;
      const logoW = mark.naturalWidth > 0 ? (mark.naturalWidth / mark.naturalHeight) * logoH : 0;
      if (logoW > 0) ctx.drawImage(mark, width - 88 - logoW, 72, logoW, logoH);

      const centerX = 1460;
      ctx.textAlign = "center";

      const claimedSize = 32;
      const claimed = "Just Claimed";
      let prizeSize = 112;
      ctx.font = `700 ${prizeSize}px ${family}`;
      while (ctx.measureText(reward).width > 760 && prizeSize > 64) {
        prizeSize -= 2;
        ctx.font = `700 ${prizeSize}px ${family}`;
      }
      const metaSize = 30;
      const meta = `Box #${boxId}  ·  Season 01`;
      const ctaSize = 36;
      const cta = "Claim your Lucky box now";
      const blockH = claimedSize + 22 + prizeSize + 20 + metaSize + 28 + ctaSize;
      let y = Math.round((height - blockH) / 2) + 12;

      ctx.fillStyle = "#f5f5f5";
      ctx.font = `600 ${claimedSize}px ${family}`;
      ctx.fillText(claimed, centerX, y);
      y += claimedSize + 22;

      ctx.fillStyle = reward === "No reward" ? "#9b9b9b" : "#ccff00";
      ctx.font = `700 ${prizeSize}px ${family}`;
      ctx.fillText(reward, centerX, y);
      y += prizeSize + 20;

      ctx.fillStyle = "#9a9aa2";
      ctx.font = `500 ${metaSize}px ${family}`;
      ctx.fillText(meta, centerX, y);
      y += metaSize + 28;

      ctx.fillStyle = "#f5f5f5";
      ctx.font = `600 ${ctaSize}px ${family}`;
      ctx.fillText(cta, centerX, y);

      ctx.textBaseline = "alphabetic";
      ctx.font = `500 24px ${family}`;
      ctx.fillStyle = "#b4b4bc";
      ctx.textAlign = "right";
      ctx.fillText("lootingpad.com  |  Robinhood Chain", width - 72, 1032);
    };

    mark.onload = paint;
    scene.onload = paint;
    mark.onerror = paint;
    scene.onerror = paint;
    paint();

    return () => {
      cancel = true;
    };
  }, [boxId, reward, token]);

  async function share() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;
    const file = new File([blob], `looting-${token.toLowerCase()}-box-${boxId}.png`, { type: "image/png" });
    const payload = { files: [file], title: "LOOTING Lucky Box", text: `Lucky box $${token}: ${reward}` };
    if (navigator.canShare?.(payload)) {
      try {
        await navigator.share(payload);
        setNote("Shared");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    link.click();
    URL.revokeObjectURL(url);
    setNote("Image saved");
  }

  return (
    <div className="share-card">
      <canvas ref={canvasRef} className="share-canvas" aria-label={`Share card, ${reward}`} />
      <div className="claim-actions">
        <button type="button" className="claim-btn claim-all" onClick={share}>
          Share
        </button>
        {children}
      </div>
      {note ? <p className="page-note">{note}</p> : null}
    </div>
  );
}

function PrizeReveal({
  reward,
  rewardPool,
  onDone,
}: {
  reward: string;
  rewardPool: string[];
  onDone: () => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const pool = rewardPool.length > 0 ? rewardPool : FALLBACK_POOL;
  const copies = 12;
  const strip = useRef(Array.from({ length: copies }, () => pool).flat()).current;
  const winner = Math.max(0, pool.indexOf(reward));
  const landIndex = (copies - 2) * pool.length + winner;
  const startIndex = Math.max(0, landIndex - pool.length * 7);

  const [shift, setShift] = useState(0);
  const [ready, setReady] = useState(false);
  const [landed, setLanded] = useState(false);
  const empty = reward === "No reward";

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const center = track.clientWidth / 2 - CASE_ITEM / 2;
    const from = center - startIndex * CASE_STEP;
    const to = center - landIndex * CASE_STEP;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      setShift(to);
      setReady(true);
      setLanded(true);
      const id = window.setTimeout(() => doneRef.current(), 500);
      return () => window.clearTimeout(id);
    }

    setShift(from);
    setReady(false);
    const start = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setReady(true);
        setShift(to);
      });
    });
    const lock = window.setTimeout(() => setLanded(true), 3400);
    const done = window.setTimeout(() => doneRef.current(), 4200);
    return () => {
      window.cancelAnimationFrame(start);
      window.clearTimeout(lock);
      window.clearTimeout(done);
    };
  }, [landIndex, startIndex]);

  return (
    <div className={`case-open${landed ? " is-landed" : ""}${empty ? " is-empty" : ""}`}>
      <div className="case-track" ref={trackRef}>
        <div className="case-fade case-fade-left" aria-hidden />
        <div className="case-fade case-fade-right" aria-hidden />
        <div className="case-needle" aria-hidden />
        <div
          className={`case-strip${ready ? " is-running" : ""}`}
          style={{ transform: `translate3d(${shift}px, 0, 0)` }}
        >
          {strip.map((prize, index) => {
            const isWin = landed && index === landIndex;
            return (
              <div
                key={`${prize}-${index}`}
                className={`case-item${prize === "No reward" ? " is-miss" : ""}${isWin ? " is-win" : ""}`}
              >
                <span>{prize}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="case-meta">
        {landed ? (
          <>
            <strong className="case-prize">{reward}</strong>
            <p className="page-note">{empty ? "No reward this time" : "Prize locked in"}</p>
          </>
        ) : (
          <p className="page-note">Opening box…</p>
        )}
      </div>
    </div>
  );
}

export function Rewards() {
  const { connected, address, connect } = useWallet();
  const {
    data: remoteBoxes,
    loading: boxesLoading,
    error: boxesError,
  } = useAsyncData(() => getWalletLuckyBoxes(address), [address], {
    initial: [],
    enabled: connected,
  });
  const { data: rewardTable } = useAsyncData(() => getRewardTable(), [], {
    initial: null,
  });
  const rewardPool = rewardTable?.rewardPool?.length ? rewardTable.rewardPool : FALLBACK_POOL;

  const [boxes, setBoxes] = useState<LuckyBox[]>([]);
  const [filter, setFilter] = useState<RewardFilter>("all");
  const [page, setPage] = useState(1);
  const [reel, setReel] = useState<{ box: LuckyBox; reward: string; phase: "spin" | "land" } | null>(null);
  const [opening, setOpening] = useState(false);
  const queueRef = useRef<LuckyBox[]>([]);
  const granted = useRef(new Set<string>());
  const rewardPoolRef = useRef(rewardPool);
  rewardPoolRef.current = rewardPool;

  useEffect(() => {
    setBoxes(connected ? remoteBoxes : []);
    granted.current = new Set();
    setFilter("all");
    setPage(1);
  }, [connected, address, remoteBoxes]);

  useEffect(() => {
    setPage(1);
  }, [filter]);

  const ready = boxes.filter(canClaim).length;
  const claimed = boxes.filter((box) => box.status === "claimed").length;
  const holding = boxes.filter((box) => box.status === "holding").length;
  const visible = boxes.filter((box) => {
    if (filter === "unclaimed") return canClaim(box);
    if (filter === "holding") return box.status === "holding";
    if (filter === "claimed") return box.status === "claimed";
    if (filter === "ineligible") return box.status === "ineligible";
    return true;
  });
  const pages = Math.max(1, Math.ceil(visible.length / BOXES_PER_PAGE));
  const safePage = Math.min(page, pages);
  const paged = visible.slice((safePage - 1) * BOXES_PER_PAGE, safePage * BOXES_PER_PAGE);
  const busy = Boolean(reel) || opening;

  function grant(box: LuckyBox, reward: string) {
    if (granted.current.has(box.id)) return;
    granted.current.add(box.id);
    setBoxes((current) =>
      current.map((item) =>
        item.id === box.id
          ? { ...item, status: "claimed", reward, tx: item.tx ?? claimHash(box.id), claimedAt: item.claimedAt ?? "now" }
          : item,
      ),
    );
  }

  async function openReel(box: LuckyBox) {
    let reward = prizeFor(box, rewardPoolRef.current);
    try {
      const res = await openLuckyBox(box.id, address);
      reward = res.reward ?? res.data?.reward ?? reward;
    } catch {
      // Local reel fallback when the open endpoint is unreachable.
    }
    setReel({ box, reward, phase: "spin" });
  }

  async function claimMany(list: LuckyBox[]) {
    const targets = list.filter((box) => canClaim(box) && !granted.current.has(box.id));
    if (targets.length === 0 || busy) return;
    queueRef.current = targets.slice(1);
    setOpening(true);
    try {
      await openReel(targets[0]);
    } finally {
      setOpening(false);
    }
  }

  function finishSpin() {
    setReel((current) => {
      if (!current || current.phase === "land") return current;
      grant(current.box, current.reward);
      return { ...current, phase: "land" };
    });
  }

  function closeReel() {
    setReel((current) => {
      if (current) grant(current.box, current.reward);
      return null;
    });
    queueRef.current = [];
  }

  async function collect() {
    const next = queueRef.current.shift();
    if (!next) {
      setReel(null);
      return;
    }
    setOpening(true);
    try {
      await openReel(next);
    } finally {
      setOpening(false);
    }
  }

  useEffect(() => {
    if (!reel) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeReel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reel]);

  return (
    <div className="rewards-page">
      <div className="page-head">
        <div>
          <h1 className="explore-title">Lucky Boxes</h1>
          <p className="page-note">Season 01 · Open after you exit a launch.</p>
        </div>
        <div className="rewards-stats">
          <button type="button" className={filter === "unclaimed" ? "is-ready on" : "is-ready"} onClick={() => setFilter("unclaimed")}>
            <span>Ready</span>
            <strong>{ready}</strong>
          </button>
          <button type="button" className={filter === "holding" ? "on" : ""} onClick={() => setFilter("holding")}>
            <span>In market</span>
            <strong>{holding}</strong>
          </button>
          <button type="button" className={filter === "claimed" ? "on" : ""} onClick={() => setFilter("claimed")}>
            <span>Claimed</span>
            <strong>{claimed}</strong>
          </button>
        </div>
      </div>
      {!connected ? (
        <section className="sheet rewards-gate">
          <p className="account-kicker">Holding history</p>
          <p className="rewards-gate-title">Connect to check eligibility</p>
          <p className="page-note">A box opens after you exit a token launched on LOOTING. A wallet that never bought one is not eligible.</p>
          <button type="button" className="claim-btn claim-all" onClick={connect}>
            Connect
          </button>
        </section>
      ) : null}
      {connected ? <SlidingTabs ariaLabel="Box status" items={rewardFilters} value={filter} onChange={setFilter} /> : null}
      {connected ? (
        <>
      <div className="table-wrap rewards-board">
        <table className="coin-table rewards-table">
          <thead>
            <tr>
              <th>Box</th>
              <th>Coin</th>
              <th>Reward</th>
              <th>Txn</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {boxesLoading ? (
              <tr>
                <td className="rewards-empty" colSpan={6}>
                  Loading boxes…
                </td>
              </tr>
            ) : null}
            {!boxesLoading && boxesError ? (
              <tr>
                <td className="rewards-empty" colSpan={6}>
                  {boxesError}
                </td>
              </tr>
            ) : null}
            {!boxesLoading && !boxesError && paged.length === 0 ? (
              <tr>
                <td className="rewards-empty" colSpan={6}>
                  No boxes
                </td>
              </tr>
            ) : null}
            {!boxesLoading && !boxesError
              ? paged.map((box) => {
                  const open = canClaim(box);
                  const active = reel?.box.id === box.id;
                  const prize = box.reward;
                  return (
                    <tr key={box.id} className={active && reel?.phase === "land" ? "is-claiming" : undefined}>
                      <td className="num text-left">
                        <span className="box-id">#{box.id}</span>
                      </td>
                      <td className="text-left">
                        <span className="reward-coin">
                          <TokenLogo symbol={box.token} size={28} />${box.token}
                        </span>
                      </td>
                      <td className="text-left">
                        <span className={`reward-prize${prize ? (prize === "No reward" ? " is-empty" : " is-won") : " is-hidden"}`}>
                          {prize ?? (box.status === "ineligible" ? "—" : "Sealed")}
                        </span>
                      </td>
                      <td className="text-left">
                        {box.status === "claimed" && box.tx ? (
                          <span className="reward-tx">
                            {shortAddress(box.tx)}
                            <span>{box.claimedAt}</span>
                          </span>
                        ) : (
                          <span className="reward-idle">—</span>
                        )}
                      </td>
                      <td className="text-left">
                        <span className={`status ${box.status === "opened" ? "unopened" : box.status}`}>{statusLabel[box.status]}</span>
                      </td>
                      <td className="text-right">
                        {open ? (
                          <button type="button" className="claim-btn" disabled={busy} onClick={() => void claimMany([box])}>
                            {active || (opening && !reel) ? "Claiming" : "Claim"}
                          </button>
                        ) : (
                          <span className="reward-idle">{box.status === "holding" ? "Exit to open" : "—"}</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              : null}
          </tbody>
        </table>
        {visible.length > BOXES_PER_PAGE ? (
          <Pager page={safePage} pages={pages} onChange={setPage} />
        ) : null}
      </div>
      <section className="sheet rewards-mobile-board">
        <ul className="app-rows">
          {boxesLoading ? <li className="is-empty">Loading boxes…</li> : null}
          {!boxesLoading && boxesError ? <li className="is-empty">{boxesError}</li> : null}
          {!boxesLoading && !boxesError && paged.length === 0 ? <li className="is-empty">No boxes</li> : null}
          {!boxesLoading && !boxesError
            ? paged.map((box) => {
                const open = canClaim(box);
                const active = reel?.box.id === box.id;
                const prize = box.reward;
                return (
                  <li key={box.id}>
                    <TokenLogo symbol={box.token} size={32} />
                    <div>
                      <strong>${box.token}</strong>
                      <span>
                        #{box.id} · {statusLabel[box.status]}
                        {prize ? ` · ${prize}` : ""}
                      </span>
                    </div>
                    {open ? (
                      <button type="button" className="claim-btn" disabled={busy} onClick={() => void claimMany([box])}>
                        {active || (opening && !reel) ? "Claiming" : "Claim"}
                      </button>
                    ) : (
                      <b>{box.status === "holding" ? "Exit" : box.status === "claimed" ? "Done" : "—"}</b>
                    )}
                  </li>
                );
              })
            : null}
        </ul>
        {visible.length > BOXES_PER_PAGE ? (
          <Pager page={safePage} pages={pages} onChange={setPage} />
        ) : null}
      </section>
        </>
      ) : null}
      {reel && (
        <div className="claim-pop" role="dialog" aria-modal="true" aria-label={`Lucky box ${reel.box.token}`}>
          <button type="button" className="claim-pop-backdrop" aria-label="Close" onClick={closeReel} />
          <div className="claim-card">
            {reel.phase === "land" ? (
              <>
                <p className="kicker">Share card</p>
                <ShareCard token={reel.box.token} boxId={reel.box.id} reward={reel.reward}>
                  <button type="button" className="claim-btn" disabled={opening} onClick={() => void collect()}>
                    {queueRef.current.length > 0 ? "Next box" : "Collect"}
                  </button>
                </ShareCard>
              </>
            ) : (
              <>
                <p className="kicker">Lucky box</p>
                <h2 className="claim-title">${reel.box.token}</h2>
                <p className="page-note">Box #{reel.box.id}</p>
                <PrizeReveal key={`${reel.box.id}-${reel.reward}`} reward={reel.reward} rewardPool={rewardPool} onDone={finishSpin} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
