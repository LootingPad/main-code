# LOOTING — Product & Technical Specification.

#add test

> **Status:** Product Architecture Draft v1.3  
> **Primary chain:** Robinhood Chain  
> **Launch engine:** Pons V2 Factory (external dependency; no partnership assumed)  
> **Product:** Token launchpad + on-chain trading activity rewards + Lucky Box + LOOTING/Stock-token rewards + public token staking vaults + Dev Lock + public Analytics  
> **v1.3 note:** Adds deploy-ready contract specs for Dev Lock and Staking vaults (structs, entrypoints, accounting, events) aligned to the shipped UI so contracts can be implemented from this document + the web app.  
> **v1.2 note:** Staking is vault-based — Create Staking publishes a new public vault per event; the Staking page lists Events and wallet Positions.  
> **v1.1 note:** Aligns the spec with shipped product surfaces (Explore, Token Terminal, Account, Staking, Dev Lock, Analytics, Docs/Litepaper) and launch-economics details already present in the UI.

---

## 1. Executive Summary

LOOTING is a Robinhood Chain launchpad whose token launches are created through the public Pons V2 launch infrastructure while LOOTING adds its own product layer on top:

1. Creators launch tokens from the LOOTING UI.
2. LOOTING uses Pons V2 Factory for token creation, bonding-curve trading, graduation, and Pons-compatible market discovery.
3. Tokens remain tradable through external interfaces such as GMGN, Axiom, Trojan, DEX aggregators, and other Robinhood Chain venues.
4. LOOTING independently indexes on-chain BUY/SELL activity for LOOTING-launched tokens.
5. A qualifying BUY of a LOOTING-launched token awards XP and creates one Lucky Box. The box can be opened only after that wallet has exited the position. A wallet that never bought a LOOTING-launched token is not eligible.
6. XP deterlootings the user's weekly tier: Bronze, Silver, or Gold.
7. Lucky Box odds improve with tier.
8. Lucky Boxes can contain LOOTING, tokenized stocks/RWA assets, or no reward depending on the configured reward table.
9. When a Lucky Box contains LOOTING, the reward contract can execute an on-chain swap and send LOOTING to the winner.
10. The reward system is designed to create a genuine reward-driven demand loop around LOOTING without relying on artificial volume generation.
11. Anyone can create a **staking vault** for a LOOTING-launched coin (Create Staking). Each create publishes a new public vault/event with its own reward pool, lock options, and end date.
12. The public Staking page lists open vaults (Events) and the connected wallet’s stakes (Positions).
13. Creators can lock or vest supply of coins they launched (Dev Lock) to signal commitment.
14. Public Analytics and Token Terminal pages make season activity and per-coin trading visible inside LOOTING without requiring the user to leave the product.

The core strategic idea is:

**Pons handles launch/trading infrastructure. LOOTING owns discovery, trading UX, reward economics, XP, Lucky Boxes, staking vaults, Dev Lock, and the user experience.**

---

## 2. Product Positioning

### Product statement

> **LOOTING is a launchpad where every qualified trade can contribute to a verifiable reward economy.**

### Core loop

```text
Creator launches token
        ↓
Pons V2 launch infrastructure
        ↓
Token trades anywhere on Robinhood Chain
        ↓
LOOTING indexes qualifying BUY activity
        ↓
Wallet earns XP + one Lucky Box per qualifying buy
        ↓
Wallet exits the position
        ↓
The box becomes openable
        ↓
Weekly tier increases
Bronze → Silver → Gold
        ↓
Better Lucky Box odds
        ↓
LOOTING / Stock / RWA rewards
        ↓
Reward demand feeds LOOTING utility
```

### What LOOTING is NOT

- Not a Pons fork.
- Not a replacement for Pons V2 Factory.
- Not a wallet.
- Not a centralized trading venue.
- Not a guarantee of token returns.
- Not a system designed to manufacture fake volume.

---

## 3. Key Product Principles

### 3.1 On-chain truth

Eligibility, claims, reward payouts, and important configuration must ultimately be verifiable from blockchain state or cryptographically verifiable data.

### 3.2 Trade anywhere

A user should not have to trade through the LOOTING website after a token is launched. A qualifying purchase should be recognized whether it occurs through LOOTING, GMGN, Axiom, Trojan, a DEX interface, or another supported routing path, provided the transaction resolves to a qualifying on-chain BUY.

### 3.3 Reward ownership is wallet-based

LOOTING should not require a traditional account to deterlooting XP. The primary identity is the wallet address.

### 3.4 Reward logic must be deterministic + auditable

The user can see why they received a box, how their tier was calculated, and which reward table was used.

### 3.5 Anti-abuse before growth

XP, Lucky Boxes, and reward treasury value are financial incentives. Sybil resistance, wash-trading controls, replay protection, reorg handling, and claim safety are first-class requirements.

### 3.6 Do not confuse trading volume with product success

LOOTING should optimize for legitimate trading activity, user retention, and reward engagement—not artificially inflated volume.

---

## 4. User Types

### Creator

Launches a token using LOOTING's launch UI and Pons V2 infrastructure.

Primary goals:
- Create token quickly.
- Configure creator tax, Lucky Box cut, quote pair, and optional holder fee share.
- Claim creator fees when the launch routes fees to the creator wallet.
- Lock or vest creator supply via Dev Lock.
- Optionally create a public staking vault for the launched coin (Create Staking).
- Track launch performance on the coin Terminal and Analytics.

### Trader / Holder

Trades LOOTING-launched tokens anywhere on Robinhood Chain, including through the LOOTING Token Terminal.

Primary goals:
- Discover new launches on Explore and via global search.
- Trade on the curve or after graduation from the Terminal.
- Earn XP and unlock Lucky Boxes.
- Improve weekly tier and climb the leaderboard.
- Receive LOOTING/Stock/RWA rewards.
- Browse public staking Events and stake into token vaults; manage Positions.
- Create staking vaults for LOOTING-launched coins (not limited to the token’s original creator).
- Claim holder fee share when a launch enables it.

### Reward Operator / Protocol Admin

Manages reward pools, verified token lists, oracle/integration configuration, emergency pause controls, and seasonal parameters.

### Indexer / Keeper

Observes blockchain events, handles confirmations/finality, derives trade events, computes XP, and prepares reward eligibility.

---

## 5. Launch Architecture

### High-level

```text
                ┌─────────────────────┐
                │     LOOTING Frontend   │
                └──────────┬──────────┘
                           │ launchToken()
                           ▼
                ┌─────────────────────┐
                │    Pons V2 Factory  │
                └──────────┬──────────┘
                           │
                  deploy token + curve
                           │
                           ▼
                ┌─────────────────────┐
                │ Pons V2 Bonding     │
                │ Curve / V4 Pool     │
                └──────────┬──────────┘
                           │
                 trading via any UI
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
      LOOTING UI            GMGN              Axiom/Trojan
        │                  │                  │
        └──────────────────┼──────────────────┘
                           ▼
                 Robinhood Chain
                           │
                           ▼
                    LOOTING Indexer
```

### Pons integration assumptions

The current Pons V2 source shows:

- public `launchToken()` entrypoints;
- creator-defined `creatorFeeRecipient`;
- creator tax separate from the shared protocol fee split;
- claim-based creator fee escrow;
- Pons V2 bonding curve before graduation;
- Uniswap V4 pool after graduation;
- launch gating through an enabled flag or launcher whitelist.

These are external-system assumptions and must be verified against the deployed Robinhood Chain addresses before production.

### Critical Pons dependency

Pons currently contains protocol-owner powers that can propose a creator-fee-recipient override after a timelock. Therefore:

**LOOTING must treat the Pons fee recipient as an external trust/dependency boundary.**

LOOTING must not claim that the Lucky Box fee split is permanently immutable unless the deployed Pons version and its governance controls prove that property.

---

## 6. Creator Fee / Lucky Box Economics

### Desired creator model

The creator chooses a creator-tax setting within Pons-supported limits. Product UI constraints (examples; tunable):

- Tax presets: **1% / 2% / 3%**
- Custom tax: **0.5%–5%** in **0.1%** steps
- Lucky Box floor: **at least 0.5% of creator tax**; the box cut can never exceed the tax

Example values below are configurable examples, NOT protocol constants:

```text
Creator tax = 1.00%

Creator share        80%
Lucky Box share      20%

Effective split of tax:
Creator side         0.80%
Lucky Box Treasury   0.20%
```

Another creator may choose:

```text
Creator tax = 1.00%

Creator share        50%
Lucky Box share      50%

Effective split of tax:
Creator side         0.50%
Lucky Box Treasury   0.50%
```

### Protocol burn vs creator-side pool

Accrued creator tax on a launch is estimated from market activity (product display uses market cap, tax rate, and curve progress). Of that accrued fee:

```text
Accrued creator tax
   ├── 80%  Creator-side pool
   └── 20%  Protocol burn share (shown in LOOTING)
```

- The **20% burn share is separate from the Lucky Box cut.**
- The **creator-side pool** is what the launch form splits between Lucky Boxes and the remaining recipient (creator wallet or holders).

### Holder fee share

After the Lucky Box cut is taken from the tax configuration, the remainder of the creator-side allocation can go to:

1. **Creator wallet** (default), or
2. **Holders** — claimable from Account / coin Terminal when the launch enables holder share

Turning holder share on does **not** shrink the Lucky Box allocation.

### Quote pair at launch

Buyers spend a quote asset chosen at launch:

