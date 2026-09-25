import Link from "next/link";

const sections = [
  {
    title: "What LOOTING is",
    paragraphs: [
      "LOOTING is a Robinhood Chain launchpad where every qualified trade can contribute to a verifiable reward economy. Creators launch from the LOOTING UI. Token creation, bonding-curve trading, and graduation run on public Pons V2 infrastructure. LOOTING owns discovery, Season XP, Lucky Boxes, and the reward experience on top.",
      "Tokens stay tradable through LOOTING and other Robinhood Chain venues. Identity is the wallet address. There is no username layer in front of XP, boxes, or the leaderboard.",
    ],
  },
  {
    title: "How it works",
    paragraphs: [
      "A creator launches a coin. Buyers trade it on the curve, then anywhere the market lists it after graduation. LOOTING indexes qualifying buys, awards Season XP, and creates one Lucky Box per qualifying buy.",
      "The box stays sealed while the wallet still holds the position. After the exit, the box can be opened. Weekly tier climbs from Bronze to Silver to Gold, and better tiers improve Lucky Box odds. Rewards can include LOOTING, tokenized stocks or RWA assets, or no reward, depending on the season table.",
    ],
    points: [
      "Launch on LOOTING → curve on Pons V2",
      "Trade anywhere on Robinhood Chain",
      "Qualifying buy → XP + one Lucky Box",
      "Exit the position → box becomes openable",
      "Higher weekly tier → better odds",
    ],
  },
  {
    title: "For creators",
    paragraphs: [
      "Use Launch to publish a coin with name, ticker, artwork, and socials. Set creator tax, the Lucky Box cut of that tax, the quote pair, and optional extras such as holder fee sharing, exemptions, and an initial buy.",
      "Fees accrue from trading activity on that coin. Creators claim their share; the configured slice funds Lucky Boxes for traders who actually bought and exited.",
    ],
  },
  {
    title: "For traders",
    paragraphs: [
      "Explore finds new pairs, coins near graduation, movers, and graduated markets. Search by name, ticker, or address. Open a coin to trade the curve, track fees, and follow progress toward graduation.",
      "Connect a wallet to earn Season XP, unlock Lucky Boxes after you exit, climb the leaderboard, and claim rewards. A wallet that never bought a LOOTING-launched coin is not eligible for boxes.",
    ],
  },
  {
    title: "Fees and Lucky Boxes",
    paragraphs: [
      "Each launch sets its own creator tax and Lucky Box allocation. Boxes are funded from that coin’s tax share, not from a global drop. Eligibility is wallet-based and trade-based: buy, then exit, then open.",
      "Season 01 scores wallets. Bronze starts at 0 XP, Silver at 1,000, Gold at 5,000. Account shows your season bar; the leaderboard ranks the season.",
    ],
  },
  {
    title: "What LOOTING is not",
    paragraphs: [
      "LOOTING is not a Pons fork, not a wallet, and not a guarantee of token returns. It does not manufacture wash volume. Pons handles launch and trading rails; LOOTING adds the reward layer and the product surface around it.",
    ],
  },
];

export default function DocsPage() {
  return (
    <div className="doc-page">
      <div className="page-head">
        <div>
          <h1 className="explore-title">Docs</h1>
          <p className="page-note">Introduction to LOOTING on Robinhood Chain.</p>
        </div>
        <div className="doc-actions">
          <Link href="/docs/guide" className="claim-btn">
            Detailed docs
          </Link>
          <Link href="/create" className="doc-secondary">
            Launch a coin
          </Link>
        </div>
      </div>
      {sections.map((section) => (
        <section key={section.title} className="sheet doc-block">
          <h2>{section.title}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {section.points ? (
            <ul>
              {section.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
      <section className="sheet doc-block doc-cta">
        <h2>Go deeper</h2>
        <p>Step-by-step product guide for Explore, Launch, Lucky Boxes, Season XP, Analytics, and fees.</p>
        <div className="doc-actions">
          <Link href="/docs/guide" className="claim-btn">
            Detailed docs
          </Link>
          <Link href="/litepaper" className="doc-secondary">
            Litepaper
          </Link>
        </div>
      </section>
    </div>
  );
}
