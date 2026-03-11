import type { ElementHandle, Page } from "playwright";
import type { NormalizedListing, ScraperConfig } from "../types";
import {
  parsePrice,
  parseBedrooms,
  parseSurface,
  hasGardenFromText,
  externalIdFromUrl,
  isSoldOrRentedFromText,
} from "../normalize";

const DEFAULT_LISTINGS_URL =
  "https://www.trevi.be/nl/panden-te-koop/huizen?purpose=0&pagenumber=&office=&estatecategory=1&zips%5B%5D=9090_Melle&zips%5B%5D=9820_Merelbeke&zips%5B%5D=%5BStad%5D12_Gent+%2B+Deelgemeenten&minprice=450000&maxprice=600000&rooms=3&estateid=";

/** Same as trevi-gent agency config (for direct run) */
const TREVI_LISTINGS_URL =
  "https://www.trevi.be/nl/panden-te-koop/huizen?purpose=0&pagenumber=&office=&estatecategory=1&zips%5B%5D=9070_Destelbergen&zips%5B%5D=9070_Heusden+%28O.Vl.%29&zips%5B%5D=9090_Melle&zips%5B%5D=9820_Merelbeke&zips%5B%5D=%5BStad%5D12_Gent+%2B+Deelgemeenten&minprice=450000&maxprice=600000&rooms=3&estateid=";