- Default: **ETH**
- Optional stock/RWA quotes (product examples): NVDA, AAPL, TSLA, SPY, AMZN, META, GOOGL, MSFT, COIN

Graduation keeps the same quote pair. This is distinct from stock/RWA tokens used as Lucky Box prizes (§9 / §31).

### Launch form extras

- Optional **initial buy** so the creator can take the first curve position
- Up to **8 exempt wallets** (e.g. snipe-tax exemptions); duplicates rejected
- Metadata rules: name length limit, no URLs in description, social handle normalization

### Important implementation rule

The Lucky Box percentage must NOT be hardcoded globally.

Each launch must store a per-token immutable/snapshotted reward allocation configuration such as:

```solidity
struct LaunchRewardConfig {
    address token;
    address creatorFeeRouter;
    uint16 creatorBps;
    uint16 luckyBoxBps;
    uint16 totalCreatorFeeBps;
    bool holderShareEnabled;
    address quoteAsset;
    bytes32 configHash;
}
```

Expected invariant:

```text
creatorBps + luckyBoxBps = totalCreatorFeeBps
```

### Reward Router

The first recipient of creator-fee funds should be a LOOTING-controlled smart contract (where technically compatible with the exact Pons deployment).

```text
Pons V2
   ↓
creatorFeeRecipient = LOOTING Reward Router
   ↓
   ├── creator / holder allocation → claimable balances
   ├── Lucky Box allocation → Reward Treasury
   └── protocol burn share → burn accounting (per product policy)
```

The router must not expose arbitrary withdrawal functionality.

---

## 7. Lucky Box System

## 7.1 Core eligibility rule

The baseline product rule is:

> **A qualifying BUY of a token launched on LOOTING creates one Lucky Box. That box can be opened only after the same wallet has exited the position. A wallet that never bought a LOOTING-launched token is not eligible.**

The box is consumed once opened. A sell does not create a new box. A sell that fully exits the position unlocks the box created by the earlier buy.

Example:

```text
BUY $ABC #1        → Lucky Box #1 → In market (cannot open)
BUY $ABC #2        → Lucky Box #2 → In market (cannot open)
Still holding $ABC → both boxes stay locked
EXIT $ABC          → both boxes become openable
SELL while holding → no new Lucky Box
Never bought $ABC  → Not eligible
```

Exit means the wallet no longer holds the position it bought. A partial sell that leaves a balance does not unlock the box. Transferring tokens to another wallet does not transfer the box and does not count as an exit for the recipient.

A token remaining active does NOT automatically create more boxes for the holder.

### Who enforces it

The smart contract is the gate at claim time. It accepts a claim only when all of these are true:

- the token is in the LOOTING launch registry
- the wallet has a box from a qualifying buy of that token
- the position for that box has been marked exited
- the box has not already been opened

The contract does not scan a wallet's full history on every claim. The indexer prepares that history from chain events and records the status the contract checks: in market, exited, or not eligible.

### External trading compatibility

The detection mechanism must be chain-based, not website-based.

A qualifying BUY can originate from:

- LOOTING UI
- GMGN
- Axiom
- Trojan
- DEX UI
- DEX aggregator
- supported trading bot

The indexer reads eligibility from on-chain swap and curve events, plus balance changes, and checks that the wallet was the economic buyer of a token launched on LOOTING.

---

## 7.2 Why wallet-based eligibility

A user should not need to register an email account.

Primary key:

```text
chain_id + wallet_address
```

Profile example:

```json
{
  "wallet": "0x...",
  "seasonXp": 2840,
  "tier": "SILVER",
  "luckyBoxesAvailable": 7,
  "lifetimeXp": 18420
}
```

---

## 8. Lucky Box Tiers

Initial three-tier model:

### Bronze

- entry tier
- base odds
- 0–999 season XP

### Silver

- improved odds
- 1,000–4,999 season XP

### Gold

- best odds
- 5,000+ season XP

Thresholds are configurable per season, not hardcoded forever.

---

## 9. Lucky Box Reward Table

A reward table should define outcomes and probabilities.

Example only:

| Reward class | Bronze | Silver | Gold |
|---|---:|---:|---:|
| Legendary | 5% | 10% | 20% |
| Epic | 20% | 30% | 40% |
| Rare | 50% | 50% | 35% |
| Empty | 25% | 10% | 5% |

The production percentages must be calibrated against the actual reward treasury budget.

### Reward payload types

A box may resolve to:

- LOOTING token amount
- tokenized stock amount
- other approved RWA reward
- fixed USDC/USDG/ETH reward if legally and economically appropriate
- no reward

### Critical treasury rule

Probability must be budget-backed.

Before a season is activated, the protocol should validate that the maximum expected reward liability does not exceed the funded reward pool under the selected configuration.

---

## 10. LOOTING Token Reward Mechanism

One intended reward type is LOOTING itself.

### Desired flow

```text
Lucky Box opens
       ↓
Outcome = LOOTING
       ↓
Reward contract deterlootings required quote amount
       ↓
On-chain swap through approved router / aggregator
       ↓
LOOTING acquired
       ↓
LOOTING transferred to winner wallet
```

Example:

```text
Box reward budget = $30 equivalent
       ↓
Swap $30 quote asset → LOOTING
       ↓
LOOTING sent directly to winner
```

### Important economic principle

The purpose is **real reward distribution and token utility**, not wash volume.

The LOOTING buy should only happen when an actual winner has earned a real reward.

### Execution safeguards

- maximum swap slippage
- minimum output amount
- approved router allowlist
- deadline / expiry
- TWAP or price sanity check where available
- maximum reward size per transaction
- global per-season reward budget
- pause switch
- no arbitrary external call target

---

## 11. XP System

### Base rule

**1 qualifying trade = 10 XP** as the initial baseline.

### Minimum trade

Recommended initial minimum qualifying notional: **$5 equivalent**.

### Volume scaling

Do not award linear unlimited XP to prevent spam.

Example initial policy:

```text
Trade notional        XP
<$5                    0
$5–$24.99            10
$25–$99.99           15
$100–$249.99         25
$250–$499.99         40
$500–$999.99         60
≥$1,000             100 max
```

This is a starting model and should be tuned after observing real usage.

### Optional bonuses

These should be implemented only after the core XP engine is stable:

- first BUY of a token: +25 XP
- holding-time bonus: +5 XP after minimum holding duration
- first interaction with a new launch: +X XP
- season milestone bonuses

### XP must be anti-farm aware

The engine must detect and suppress obvious self-trading patterns, repeated micro-swaps designed solely to farm XP, and circular wallets where possible.

---

## 12. Weekly Seasons

### Season cadence

- 7-day season
- XP resets at season boundary
- lifetime activity remains stored

Example:

```text
Season 01
Season XP: 7,420
Tier: GOLD
Boxes earned: 5

↓ reset

Season 02
Season XP: 0
Tier: BRONZE
```

### Retained user history

Lifetime counters remain:

- Lifetime XP
- Lifetime qualified trades
- Lifetime lucky boxes earned
- Lifetime lucky boxes opened
- Lifetime reward value
- Number of launches traded

### Season boundary implementation

Use server/database time only as a display aid; the actual season identifier and active configuration should be persisted in the protocol database and, where appropriate, committed to a cryptographic config hash.

Recommended format:

```text
season_id = YYYY-WW or monotonically increasing uint64
```

Avoid relying on client time.

---

## 13. Reward Page UX

### User profile header

```text
LOOTING REWARDS

Season XP       2,840
Tier            SILVER
Boxes Available 7
Lifetime XP     18,420
```

### Box grid

```text
[ 🎁 ] [ 🎁 ] [ 🎁 ] [ 🔒 ]
[ 🎁 ] [ 🎁 ] [ 🔒 ] [ 🔒 ]
```

States:

- Unclaimed: the wallet bought a LOOTING-launched token and has exited, so the box can be opened
- In market: the wallet bought the token and still holds it, so the box stays locked until exit
- Claimed: the box was opened; show the payout transaction
- Not eligible: the wallet never bought that token from a LOOTING launch

Filters (product UX):

```text
All · Unclaimed · In market · Claimed · Not eligible
```

After a reward is revealed, the user can save/share a branded **share card**. The primary nav label for this surface is **Lucky Boxes** (route may still be `/rewards`).

### Box detail modal

Before opening:

```text
SILVER LUCKY BOX

Higher reward odds than Bronze.

[ OPEN BOX ]
```

After opening:

```text
🎉 YOU WON

0.42 mNVDA

Transaction
0x...

[ VIEW ONCHAIN ]
```

### Reward history

```text
#07  $TOKENA   Unopened
#06  $TOKENB   0.18 mNVDA
#05  $TOKENC   No Reward
#04  $TOKENX   0.42 mSPY
#03  $TOKENX   25 LOOTING
```

---

## 14. Randomness

### Requirement

Do not use:

- `block.timestamp` alone
- `blockhash` alone for high-value rewards
- backend `Math.random()`
- a mutable server-side random value

### Preferred design

Use verifiable randomness appropriate to Robinhood Chain deployment availability. The implementation may be:

1. Chain-compatible VRF/oracle randomness; or
2. a commit/reveal mechanism if VRF is unavailable and the UX allows delayed settlement.

### Recommended MVP flow

```text
Box assigned
   ↓
User clicks Open
   ↓
Contract locks box
   ↓
Randomness request
   ↓
Randomness fulfilled
   ↓
Outcome derived from sealed reward table hash
   ↓
Reward claim settled
```

