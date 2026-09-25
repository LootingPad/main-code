# main-code

LOOTING — a token launchpad on Robinhood Chain that adds XP, Lucky Boxes and staking
on top of the Pons V2 launch infrastructure. This repo holds the web client.

## Stack

- Next.js 15 (App Router) with React 19 and TypeScript
- Tailwind CSS v4 through the PostCSS plugin
- No backend yet: every screen runs on the mock data layer

## Getting started

```bash
cd apps/web
npm install
npm run dev
```

The app serves on http://localhost:3000.

## Layout

| Path | Contents |
| --- | --- |
| `apps/web/src/app` | Routes: explore, create, token terminal, rewards, leaderboard, account, analytics, staking, dev lock, docs |
| `apps/web/src/components` | Shell, wallet context and the per-section UI |
| `apps/web/src/lib` | Mock market data, fee model, draft storage, launch window |
| `LOOTING_PRODUCT_SPEC.md` | Product and technical specification |

## Status

The UI is complete against `apps/web/src/lib/mock.ts`. Contracts, the indexer and the
reward backend are not wired up, so wallet connection, trades and claims are simulated.
