# Crypto 5 — Daily Opportunity Scanner

A personal research tool that scans the crypto market each day. It filters out stablecoins, wrapped tokens, dead or illiquid coins and serious red flags. It scores the rest on a transparent 0–100 research scale and shows **5 research candidates**, each with the reasons to be careful, a bear case and invalidation conditions.

> These results are market research generated from available data. They are not guarantees of future performance. Cryptocurrency markets are highly volatile and involve substantial risk.

It does **not** trade, connect to exchanges or hold funds. Scores rank the evidence that is available. They do not predict prices.

---

## 1. What you need
- Node.js 18.18+ (20 LTS recommended)
- PostgreSQL 14+ (local, or a free cloud database such as [Neon](https://neon.tech) or Supabase)
- A **free CoinGecko Demo API key**: https://www.coingecko.com/en/api/pricing → "Create Free Account" → Developer Dashboard → "Add new key"

## 2. Set up (about 10 minutes)
```bash
npm install
cp .env.example .env        # then edit .env (see below)
npm run db:push             # creates the tables
npm run build && npm start  # opens on http://localhost:3100
```
Click **Run today's scan**. The first live scan takes about 3–5 minutes on the free plan because requests are rate-limited on purpose. Later page loads are instant.

For development with hot reload: `npm run dev`.

### .env
| Variable | Needed? | What it does |
|---|---|---|
| `DATABASE_URL` | **Yes** | Postgres connection string |
| `AUTH_SECRET` | **Yes** | Any long random string (`openssl rand -hex 32`) |
| `DATA_MODE` | **Yes** | `LIVE` for real data. `SAMPLE` = fictional test coins only |
| `COINGECKO_API_KEY` | Strongly recommended | Free Demo key. Raises the rate limit |
| `COINGECKO_PLAN` | Optional | `demo` (default) or `pro` for a paid key |
| `APP_PASSWORD` | Recommended if online | Puts a password on the whole app |
| `CRON_SECRET` | For the daily auto-scan | Protects `/api/cron/scan` |
| `GITHUB_TOKEN` | Optional (free) | Better developer-activity data (github.com → Settings → Developer settings → token, no scopes) |
| `CMC_API_KEY` | Optional (free) | Cross-checks price, market cap and volume against CoinMarketCap |
| `CRYPTOPANIC_API_KEY` | Optional (free) | News headlines on coin pages |

API keys are read only on the server from environment variables. They are never sent to the browser or stored in the database.

## 3. Free vs paid data
**Works on free sources:** CoinGecko (prices, market cap, FDV, supply, volume, 365-day history, developer and community stats), DeFiLlama (TVL, fees, stablecoin supply), alternative.me (Fear & Greed), GitHub, CoinMarketCap free tier, CryptoPanic free tier.

**Needs paid data, so it is shown as N/A and marked "paid" in Settings:** holder concentration, whale and insider wallets, exchange inflows and outflows (Glassnode, Nansen, Arkham), token-unlock calendars (Token Unlocks / Tokenomist), smart-contract audit feeds, and social sentiment volume (LunarCrush, Santiment).

For unlocks, catalysts and security incidents, add verified events in **Settings → Catalysts** with the official source link. They feed the scores, red flags and alerts.

## 4. How a scan works
1. Fetches the top coins (Settings → "Coins to scan", default 2,000), plus global data, Fear & Greed, DeFiLlama and exchange rates.
2. Classifies the market regime (Bullish, Neutral, Bearish or High Volatility) with the evidence behind it.
3. Removes stablecoins, wrapped, bridged, staked and LP tokens, coins below the volume floor, and coins outside your price, risk and market-cap filters.
4. Pre-ranks the rest, then analyses the top N (default 30) in depth: 365-day technicals, tokenomics, TVL, development and catalysts.
5. Scores them on 9 components: Fundamentals 25, Tokenomics 15, Technical 15, Liquidity 10, On-chain 10, Dev 10, Catalysts 5, Market 5, Risk 5. Missing data gets a fixed neutral 40% and is labelled **N/A – neutral**.
6. Picks 5. Each must have no serious red flags, fall within your risk preference and have at least 50% data coverage, with at most 2 from the same sector.
7. Saves a price snapshot so the **History** page can later show what actually happened after 7, 30 and 90 days, compared with BTC.
8. Checks your alerts.

Every number shows its source and timestamp. Hover over it to see the details. Derived values are marked ESTIMATE.

## 5. Screens
Dashboard · Market overview · Daily 5 (comparison table, "Why you should not buy", bull and bear cases, invalidation) · Coin detail (all sections, charts, cross-check, score history) · Screener with saved screens · Watchlist and alerts · Portfolio tracker · History and scan log · Printable daily report (Print → Save as PDF) · Settings, data sources and catalysts.

## 6. Run it every day automatically
**Vercel + Neon (free tiers, no commands needed, works from a phone):**
1. Put this folder in a private GitHub repo.
2. On vercel.com, sign in with GitHub → Add New → Project → import the repo. Before deploying, add 3 environment variables: `COINGECKO_API_KEY`, `APP_PASSWORD` (your login password) and `CRON_SECRET` (any random word). Deploy.
3. In the Vercel project → **Storage** → Create Database → **Neon** (free) → Connect. This sets `DATABASE_URL` for you. Then go to Deployments → ⋯ → **Redeploy**.
4. Open your site. The tables are created automatically on first start (`setup.sql` is the same SQL, in case you prefer to run it yourself). `DATA_MODE` defaults to LIVE. `AUTH_SECRET` is optional; if it is not set, the login key is derived from `APP_PASSWORD`.
5. `vercel.json` already schedules `/api/cron/scan` daily at 01:15 UTC (06:45 IST). Vercel sends the `CRON_SECRET` automatically.

   Note: a full scan can take several minutes. On Vercel's free Hobby plan functions are time-limited. If the cron scan times out, use one of these options:
   - Lower "Coins to scan" and "Candidates analysed" in Settings.
   - Run the scan from your own computer with `npm run scan` (for example, Windows Task Scheduler or cron: `15 7 * * * cd /path/to/crypto5 && npm run scan`).

**On your own PC only:** `npm start`, then `npm run scan` from a daily scheduled task.

## 7. Tests
```bash
npm test        # unit tests: indicators, scoring, red flags, regime
```
Before delivery, the whole app was also tested end-to-end in a browser (scan, all pages, watchlist, alerts, portfolio, saved screens, catalysts, report, mobile layout) using `DATA_MODE=SAMPLE`.

## 8. Sample mode
`DATA_MODE=SAMPLE` generates ~625 **fictional** coins so you can try the app with no internet or keys. A yellow banner is shown on every page. Never use sample output for decisions.

---
*No automatic trading. Crypto assets are highly volatile and can lose substantial or all of their value.*