For MVP, if a trusted randomness provider is unavailable on Robinhood Chain, use a conservative commit/reveal design rather than an operator-controlled random number.

---

## 15. Reward Config Immutability

Every season should have a versioned reward configuration.

```solidity
struct RewardTableConfig {
    uint64 seasonId;
    bytes32 configHash;
    uint32 totalWeight;
    address rewardVault;
    bool active;
}
```

The actual reward table should map weights to reward classes.

Example:

```text
Season 12
configHash = 0x...

Bronze:
  LEGENDARY = 50
  EPIC       = 200
  RARE       = 500
  EMPTY      = 250
```

Once a box is assigned, the box must reference the exact season/config version under which it was created. A later season update must not retroactively alter the box's odds.

---

## 16. Smart Contract Architecture

Suggested contracts:

```text
LootingLaunchRegistry
LootingRewardRouter
LootingLuckyBox
LootingRewardVault
LootingSeasonConfig
LootingLOOTINGRewardExecutor
LootingStockRewardAdapter
LootingEmergencyController
LootingStakingFactory
LootingStakingVault
LootingDevLock
```

### LootingLaunchRegistry

Stores LOOTING-supported launch metadata:

- token address
- Pons curve address
- creator address
- creator fee recipient/router
- reward split
- launch timestamp
- Pons phase/status
- reward program enabled/disabled

### LootingRewardRouter

Receives creator-fee flow when supported by Pons deployment.

Responsibilities:

- validate launch id
- split creator / Lucky Box allocation
- maintain per-launch balances
- send creator funds to claimable balance
- send reward allocation to reward vault
- emit accounting events

Must NOT:

- make arbitrary delegatecalls
- change immutable launch config
- approve unlimited arbitrary tokens
- expose generic withdraw(address token, address to, uint256 amount)

### LootingLuckyBox

NFT-like or ERC-1155 style box representation is recommended.

Each box stores:

- box id
- owner
- season id
- token launch id
- tier
- creation block / timestamp where relevant
- status: in market, exited, opened, or claimed
- the buy transaction that created the box
- the exit transaction, once the position is closed
- reward config hash

`open` must revert unless the box status is exited, the token is a registered LOOTING launch, the caller is the owner, and the box has not been opened before. A wallet with no qualifying buy has no box and cannot claim.

### LootingRewardVault

Custodies funded reward assets.

Needs:

- per-token reward budgets
- reserve accounting
- emergency pause
- accounting events
- strict allowlists

### LootingLOOTINGRewardExecutor

Handles LOOTING rewards via approved swap routers.

Inputs:

- reward budget
- minimum LOOTING output
- deadline
- winner
- approved route identifier

Must never allow arbitrary calldata target injection.

### LootingStakingFactory / LootingStakingVault

**Factory** creates or registers a **new vault** per Create Staking event (UI: `/create-staking`).

**Vault** binds to:

- a LOOTING-launched token (`stakeToken`) registered in `LootingLaunchRegistry`
- a reward pool funded by the vault creator (same token unless a later version introduces a separate reward token — MVP: same ERC-20)
- enabled lock options as a bitmask: Flexible / 30 days / 90 days
- APR bps per enabled lock, snapshotted at create
- an event end timestamp (`endsAt`)

Recommended factory create signature (conceptual):

```solidity
function createVault(
    address stakeToken,
    uint256 rewardAmount,
    uint64 endsAt,
    uint8 lockMask,          // bit0=flex, bit1=30d, bit2=90d
    uint16[3] calldata aprBps // APR in bps for flex/30/90; 0 if disabled
) external returns (address vault, uint256 vaultId);
```

`createVault` must:

1. require `stakeToken` is a registered LOOTING launch
2. pull `rewardAmount` from `msg.sender` into the new vault
3. require `endsAt > block.timestamp`
4. require at least one lock enabled
5. emit `StakingVaultCreated`

Vault user entrypoints (match Staking → Positions UI):

```solidity
function stake(uint256 amount, uint8 lockId) external;   // 0=flex, 1=30d, 2=90d
function unstake(uint256 amount, uint8 lockId) external;
function claimRewards(uint8 lockId) external returns (uint256 paid);
```

Views the UI needs:

```solidity
function vaultInfo() external view returns (...);
function position(address wallet, uint8 lockId) external view returns (
    uint256 staked,
    uint256 rewardDebtOrAccrued,
    uint64 lockEndsAt
);
function pendingRewards(address wallet, uint8 lockId) external view returns (uint256);
function totalStaked() external view returns (uint256);
function rewardRemaining() external view returns (uint256);
```

Unstake rules:

- Flexible: anytime while vault is active (and after event end for withdrawal of principal)
- 30 / 90: principal locked until `stakeTime + lockDuration`; rewards may still be claimable per accounting policy

Reward accounting (MVP recommendation):

- continuous accrual: `pending ≈ staked * aprBps / 10_000 / secondsPerYear * elapsed`
- paid rewards decrease `rewardRemaining`
- if `rewardRemaining` is insufficient, pay only what remains (never revert user principal unstake solely for empty rewards)
- after `endsAt`, new stakes revert; existing positions may still claim remaining accrued rewards and unstake when locks allow

### LootingDevLock

Locks or vests creator supply of LOOTING-launched tokens (UI: `/devlock`).

Authorization (matches UI gate):

- `token` must be registered in `LootingLaunchRegistry`
- `msg.sender` must be the launch creator for that token (or an explicitly approved operator if added later)

Modes:

- **Time lock (`mode = 0`)** — full amount claimable only when `block.timestamp >= unlockAt`
- **Vesting (`mode = 1`)** — 0 until `cliffAt`; then linear from cliff → `unlockAt`; cadence is metadata for UI schedule display (daily/weekly/monthly) but vesting math is continuous linear unless a stricter discrete schedule is chosen at deploy

Recommended structs:

```solidity
enum DevLockMode { Time, Vest }
enum DevLockCadence { Day, Week, Month } // UI metadata; optional on-chain

struct DevLockPosition {
    uint256 id;
    address owner;
    address token;
    DevLockMode mode;
    uint256 amount;
    uint256 claimed;
    uint64 start;
    uint64 cliff;     // == start for time locks
    uint64 unlock;
    DevLockCadence cadence;
}
```

Entrypoints:

```solidity
function createTimeLock(address token, uint256 amount, uint64 unlockAt) external returns (uint256 lockId);
function createVesting(
    address token,
    uint256 amount,
    uint64 cliffAt,
    uint64 unlockAt,
    DevLockCadence cadence
) external returns (uint256 lockId);
function claim(uint256 lockId) external returns (uint256 paid);
function vestedAmount(uint256 lockId) external view returns (uint256);
function claimableAmount(uint256 lockId) external view returns (uint256);
```

Claim math (must match UI):

```text
vested(time) =
  if now >= unlock → amount
  if mode == Time OR now <= cliff → 0
  else → amount * (now - cliff) / (unlock - cliff)

claimable = vested - claimed
```

`claim` transfers `claimable` of `token` to `owner`, increments `claimed`, and deletes / closes the position when `claimed >= amount`. Share-card generation is **frontend-only** (no contract call).

---

## 17. Contract Invariants

These must be enforced by tests and preferably by runtime assertions where practical.

### Fee split invariant

```text
creatorBps + luckyBoxBps == totalCreatorFeeBps
```

### Lucky Box ownership invariant

A box can only be opened by its current owner or an authorized operator.

### Exit-before-open invariant

A box created by a buy stays locked while the wallet still holds that position. Open is allowed only after the position is fully exited. No buy of a LOOTING-launched token means no box.

### Single-open invariant

```text
opened(boxId) == true
```

must permanently prevent another open of the same box.

### Claim invariant

A reward amount may only be claimed once.

### Reward budget invariant

The contract must never pay more than its recorded funded balance.

### Season invariant

Box odds must use the config version associated with the box, not the current season config.

### Router invariant

No arbitrary external recipient override from non-authorized roles.

### Swap invariant

LOOTING reward executor cannot spend more than the box's assigned reward budget.

### Staking invariant

Unstake and reward claim must respect the selected vault lock terms and never over-pay that vault’s claimable rewards or funded reward budget. Creating a staking event creates a distinct vault; vaults do not share reward liabilities.

### Dev Lock invariant

Locked or unvested amounts cannot be withdrawn before the schedule allows. Claimed amount never exceeds vested amount.

---

## 18. Indexer Architecture

LOOTING needs a dedicated indexer because reward eligibility depends on wallet holding history, including trades made outside the LOOTING site.

The indexer records, per wallet and per LOOTING launch:

- whether the wallet ever bought the token
- whether the position is still open or has been fully exited
- the buy transaction and, after exit, the closing transaction

It then marks each box in market, exited, or leaves the wallet not eligible when there was never a qualifying buy. The reward contract checks that record at claim time. The indexer does not pay rewards itself.

```text
Robinhood Chain RPC / WebSocket
            ↓
      Block Listener
            ↓
   Raw Event / Tx Store
            ↓
  Pons Decoder / Router Decoder
            ↓
      Trade Normalizer
            ↓
     Qualification Engine
            ↓
      XP + Box Engine
            ↓
        PostgreSQL
            ↓
          API
            ↓
         Frontend
```

### Data ingestion requirements

Track:

- block number
- block hash
- transaction hash
- log index
- timestamp
- token address
- pool/curve address
- trader wallet
- token amount
- quote amount
- direction
- effective price
- source contract
- confirmation status

### Reorg handling

