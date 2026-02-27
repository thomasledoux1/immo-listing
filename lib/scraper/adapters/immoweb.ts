import type { Page } from 'playwright';
import type { NormalizedListing, ScraperConfig } from '../types';
import {
  externalIdFromUrl,
  hasGardenFromText,
  parsePrice,
  parseBedrooms,
  parseSurface,
} from '../normalize';

const LISTINGS_URL =
  'https://www.immoweb.be/en/search/house/for-sale?countries=BE&maxPrice=600000&minPrice=450000&postalCodes=9000,9030,9031,9032,9040,9041,9050,9070,9090,9820,9940&page=1&orderBy=newest';

/** Headers that mimic a real browser to reduce DataDome 403 (x-datadome: protected) */
const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-GB,en;q=0.9,nl;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'max-age=0',
  'Sec-Ch-Ua':
    '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"macOS"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
};

/** Extract JSON from :classified='{...}' in HTML by brace-counting */
function extractClassifiedJsonBlocks(html: string): string[] {
  const blocks: string[] = [];
  const trigger = ":classified='";
  let i = 0;
  while (true) {
    const start = html.indexOf(trigger, i);
    if (start === -1) break;
    const jsonStart = start + trigger.length;
    if (html.charCodeAt(jsonStart) !== 0x7b) {
      i = jsonStart;
      continue;
    }
    let depth = 0;
    let j = jsonStart;
    while (j < html.length) {
      const c = html[j];
      if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) {
          blocks.push(html.slice(jsonStart, j + 1));
          break;
        }
      } else if (c === '"' && depth > 0) {
        j = skipString(html, j, '"') + 1;
        continue;
      }
      j++;
    }
    i = j + 1;
  }
  return blocks;
}

function skipString(html: string, at: number, quote: string): number {
  at++;
  while (at < html.length) {
    const c = html[at];
    if (c === '\\') {
      at += 2;
      continue;
    }
    if (c === quote) return at;
    at++;
  }
  return at;
}

interface ImmowebClassified {
  id?: number;
  property?: {
    type?: string;
    subtype?: string;
    title?: string;
    bedroomCount?: number;
    netHabitableSurface?: number;
    location?: { locality?: string; postalCode?: string };
  };
  transaction?: { type?: string; sale?: { price?: number } };
  price?: {
    mainValue?: number | null;
    minRangeValue?: number;
    maxRangeValue?: number;
  };
  media?: { pictures?: Array<{ largeUrl?: string }> };
}

function parseClassifiedJson(raw: string): ImmowebClassified | null {
  try {
    const decoded = raw.replace(/\\\//g, '/');
    return JSON.parse(decoded) as ImmowebClassified;
  } catch {
    return null;
  }
}

/** Data extracted from one DOM card (new Immoweb HTML without :classified= JSON) */
interface DomCardData {
  url: string;
  externalId: string;
  priceText: string;
  title: string;
  infoText: string;
  localityText: string;
  imageUrl: string | null;
}

/** Extract listing cards from new HTML format: <article id="classified_123"> with link, price, etc. */
function extractFromDomCards(html: string): DomCardData[] {
  const cards: DomCardData[] = [];
  // Match only the opening tag (no body) to avoid catastrophic backtracking on large HTML
  const openTagRegex =
    /<article[^>]*\sid="(?:classified_|premium_position_)(\d+)"[^>]*>/gi;
  let m = openTagRegex.exec(html);
  while (m !== null) {
    const id = m[1];
    const tagEnd = m.index + m[0].length;
    const closeStart = html.indexOf('</article>', tagEnd);
    if (closeStart === -1) {
      m = openTagRegex.exec(html);
      continue;
    }
    const block = html.slice(tagEnd, closeStart);
    const urlMatch = block.match(
      /href="(https:\/\/[^"]*\/en\/classified\/house\/for-sale\/[^"]+)"/i,
    );
    const url = urlMatch?.[1]?.replace(/&amp;/g, '&') ?? null;
    if (!url) {
      m = openTagRegex.exec(html);
      continue;
    }
    const priceMatch =
      block.match(/card--result__price[\s\S]*?€\s*([\d,]+)/i) ??
      block.match(/€\s*([\d,]+)/);
    const priceText = (priceMatch?.[1] ?? '').replace(/,/g, '');
    const titleMatch = block.match(/card__title-link[^>]*>([^<]+)</);
    const title = titleMatch?.[1]?.trim() ?? 'House';
    const infoMatch = block.match(/card__information--property[\s\S]*?<\/p>/i);
    const infoText = (infoMatch?.[0] ?? '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const localityMatch = block.match(
      /card--results__information--locality[^>]*>([^<]+)</,
    );
    const localityText = localityMatch?.[1]?.trim() ?? '';
    const imgMatch =
      block.match(/<img[^>]*src="([^"]+)"[^>]*card__media-picture/) ??
      block.match(/card__media-picture[^>]*src="([^"]+)"/);
    const imageUrl = imgMatch?.[1] ?? null;
    cards.push({
      url,
      externalId: id ?? externalIdFromUrl(url),
      priceText,
      title,
      infoText,
      localityText,
      imageUrl,
    });
    m = openTagRegex.exec(html);
  }
  return cards;
}

/** Build listing URL from classified (locality is slugified in URL) */
function listingUrl(baseUrl: string, c: ImmowebClassified): string {
  const id = c.id;
  const loc = c.property?.location;
  const locality = loc?.locality ?? '';
  const postalCode = loc?.postalCode ?? '';
  if (!id) return '';
  const slug = locality.toLowerCase().replace(/\s+/g, '-');
  const origin = new URL(baseUrl).origin;
  return `${origin}/en/classified/house/for-sale/${slug}/${postalCode}/${id}`;
}

