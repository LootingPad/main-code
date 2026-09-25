import Link from "next/link";

const sections = [
  {
    title: "Connect a wallet",
    paragraphs: [
      "Use Connect in the header. LOOTING does not create a username or a profile login. The address you connect is the identity for Season XP, Lucky Boxes, trades, and the leaderboard.",
      "Disconnect from the same button. Account, boxes, and your rank card only appear while that wallet is connected. Refreshing the page starts disconnected until you connect again.",
    ],
    points: [
      "The header button shows a short address once connected.",
      "Account explains the empty state and offers Connect if nothing is linked.",
      "Lucky Boxes asks you to connect before it can check eligibility.",
    ],
  },
  {
    title: "Explore",
    paragraphs: [
      "Explore is the market. A moving tape in the header, between search and Connect, repeats live coins with symbol, market cap, and the 1 hour change. Below that, switch the list between table and grid.",
      "Filters are New Pair, Almost Graduate, Migrate, Movers, and Trending. On the right, a time window runs Latest, 5 minutes, 1 hour, 6 hours, 24 hours, and 48 hours. Table columns are coin, chart, market cap, all-time high, age, transactions, 24 hour volume, the box figure, and the 1 hour and 24 hour move.",
    ],
  },
  {
    title: "Search",
    paragraphs: [
      "Click the header field or press Ctrl or Cmd + K. The dialog searches name, ticker, and contract address. The shortcut badge sits inside the field.",
      "Sort by relevance, market cap, volume, newest, or oldest. Age can be all, 24 hours, or 7 days. Phase can be all, still on the curve, or graduated. Eight results show at a time, with previous and next under the list.",
      "Choosing a row opens that coin. Submitting the field sends you to Explore with the query applied.",
    ],
  },
  {
    title: "Launch a coin",
    paragraphs: [
      "Launch is the create form. You set the coin, its links, the creator tax, the Lucky Box cut, the quote pair, and optional extras before the coin goes on the curve.",
    ],
    points: [
      "Name is 32 characters. Letters, numbers, and spaces. The description cannot contain a URL.",
      "Ticker, description, X, Telegram, Discord, and Farcaster are on the form. A leading @ on X is stripped.",
      "Creator tax presets are 1%, 2%, and 3%. Custom tax is allowed from 0.5% to 5%, in 0.1% steps.",
      "Lucky Boxes must receive at least 0.5% of that tax. The slider stops at the tax you set, so the box cut can never be larger than the tax.",
      "Turn holder share on if holders should claim the remainder from their profile. Leave it off and that remainder goes to the creator wallet. Boxes still take their cut in both cases.",
      "Pair is what buyers spend. ETH is the default. Stock quotes are NVDA, AAPL, TSLA, SPY, AMZN, META, GOOGL, MSFT, and COIN. The coin graduates in that same pair.",
      "Up to 8 wallet addresses can be exempt. Duplicates are rejected. An initial buy is optional.",
    ],
  },
  {
    title: "The coin page",
    paragraphs: [
      "Open a coin from Explore, search, or the tape. The page is that one launch: price, market cap, curve progress, volume, traders, and how fees are splitting between the creator side and the Lucky Box pool.",
      "While progress is under 100% the coin is still on the curve. At graduation it keeps the quote asset from launch and shows as graduated everywhere else in the app.",
    ],
  },
  {
    title: "Trade on the curve",
    paragraphs: [
      "Buys and sells move price and market cap along the curve. The trade is recorded against the connected wallet.",
      "Account lists those fills after you connect: buy or sell, token, token amount, ETH, and how long ago. Select a row to jump back to that coin.",
    ],
  },
  {
    title: "Lucky Boxes",
    paragraphs: [
      "A box belongs to one wallet and one coin. It is funded from the Lucky Box share of that coin’s creator tax. It is not a reward for merely holding the site open.",
      "The box stays sealed while you are still in the position. It becomes ready after you exit. If the wallet never bought the coin, the box is not eligible.",
    ],
    points: [
      "Ready: you can open it.",
      "In market: you still hold the position, so the box waits.",
      "Claimed: the reward is revealed and a transaction reference is kept.",
      "Not eligible: that wallet did not buy the launch.",
      "A revealed reward can be saved as a share card.",
    ],
  },
  {
    title: "Season XP",
    paragraphs: [
      "Season 01 scores the wallet. There is no second score for a username. Trades add XP. Account shows the season total, a bar toward the next tier, lifetime XP, box count, trade count, and rewards.",
      "Bronze is the start. Silver begins at 1,000 XP. Gold begins at 5,000 XP and is the top of the bar. The label next to the bar names the next tier, or Top tier once you are Gold.",
    ],
  },
  {
    title: "Leaderboard",
    paragraphs: [
      "The board sorts wallets by Season XP and shows tier, trades, and rewards. Twenty rows fill a page, then previous, page numbers, and next.",
      "Ranks 1, 2, and 3 keep gold, silver, and bronze trophies even when you leave page 1. A connected wallet that is on the board gets a card with its global rank. That card jumps to the page where the wallet sits, and the row is tagged You.",
    ],
  },
  {
    title: "Analytics",
    paragraphs: [
      "Analytics is the season total, not one wallet. It covers volume, launch count, and traders, then the creator-fee split and staking by lock: Flexible, 30 days, and 90 days.",
      "Three daily charts follow: volume, new launches, and staking. The bars are the season histogram. Hover or focus a bar to read the amount and the date. Range can be 24 hours or all time.",
    ],
  },
  {
    title: "Fees, in short",
    paragraphs: [
      "The tax you set is the creator tax. Accrued fee on a coin is estimated from its market cap, that tax, and curve progress. Of the accrued fee, 80% stays on the creator side and 20% is the protocol burn share, shown in LOOTING.",
      "The creator side is what the launch form splits. Lucky Boxes take their configured cut of the tax, at least 0.5%. The rest is either the creator wallet or the holder claim. If the connected wallet created a coin, a claim card appears above Explore and totals those creator fees.",
    ],
  },
  {
    title: "Graduation",
    paragraphs: [
      "Clearing the curve graduates the coin into the quote pair from launch. It does not mint a new set of rules. Explore lists it under Migrate. Search can filter to graduated only.",
      "On Pons V2, second-zero buys in the launch window start with a 99% snipe tax that falls in a straight line to 0% over 3 seconds. Box eligibility is unchanged: bought the coin, then exited.",
    ],
  },
];

export default function DocsGuidePage() {
  return (
    <div className="doc-page">
      <div className="page-head">
        <div>
          <p className="doc-back">
            <Link href="/docs">← Docs</Link>
          </p>
          <h1 className="explore-title">Detailed docs</h1>
          <p className="page-note">How to launch, trade, earn Season XP, and open Lucky Boxes.</p>
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
    </div>
  );
}