Do not permanently award XP from the first observation.

Recommended states:

```text
PENDING
CONFIRMED
FINALIZED
REORGED
REVERSED
```

XP and box issuance should happen only at the protocol's defined confirmation/finality threshold.

---

## 19. Trade Qualification Engine

A trade qualifies only when all checks pass.

### BUY detection

1. Transaction is on Robinhood Chain.
2. Event belongs to a registered LOOTING launch.
3. Token flow indicates a purchase, not a transfer.
4. Economic buyer is identified.
5. Quote notional meets minimum threshold.
6. Transaction is finalized.
7. Trade is not already processed.
8. Trade is not blocked by anti-abuse rules.

### Transfer rejection

This is essential.

```text
Alice BUY token
↓
Alice transfers token to Bob
```

Bob must not receive a Lucky Box merely because he received tokens.

The indexer must use swap/curve events and balance deltas to distinguish purchases from transfers.

### Exit detection

A box unlocks only when the buying wallet's position in that LOOTING-launched token is fully closed.

- A partial sell leaves the box in market.
- A transfer out is not an exit and does not make the recipient eligible.
- A wallet that never bought the token stays not eligible.

---

## 20. Anti-Sybil / Anti-Wash Trading

LOOTING cannot assume one wallet equals one human.

### MVP protections

- minimum trade notional
- maximum XP per trade
- duplicate tx prevention
- suspicious rapid buy/sell loop detection
- self-routing / same-wallet loop detection
- minimum effective holding time for selected bonuses
- XP velocity caps
- daily/season XP caps for suspicious patterns
- optional wallet reputation score

### Advanced protections

Graph-based clustering:

```text
Wallet A
  ↓
Wallet B
  ↓
Wallet C
  ↓
same funding source
  ↓
rapid same-token round trips
```

Flag cluster for reduced or zero XP while keeping the underlying trade visible.

### Important product choice

Do NOT revert legitimate user trades merely because they look suspicious. The safer pattern is:

```text
trade remains valid
XP eligibility = reduced / delayed / review-required
```

---

## 21. Database Model

Recommended stack: PostgreSQL/Supabase.

### users_wallets

```text
id
chain_id
wallet_address
first_seen_at
last_seen_at
lifetime_xp
lifetime_trade_count
lifetime_box_count
created_at
updated_at
```

### seasons

```text
id
season_id
starts_at
ends_at
status
config_hash
bronze_threshold
silver_threshold
gold_threshold
created_at
```

### season_wallet_stats

```text
id
season_id
wallet_id
xp
trade_count
qualified_trade_count
boxes_earned
boxes_opened
tier
rank
updated_at
```

### launches

```text
id
token_address
curve_address
pair_address
creator_address
creator_fee_recipient
creator_fee_bps
creator_share_bps
lucky_box_share_bps
launch_tx_hash
launch_block
phase
status
created_at
```

### trades

```text
id
tx_hash
log_index
block_number
block_hash
token_address
curve_or_pool_address
wallet_address
direction
quote_amount
token_amount
usd_notional
is_qualified
qualification_reason
confirmation_state
created_at
```

### lucky_boxes

```text
id
box_id
wallet_address
launch_id
season_id
tier
status
reward_config_hash
earned_from_trade_id
created_at
opened_at
claimed_at
```

### rewards

```text
id
box_id
reward_type
reward_token_address
reward_amount
target_value
actual_swap_input
actual_swap_output
swap_tx_hash
status
created_at
```

### reward_treasury_ledger

```text
id
launch_id
asset_address
entry_type
amount
reference_tx_hash
created_at
```

### staking_vaults

```text
id
vault_id
vault_address
stake_token
creator_address
reward_funded
reward_remaining
total_staked
staker_count
ends_at
lock_mask
apr_flex_bps
apr_30_bps
apr_90_bps
status
create_tx_hash
created_at
```

### staking_positions

```text
id
vault_id
wallet_address
lock_id
amount
rewards_claimed
lock_started_at
lock_ends_at
updated_at
```

### dev_locks

```text
id
lock_id
owner_address
token_address
mode
amount
claimed
start_at
cliff_at
unlock_at
cadence
status
create_tx_hash
created_at
```

---

## 22. API Design

### Public

```http
GET /api/launches
GET /api/launches/:token
GET /api/seasons/current
GET /api/wallet/:address
GET /api/wallet/:address/rewards
GET /api/wallet/:address/lucky-boxes
GET /api/wallet/:address/staking-positions
GET /api/wallet/:address/dev-locks
GET /api/staking/events
GET /api/staking/events/:vaultId
GET /api/leaderboard/current
```

### Creator

```http
POST /api/launch/prepare
POST /api/launch/confirm
GET  /api/creator/:address/launches
GET  /api/launch/:token/rewards
POST /api/staking/events/prepare
POST /api/staking/events/confirm
POST /api/devlock/prepare
POST /api/devlock/confirm
```

### Admin / operator

```http
POST /api/admin/season
POST /api/admin/reward-table
POST /api/admin/launch/:token/pause-rewards
POST /api/admin/token/approve
```

### API rules

- wallet addresses normalized consistently
- all sensitive mutations require signature/authentication
- idempotency keys for reward-related jobs
- no privileged action based solely on client-side values

---

## 23. Frontend Information Architecture

### Primary navigation

```text
Explore
Launch
Lucky Boxes
Leaderboard
```

### Secondary navigation (titled groups)

```text
Protocol
  Staking          ← public vault marketplace (Events + Positions)
  Analytics

Token tools
  Dev Lock         ← creator supply lock / vest
  Create Staking   ← publish a new staking vault for a launched coin

Account            ← wallet hub (ungrouped)
```

### Side / support

```text
Docs (intro + detailed guide)
Litepaper
X / Telegram (external)
```

Optional header strip: when the connected wallet created launches with claimable creator fees, show a **creator fee claim** control above the market.

### Explore (market home)

Former “Discover” surface. Product name is **Explore**.

- Boards: New Pair, Almost Graduate, Migrate, Movers, Trending
- Time windows: Latest, 5m, 1h, 6h, 24h, 48h
- Layout: table or grid
- Columns / cards: coin, sparkline, market cap, ATH, age, txns, 24h volume, box figure, 1h / 24h move
- Live header tape: symbol, market cap, 1h change

### Global search

- Header search field or **Ctrl / Cmd + K**
- Match by name, ticker, or contract address
- Sort: relevance, market cap, volume, newest, oldest
- Filters: age (all / 24h / 7d), phase (all / still on curve / graduated)
- Selecting a row opens the coin Terminal; submitting the query applies it on Explore

### Launch

Creator flow:

1. Token details (name, ticker, logo, description, socials)
2. Creator tax + Lucky Box cut
3. Quote pair (ETH or stock ticker)
4. Holder share toggle + optional recipient / exemptions / initial buy
5. Review economics (including protocol burn vs creator-side pool)
6. Wallet sign
7. Launch
8. Success / share → coin Terminal

### Token Terminal

Each coin has a dedicated page:

- Price, market cap, curve progress, volume, traders, fee split (creator side vs Lucky Box)
- Buy / sell on the curve with amount presets
- Order modes: Instant / Market / Limit (product UX)
- Trade settings: slippage, gas, priority, optional MEV protection, TP/SL
- Holders list + recent transactions
- Connected wallet PnL when holding
- Creator and holder fee claim when eligible
- Graduation keeps the launch quote pair

### Lucky Boxes

- XP, tier, boxes, reward history, season countdown, odds disclosure
- Status filters and share card after reveal

### Leaderboard

- Weekly XP ranking, shortened wallet, tier badge, qualified trade count, reward stats
- Paginated board (e.g. 20 rows per page)
- Global #1–#3 trophy treatment persists across pages
- Connected wallet **You** card with rank jump and row highlight

### Account

Wallet hub (product name **Account**, not a social Profile):

- Season XP, tier progress toward next tier, lifetime XP / boxes / trades / rewards
- Trade history on LOOTING launches with jump-to-coin
- Shortcuts to Staking, Create Staking, Dev Lock, Analytics
- Empty / connect prompt when no wallet is linked
- Identity is the address only

### Staking

Public staking marketplace — see §55.

Tabs:

- **Events** — list of open staking vaults created via Create Staking
- **Positions** — connected wallet’s stakes across those vaults (stake / unstake / claim)

### Create Staking / Dev Lock / Analytics

Dedicated product pages — see §§54–56 and §55a.

### Docs / Litepaper

In-app product rules and narrative docs so users can understand fees, boxes, graduation, and the launch window without leaving LOOTING.

## 24. Creator Launch Flow

### Step 1 — Token metadata

- name (product limit: 32 characters; letters, numbers, spaces)
- ticker
- logo
- description (no URLs)
- socials (X, Telegram, Discord, Farcaster; leading `@` on X stripped)

### Step 2 — Launch configuration

LOOTING displays Pons-supported parameters without pretending to own Pons mechanics.

Product extras at this step:

- Quote pair: ETH (default) or a stock ticker from the allowlist
- Optional initial buy
- Up to 8 snipe-tax exemption wallets

### Step 3 — Reward / fee configuration

Example UI:

```text
Creator tax: 1.00%   (presets 1 / 2 / 3% or custom 0.5–5%)

Lucky Box cut        [ ≥ 0.5% of tax ]
Remainder recipient  Creator wallet  |  Holders

Estimated Lucky Box funding per $100k volume:
$200

Accrued-fee display:
  80% creator-side pool · 20% protocol burn (LOOTING)
```

