# Ghent Immo – New listings (24h)

Next.js app that scrapes **20 immo agencies in Ghent** (no aggregators like Zimmo/Immoweb) and shows houses that appeared in the **last 24 hours** with:

- **Price:** 450 000 – 600 000 €  
- **Garden:** yes  
- **Bedrooms:** ≥ 3  
- **Livable surface:** ≥ 160 m²  

## Stack

- **Next.js 16** (App Router), **React 19**, **TypeScript**
- **shadcn/ui** + Tailwind
- **Drizzle ORM** + **SQLite** (better-sqlite3)
- **Playwright** for scraping agency websites

## Setup

```bash
npm install
npx drizzle-kit push
npx tsx scripts/seed-agencies.ts
```

Optional: install Playwright Chromium for the scraper:

```bash
npx playwright install chromium
```

## Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The home page lists matching houses (first seen in the last 24h). If the list is empty, run the scraper once to backfill.

## Running the scraper

The scraper visits each agency’s website, extracts listings, and upserts them into the DB. **“Last 24 hours”** is based on **first time we see a listing** (`first_seen_at`).

### Option 1: Local / CLI (recommended)

Run the script manually or via cron on a machine where Node and Playwright can run:

```bash
npm run scrape
```

Or with tsx directly:

```bash
npx tsx scripts/scrape.ts
```

Schedule it every 2–6 hours (e.g. cron):

```cron
0 */4 * * * cd /path/to/ghent-immo && npm run scrape
```

### Option 2: API route (Vercel or self-hosted)

You can trigger the same logic via GET or POST with a secret:

```bash
curl -X POST "https://your-domain.com/api/cron/scrape" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
# or
curl "https://your-domain.com/api/cron/scrape?secret=YOUR_CRON_SECRET"
```

Set `CRON_SECRET` in your environment. On **Vercel**, the route uses [@sparticuz/chromium](https://www.npmjs.com/package/@sparticuz/chromium) and `playwright-core` for a serverless-friendly Chromium build (see [Zenrows: Playwright on Vercel – Cold start optimization](https://www.zenrows.com/blog/playwright-vercel#cold-start-optimization)). **Vercel Cron** is configured to call this route every 6 hours (`vercel.json`).

## Database

- **Local:** SQLite file `db/local.sqlite` (override with `DATABASE_PATH`). Used when `TURSO_DATABASE_URL` is not set.
- **Production (Vercel):** Set **Turso** env vars so the app uses your remote DB:
  - `TURSO_DATABASE_URL` – e.g. `libsql://your-db.your-region.turso.io`
  - `TURSO_AUTH_TOKEN` – create with `turso db tokens create your-db-name`
  - In Vercel: Project → Settings → Environment Variables. Add both for Production (and Preview if you want).
- **Tables:** `agencies`, `listings` (url, price, bedrooms, surface, garden, first_seen_at, last_seen_at, deleted_at).
- **Soft delete:** Listings you delete in the UI are marked with `deleted_at` and no longer shown. The scraper does not re-add or update them.
- **Drizzle:** `npm run db:generate`, `npm run db:push`, `npm run db:studio`. With `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` set, `db:push` applies to Turso.

## Project layout

- `app/` – Next.js App Router (page, API cron route)
- `components/` – UI (shadcn, listing card)
- `db/` – Drizzle schema and migrations
- `data/agencies.ts` – Agency list and scraper config
- `lib/` – DB client, queries, scraper (adapters, normalize, run)
- `scripts/` – `seed-agencies.ts`, `scrape.ts`

Data is collected from public agency websites. Respect `robots.txt` and rate limits when scheduling the scraper.
