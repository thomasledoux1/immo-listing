import type { Page } from 'playwright';
import { IMMOSCOOP_SEARCH_URL } from '../../constants';
import type { NormalizedListing } from '../types';
import { hasGardenFromText, parsePrice } from '../normalize';

/** Parse one card block (HTML between two property-card_card links) into a NormalizedListing. */
function parseCardBlock(
  block: string,
  path: string,
  baseUrl: string,
): NormalizedListing | null {
  const pathMatch = path.match(/\/te-koop\/([^/]+)\/(\d+)$/);
  if (!pathMatch || !pathMatch[2]) return null;
  const id = pathMatch[2];
  const url = `${baseUrl}${path}`;

  const priceEl = block.match(
    /property-card_price__XfyPH">(?:€\s*&nbsp;)?([^<]+)<\/p>/,
  );
  const price = parsePrice(priceEl?.[1] ?? null) || 500000;

  const titleEl = block.match(
    /property-card_title__togt2">\s*([^<]*)\s*<\/h3>/,
  );
  const title = (titleEl?.[1] ?? 'Huis te koop').trim();

  const addressEl = block.match(
    /<address[^>]*>[\s\S]*?<div><div>([^<]+)<\/div><\/div>/,
  );
  const addressText = (addressEl?.[1] ?? '').trim();
  const municipality = addressText || 'Gent';
  const address = addressText || null;

  const imgEl = block.match(
    /image-gallery-image[^>]*\ssrc="([^"]+)"/,
  );
  const imageUrl = imgEl?.[1] ?? null;

  const livableMatch = block.match(
    /data-selector="feature-icon:div:livableSurfaceArea"[\s\S]*?FeatureIcons_value__flPF6[^>]*>\s*(\d+(?:[.,]\d+)?)\s*</,
  );
  const livingSurfaceM2 = livableMatch?.[1]
    ? parseFloat(livableMatch[1].replace(',', '.'))
    : null;

  const terrainMatch = block.match(
    /data-selector="feature-icon:div:TerrainArea"[\s\S]*?FeatureIcons_value__flPF6[^>]*>\s*(\d+(?:[.,]\d+)?)\s*</,
  );
  const terrainM2 = terrainMatch?.[1]
    ? parseFloat(terrainMatch[1].replace(',', '.'))
    : null;
  const hasGarden =
    (terrainM2 != null && terrainM2 > 0) ||
    hasGardenFromText(block);

  const bedroomMatch = block.match(
    /data-selector="feature-icon:div:BedroomNumber"[\s\S]*?FeatureIcons_value__flPF6[^>]*>\s*(\d+)\s*</,
  );
  const bedrooms = bedroomMatch?.[1]
    ? parseInt(bedroomMatch[1], 10)
    : null;

  return {
    externalId: id,
    url,
    title,
    price,
    bedrooms,
    livingSurfaceM2,
    hasGarden,
    municipality,
    address,
    description: null,
    imageUrl,
  };
}

/** Parse Immoscoop search results HTML (structure as in immoscoophtmlexample.html). */
export function parseImmoscoopHtml(
  html: string,
  baseUrl: string,
): NormalizedListing[] {
  const results: NormalizedListing[] = [];
  const cardStartRegex =
    /<a\s[^>]*data-mobile-selector="property-card_card"[^>]*href="(\/te-koop\/[^"/]+\/\d+)"/g;
  const matches: { index: number; path: string }[] = [];
  let match = cardStartRegex.exec(html);
  while (match !== null) {
    const path = match[1];
    if (path) matches.push({ index: match.index, path });
    match = cardStartRegex.exec(html);
  }
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const next = matches[i + 1];
    if (!m) continue;
    const start = m.index;
    const end = next ? next.index : html.length;
    const block = html.slice(start, end);
    const listing = parseCardBlock(block, m.path, baseUrl);
    if (listing) results.push(listing);
  }
  return results;
}

const WAIT_AFTER_LOAD_MS = 10_000;

/** Load search page in browser, wait 10s, scrape HTML. Use searchPageUrl from config or default. */
export async function fetchImmoscoopFromApi(
  baseUrl: string,
  searchPageUrl?: string | null,
  browserPage?: Page | null,
): Promise<NormalizedListing[]> {
  const page = browserPage ?? null;
  if (!page) {
    return [];
  }

  const url = searchPageUrl ?? IMMOSCOOP_SEARCH_URL;
  const res = await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  if (!res?.ok())
    throw new Error(
      `Immoscoop search page ${res?.status()}: ${res?.statusText()}`,
    );

  await new Promise(r => setTimeout(r, WAIT_AFTER_LOAD_MS));

  const html = await page.content();
  return parseImmoscoopHtml(html, baseUrl);
}

/** Run directly: npx tsx lib/scraper/adapters/immoscoop-api.ts [path/to/immoscoophtmlexample.html] */
async function main() {
  const baseUrl = 'https://www.immoscoop.be';
  const localFile = process.argv[2];
  if (localFile) {
    const fs = await import('fs');
    const html = fs.readFileSync(localFile, 'utf-8');
    const listings = parseImmoscoopHtml(html, baseUrl);
    console.log('Listings:', listings.length);
    console.log(JSON.stringify(listings.slice(0, 3), null, 2));
    return;
  }
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const browserPage = await context.newPage();
    const listings = await fetchImmoscoopFromApi(baseUrl, undefined, browserPage);
    console.log('Listings:', listings.length);
    console.log(JSON.stringify(listings.slice(0, 3), null, 2));
  } finally {
    await browser.close();
  }
}

if (process.argv[1]?.includes('immoscoop-api')) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