The exact estimation must account for the actual Pons fee semantics in the deployed version.

### Step 4 — Review

Show:

- total creator tax
- Lucky Box allocation (floor enforced)
- creator vs holder remainder
- protocol burn share (display)
- quote pair + graduation pair notice
- reward program status
- external Pons dependency notice
- launch-window snipe tax notice (§57)

### Step 5 — Sign launch transaction

LOOTING frontend calls the configured Pons V2 Factory.

### Step 6 — Confirm and register

Backend waits for finalized launch transaction and stores the launch metadata, including quote pair, holder-share flag, and reward split snapshot.

---

## 25. Reward Flow End-to-End

```text
1. User buys LOOTING-launched token
2. Trade lands on Robinhood Chain
3. Indexer sees transaction
4. Decoder confirms BUY
5. Trade reaches finality threshold
6. Qualification engine approves trade
7. +10 base XP or volume-tier XP
8. 1 Lucky Box assigned
9. Box references season config
10. User opens box
11. Random outcome is generated
12. Reward is recorded
13. If reward = LOOTING:
      approved router executes swap
14. LOOTING is sent to winner
15. Reward tx hash stored
16. UI updates history
```

---

## 26. Security Architecture

Security objective:

> **A compromised frontend must not be able to steal reward funds or change reward odds.**

### Threat model

Assume an attacker can:

- modify frontend JavaScript
- spam transactions
- create thousands of wallets
- call contracts directly
- replay API requests
- submit malformed calldata
- force-send tokens/ETH
- attempt reentrancy
- manipulate swap slippage
- exploit price volatility
- trigger block reorgs
- race box-opening transactions
- attempt claim replay

### Contract protections

Use:

- OpenZeppelin ReentrancyGuard
- SafeERC20
- checks-effects-interactions
- strict access control
- two-step ownership transfers
- timelocks for sensitive protocol changes
- pausability for reward contracts
- nonces / replay protection where signatures are used
- explicit token/route allowlists
- bounded integer math
- custom errors
- no arbitrary delegatecall
- no unrestricted arbitrary call
- no upgradeable proxy unless absolutely needed

---

## 27. Reward Contract Security Rules

### Never allow

```solidity
function withdraw(address token, address to, uint256 amount) external onlyOwner
```

for the live reward vault unless it is specifically an emergency rescue function behind a timelock and clearly excluded from normal funds.

### Prefer

Separate accounting buckets:

```text
normal rewards
protocol-owned reserve
emergency reserve
```

### Emergency rescue

If required:

- only non-user funds
- explicit timelock
- multisig
- on-chain event
- UI warning
- post-execution audit log

---

## 28. Upgradeability Policy

### MVP recommendation

Core reward contracts should be **non-upgradeable** where practical.

Use deploy-and-migrate architecture:

```text
Version 1
  ↓
Immutable reward logic
  ↓
New version later
  ↓
Migration / new season
```

### If upgradeability is unavoidable

Use:

- OpenZeppelin UUPS or transparent proxy
- multisig owner
- timelock
- public implementation hash
- upgrade delay
- emergency pause

Never allow a single hot wallet to upgrade production reward contracts.

---

## 29. Admin Security

Recommended production roles:

```text
Protocol Multisig
├── emergency pause
├── reward config activation
└── upgrade approval if any

Operations Key
├── indexer/keeper actions
└── non-fund-sensitive maintenance

Treasury Multisig
└── funding / treasury operations

Deployer
└── deployment only; revoke unnecessary privileges afterward
```

### Key management

- hardware-backed or MPC keys
- no private keys in Git
- no private keys in `.env` committed to repo
- separate testnet/mainnet credentials
- rotation procedures documented

---

## 30. Oracle / Price Safety

LOOTING reward value must not trust a single spot price blindly.

For LOOTING rewards:

- require minimum output
- enforce max slippage
- reject stale route quotes
- cap reward amount
- optionally compare against independent price source

For RWA/stock token rewards:

- approved token registry only
- verify token decimals
- verify issuer/oracle assumptions
- avoid arbitrary ERC-20 reward insertion by creators

---

## 31. Stock / RWA Reward Adapter

The Reward Vault should not assume every ERC-20 is safe.

Maintain an allowlist:

```text
asset
issuer
decimals
oracle source
reward enabled
max season budget
```

Example:

```text
mNVDA  ✅
mSPY   ✅
mAAPL  ✅
random token ❌
```

Do not let a creator point a Lucky Box reward to a malicious token with transfer hooks, rebasing behavior, blacklist controls, or hidden taxes unless the asset has been explicitly reviewed.

---

## 32. Pons Dependency Handling

LOOTING must isolate Pons-specific code behind an adapter.

Suggested module:

```text
packages/protocol-adapters/pons-v2
```

Adapter responsibilities:

- deploy/launch transaction construction
- parse Pons launch events
- map token → curve
- detect graduation
- detect creator-fee configuration
- query launch state
- verify fee recipient

The rest of LOOTING must not import Pons-specific ABIs directly.

Architecture:

```text
LOOTING Core
   ↓
LaunchAdapter interface
   ↓
PonsV2Adapter
```

This lets LOOTING replace the launch engine later without rewriting the reward system.

---

## 33. Pons Risk Mitigation Strategy

### Risk

Pons controls the external factory and has protocol-owner permissions, including creator-fee recipient overrides in the current source.

### Mitigation

1. Verify the exact deployed factory/hook/escrow addresses before mainnet.
2. Monitor each launch's creator-fee recipient on-chain.
3. Alert if recipient changes.
4. Freeze Lucky Box accrual for that launch if reward routing is no longer verifiable.
5. Maintain per-launch reward ledger independent from creator claim UI.
6. Keep a migration path to an independent factory.
7. Do not represent the reward split as immutable unless technically proven.

### Operational rule

```text
recipient == LootingRewardRouter
    → reward program ACTIVE

recipient != LootingRewardRouter
    → reward program PAUSED
    → preserve historical data
    → prevent new reward liabilities
```

This does not prevent an upstream protocol from changing fee routing, but it prevents LOOTING from silently accounting for rewards it cannot actually receive.

---

## 34. Observability

Track metrics:

### Launch metrics

- launches/day
- unique creators
- graduation rate
- launch failure rate

### Trading metrics

- qualified trades/day
- unique trading wallets
- qualified volume
- median trade size
- XP generated

### Reward metrics

- boxes issued
- boxes opened
- reward hit rates
- LOOTING reward spend
- RWA reward spend
- unclaimed boxes

### Security metrics

- paused launches
- fee-recipient changes
- failed reward swaps
- suspicious XP clusters
- reorg corrections
- failed randomness requests

---

## 35. Event Logging

Every significant state change must emit an event.

Examples:

```solidity
event LaunchRegistered(address indexed token, address indexed creator);
event RewardSplitConfigured(address indexed token, uint16 creatorBps, uint16 luckyBoxBps);
event LuckyBoxMinted(uint256 indexed boxId, address indexed wallet, uint64 seasonId);
event LuckyBoxOpened(uint256 indexed boxId, bytes32 outcomeCommitment);
event RewardResolved(uint256 indexed boxId, bytes32 rewardType, uint256 amount);
event RewardClaimed(uint256 indexed boxId, address indexed wallet);
event LootingRewardPurchased(uint256 indexed boxId, uint256 quoteIn, uint256 lootingOut);
event SeasonActivated(uint64 indexed seasonId, bytes32 configHash);
event RewardProgramPaused(address indexed token, bytes32 reason);

// Staking vaults (Create Staking / Events / Positions)
event StakingVaultCreated(
    uint256 indexed vaultId,
    address indexed vault,
    address indexed stakeToken,
    address creator,
    uint256 rewardAmount,
    uint64 endsAt,
    uint8 lockMask
);
event Staked(uint256 indexed vaultId, address indexed wallet, uint8 lockId, uint256 amount);
event Unstaked(uint256 indexed vaultId, address indexed wallet, uint8 lockId, uint256 amount);
event StakingRewardsClaimed(uint256 indexed vaultId, address indexed wallet, uint8 lockId, uint256 amount);

// Dev Lock
event DevLockCreated(
    uint256 indexed lockId,
    address indexed owner,
    address indexed token,
    uint8 mode,
    uint256 amount,
    uint64 cliff,
    uint64 unlock
);
event DevLockClaimed(uint256 indexed lockId, address indexed owner, uint256 amount);
```

These events should make the system reconstructable from chain data. Indexer + frontend Events/Positions/Dev Lock lists should be rebuildable from them.

---

## 36. Testing Strategy

### Unit tests

- fee split math
- XP calculations
- tier calculations
- reward selection
- season transitions
- box lifecycle
- reward budget accounting
- swap safety
- Dev Lock vested/claimable math (time + vest + cliff)
- Dev Lock early-claim reverts; post-unlock full claim
- staking vault create pulls rewards and registers vault id
- stake / unstake lock-duration enforcement (flex vs 30 vs 90)
- staking reward accrual + rewardRemaining cap
- no stake after endsAt; principal still withdrawable when locks allow

### Property tests

Examples:

```text
creatorBps + luckyBoxBps == totalFee
```

always holds.

```text
opened box cannot be opened twice
```

always holds.

```text
claimed reward cannot be claimed again
```

always holds.

```text
devLock.claimed <= vested(lock) <= lock.amount
```

always holds.

```text
sum(staking rewards paid for vault) <= vault.rewardFunded
```

always holds.

### Fuzz tests

Target:

