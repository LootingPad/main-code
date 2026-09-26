# Frontend ↔ Backend Wiring Report

**Date:** 2026-09-26 (updated: Trenches-style New Pair via ponsapi WS)  
**Frontend:** `main-code/apps/web`  
**Backend:** `backend/looting-backend`

---

## Explore sources

| Tab | Source | Notes |
|-----|--------|--------|
| **New Pair** / **Almost Graduate** | **ponsapi.dev** HTTP + WS `subscribeNewToken` | Live Pons creates (like GMGN Trenches) |
| **Migrate** | DexScreener Robinhood | Graduated / DEX-listed |

Env:
- `PONSAPI_API_KEY` / `PONSAPI_BASE_URL` / `PONSAPI_WS_URL`
- `ENABLE_DEXSCREENER_FEED=true`

Code: `src/pons-adapter/live-feed.ts` (WS buffer) + `src/clients/dexscreener.ts`

FE New/Almost poll **8s** so WS pushes show up fast (14/page pager unchanged).

---

## Still mock / deferred

| Item | Notes |
|------|--------|
| `/looting` burn | intentional mock |
| Write prepare/confirm | not wired |
| FE SSE for instant push | optional; poll 8s for now |
