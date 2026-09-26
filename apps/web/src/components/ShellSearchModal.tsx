"use client";

import Link from "next/link";
import { FormEvent, RefObject, useEffect, useRef } from "react";
import { getLaunches, getStakingEvents } from "@/lib/api";
import { formatUsd } from "@/lib/format";
import { eventAprRange, formatStakingDate, formatStakingTokens } from "@/lib/staking-events";
import type { LaunchWithStats, StakingEvent } from "@/lib/types";
import { useAsyncData } from "@/lib/use-async-data";
import { SearchIcon } from "./Icons";
import { TokenLogo } from "./TokenLogo";

export type SearchCategory = "all" | "token" | "staking";
export type SearchSortBy = "relevance" | "mcap" | "volume" | "newest" | "oldest";
export type SearchAge = "all" | "24h" | "7d";
export type SearchPhase = "all" | "curve" | "graduated";
export type SearchMenu = "sort" | "age" | "phase" | null;

function ageHours(age: string) {
  const value = Number.parseFloat(age);
  if (age.endsWith("m")) return value / 60;
  if (age.endsWith("h")) return value;
  if (age.endsWith("d")) return value * 24;
  return 999;
}

export function ShellSearchModal({
  query,
  setQuery,
  searchVisible,
  dialogRef,
  onClose,
  onSubmit,
  sortBy,
  setSortBy,
  age,
  setAge,
  phase,
  setPhase,
  category,
  setCategory,
  page,
  setPage,
  menuOpen,
  setMenuOpen,
  launches: launchesProp,
  stakingEvents: stakingEventsProp,
}: {
  query: string;
  setQuery: (value: string) => void;
  searchVisible: boolean;
  dialogRef: RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  sortBy: SearchSortBy;
  setSortBy: (value: SearchSortBy) => void;
  age: SearchAge;
  setAge: (value: SearchAge) => void;
  phase: SearchPhase;
  setPhase: (value: SearchPhase) => void;
  category: SearchCategory;
  setCategory: (value: SearchCategory) => void;
  page: number;
  setPage: (value: number | ((current: number) => number)) => void;
  menuOpen: SearchMenu;
  setMenuOpen: (value: SearchMenu) => void;
  launches?: LaunchWithStats[];
  stakingEvents?: StakingEvent[];
}) {
  const fetchLaunches = launchesProp === undefined;
  const fetchStaking = stakingEventsProp === undefined;
  const { data: fetchedLaunches } = useAsyncData(() => getLaunches({ limit: 50 }), [], {
    initial: [] as LaunchWithStats[],
    enabled: fetchLaunches,
  });
  const { data: fetchedStaking } = useAsyncData(() => getStakingEvents({ limit: 50 }), [], {
    initial: [] as StakingEvent[],
    enabled: fetchStaking,
  });
  const launches = launchesProp ?? fetchedLaunches;
  const stakingEvents = stakingEventsProp ?? fetchedStaking;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (menuOpen) {
        setMenuOpen(null);
        return;
      }
      onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen, onClose, setMenuOpen]);

  const needle = (typeof query === "string" ? query : "").trim().toLowerCase();
  const coinHits =
    category === "staking"
      ? []
      : launches
          .map((coin) => ({ kind: "token" as const, coin, stats: coin.stats }))
          .filter(({ coin, stats }) => {
            const hours = ageHours(stats.age);
            if (age === "24h" && hours > 24) return false;
            if (age === "7d" && hours > 24 * 7) return false;
            if (phase !== "all" && coin.phase !== phase) return false;
            if (!needle) return true;
            return (
              coin.name.toLowerCase().includes(needle) ||
              coin.symbol.toLowerCase().includes(needle) ||
              coin.address.toLowerCase().includes(needle)
            );
          })
          .sort((a, b) => {
            if (sortBy === "mcap") return b.coin.marketCap - a.coin.marketCap;
            if (sortBy === "volume") return b.stats.volume24h - a.stats.volume24h;
            if (sortBy === "newest") return ageHours(a.stats.age) - ageHours(b.stats.age);
            if (sortBy === "oldest") return ageHours(b.stats.age) - ageHours(a.stats.age);
            return 0;
          });
  const stakingHits =
    category === "token"
      ? []
      : stakingEvents
          .filter((event) => {
            if (!needle) return true;
            return (
              event.name.toLowerCase().includes(needle) ||
              event.symbol.toLowerCase().includes(needle) ||
              event.address.toLowerCase().includes(needle) ||
              event.id.toLowerCase().includes(needle)
            );
          })
          .map((event) => ({ kind: "staking" as const, event }))
          .sort((a, b) => {
            if (sortBy === "mcap") return b.event.marketCap - a.event.marketCap;
            if (sortBy === "volume") return b.event.volume24h - a.event.volume24h;
            if (sortBy === "newest") return a.event.ends - b.event.ends;
            if (sortBy === "oldest") return b.event.ends - a.event.ends;
            return 0;
          });
  const allHits = category === "token" ? coinHits : category === "staking" ? stakingHits : [...coinHits, ...stakingHits];
  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(allHits.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageHits = allHits.slice(safePage * pageSize, safePage * pageSize + pageSize);

  return (
    <div className={`search-modal-root ${searchVisible ? "is-open" : ""}`} onMouseDown={onClose}>
      <div
        className="search-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <form className="search-modal-field" onSubmit={onSubmit}>
          <SearchIcon />
          <input
            ref={dialogRef}
            value={typeof query === "string" ? query : ""}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder="Search tokens or staking pools"
            aria-label="Search tokens or staking pools"
          />
          <button type="button" className="search-modal-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </form>
        <div className="search-filters">
          <div className="search-type" role="tablist" aria-label="Result type">
            {(
              [
                ["all", "All"],
                ["token", "Token"],
                ["staking", "Staking"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={category === id}
                className={category === id ? "on" : ""}
                onClick={() => {
                  setCategory(id);
                  setPage(0);
                  setMenuOpen(null);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="search-selects">
            <SearchSelect
              label="Sort"
              open={menuOpen === "sort"}
              onOpenChange={(next) => setMenuOpen(next ? "sort" : null)}
              value={sortBy}
              options={[
                { value: "relevance", label: "Relevance" },
                { value: "mcap", label: "Market cap" },
                { value: "volume", label: "Volume" },
                { value: "newest", label: "Newest" },
                { value: "oldest", label: "Oldest" },
              ]}
              onChange={(next) => {
                setSortBy(next);
                setPage(0);
              }}
            />
            {category !== "staking" ? (
              <>
                <SearchSelect
                  label="Age"
                  open={menuOpen === "age"}
                  onOpenChange={(next) => setMenuOpen(next ? "age" : null)}
                  value={age}
                  options={[
                    { value: "all", label: "All" },
                    { value: "24h", label: "24h" },
                    { value: "7d", label: "7d" },
                  ]}
                  onChange={(next) => {
                    setAge(next);
                    setPage(0);
                  }}
                />
                <SearchSelect
                  label="Phase"
                  open={menuOpen === "phase"}
                  onOpenChange={(next) => setMenuOpen(next ? "phase" : null)}
                  value={phase}
                  options={[
                    { value: "all", label: "All" },
                    { value: "curve", label: "Curve" },
                    { value: "graduated", label: "Graduated" },
                  ]}
                  onChange={(next) => {
                    setPhase(next);
                    setPage(0);
                  }}
                />
              </>
            ) : null}
          </div>
        </div>
        <div className="search-modal-list">
          {pageHits.length === 0 ? (
            <p className="search-empty">No results match that search.</p>
          ) : (
            pageHits.map((hit) =>
              hit.kind === "token" ? (
                <Link
                  key={`token-${hit.coin.address}`}
                  href={`/token/${hit.coin.address}`}
                  className="search-hit"
                  onClick={onClose}
                >
                  <TokenLogo symbol={hit.coin.symbol} size={32} />
                  <span>
                    <b>{hit.coin.name}</b>
                    <em>
                      ${hit.coin.symbol} · {formatUsd(hit.coin.marketCap)} MC · {hit.stats.age}
                    </em>
                  </span>
                  <strong className="search-hit-kind is-token">Token</strong>
                  <i aria-hidden>›</i>
                </Link>
              ) : (
                <Link
                  key={`staking-${hit.event.id}`}
                  href={`/staking?pool=${encodeURIComponent(hit.event.id)}`}
                  className="search-hit"
                  onClick={onClose}
                >
                  <TokenLogo symbol={hit.event.symbol} size={32} />
                  <span>
                    <b>{hit.event.name}</b>
                    <em>
                      ${hit.event.symbol} · {eventAprRange(hit.event)} APR · {formatStakingTokens(hit.event.staked)} staked · ends{" "}
                      {formatStakingDate(hit.event.ends)}
                    </em>
                  </span>
                  <strong className="search-hit-kind is-staking">Staking</strong>
                  <i aria-hidden>›</i>
                </Link>
              ),
            )
          )}
        </div>
        <div className="search-modal-foot">
          <span>
            {allHits.length === 0
              ? "0 results"
              : `${safePage * pageSize + 1} to ${Math.min(allHits.length, safePage * pageSize + pageSize)} of ${allHits.length}`}
          </span>
          <div>
            <button type="button" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
              Previous
            </button>
            <em>
              {safePage + 1} / {pageCount}
            </em>
            <button type="button" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}>
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SearchSelect<T extends string>({
  label,
  value,
  options,
  open,
  onOpenChange,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onChange: (next: T) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const current = options.find((item) => item.value === value)?.label ?? value;

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) onOpenChange(false);
    }
    window.addEventListener("mousedown", onPointer);
    return () => window.removeEventListener("mousedown", onPointer);
  }, [open, onOpenChange]);

  return (
    <div className={`search-select${open ? " is-open" : ""}`} ref={rootRef}>
      <span>{label}</span>
      <button
        type="button"
        className="search-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => onOpenChange(!open)}
      >
        {current}
      </button>
      {open ? (
        <div className="search-select-menu" role="listbox" aria-label={label}>
          {options.map((item) => (
            <button
              key={item.value}
              type="button"
              role="option"
              aria-selected={item.value === value}
              className={item.value === value ? "on" : ""}
              onClick={() => {
                onChange(item.value);
                onOpenChange(false);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