- max uint values
- zero amounts
- tiny trades
- huge trades
- malicious token contracts
- unusual decimals
- reentrancy callbacks
- repeated claims
- season boundary timestamps

### Integration tests

Test against a local fork or deterministic test deployment of the actual Pons V2 contracts.

### Mainnet preflight

Before production:

1. verify contract bytecode
2. verify Pons addresses
3. verify launch entrypoint
4. verify fee recipient behavior
5. verify graduation
6. verify GMGN visibility assumptions
7. execute small end-to-end launch
8. fund tiny reward pool
9. open Lucky Box
10. verify reward claim

---

## 37. Security Audit Plan

### Audit 1 — Core contracts

- Reward Router
- Lucky Box
- Reward Vault
- LOOTING Reward Executor

### Audit 2 — Economic simulation

Stress-test:

- high volatility
- low liquidity
- zero reward treasury
- many concurrent claims
- high gas
- repeated failed swaps
- creator configuration extremes

### Audit 3 — Indexer integrity

Review:

- event parsing
- duplicate processing
- reorg handling
- chain restart recovery
- missed logs
- backfill correctness

---

## 38. Infrastructure Stack

Recommended initial stack:

### Frontend

- Next.js
- TypeScript
- Tailwind CSS
- viem
- wagmi or equivalent wallet connector

### Backend

- TypeScript / Node.js or Go
- PostgreSQL / Supabase
- Redis for queues/caching
- WebSocket RPC + fallback HTTP RPC

### Indexer

Recommended implementation:

- dedicated worker process
- cursor-based block scanning
- WebSocket subscription for low latency
- HTTP backfill for reliability
- persistent checkpoint

### Monitoring

- structured logs
- error tracking
- metrics
- Discord/Telegram/Slack ops alerts as appropriate

---

## 39. Repository Structure

Recommended monorepo:

```text
looting/
├── apps/
│   ├── web/
│   └── api/
├── packages/
│   ├── contracts/
│   ├── pons-adapter/
│   ├── indexer/
│   ├── xp-engine/
│   ├── reward-engine/
│   ├── shared/
│   └── sdk/
├── docs/
│   ├── LOOTING_PRODUCT_SPEC.md
│   ├── SECURITY.md
│   ├── ARCHITECTURE.md
│   ├── TOKENOMICS.md
│   └── RUNBOOK.md
├── infra/
│   ├── docker/
│   └── deployment/
├── scripts/
├── .cursor/
│   ├── rules/
│   └── mcp.json
└── AGENTS.md
```

---

## 40. Cursor Instructions

`AGENTS.md` should point developers/Cursor to this specification as the canonical product source.

Suggested rules:

```text
- Never change reward economics without updating LOOTING_PRODUCT_SPEC.md.
- Never add arbitrary token transfer functions to reward contracts.
- Never assume frontend state is authoritative for XP or eligibility.
- Never use wallet balance alone to classify a BUY.
- Never use non-verifiable randomness for production Lucky Boxes.
- All Pons integration code must be isolated in pons-adapter.
- All privileged contract actions must be tested and logged.
- Never store secrets in the repository.
- Every production migration requires rollback strategy.
```

---

## 41. MCP Plan for Cursor

Recommended MCP capabilities:

### GitHub

- repository inspection
- PR workflow
- issue/task management

### Database

- development PostgreSQL/Supabase
- read-only analytics by default

### Blockchain

Custom LOOTING MCP can later expose:

```text
looting_get_launch(token)
looting_get_wallet_xp(wallet)
looting_get_wallet_boxes(wallet)
looting_get_season()
looting_scan_trades(token, fromBlock, toBlock)
looting_verify_fee_recipient(token)
looting_get_reward_budget(seasonId)
```

The custom MCP should be read-only by default.

Any write tool must be heavily restricted and ideally require external confirmation.

---

## 42. Roadmap

## Phase 0 — Research & Verification

Goal: prove Pons integration and reward feasibility.

Tasks:

- verify exact Pons V2 deployment addresses on Robinhood Chain
- verify `launchToken()` ABI
- verify `creatorFeeRecipient` behavior
- verify live Fee Escrow behavior
- verify creator recipient override behavior
- verify launch gating status
- verify GMGN indexing of current Pons launches
- verify token/quote pair behavior
- verify feasible randomness solution on Robinhood Chain

Deliverable:

**Integration Proof-of-Concept**

---

## Phase 1 — LOOTING MVP Launchpad

Build:

- wallet connect
- creator launch form (tax, Lucky Box cut, quote pair, holder share, exemptions, initial buy)
- Pons V2 adapter
- launch registry
- Explore market board + global search
- Token Terminal (buy/sell UX)
- launch pages
- Pons event indexer
- external trade indexing
- LOOTING launch listing
- Docs / Litepaper shells

No Lucky Box funds yet.

---

## Phase 2 — XP Engine

Build:

- wallet profiles / Account hub
- trade normalization
- qualifying-trade rules
- XP engine
- weekly seasons
- Bronze/Silver/Gold
- leaderboard (pagination + You card)
- public Analytics (season aggregates)
- anti-duplication

Deliverable:

**LOOTING Season system without financial rewards**

---

## Phase 3 — Lucky Boxes

Build:

- box contract
- box issuance
- box grid UI
- season-linked reward config
- verifiable randomness
- claim history
- reward vault

Deliverable:

**Testnet Lucky Box lifecycle**

---

## Phase 4 — LOOTING Rewards

Build:

- LOOTING token
- approved DEX/aggregator integration
- LOOTING reward executor
- slippage controls
- treasury funding
- LOOTING reward purchase → user transfer

Deliverable:

**LOOTING reward end-to-end**

---

## Phase 5 — Stock/RWA Rewards

Build:

- asset allowlist
- mNVDA/mSPY/mAAPL or other approved token adapters
- reward budget management
- reward display metadata
- asset risk metadata
- stock quote pairs at launch (product already surfaces these)

Deliverable:

**RWA Lucky Box rewards + quote-pair support**

---

## Phase 5b — Staking Vaults & Dev Lock

Build:

- staking vault factory / registry (Create Staking → new vault per event)
- per-vault reward accounting and lock options (Flexible / 30 / 90)
- public Events list + wallet Positions stake / unstake / claim
- Dev Lock time-lock + vesting contracts
- creator lock UX wired to on-chain schedules
- Analytics aggregates across public vaults

Deliverable:

**On-chain token staking vaults + Dev Lock beyond Lucky Boxes**

---

## Phase 6 — Production Hardening

- audit
- fuzzing
- monitoring
- multisig
- timelocks
- emergency pause
- reorg recovery
- load testing
- reward budget reconciliation
- incident response runbook

---

## Phase 7 — Mainnet Launch

Start with:

- limited creators
- limited reward assets
- controlled reward budgets
- low max reward per box
- conservative XP rules

Gradually increase after verified stability.

---

## 43. MVP Scope — What NOT to Build First

Do NOT build in MVP:

- complicated social profiles
- copy trading
- referral trees
- multi-chain support
- creator DAO governance
- sophisticated RWA token issuance
- arbitrary creator-defined reward tokens
- cross-chain rewards
- complicated account abstraction
- huge recommendation engine

MVP should focus on:

```text
Pons launch
+ Explore / search / Token Terminal
+ trade indexer
+ XP
+ weekly season
+ Lucky Box
+ LOOTING reward
+ Account / Leaderboard / Analytics (read)
```

Staking and Dev Lock UIs may ship as product surfaces early, but on-chain vault factory / per-vault settlement and Dev Lock can follow Phase 5b once the reward loop is live.

---

## 44. MVP Success Metrics

### Activation

- % of launches with first trade
- time from launch to first trade
- creator completion rate

### Trading

- qualified trades/day
- unique traders/day
- median trade notional
- retention week over week

### Rewards

- boxes issued/day
- boxes opened/day
- open rate
- reward claim completion rate

### Treasury

- reward funding per launch
- reward value distributed
- LOOTING purchased through reward system

### Reliability

- indexer lag
- missed event rate
- reorg correction rate
- failed claim rate
- failed swap rate

---

## 45. Launch Risk Matrix

| Risk | Severity | Mitigation |
|---|---|---|
| Pons changes fee recipient | High | monitor + pause reward program + migration path |
| Incorrect BUY detection | Critical | event decoding + replay tests + reconciliation |
| Sybil XP farming | High | thresholds + graph heuristics + XP caps |
| Lucky Box randomness manipulation | Critical | VRF/commit-reveal |
| Reward treasury drain | Critical | strict accounting + caps + audit |
| Malicious reward token | Critical | asset allowlist |
| Swap slippage | High | minOut + price checks + cap |
| Chain reorg | High | confirmation/finality policy |
| Frontend compromise | High | contracts remain authoritative |
| Admin key compromise | Critical | multisig + hardware/MPC + timelock |
| Reward budget insolvency | High | funded-table validation |
| Pons launch gate closed | Medium/High | integration check + fallback plan |

---

## 46. Emergency Runbook

### Scenario: reward contract exploit suspected

1. Pause reward opening.
2. Pause LOOTING reward executor.
3. Preserve all historical state.
4. Snapshot treasury balances.
5. Disable affected launch reward programs.
6. Investigate on-chain events.
7. Publish incident status.
8. Deploy fixed contracts only after review.

### Scenario: Pons fee recipient changed unexpectedly

1. Detect event.
2. Mark launch `REWARD_PAUSED`.
3. Stop new Lucky Box issuance for that launch.
4. Preserve existing boxes.
5. Reconcile missed/received fees.
6. Deterlooting migration path.