export async function scrapeTrevi(
  page: Page,
  config: ScraperConfig,
  baseUrl: string,
  options?: { debug?: boolean }
): Promise<NormalizedListing[]> {
  const debug = options?.debug ?? false;
  const results: NormalizedListing[] = [];
  const listingsUrl = config.listingsUrl ?? DEFAULT_LISTINGS_URL;
  if (!listingsUrl) {
    if (debug) console.error("[trevi] no listingsUrl");
    return results;
  }

  const seenUrls = new Set<string>();
  let pageNum = 1;
  const maxPages = 20;

  while (pageNum <= maxPages) {
    const url = listingsUrl.includes("pagenumber=")
      ? listingsUrl.replace(/pagenumber=[^&]*/, `pagenumber=${pageNum}`)
      : pageNum === 1
        ? listingsUrl
        : `${listingsUrl}${listingsUrl.includes("?") ? "&" : "?"}pagenumber=${pageNum}`;

    if (debug) console.error("[trevi] page", pageNum, "GET", url.slice(0, 100) + "...");
    await page.goto(url, { waitUntil: "load", timeout: 30000 });

    // Listings are loaded by JS; wait for content then look for listing links
    await new Promise((r) => setTimeout(r, 5000));
    try {
      await page.waitForSelector('a[href*="/nl/pand/"]', { timeout: 10000, state: "attached" });
    } catch {
      /* continue */
    }
    await new Promise((r) => setTimeout(r, 1500));

    // Prefer links that look like listing detail pages: /nl/pand/.../huis/... or /nl/pand/<id>/
    let links = await page.$$('a[href*="/nl/pand/"][href*="/huis/"]');
    if (links.length === 0) {
      links = await page.$$('a[href*="/nl/pand/"][href*="/pand/"]');
      if (debug) console.error("[trevi] fallback a[href*=\"/nl/pand/\"][href*=\"/pand/\"] count", links.length);
    }
    if (links.length === 0) {
      const allPand = await page.$$('a[href*="/nl/pand/"]');
      const listingLinks: Awaited<ReturnType<typeof page.$$>>[number][] = [];
      for (const a of allPand) {
        const h = await a.getAttribute("href");
        if (h && /\/pand\/\d+/.test(h) && !/panden-te-koop\?/.test(h)) listingLinks.push(a);
      }
      links = listingLinks;
      if (debug) console.error("[trevi] fallback /pand/\\d+ (excl. search) count", links.length);
    }
    if (links.length === 0) {
      const allPand = await page.$$('a[href*="/nl/pand/"]');
      const listingLinks: Awaited<ReturnType<typeof page.$$>>[number][] = [];
      for (const a of allPand) {
        const h = await a.getAttribute("href");
        if (h && !/panden-te-koop\?|panden-te-koop$/.test(h)) listingLinks.push(a);
      }
      links = listingLinks;
      if (debug) console.error("[trevi] fallback all /nl/pand/ (excl. search page) count", links.length);
    }
    if (links.length === 0 && debug) {
      const anyPand = await page.$$('a[href*="pand"]');
      if (anyPand.length > 0) {
        const samples = await Promise.all(
          anyPand.slice(0, 8).map((a) => a.getAttribute("href"))
        );
        console.error("[trevi] sample hrefs containing 'pand':", samples);
      }
      const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 300) ?? "");
      console.error("[trevi] body text slice:", bodyText);
    }
    if (debug) console.error("[trevi] links found", links.length);
    if (links.length === 0) break;

    let skippedNoHref = 0;
    let skippedPandId = 0;
    let skippedDuplicate = 0;
    let skippedSold = 0;
    let skippedNoPrice = 0;

    for (const link of links) {
      const href = await link.getAttribute("href");
      if (!href) {
        skippedNoHref++;
        continue;
      }
      if (!/\/pand\/[\d-]+\//.test(href) && !/\/pand\/[^/]+\//.test(href)) {
        skippedPandId++;
        continue;
      }

      const fullUrl = href.startsWith("http") ? href : new URL(href, baseUrl).href;
      if (seenUrls.has(fullUrl)) {
        skippedDuplicate++;
        continue;
      }

      const card = await link.evaluateHandle(
        (el) =>
          el.closest("article") ??
          el.closest("[class*='card']") ??
          el.closest("li") ??
          el.parentElement?.parentElement?.parentElement ??
          el
      );
      const cardEl = card.asElement();
      if (!cardEl) continue;

      const allText = await (cardEl as ElementHandle<HTMLElement>).evaluate(
        (el) => (el.innerText ?? "").trim()
      );
      if (isSoldOrRentedFromText(allText)) {
        skippedSold++;
        continue;
      }
      seenUrls.add(fullUrl);

      const price = parsePrice(allText);
      if (price <= 0) {
        skippedNoPrice++;
        if (debug && skippedNoPrice <= 2)
          console.error("[trevi] skip no price, text slice:", allText.slice(0, 200));
        continue;
      }

      const bedrooms = parseBedrooms(allText);
      const livingSurfaceM2 = parseSurface(allText);
      const hasGarden = hasGardenFromText(allText);

      const title =
        (await (cardEl as ElementHandle<HTMLElement>).evaluate((el) => {
          const h = el.querySelector("h2, h3, h4, [class*='title']");
          return h?.textContent?.trim() ?? "";
        })) ||
        (await link.textContent()) ||
        "Huis";

      const img = await (cardEl as ElementHandle<HTMLElement>).evaluate(
        (el) => el.querySelector("img")?.getAttribute("src") ?? null
      );
      const imageUrl = img ? (img.startsWith("http") ? img : new URL(img, baseUrl).href) : null;

      const address = await (cardEl as ElementHandle<HTMLElement>).evaluate((el) => {
        const loc = el.querySelector("[class*='location'], [class*='locality'], [class*='city'], [class*='address'], [class*='place']");
        const text = loc?.textContent?.trim();
        if (text) return text;
        const inner = (el.innerText ?? "").trim();
        const postalMatch = inner.match(/\b(9\d{3})\s+([A-Za-z\-]+(?:\s+[A-Za-z\-]+)*)/);
        if (postalMatch) return postalMatch[2].trim();
        return null;
      });
      const municipality = address ?? "Gent";

      results.push({
        externalId: externalIdFromUrl(fullUrl),
        url: fullUrl,
        title: title.trim().slice(0, 500),
        price,
        bedrooms,
        livingSurfaceM2,
        hasGarden,
        municipality,
        address: address ?? (title ? `${title}, ${municipality}` : null),
        description: null,
        imageUrl,
      });
    }

    if (debug && (skippedNoHref || skippedPandId || skippedDuplicate || skippedSold || skippedNoPrice))
      console.error(
        "[trevi] skipped: noHref=",
        skippedNoHref,
        "pandId=",
        skippedPandId,
        "dup=",
        skippedDuplicate,
        "sold=",
        skippedSold,
        "noPrice=",
        skippedNoPrice
      );

    pageNum += 1;
  }

  if (debug) console.error("[trevi] total listings", results.length);
  return results;
}

/** Run directly: npx tsx lib/scraper/adapters/trevi.ts */
async function main() {
  const { chromium } = await import("playwright");
  const baseUrl = "https://www.trevi.be";
  const config: ScraperConfig = { listingsUrl: TREVI_LISTINGS_URL };
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const listings = await scrapeTrevi(page, config, baseUrl, { debug: true });
    console.log("Listings:", listings.length);
    console.log(JSON.stringify(listings.slice(0, 2), null, 2));
  } finally {
    await browser.close();
  }
}

if (process.argv[1]?.includes("trevi")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
