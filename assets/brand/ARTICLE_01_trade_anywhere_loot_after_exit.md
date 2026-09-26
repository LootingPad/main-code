# Trade Anywhere. Loot After Exit.

**How LOOTING turns every qualified trade into a season — without trapping you in one website**

---

You bought the coin on a terminal.  
You flipped it on a bot.  
You never opened the launchpad again.

On most pads, that means your “points season” never happened. Loyalty is gated behind *their* UI. Rewards either trap you on-site, drip forever for holding, or feel like a casino sticker on a bonding curve.

That is the gap LOOTING is built to close.

**LOOTING** is a Robinhood Chain launchpad where launches run on public **Pons V2** rails — and where LOOTING owns what comes after: discovery, Terminal UX, Season XP, Lucky Boxes, Dev Lock, public staking, and analytics.

> **Every qualified trade anywhere can contribute to a verifiable reward economy.**  
> Buy → XP + Lucky Box → exit → open loot.  
> Better weekly tier, better odds. Rewards can be LOOTING, tokenized stocks, or RWAs.

Not another “Pump on [chain].”  
Not hold-to-farm theater.  
**Trade anywhere. Loot after exit.**

---

## The problem with launchpad loyalty

Fair launch and bonding curves are table stakes now. Solana, BNB, Base, TRON, Avalanche — the pattern is familiar: mint fast, trade the curve, graduate, move on.

What most pads still get wrong:

1. **UI-locked rewards** — points only count if you traded through *their* button. Real traders live on GMGN, Axiom, Trojan, aggregators, bots.
2. **Hold-farm “loyalty”** — rewards for sitting still invent conviction that isn’t there.
3. **Issuance as flex** — thousands of mints/day is not product success. Retention and real loops are.
4. **Trust as a tweet** — “we won’t rug” with nothing on-chain to look at.

LOOTING starts from a different bet: **reward the completed trade loop**, and make eligibility follow the **wallet on-chain** — not the website session.

---

## The split: rails vs loot

On Robinhood Chain, infrastructure and product layer can be separate.

| Layer | Who | What |
|-------|-----|------|
| **Launch rails** | Pons V2 | Token creation, bonding curve, graduation, market plumbing |
| **Product layer** | LOOTING | Explore, Token Terminal, Season XP, Lucky Boxes, Dev Lock, staking vaults, Analytics, Account |

We are **not** a Pons fork. We are **not** trying to replace the factory.  
Pons runs the rails. **LOOTING owns the loot.**

That split is the product.

---

## A day in the loot loop (concrete)

Imagine wallet `0xRaider` on Season 01.

**Morning — launch**  
A creator ships `$ABC` from LOOTING. They set creator tax (e.g. 1%), route part of that tax to the Lucky Box pool (floor: at least **0.5% of creator tax**), pick a quote — ETH or a stock/RWA ticker like NVDA, AAPL, TSLA, SPY — and optionally enable holder fee share. They can Dev Lock supply and/or open a public staking vault later.

**Midday — trade anywhere**  
`0xRaider` buys `$ABC` on a terminal that isn’t LOOTING. The buy is still a qualifying on-chain BUY of a LOOTING-launched token.

What LOOTING does:

- indexes the activity  
- awards **Season XP**  
- creates **Lucky Box #1** for that wallet + coin  

Status of the box: **in market — cannot open yet.**

**Afternoon — second buy**  
Another qualifying buy → **Lucky Box #2**. Still holding → both boxes stay locked.  
A sell that only trims size does **not** unlock. A sell does **not** create a new box. Transfers don’t move boxes to someone else.

**Evening — exit**  
`0xRaider` fully exits `$ABC`. Now both boxes become **openable**.

**Night — season**  
Account shows season XP, tier bar, box count.  
Bronze (0–999) → Silver (1,000–4,999) → Gold (5,000+). Higher tier, better configured odds. Open a box: LOOTING, stock/RWA, or empty — per the reward table and treasury budget.

That’s the loop. Not “camp our homepage.” Not “never sell or you lose the airdrop.” **Complete the raid. Unlock the haul.**

```text
Creator launches on LOOTING (Pons V2)
        ↓
Token trades anywhere on Robinhood Chain
        ↓
LOOTING indexes qualifying BUY
        ↓
XP + one Lucky Box per qualifying buy
        ↓
Wallet exits the position
        ↓
Box openable → tiered odds → LOOTING / stock / RWA / empty
```

---

## Trade anywhere (for real)

Eligibility is **chain-based**, not website-based.

A qualifying BUY can originate from:

- LOOTING Token Terminal  
- GMGN  
- Axiom  
- Trojan  
- DEX UI / aggregator  
- supported trading bots  

…as long as it resolves to a qualifying on-chain BUY of a token in the LOOTING launch registry.

Identity is:

```text
chain_id + wallet_address
```

No email profile. No username season. Leaderboard and XP follow the address.

If you never bought a LOOTING-launched token, you are **not eligible**. That is intentional — loot is for traders in the loop, not spectators.

---

## What funds Lucky Boxes

Boxes are not a random treasury sprinkle.

Each launch stores its own reward allocation (per-token config — not one global hardcoded %). Creators choose tax in product limits (presets like 1% / 2% / 3%, or custom bands). Of the **creator-side** pool, they split between:

- **Lucky Box cut** (minimum **0.5% of creator tax**; never larger than the tax)  
- **Remainder** → creator wallet **or** holder claim (if enabled)