### Scenario: indexer outage

1. Stop reward issuance if duplicate risk exists.
2. Keep raw chain ingestion checkpoint.
3. Restore service.
4. Replay from last safe block.
5. Compare against chain truth.
6. Resume only after reconciliation.

---

## 47. Economic Simulation Requirements

Before mainnet, simulate at minimum:

### Low volume

```text
Volume/day = $10k
Lucky Box allocation = 20% of creator-fee budget
```

### Medium volume

```text
Volume/day = $100k
```

### High volume

```text
Volume/day = $1M+
```

Measure:

- reward liability
- average reward
- LOOTING buy demand
- treasury depletion
- expected reward distribution
- creator earnings
- protocol take

The reward table must never be selected without checking the treasury against expected and worst-case liability.

---

## 48. Important Legal / Compliance Considerations

Lucky Box mechanics involving randomized rewards of economically valuable tokens may create sweepstakes, gambling, promotional contest, consumer-protection, or securities-related considerations depending on jurisdiction and implementation.

RWA/stock-token rewards can independently raise securities, issuer, transfer restriction, custody, KYC/AML, and distribution issues.

Therefore production design must include counsel review for the target launch jurisdictions before real-money randomized rewards are enabled.

The technical design should support disabling specific reward types or jurisdictions without redeploying the entire launchpad.

---

## 49. Product North Star

LOOTING should not be understood as:

> "Another token launchpad."

The intended product identity is:

> **A launchpad where trading activity creates a transparent reward economy.**

Pons provides the launch/trading rail.

LOOTING provides:

- discovery (Explore + search)
- in-app Token Terminal trading UX
- XP
- seasons
- Lucky Boxes
- LOOTING staking vaults (Create Staking → public Events / Positions)
- Dev Lock (creator supply commitment)
- public Analytics
- LOOTING utility
- stock/RWA rewards (as box prizes and as optional launch quote pairs)
- reward transparency
- user retention loop
- Docs / Litepaper in product

---

## 50. Final Technical Direction

### Recommended architecture

```text
                         LOOTING
                           │
         ┌─────────────────┴─────────────────┐
         │                                   │
   LOOTING Frontend                         LOOTING Backend
         │                                   │
         │                              Indexer / XP
         │                                   │
         ▼                                   ▼
  Pons V2 Adapter                      PostgreSQL
         │                                   │
         ▼                                   │
  Pons V2 Factory                          │
         │                                   │
         ▼                                   │
  Token / Curve / V4                       │
         │                                   │
         └──────────────┬────────────────────┘
                        ▼
                Reward Contracts
                        │
        ┌───────────────┼────────────────┐
        ▼               ▼                ▼
   Lucky Box       Reward Vault     LOOTING Executor
        │               │                │
        ▼               ▼                ▼
     Winner          Stock/RWA          LOOTING
```

### Core principle

**Do not rebuild what Pons already provides. Build the layer Pons does not provide.**

That layer is LOOTING's moat:

```text
Pons launch infrastructure
            +
LOOTING reward infrastructure
            +
LOOTING XP / seasons
            +
LOOTING Lucky Boxes
            +
LOOTING staking vaults
            +
LOOTING Dev Lock
            +
LOOTING/RWA reward economy
            +
LOOTING discovery / Terminal / Analytics UX
```

---

## 51. Immediate Build Order

The first engineering sprint should be:

### Sprint 1

1. Create monorepo.
2. Create `AGENTS.md`.
3. Create Pons V2 adapter package.
4. Verify live Pons addresses and ABI on Robinhood Chain.
5. Build a read-only launch detector.
6. Build a launch registry table.
7. Build Pons launch transaction builder.
8. Build one end-to-end test launch on testnet/fork if available.

### Sprint 2

1. Build trade indexer.
2. Decode Pons curve BUY/SELL events.
3. Decode graduated V4 swap events.
4. Build normalized `trades` table.
5. Implement confirmation/reorg handling.

### Sprint 3

1. Implement XP engine.
2. Implement seasons.
3. Implement Bronze/Silver/Gold.
4. Build leaderboard.
5. Build Rewards page without financial claim.

### Sprint 4

1. Build Lucky Box contracts.
2. Build reward configuration hash.
3. Integrate randomness.
4. Build box mint/open lifecycle.
5. Test claim replay / double-open / reentrancy.

### Sprint 5

1. Deploy LOOTING token on testnet.
2. Integrate approved LOOTING swap route.
3. Implement reward purchase executor.
4. Fund reward treasury.
5. Run full economic simulation.

### Sprint 6

1. Add approved stock/RWA rewards.
2. Run security review.
3. Prepare audit package.
4. Set up multisig and operations.
5. Mainnet pilot.

---

## 52. Definition of Done for MVP

MVP is complete only when all are true:

- [ ] LOOTING can launch a token through the verified Pons V2 factory.
- [ ] The launch is visible from LOOTING.
- [ ] The token can be traded externally.
- [ ] LOOTING can detect qualifying BUYs from external trading venues.
- [ ] Wallet XP updates correctly.
- [ ] Weekly season reset works.
- [ ] Tier calculation is deterministic.
- [ ] Lucky Box issuance is one-time per qualifying trade.
- [ ] Lucky Boxes can only be opened once.
- [ ] Randomness cannot be controlled by the frontend.
- [ ] Reward treasury cannot be overdrawn.
- [ ] LOOTING rewards execute through an approved route.
- [ ] Winner receives reward directly.
- [ ] All major actions are reconstructable from on-chain events.
- [ ] Reorg recovery has been tested.
- [ ] Pons recipient changes are detected.
- [ ] Emergency pause works.
- [ ] Production multisig is configured.
- [ ] Security review is complete before meaningful treasury funding.

---

## 53. Source / Verification Notes

The Pons V2 integration assumptions in this document are based on review of the public `ponsdotdev/pons-labs` repository source, including:

- `PonsV2LaunchFactory.sol`
- `PonsV2BondingCurve.sol`
- `PonsV2MemeHook.sol`
- `ILaunchpadV2.sol`

The deployed addresses, enabled launch gate, exact deployed bytecode, and current Robinhood Chain runtime configuration must be verified independently before mainnet.

This document is a product/engineering specification, not a legal opinion or a security audit.

---

## 54. Dev Lock

### Purpose

Creators lock or vest supply of coins they launched to signal that tokens are committed on a schedule. Dev Lock is **separate from** Lucky Boxes and staking.

### Modes

**Time lock**

- Full amount unlocks at a chosen future date
- Product presets: 30 / 90 / 180 / 365 days, or custom date

**Vesting**

- Cliff (e.g. none / 30 / 90 days)
- Vesting length (e.g. 6 months / 1 year / 2 years)
- Release cadence: daily / weekly / monthly
- Claimable amount = vested − already claimed

### Product rules

- User selects a coin (typically from launches they created) and an amount from wallet balance
- Lock schedule is visible after creation
- Unlocked / vested amounts are **Claim**ed back to the wallet (product label is Claim, not Release)
- Early withdrawal of locked / unvested tokens is not allowed

### Share card

Each lock row has a **Share** action. Sharing opens a branded share card (canvas OG image) with:

- token symbol
- lock mode (Time-based / Vesting)
- locked amount
- status line (unlock date or vesting progress)
- unlock progress bar
- LOOTING branding / lootingpad.com footer

The user can share via the system share sheet or download the PNG. This mirrors Lucky Box share-card UX but is scoped to Dev Lock positions.

### On-chain mapping

See §16 (`LootingDevLock`) and §61 (deploy acceptance). Share card is off-chain only.

### UX surface

Route: `/devlock`  
Nav: Token tools group

---

## 55. Public Staking (Events & Positions)

### Purpose

Public marketplace for **token staking vaults**. Independent of Lucky Boxes. Not a single global LOOTING-only pool — each Create Staking action publishes a **new vault**.

### Core model

```text
Create Staking
      ↓
New vault registered for a LOOTING-launched token
      ↓
Vault appears on Staking → Events
      ↓
Wallets stake into that vault
      ↓
Positions show per-vault balances + claimable rewards
```

### Events tab (public)

Lists open vaults with:

- token / pool identity
- vault creator
- total staked + staker count
- reward pool size
- APR range from enabled locks
- event end date
- **Stake** → opens Positions with that vault selected

Summary strip may show open event count, aggregate staked, and aggregate reward pools.

### Positions tab (wallet)

- List of the connected wallet’s positions across vaults
- Selecting a position drives the stake / unstake form for that vault’s token
- Claimable rewards for the selected position
- Empty states: connect wallet, or browse Events if no positions

### Lock options (per vault)

| Lock | Role |
|---|---|
| Flexible | Lowest rate; no fixed term |
| 30 days | Mid rate |
| 90 days | Highest rate |

A vault creator chooses which locks to enable. Rates are config parameters, not immutable constants. Longer locks typically advertise higher rates.

### Actions

- Stake into a selected vault
- Unstake (subject to that vault’s lock rules)
- Claim rewards to wallet from the selected position

### Relationship to Analytics

Public Analytics may surface aggregate staking across vaults (totals, by lock length, daily charts).

### On-chain mapping

See §16 (`LootingStakingFactory` / `LootingStakingVault`) and §61. Each Events row = one vault; Positions rows = `(wallet, vault, lockId)`.

### UX surface

Route: `/staking`  
Nav: Protocol group

---

## 55a. Create Staking

