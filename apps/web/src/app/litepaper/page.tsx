import { PageTitle } from "@/components/PageInfo";

const sections = [
  {
    title: "What LOOTING is",
    paragraphs: [
      "LOOTING is a fair-launch pad on Robinhood Chain. A coin does not start on an open pool. It starts on a bonding curve, trades there until the curve is full, then graduates into the quote asset chosen by the creator.",
      "The second piece is the Lucky Box. A slice of the creator tax is reserved for boxes. A wallet that actually traded the coin can open its box after it exits. Wallets that never bought are left out.",
      "Identity is the wallet. Season XP, rank, trade history, and boxes all hang off that address. There is no account layer in front of it.",
    ],
  },
  {
    title: "Why a curve",
    paragraphs: [
      "The curve is the price while the coin is young. A buy lifts price and market cap. A sell pulls them down. Progress on the coin page is the distance left before graduation, not a separate score.",
      "That keeps the launch in one place: Explore can show who is new, who is close to graduating, who already migrated, who is moving, and who is trending, without mixing those states together.",
    ],
  },
  {
    title: "Creator tax",
    paragraphs: [
      "The creator picks the tax at launch and cannot hide it. Presets are 1%, 2%, and 3%. A custom rate is allowed from 0.5% to 5% in tenths of a percent.",
      "Analytics estimates accrued fees from market cap, the tax rate, and a weight that rises as the curve fills. Of that accrued fee, 80% remains on the creator side and 20% is the protocol burn share, displayed in LOOTING tokens.",
    ],
    points: [
      "The 80% is not the creator’s take-home by itself. It is the pool the launch form splits.",
      "The 20% burn share is separate from the Lucky Box cut.",
      "The tax is fixed on the coin. Later trades use the rate from launch.",
    ],
  },
  {
    title: "How the tax is split",
    paragraphs: [
      "Inside the creator side, the creator sets a Lucky Box share. The floor is 0.5% of the creator tax. The ceiling is the tax itself, so boxes can take the whole tax but never more than it.",
      "Whatever is left can go to the creator wallet, or be switched to holders. Holders claim that share from their profile. Turning holder share on does not shrink the box cut. The launch form shows both numbers and a rough box amount per $100k of volume.",
    ],
  },
  {
    title: "Lucky Boxes",
    paragraphs: [
      "A box is a reward tied to a trade, not a site-wide drop. One coin, one wallet. The pool that pays it is the box share of that coin’s tax.",
      "Timing matters. While the wallet is still in the position, the box is in the market and stays sealed. After the exit, it is ready to open. Opening it reveals the reward. A claimed box keeps that reward and a transaction reference, and the reward can be saved as a share card.",
      "A wallet that never bought the coin is not eligible. Filtering on the Lucky Boxes page is Ready, In market, Claimed, and Not eligible.",
    ],
  },
  {
    title: "Season 01",
    paragraphs: [
      "The season scores wallets. Trades add Season XP. The leaderboard orders those wallets and shows tier, trade count, and rewards. Twenty wallets are on each page. Ranks 1, 2, and 3 keep trophies on every page, because rank is global, not restarted per page.",
      "Account is the same score for the connected wallet: season XP, the bar to the next tier, lifetime XP, boxes, trades, and rewards. Bronze is the base. Silver starts at 1,000 XP. Gold starts at 5,000 XP. Gold fills the bar and is marked Top tier.",
      "If the connected wallet is on the board, its card shows the global rank and jumps to that page. The row is marked You.",
    ],
  },
  {
    title: "Quote asset",
    paragraphs: [
      "Buyers spend the pair chosen at launch. ETH is the default quote. The creator can instead quote a stock ticker: NVDA, AAPL, TSLA, SPY, AMZN, META, GOOGL, MSFT, or COIN.",
      "That choice is the graduation market too. The coin does not switch quote assets when the curve ends.",
    ],
  },
  {
    title: "Graduation",
    paragraphs: [
      "A full curve migrates the coin. It stays listed, now as graduated, and keeps trading in the launch pair. Search can isolate that phase. Explore’s Migrate filter is the same set.",
      "The first moments on Pons V2 use a launch window. A snipe tax on second-zero buys starts at 99% and decays in a straight line to 0% over 3 seconds. After that window the tax is gone. Lucky Box rules are not part of that window: they still depend on buying the coin and then exiting.",
    ],
  },
  {
    title: "Exemptions and the first buy",
    paragraphs: [
      "A creator can list up to 8 wallet addresses as exempt at launch. The same address cannot be added twice.",
      "An initial buy is optional. It is set on the form before the coin is created, so the creator can take the first position on their own curve.",
    ],
  },
  {
    title: "Where each number lives",
    paragraphs: [
      "Explore is the whole market. The coin page is one launch. Account is one wallet. Lucky Boxes are that wallet’s rewards. The leaderboard is the season ranking. Analytics is the season sum: volume, launches, traders, and the fee split between creators and boxes.",
      "Search reaches any of the coins by name, ticker, or address, then sorts by relevance, market cap, volume, newest, or oldest, and filters by age and by curve versus graduated.",
    ],
  },
];

export default function LitepaperPage() {
  return (
    <div className="doc-page">
      <div className="page-head">
        <PageTitle tip="How launches, fees, Lucky Boxes, and Season XP fit together.">Litepaper</PageTitle>
      </div>
      {sections.map((section) => (
        <section key={section.title} className="sheet doc-block">
          <h2>{section.title}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {"points" in section && section.points ? (
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