Example (illustrative, not a promise):

```text
Creator tax = 1.00%
Creator share 80% · Lucky Box share 20%
→ Lucky Box treasury take ≈ 0.20% of tax flow on that launch
```

Another creator can weight boxes heavier (e.g. 50/50 of the creator-side split). Traders can see how fees lean on the coin Terminal.

**Honesty rules we will not hide:**

- Empty boxes are possible  
- Odds improve with tier and are calibrated to treasury budget  
- Opening consumes the box  
- We do not market this as a casino or a guaranteed yield product  

When a box resolves to LOOTING, the reward path can swap and deliver LOOTING on-chain to the winner. Stock/RWA prizes are a different payload class from **quote pairs** at launch (you might *trade* `$ABC` against NVDA as quote, and separately *win* a stock/RWA prize from a box — two different roles).

---

## Creators: launch with skin in the game

From the launch form, creators can:

- Ship metadata + socials under product rules  
- Set tax + Lucky Box cut + quote (ETH or stock/RWA tickers)  
- Optional initial buy, exempt wallets, holder fee share  
- **Dev Lock / vest** launch supply and share a lock card  
- **Create Staking** — publish a public vault/event with its own reward pool, lock options, and end date (not limited to the original creator)

Dev Lock is an **accountability signal**, not a “safe launch” stamp. We will never sell it as rug-proof.

Staking page: browse **Events**, manage your **Positions**. Vaults are public — anyone can fund an event for a LOOTING-launched coin.

---

## Product surfaces (where the season lives)

You should not need five tabs to understand the season:

| Surface | Job |
|---------|-----|
| **Explore** | New pairs, movers, trending, almost graduate, migrate |
| **Token Terminal** | Per-coin curve / post-grad trading, fees, box economy |
| **Lucky Boxes / Rewards** | Boxes tied to wallet + coin; open after exit |
| **Account** | Season XP, tier bar, lifetime XP, box & trade counts |
| **Leaderboard** | Wallet ranks — Season XP, not usernames |
| **Staking** | Public Events + your Positions |
| **Dev Lock** | Lock/vest + shareable proof |
| **Analytics** | Season totals across launches, vaults, locks |

Stay for the Terminal. Leave for your favorite bot. **The loop still counts.**

---

## How we differ (without flame wars)

| Crowded launchpad claim | LOOTING |
|-------------------------|---------|
| Fair launch / bonding curve | Necessary, not the headline |
| “Pump on [this chain]” | Robinhood Chain + loot economy |
| Points only on our site | Trade anywhere → still eligible |
| Hold to earn stocks / points | **Exit to unlock** Lucky Boxes |
| Creator fees only | Fees + box cut + Dev Lock + public vaults |
| Mint-count flex | Optimize for real trades & retention, not wash volume |

Closest category confusion is “stock meme” pads that pay for **holding**. LOOTING’s stock story is different: stock/RWA as **quotes and prizes**, loot tied to a **completed trade loop**.

---

## Season 01 — wallets, not accounts

Season XP is scored on the wallet. Thresholds (configurable per season; Season 01 baseline):

| Tier | Season XP | Odds |
|------|-----------|------|
| Bronze | 0–999 | Base |
| Silver | 1,000–4,999 | Improved |
| Gold | 5,000+ | Best |

Climb the ladder. Improve the odds. Open loot after exit.

---

## What LOOTING is not

Say it plainly:

- Not a Pons fork or Pons replacement  
- Not a wallet or CEX  
- Not a guarantee of token returns or box value  
- Not a fake-volume farm  
- Not hold-to-farm loyalty cosplay  
- Not a casino brand — no “jackpot,” no “guaranteed win”

We design for **on-chain truth**, **anti-abuse before growth**, and **retention over inflated screenshots**.

---

## Why this matters now

Robinhood Chain put stock-aware memes and RWA-shaped assets into the same conversation as fair launches. The market doesn’t need a fifteenth clone of the same bonding-curve homepage.

It needs a pad that admits how traders actually move — across venues — and still gives them a season worth climbing.

That’s LOOTING.

**Pons runs the rails. LOOTING owns the loot.**

---

## Start the loop

1. Open [lootingpad.com](https://lootingpad.com)  
2. Connect the wallet (that address *is* your season)  
3. Explore a launch — or create one with a Lucky Box cut and optional Dev Lock  
4. Trade where you already trade  
5. Exit → open boxes → check Account / Leaderboard  

Telegram: [t.me/lootingpad](https://t.me/lootingpad)

**Trade anywhere. Loot after exit.**

---

*Trading involves risk. Lucky Boxes and seasons follow on-chain eligibility and configured reward tables. Examples in this article are illustrative. Nothing here is financial advice.*

---

### Publish kit

| | |
|--|--|
| **Title** | Trade Anywhere. Loot After Exit. |
| **Deck** | How LOOTING turns every qualified trade into a season — without trapping you in one website |
| **Hero** | `assets/brand/looting-x-banner-with-copy.png` |
| **Length** | ~1,600–1,800 words (skim + depth) |

**X teaser:**
```text
You bought on a terminal.
You never opened the pad again.

On most platforms, your season never happened.

LOOTING: trade anywhere → XP + Lucky Box → exit → unlock loot.

New article ↓
lootingpad.com
```

**Alt teaser (shorter):**
```text
Not hold-to-farm.
Trade-to-loot.

How LOOTING works — full article:
lootingpad.com
```