### Purpose

Publish a **new staking vault** for any LOOTING-launched coin. The vault creator funds the reward pool. Permission is **not** limited to the original token creator — any connected wallet can create an event for a launched coin.

### Create flow

1. Select a LOOTING-launched token
2. Fund reward pool amount (in that token)
3. Choose event length (e.g. 30 / 90 / 180 / 365 days)
4. Enable lock options (Flexible / 30 / 90)
5. Review and create → new vault ID
6. Vault appears on Staking → Events

### Product rules

- One create = one new vault (distinct accounting from other vaults)
- Reward liability is capped by the funded pool for that vault
- Enabled locks and end date are snapshotted at create time
- Published vaults are publicly stakeable until the event ends (or is paused by emergency controls)

### On-chain mapping

`createVault` on `LootingStakingFactory` — one successful create = one new vault address + `vaultId` (§61.3).

### UX surface

Route: `/create-staking`  
Nav: Token tools group

---

## 56. Public Analytics

### Purpose

Season-level dashboard for the protocol — **not** a single-wallet page (that is Account). Distinct from ops Observability (§34).

### Content

- Volume, launch count, traders (24h / all-time toggle)
- Creator-fee vs Lucky Box funding split with top launches
- Aggregate staking across public vaults (by lock length where available)
- Daily charts: volume, new launches, staking (histogram with hover/focus values)

### UX surface

Route: `/analytics`

---

## 57. Pons Launch-Window Snipe Tax

### Product rule

On Pons V2, early **second-zero** buys in the launch window face a snipe tax:

```text
Starts at 99%
Decays linearly to 0% over ~3 seconds
Then normal tax rules apply
```

### What it does NOT change

- Lucky Box eligibility remains: qualifying buy → exit → open
- A snipe-taxed buy that still qualifies as a BUY still creates a box under the normal rules
- Creator tax / Lucky Box / burn splits still apply after the window

### UX

Surface the short notice on Launch review, Token Terminal, Docs, and Litepaper so users understand early-entry cost.

Exemptions: up to 8 wallets can be listed at launch as snipe-tax exempt (product form).

---

## 58. Token Terminal (product detail)

Complements §23. The Terminal is the primary in-app trading surface for a single launch.

### Must show

- Market facts: price, mcap, curve progress or graduated state, volume, traders
- Fee split visualization (creator side vs Lucky Box; burn share where displayed)
- Quote pair from launch
- Holders + recent fills
- Connected wallet position / PnL when holding

### Trading UX

- Buy and sell against the bonding curve while progress < 100%
- After graduation, trading continues in the launch quote pair via the graduated venue
- Amount presets and Instant / Market / Limit modes as product affordances
- Advanced settings: slippage, gas, priority fee, optional MEV protection, take-profit / stop-loss

### Claims

- Creator fee claim when the connected wallet is the fee recipient
- Holder fee claim when the launch enabled holder share and the wallet is eligible

External venues (GMGN, Axiom, Trojan, aggregators) remain valid (§3.2). The Terminal does not replace “trade anywhere”; it adds a first-party path.

---

## 59. Explore & Search (product detail)

### Explore boards

```text
New Pair · Almost Graduate · Migrate · Movers · Trending
```

Time windows and table/grid layouts are first-class filters, not optional polish.

### Search dialog

- Opens from the header or keyboard shortcut
- Pagination of results (product: eight per page with previous/next)
- Opening a result navigates to `/token/:address`
- Submitting the query lands on Explore with the query applied

---

## 60. Docs & Litepaper

### Docs intro

Short product orientation: connect wallet, Explore, Launch, Terminal, Lucky Boxes, seasons, Account.

### Detailed guide

Operational how-to covering wallet identity, Explore/search, launch form constraints, trading, Lucky Box states, Season XP tiers, leaderboard pagination, Analytics, fee/burn model, and graduation / launch-window rules.

### Litepaper

Narrative product economics: fee accrual display, 80/20 creator-side vs protocol burn, holder share, and launch-window snipe tax — without replacing this engineering specification.

These surfaces are part of the product IA so rules are user-visible, not only developer-facing.

---

## 61. Deploy Guide — Contracts from Product UI

This section is the checklist for implementing and deploying smart contracts so they line up with the current web UI. Treat the UI routes as acceptance surfaces: if a wallet action exists in the UI, there must be a corresponding on-chain entrypoint (except pure presentation such as share cards).

### 61.1 UI → contract map

| UI surface | Route | On-chain module | Required calls |
|---|---|---|---|
| Create Staking | `/create-staking` | `LootingStakingFactory` | `createVault(...)` |
| Staking → Events | `/staking` (tab Events) | Factory registry + each vault | read `vaultInfo`, lists from events/indexer |
| Staking → Positions | `/staking` (tab Positions) | `LootingStakingVault` | `stake`, `unstake`, `claimRewards`, `pendingRewards` |
| Dev Lock form | `/devlock` | `LootingDevLock` | `createTimeLock` / `createVesting` |
| Dev Lock Claim | `/devlock` list | `LootingDevLock` | `claim(lockId)` |
| Dev Lock Share | `/devlock` list | **none** | frontend canvas OG only |
| Launch | `/create` | Pons adapter + `LootingLaunchRegistry` | existing launch flow |
| Lucky Boxes | `/rewards` | `LootingLuckyBox` + vault/executor | existing reward flow |

### 61.2 Deploy order (recommended)

1. `LootingEmergencyController` (pause roles)
2. `LootingLaunchRegistry` (tokens that may be locked / vaulted)
3. `LootingDevLock` (depends on registry for creator checks)
4. `LootingStakingFactory` + vault implementation / clone template
5. Wire factory to registry + emergency pause
6. Indexer subscriptions for new events in §35
7. Point frontend env to factory + DevLock addresses

### 61.3 Create Staking → new vault (acceptance)

When a user completes Create Staking in the UI:

1. Wallet approves `rewardAmount` of `stakeToken` to the factory (or vault)
2. `createVault` succeeds and returns `(vault, vaultId)`
3. `StakingVaultCreated` is emitted
4. Staking → Events shows the new row after indexer/API refresh
5. Another wallet can `stake` into that vault from Positions
6. Reward payouts never exceed the funded `rewardAmount`

Failure cases the UI must surface:

- token not a LOOTING launch
- reward amount 0 / endsAt in the past / no locks enabled
- insufficient allowance or balance

### 61.4 Staking Positions (acceptance)

Positions UI expects per `(wallet, vault, lockId)`:

- staked principal
- lock label + APR
- pending / claimable rewards
- ability to stake more (same lock) or unstake when allowed
- Claim button pays rewards only (principal stays until unstake)

Default product lock ids:

| `lockId` | Label | Duration | Typical APR (example only) |
|---:|---|---|---|
| 0 | Flexible | 0 | 8% (800 bps) |
| 1 | 30 days | 30d | 14% (1400 bps) |
| 2 | 90 days | 90d | 22% (2200 bps) |

APR values are set per vault at create time (UI may show presets). They are not global protocol constants.

### 61.5 Dev Lock (acceptance)

Create Time-based:

- pull `amount` of creator’s token
- store unlock timestamp
- `claimable = 0` until unlock; then full remainder

Create Vesting:

- pull `amount`
- store `cliff`, `unlock`, cadence metadata
- claimable follows linear formula in §16

Claim:

- transfers only `claimableAmount`
- updates `claimed`
- removes closed locks from “active” lists when fully claimed

Share:

- no transaction; card data is read from lock state + token metadata

Authorization:

- only the launch creator may create Dev Locks for that token (matches UI “coins you launched”)

### 61.6 Storage the indexer/API should mirror

```text
staking_vaults
  vault_id, vault_address, stake_token, creator, reward_funded,
  reward_remaining, total_staked, staker_count, ends_at, lock_mask,
  apr_flex_bps, apr_30_bps, apr_90_bps, created_at, status

staking_positions
  vault_id, wallet, lock_id, amount, rewards_claimed, lock_started_at,
  lock_ends_at, updated_at

dev_locks
  lock_id, owner, token, mode, amount, claimed, start, cliff, unlock,
  cadence, created_at, status
```

### 61.7 Security requirements for these modules

- ReentrancyGuard on stake / unstake / claim / createVault / DevLock claim
- SafeERC20 for all token moves
- Pausable via emergency controller on factory create + vault stake
- No generic owner `withdraw(token,to,amount)` on live vault reward accounting
- Explicit token decimal handling (do not assume 18)
- Reject fee-on-transfer / rebasing tokens unless explicitly supported and tested
- Create Staking and Dev Lock must not accept arbitrary unregistered ERC-20s

### 61.8 Out of scope for these contracts

- Share-card image generation
- Explore / Analytics chart aggregation (indexer/API)
- Lucky Box randomness (separate modules)
- Changing Pons bonding-curve mechanics

### 61.9 Definition of done for vault + Dev Lock deploy

- [ ] Factory creates a distinct vault per Create Staking tx
- [ ] Events tab can list all vaults from chain/indexer
- [ ] Positions can stake / unstake / claim against a selected vault + lock
- [ ] Flexible / 30 / 90 lock rules enforced on-chain
- [ ] Vault reward paid ≤ reward funded
- [ ] Dev Lock time + vesting claim math matches UI formula
- [ ] Non-creators cannot Dev-Lock someone else’s launch token
- [ ] Pause stops new vault creates and new stakes
- [ ] All actions emit §35 events
- [ ] Frontend env wired; mock paths removable behind feature flags

