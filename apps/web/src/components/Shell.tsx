"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { getCreatorLaunches, getFees, getLaunches } from "@/lib/api";
import { formatUsd, shortAddress } from "@/lib/format";
import type { FeesConfig, LaunchWithStats } from "@/lib/types";
import { useAsyncData } from "@/lib/use-async-data";
import { BookIcon, NavIcon, PanelIcon, PlusIcon, SearchIcon, TelegramIcon, XIcon } from "./Icons";
import { RouteTransition } from "./RouteTransition";
import { TokenLogo } from "./TokenLogo";
import { useWallet } from "./Wallet";

type SearchCategory = "all" | "token" | "staking";
type SearchSortBy = "relevance" | "mcap" | "volume" | "newest" | "oldest";
type SearchAge = "all" | "24h" | "7d";
type SearchPhase = "all" | "curve" | "graduated";
type SearchMenu = "sort" | "age" | "phase" | null;

const ShellSearchModal = dynamic(
  () => import("./ShellSearchModal").then((mod) => ({ default: mod.ShellSearchModal })),
  { ssr: false },
);

const links = [
  { href: "/", label: "Explore" },
  { href: "/create", label: "Launch" },
  { href: "/rewards", label: "Lucky Boxes" },
  { href: "/leaderboard", label: "Leaderboard" },
];

const navGroups = [
  {
    title: "Protocol",
    links: [
      { href: "/looting", label: "$LOOTING" },
      { href: "/staking", label: "Staking" },
      { href: "/analytics", label: "Analytics" },
    ],
  },
  {
    title: "Token tools",
    links: [
      { href: "/devlock", label: "Dev Lock" },
      { href: "/create-staking", label: "Create Staking" },
    ],
  },
] as const;

const accountLink = { href: "/account", label: "Account" };

const sideLinks = [
  { href: "https://x.com", label: "X", icon: <XIcon size={20} />, external: true },
  { href: "/docs", label: "About", icon: <BookIcon size={20} />, external: false },
  { href: "https://t.me/lootingpad", label: "Telegram", icon: <TelegramIcon size={20} />, external: true },
];

const DEFAULT_ETH_USD = 3500;

function creatorFeeEth(launch: LaunchWithStats, ethUsd: number) {
  const rate = ethUsd > 0 ? ethUsd : DEFAULT_ETH_USD;
  const accrued = (launch.marketCap / rate) * (launch.creatorTax / 100) * (0.35 + launch.progress / 200);
  return (accrued * (100 - launch.luckyShare)) / 100;
}

