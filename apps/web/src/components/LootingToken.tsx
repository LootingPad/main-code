"use client";

import Link from "next/link";
import { PageInfo } from "./PageInfo";
import { TokenLogo } from "./TokenLogo";

/** $LOOTING hub — honest empty until CA + fee→burn path are live. No seed numbers. */
export function LootingToken() {
  return (
    <div className="looting-token-page">
      <section className="sheet looting-token-hero">
        <div className="looting-token-hero-copy">
          <span className="looting-token-kicker">Protocol token</span>
          <div className="looting-token-hero-meta">
            <TokenLogo symbol="LOOTING" size={56} />
            <span className="looting-ca-badge" title="Contract address not published yet">
              <em>CA</em>
              <code>—</code>
            </span>
          </div>
          <div className="page-title-row">
            <h1>$LOOTING</h1>
            <PageInfo
              tip="Burn share from creator tax on LOOTING launches settles here once the token CA and fee router are live. Charts and ledger stay empty until then — no placeholder figures."
              label="About $LOOTING"
            />
          </div>
          <div className="looting-token-hero-actions">
            <Link href="/" className="claim-btn claim-all">
              Explore launches
            </Link>
            <Link href="/docs" className="looting-hero-secondary">
              Read the docs
            </Link>
          </div>
        </div>
        <dl className="looting-token-kpis">
          <div>
            <dt>Price</dt>
            <dd>—</dd>
          </div>
          <div>
            <dt>Market cap</dt>
            <dd>—</dd>
          </div>
          <div>
            <dt>Burned</dt>
            <dd>—</dd>
          </div>
          <div>
            <dt>24h volume</dt>
            <dd>—</dd>
          </div>
        </dl>
      </section>

      <section className="sheet looting-token-empty">
        <div className="page-title-row">
          <h2>Live burn ledger</h2>
          <PageInfo
            tip="Fee → burn settlements will index here after the RewardRouter and $LOOTING CA ship. Until then this page is intentionally blank rather than mocked."
            label="Burn ledger"
          />
        </div>
        <ul className="looting-token-checklist">
          <li>Publish $LOOTING contract address</li>
          <li>Route protocol burn share on-chain</li>
          <li>Index burn txs into this ledger</li>
        </ul>
      </section>
    </div>
  );
}
