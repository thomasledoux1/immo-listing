/**
 * Run the scraper only for Top Vastgoed (for debugging).
 * Usage: npx tsx scripts/scrape-topvastgoed.ts
 *
 * Set DEBUG_TOPVASTGOED=1 to see API pagination logs.
 * Set API_ONLY=1 to only run the API fetch (no browser, no DB) and see if pagination finishes.
 */
process.env.DEBUG_TOPVASTGOED = "1";

import { chromium } from "playwright";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { agencies } from "../db/schema";
import { runScraperForAgency } from "../lib/scraper/run";
import { fetchTopVastgoedFromApi } from "../lib/scraper/adapters/topvastgoed-api";

async function main() {
  if (process.env.API_ONLY === "1") {
    console.log("[scrape-topvastgoed] API only: fetching Top Vastgoed listings...");
    const items = await fetchTopVastgoedFromApi("https://topvastgoed.be");
    console.log("[scrape-topvastgoed] API returned", items.length, "listings");
    return;
  }

  const rows = await db
    .select()
    .from(agencies)
    .where(eq(agencies.slug, "top-vastgoed"))
    .limit(1);

  if (rows.length === 0) {
    console.error("Top Vastgoed agency not found in DB. Run: npx tsx scripts/seed-agencies.ts");
    process.exit(1);
  }

  const agency = rows[0];
  console.log("[scrape-topvastgoed] Running for agency:", agency.name, "id:", agency.id);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  try {
    console.log("[scrape-topvastgoed] Calling runScraperForAgency...");
    const result = await runScraperForAgency(page, agency);
    console.log("[scrape-topvastgoed] Done:", result);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