function formatEth(value: number) {
  if (value >= 100) return `${value.toFixed(1)} ETH`;
  if (value >= 1) return `${value.toFixed(2)} ETH`;
  return `${value.toFixed(4)} ETH`;
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { connected, address, connect, disconnect } = useWallet();
  const { data: launches } = useAsyncData(() => getLaunches({ limit: 50 }), [], {
    initial: [] as LaunchWithStats[],
    pollMs: 30000,
  });
  const { data: fees } = useAsyncData(() => getFees(), [], {
    initial: null as FeesConfig | null,
  });
  const ethUsd = fees?.ETH_USD ?? DEFAULT_ETH_USD;
  const [creatorClaimed, setCreatorClaimed] = useState(false);
  const [query, setQuery] = useState("");
  const [searchMounted, setSearchMounted] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const dialogRef = useRef<HTMLInputElement>(null);
  const closeTimer = useRef<number | null>(null);
  const searchGen = useRef(0);
  const [sortBy, setSortBy] = useState<SearchSortBy>("relevance");
  const [age, setAge] = useState<SearchAge>("all");
  const [phase, setPhase] = useState<SearchPhase>("all");
  const [category, setCategory] = useState<SearchCategory>("all");
  const [page, setPage] = useState(0);
  const [menuOpen, setMenuOpen] = useState<SearchMenu>(null);
  const [pill, setPill] = useState({ y: 0, h: 36, show: false });

  useEffect(() => {
    setOpen(window.localStorage.getItem("looting-sidebar") === "1");
  }, []);

  useLayoutEffect(() => {
    const root = navRef.current;
    if (!root) return;
    const active = root.querySelector<HTMLElement>("a.active");
    if (!active) {
      setPill((current) => ({ ...current, show: false }));
      return;
    }
    setPill({ y: active.offsetTop, h: active.offsetHeight, show: true });
  }, [pathname, open]);

  function toggleSidebar() {
    setOpen((current) => {
      const next = !current;
      window.localStorage.setItem("looting-sidebar", next ? "1" : "0");
      return next;
    });
  }

  const closeSearch = useCallback(() => {
    searchGen.current += 1;
    setSearchVisible(false);
    setMenuOpen(null);
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setSearchMounted(false), 240);
  }, []);

  function openSearch() {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    const gen = ++searchGen.current;
    setSearchMounted(true);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (searchGen.current !== gen) return;
        setSearchVisible(true);
      });
    });
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openSearch();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!searchVisible) return;
    const frame = window.requestAnimationFrame(() => dialogRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [searchVisible]);

  function search(event: FormEvent) {
    event.preventDefault();
    const term = query.trim();
    closeSearch();
    router.push(term ? `/?q=${encodeURIComponent(term)}` : "/");
  }

  const tape = launches.length > 0 ? [...launches, ...launches] : [];

  return (
    <div className={`app ${open ? "is-open" : ""}`}>
      <div className="atmosphere" />
      <div className="rail">
        <aside className="sidebar">
        <div className="brand-row">
          <Link href="/" className="brand" title="LOOTING" aria-label="LOOTING">
            <img src="/logo.png" alt="" className="brand-logo" fetchPriority="high" decoding="async" />
            <img src="/logo-wordmark.png" alt="" className="brand-word" fetchPriority="high" decoding="async" />
          </Link>
        </div>
        {connected ? (
          <CreatorClaim
            address={address}
            claimed={creatorClaimed}
            ethUsd={ethUsd}
            onClaim={() => setCreatorClaimed(true)}
          />
        ) : null}
        <nav ref={navRef} className="rail-nav" aria-label="Primary">
          <span
            className="rail-pill"
            style={{
              height: pill.h,
              transform: `translate3d(0, ${pill.y}px, 0)`,
              opacity: pill.show ? 1 : 0,
            }}
          />
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              title={link.label}
              className={`nav-item ${isActive(pathname, link.href) ? "active" : ""}`}
            >
              <span className="nav-glyph">
                <NavIcon name={link.label} size={22} />
              </span>
              <span className="nav-label">{link.label}</span>
            </Link>
          ))}
          {navGroups.map((group) => (
            <div key={group.title} className="nav-group">
              <p className="nav-group-title">{group.title}</p>
              {group.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  title={link.label}
                  className={`nav-item ${isActive(pathname, link.href) ? "active" : ""}`}
                >
                  <span className="nav-glyph">
                    <NavIcon name={link.label} size={22} />
                  </span>
                  <span className="nav-label">{link.label}</span>
                </Link>
              ))}
            </div>
          ))}
          <div className="nav-group">
            <Link
              href={accountLink.href}
              title={accountLink.label}
              className={`nav-item ${isActive(pathname, accountLink.href) ? "active" : ""}`}
            >
              <span className="nav-glyph">
                <NavIcon name={accountLink.label} size={22} />
              </span>
              <span className="nav-label">{accountLink.label}</span>
            </Link>
          </div>
        </nav>
        <div className="sidebar-end">
          <div className="sidebar-actions">
            <div className="create-stack">
              <Link href="/create" title="Create" className="create-btn">
                <PlusIcon />
                <span className="nav-label">Create</span>
              </Link>
            </div>
            <div className="side-links">
              {sideLinks.map((item) =>
                item.external ? (
                  <a key={item.label} href={item.href} className="side-link" target="_blank" rel="noreferrer" title={item.label} aria-label={item.label}>
                    {item.icon}
                    <span>{item.label}</span>
                  </a>
                ) : (
                  <Link key={item.label} href={item.href} className="side-link" title={item.label} aria-label={item.label}>
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                ),
              )}
            </div>
          </div>
        </div>
        </aside>
        <button
          type="button"
          className="rail-toggle"
          onClick={toggleSidebar}
          aria-expanded={open}
          aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
        >
          <PanelIcon open={open} />
        </button>
      </div>
      <div className="workspace">
        <header className="topbar">
          <div className="search-row">
            <form
              className="search"
              onSubmit={search}
              onMouseDown={(event) => {
                event.stopPropagation();
                openSearch();
              }}
            >
              <SearchIcon />
              <input
                value={typeof query === "string" ? query : ""}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(0);
                  openSearch();
                }}
                onFocus={openSearch}
                placeholder="Search tokens or staking pools..."
                aria-label="Search tokens or staking pools"
                aria-expanded={searchVisible}
              />
              <span className="search-keys" aria-hidden>
                <kbd>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <path d="M8 1.8v4.2M8 14.2V10M1.8 8h4.2M14.2 8H10" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
                    <path d="M8 1.8 6.4 3.5M8 1.8l1.6 1.7M8 14.2 6.4 12.5M8 14.2l1.6-1.7M1.8 8 3.5 6.4M1.8 8l1.7 1.6M14.2 8 12.5 6.4M14.2 8l-1.7 1.6" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </kbd>
                <kbd>K</kbd>
              </span>
            </form>
          </div>
          <div className="tape" aria-label="Moving coins">
            <div className="tape-track">
              {tape.map((coin, index) => (
                <Link key={`${coin.address}-${index}`} href={`/token/${coin.address}`} className="tape-item">
                  <TokenLogo symbol={coin.symbol} size={16} />
                  <span className="tape-symbol">${coin.symbol}</span>
                  <span className="num text-[var(--muted)]">{formatUsd(coin.marketCap)}</span>
                  <span className={coin.change1h >= 0 ? "up" : "down"}>
                    {coin.change1h >= 0 ? "+" : ""}
                    {coin.change1h.toFixed(1)}%
                  </span>
                </Link>
              ))}
            </div>
          </div>
          <div className="top-actions">
            <Link href="/create" className="create-fab" title="Create coin" aria-label="Create coin">
              <PlusIcon size={16} />
            </Link>
            <button type="button" className={`connect ${connected ? "on" : ""}`} onClick={connected ? disconnect : connect}>
              {connected ? shortAddress(address) : "Connect"}
            </button>
          </div>
        </header>
        <main className="content">
          <RouteTransition>{children}</RouteTransition>
        </main>
      </div>
      <nav className="tabbar">
        {[...links, { href: "/account", label: "Account" }].map((link) => (
          <Link key={link.href} href={link.href} className={isActive(pathname, link.href) ? "active" : ""}>
            <NavIcon name={link.label} size={26} />
            {link.label === "Leaderboard" ? "Board" : link.label === "Lucky Boxes" ? "Boxes" : link.label}
          </Link>
        ))}
      </nav>
      {searchMounted ? (
        <ShellSearchModal
          query={query}
          setQuery={setQuery}
          searchVisible={searchVisible}
          dialogRef={dialogRef}
          onClose={closeSearch}
          onSubmit={search}
          sortBy={sortBy}
          setSortBy={setSortBy}
          age={age}
          setAge={setAge}
          phase={phase}
          setPhase={setPhase}
          category={category}
          setCategory={setCategory}
          page={page}
          setPage={setPage}
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
        />
      ) : null}
    </div>
  );
}

function CreatorClaim({
  address,
  claimed,
  ethUsd,
  onClaim,
}: {
  address: string;
  claimed: boolean;
  ethUsd: number;
  onClaim: () => void;
}) {
  const { data: mine } = useAsyncData(() => getCreatorLaunches(address), [address], {
    initial: [] as LaunchWithStats[],
    enabled: Boolean(address),
  });
  if (mine.length === 0) return null;
  const total = mine.reduce((sum, launch) => sum + creatorFeeEth(launch, ethUsd), 0);

  return (
    <section className="creator-claim" aria-label="Creator fee">
      <div>
        <span>Creator fee</span>
        <strong>{formatEth(total)}</strong>
        <em>
          {mine.length} {mine.length === 1 ? "token" : "tokens"}
        </em>
      </div>
      <button type="button" disabled={claimed || total <= 0} onClick={onClaim}>
        {claimed ? "Claimed" : "Claim"}
      </button>
    </section>
  );
}