/** Parse Immoweb search HTML and return normalized listings (HOUSE + FOR_SALE only). */
export function parseImmowebHtml(
  html: string,
  baseUrl: string,
): NormalizedListing[] {
  const blocks = extractClassifiedJsonBlocks(html);
  console.log('blocks', blocks.length);
  const seen = new Set<string>();
  const results: NormalizedListing[] = [];

  if (blocks.length > 0) {
    for (const raw of blocks) {
      const c = parseClassifiedJson(raw);
      if (
        !c ||
        c.property?.type !== 'HOUSE' ||
        c.transaction?.type !== 'FOR_SALE'
      )
        continue;

      const url = listingUrl(baseUrl, c);
      if (!url || seen.has(url)) continue;
      seen.add(url);

      const price =
        c.price?.mainValue ??
        c.transaction?.sale?.price ??
        c.price?.minRangeValue ??
        c.price?.maxRangeValue;
      if (price == null || price <= 0) continue;

      const locality = c.property?.location?.locality ?? '';
      const municipality = locality
        ? locality.replace(/^\d+\s*/, '').trim()
        : 'Onbekend';
      const title = c.property?.title ?? 'House';
      const bedrooms = c.property?.bedroomCount ?? null;
      const surface = c.property?.netHabitableSurface ?? null;
      const imageUrl = c.media?.pictures?.[0]?.largeUrl ?? null;

      results.push({
        externalId: String(c.id ?? externalIdFromUrl(url)),
        url,
        title: (title || 'Listing').trim().slice(0, 500),
        price,
        bedrooms,
        livingSurfaceM2: surface,
        hasGarden: hasGardenFromText(title),
        municipality,
        description: null,
        imageUrl,
      });
    }
    return results;
  }

  const domCards = extractFromDomCards(html);
  console.log('cards', domCards.length);
  for (const card of domCards) {
    if (seen.has(card.url)) continue;
    seen.add(card.url);
    const price = parsePrice(card.priceText);
    if (price <= 0) continue;
    const municipality = card.localityText
      ? card.localityText.replace(/^\d+\s*/, '').trim()
      : 'Onbekend';
    results.push({
      externalId: card.externalId,
      url: card.url,
      title: (card.title || 'Listing').trim().slice(0, 500),
      price,
      bedrooms: parseBedrooms(card.infoText),
      livingSurfaceM2: parseSurface(card.infoText),
      hasGarden: hasGardenFromText(card.title + ' ' + card.infoText),
      municipality,
      description: null,
      imageUrl: card.imageUrl,
    });
  }
  return results;
}

export async function scrapeImmoweb(
  page: Page | undefined,
  config: ScraperConfig,
  baseUrl: string,
): Promise<NormalizedListing[]> {
  const listingsUrl = config.listingsUrl ?? LISTINGS_URL;
  if (!listingsUrl) return [];

  let html: string;

  if (page && typeof (page as Page).goto === 'function') {
    await page.setExtraHTTPHeaders({
      'User-Agent': BROWSER_HEADERS['User-Agent'] ?? '',
    });
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(listingsUrl, {
      waitUntil: 'load',
      timeout: 30000,
    });
    await page
      .waitForSelector('article.card--result, iw-search-card-rendered', {
        timeout: 15000,
      })
      .catch(() => {
        /* continue with whatever HTML we have */
      });
    await page.waitForTimeout(1500);
    html = await page.content();
    console.log('html', html);
  } else {
    const res = await fetch(listingsUrl, {
      headers: BROWSER_HEADERS,
    });
    if (!res.ok) return [];
    html = await res.text();
  }

  const results = parseImmowebHtml(html, baseUrl);
  if (results.length === 0 && html.length > 0) {
    const blocks = extractClassifiedJsonBlocks(html);
    console.error(
      '[immoweb] 0 listings: html length=%d, blocks=%d, trigger found=%s',
      html.length,
      blocks.length,
      html.includes(":classified='") ? 'yes' : 'no',
    );
    if (blocks.length === 0 && !html.includes(":classified='")) {
      try {
        const fs = await import('fs');
        const path = await import('path');
        const outPath = path.join(process.cwd(), 'immoweb-debug.html');
        fs.writeFileSync(outPath, html, 'utf-8');
        console.error('[immoweb] Wrote received HTML to %s', outPath);
      } catch {
        /* ignore */
      }
    }
  }
  return results;
}

/** Run directly: npx tsx lib/scraper/adapters/immoweb.ts [path/to/immowebexample.html] */
async function main() {
  const baseUrl = 'https://www.immoweb.be';
  const localFile = process.argv[2];

  if (localFile) {
    const fs = await import('fs');
    const html = fs.readFileSync(localFile, 'utf-8');
    const items = parseImmowebHtml(html, baseUrl);
    console.log(JSON.stringify(items, null, 2));
    console.log('Count:', items.length);
    return;
  }

  const config: ScraperConfig = { listingsUrl: LISTINGS_URL };
  const items = await scrapeImmoweb(
    undefined as unknown as Page,
    config,
    baseUrl,
  );
  console.log(JSON.stringify(items, null, 2));
  console.log('Count:', items.length);
}

if (process.argv[1]?.includes('immoweb')) {
  main().catch(console.error);
}
