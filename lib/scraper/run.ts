import type { Page } from 'playwright';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { agencies, listings } from '../../db/schema';
import type { Agency } from '../../db/schema';
import type { NormalizedListing, ScraperConfig } from './types';
import { scrapeCannoodt } from './adapters/cannoodt';
import { scrapeDaVinci } from './adapters/davinci';
import { scrapeOranjeberg } from './adapters/oranjeberg';
import { scrapeTrevi } from './adapters/trevi';
import { fetchConvasFromApi } from './adapters/convas-api';
import { fetchEraFromApi } from './adapters/era-api';
import { scrapeEra } from './adapters/era';
import { scrapeGeneric } from './adapters/generic';
import { scrapeImmoweb } from './adapters/immoweb';
import { scrapeZimmo } from './adapters/zimmo';
import { fetchImmoFrancoisFromApi } from './adapters/immofrancois-api';
import { fetchTopVastgoedFromApi } from './adapters/topvastgoed-api';

const USER_AGENT =
  'GhentImmoScraper/1.0 (Personal project; listing aggregator for Ghent area)';

function getBaseUrl(websiteUrl: string): string {
  try {
    const u = new URL(websiteUrl);
    return `${u.protocol}//${u.host}`;
  } catch {
    return websiteUrl;
  }
}

function selectAdapter(
  agency: Agency,
): (
  page: Page,
  config: ScraperConfig,
  baseUrl: string,
) => Promise<NormalizedListing[]> {
  const slug = agency.slug.toLowerCase();
  const url = agency.websiteUrl.toLowerCase();
  if (slug.includes('cannoodt') || url.includes('cannoodt.be'))
    return scrapeCannoodt;
  if (
    slug.includes('davinci') ||
    slug.includes('da-vinci') ||
    url.includes('immodavinci.be')
  )
    return scrapeDaVinci;
  if (slug.includes('oranjeberg') || url.includes('oranjeberg.be'))
    return scrapeOranjeberg;
  if (slug.includes('trevi') || url.includes('trevi.be')) return scrapeTrevi;
  if (slug.includes('era') || url.includes('era.be')) return scrapeEra;
  if (slug.includes('immoweb') || url.includes('immoweb.be')) return scrapeImmoweb;
  if (slug.includes('zimmo') || url.includes('zimmo.be')) return scrapeZimmo;
  return scrapeGeneric;
}

function getUrlsToScrape(config: ScraperConfig): string[] {
  const urls = config.listingsUrls?.length
    ? config.listingsUrls
    : config.listingsUrl
      ? [config.listingsUrl]
      : [];
  return urls.filter(Boolean);
}

export async function runScraperForAgency(
  page: Page,
  agency: Agency,
): Promise<{ added: number; updated: number }> {
  const config = (agency.scraperConfig ?? {}) as unknown as ScraperConfig;
  const baseUrl = getBaseUrl(agency.websiteUrl);
  const now = new Date().toISOString();

  let items: NormalizedListing[] = [];

  if (config.convasApi) {
    try {
      items = await fetchConvasFromApi(baseUrl);
    } catch (err) {
      console.error(`[${agency.slug}] Convas API fetch failed:`, err);
      return { added: 0, updated: 0 };
    }
  } else if (config.topVastgoedApi) {
    try {
      items = await fetchTopVastgoedFromApi(baseUrl);
    } catch (err) {
      console.error(`[${agency.slug}] Top Vastgoed API fetch failed:`, err);
      return { added: 0, updated: 0 };
    }
  } else if (config.immoFrancoisApi) {
    try {
      items = await fetchImmoFrancoisFromApi(baseUrl);
    } catch (err) {
      console.error(`[${agency.slug}] Immo Francois API fetch failed:`, err);
      return { added: 0, updated: 0 };
    }
  } else if (config.apiUrl) {
    try {
      items = await fetchEraFromApi(baseUrl, config.apiUrl);
    } catch (err) {
      console.error(`[${agency.slug}] ERA API fetch failed:`, err);
      return { added: 0, updated: 0 };
    }
  } else {
    const urlsToScrape = getUrlsToScrape(config);
    if (urlsToScrape.length === 0) {
      console.warn(`[${agency.slug}] No listingsUrl/listingsUrls, skipping.`);
      return { added: 0, updated: 0 };
    }
    const adapter = selectAdapter(agency);
    const seenUrls = new Set<string>();
    try {
      await page.setExtraHTTPHeaders({ 'User-Agent': USER_AGENT });
      for (const url of urlsToScrape) {
        const pageResults = await adapter(
          page,
          { ...config, listingsUrl: url },
          baseUrl,
        );
        for (const item of pageResults) {
          if (seenUrls.has(item.url)) continue;
          seenUrls.add(item.url);
          items.push(item);
        }
        await page.waitForTimeout(800);
      }
    } catch (err) {
      console.error(`[${agency.slug}] Scrape failed:`, err);
      return { added: 0, updated: 0 };
    }
  }

  let added = 0;
  let updated = 0;

  for (const item of items) {
    const price = Number(item.price);
    if (!Number.isFinite(price) || price <= 0) continue;
    const row = {
      agencyId: agency.id,
      externalId: item.externalId,
      url: item.url,
      title: item.title,
      price,
      bedrooms: item.bedrooms,
      livingSurfaceM2: item.livingSurfaceM2,
      hasGarden: item.hasGarden,
      municipality:
        item.municipality?.trim() && item.municipality.trim().length > 0
          ? item.municipality.trim()
          : item.title.split(' ').at(-1),
      description: item.description,
      imageUrl: item.imageUrl,
      firstSeenAt: now,
      lastSeenAt: now,
    };

    const existingRow = await db
      .select({ id: listings.id, deletedAt: listings.deletedAt })
      .from(listings)
      .where(
        and(
          eq(listings.agencyId, agency.id),
          eq(listings.externalId, item.externalId),
        ),
      )
      .limit(1);

    const existing = existingRow[0];

    if (existing?.deletedAt != null) {
      continue;
    }

    if (existing) {
      await db
        .update(listings)
        .set({
          url: row.url,
          title: row.title,
          ...(price > 0 && { price: row.price }),
          bedrooms: row.bedrooms,
          livingSurfaceM2: row.livingSurfaceM2,
          hasGarden: row.hasGarden,
          municipality: row.municipality,
          description: row.description,
          imageUrl: row.imageUrl,
          lastSeenAt: now,
        })
        .where(
          and(
            eq(listings.agencyId, agency.id),
            eq(listings.externalId, item.externalId),
          ),
        );
      updated++;
    } else {
      await db.insert(listings).values(row);
      added++;
    }
  }

  return { added, updated };
}

export async function runScraper(page: Page): Promise<void> {
  const agencyList = await db.select().from(agencies);
  for (const agency of agencyList) {
    const { added, updated } = await runScraperForAgency(page, agency);
    console.log(`[${agency.slug}] added=${added} updated=${updated}`);
    await page.waitForTimeout(1000);
  }
}
