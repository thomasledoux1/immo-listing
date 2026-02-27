import type { NormalizedListing } from '../types';
import { externalIdFromUrl } from '../normalize';

const AJAX_URL = 'https://topvastgoed.be/wp-admin/admin-ajax.php';
const BASE_URL = 'https://topvastgoed.be';

const BODY_PARAMS = new URLSearchParams({
  action: 'fiter_properties_query',
  'dataArray[0][name]': 'search',
  'dataArray[0][value]': '',
  'dataArray[1][name]': 'category[]',
  'dataArray[1][value]': 'Woning',
  'dataArray[2][name]': 'slaapkamers',
  'dataArray[2][value]': '0',
  'dataArray[3][name]': 'minprice',
  'dataArray[3][value]': '450000',
  'dataArray[4][name]': 'maxprice',
  'dataArray[4][value]': '600000',
  'dataArray[5][name]': 'sort',
  'dataArray[5][value]': 'newest',
  base: '',
});

function parsePrice(text: string): number {
  const match = text.replace(/\s/g, '').match(/[\d.]+/);
  return match ? parseInt(match[0].replace(/\./g, ''), 10) : 0;
}

/** Parse one page HTML into listings (cards contain property link, then title, price, etc.) */
function parseListingBlocks(html: string): NormalizedListing[] {
  const results: NormalizedListing[] = [];
  const linkRegex =
    /<a\s+href="(https:\/\/topvastgoed\.be\/property\/\d+\/)"/gi;
  const links: { url: string; index: number }[] = [];
  for (let m = linkRegex.exec(html); m !== null; m = linkRegex.exec(html)) {
    links.push({ url: m[1].replace(/\/$/, '') + '/', index: m.index });
  }
  for (let i = 0; i < links.length; i++) {
    const start = links[i].index;
    const end = i + 1 < links.length ? links[i + 1].index : html.length;
    const block = html.slice(start, end);
    const url = links[i].url;
    const titleMatch = block.match(
      /<div class="pro-list-title">\s*([^<]*?)<\/div>/i,
    );
    const title = titleMatch ? titleMatch[1].trim() : 'Woning';
    const priceMatch = block.match(
      /<div class="pro-list-price">\s*€\s*([\d.\s]+)/i,
    );
    const price = priceMatch ? parsePrice(priceMatch[1]) : 0;
    if (price <= 0) continue;
    const roomsMatch = block.match(/info-rooms">\s*(\d+)/i);
    const bedrooms = roomsMatch ? parseInt(roomsMatch[1], 10) : null;
    const areaMatch = block.match(/info-area">\s*(\d+(?:[.,]\d+)?)\s*m²/i);
    const livingSurfaceM2 = areaMatch
      ? parseFloat(areaMatch[1].replace(',', '.'))
      : null;
    const groundMatch = block.match(
      /info-groundarea">\s*(\d+(?:[.,]\d+)?)\s*m²/i,
    );
    const groundM2 = groundMatch
      ? parseFloat(groundMatch[1].replace(',', '.'))
      : null;
    const hasGarden = groundM2 != null && groundM2 > 0;
    const imgMatch = block.match(/<img\s+src="(https:[^"]+)"/i);
    const imageUrl = imgMatch ? imgMatch[1] : null;
    const municipalityMatch = title.match(/Woning in (.+)/i);
    const municipality = municipalityMatch ? municipalityMatch[1].trim() : "Onbekend";

    results.push({
      externalId: externalIdFromUrl(url),
      url,
      title: title.slice(0, 500),
      price,
      bedrooms,
      livingSurfaceM2,
      hasGarden,
      municipality,
      description: null,
      imageUrl,
    });
  }
  return results;
}

export async function fetchTopVastgoedFromApi(
  _baseUrl: string,
): Promise<NormalizedListing[]> {
  const all: NormalizedListing[] = [];
  const seen = new Set<string>();
  let page = 1;

  while (true) {
    const body = `${BODY_PARAMS.toString()}&page=${page}`;
    if (process.env.DEBUG_TOPVASTGOED) {
      console.log(`[topvastgoed-api] Fetching page ${page}...`);
    }
    const res = await fetch(AJAX_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Accept: 'text/html, */*; q=0.01',
        Origin: BASE_URL,
        Referer: `${BASE_URL}/te-koop/`,
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent':
          'GhentImmoScraper/1.0 (Personal project; listing aggregator)',
      },
      body,
    });

    if (!res.ok) {
      if (process.env.DEBUG_TOPVASTGOED) console.log(`[topvastgoed-api] Page ${page} res.ok=false, stopping`);
      break;
    }
    const html = await res.text();
    const items = parseListingBlocks(html);
    let newCount = 0;
    for (const item of items) {
      if (seen.has(item.url)) continue;
      seen.add(item.url);
      all.push(item);
      newCount += 1;
    }
    if (process.env.DEBUG_TOPVASTGOED) {
      console.log(`[topvastgoed-api] Page ${page}: ${items.length} parsed, ${newCount} new`);
    }
    if (items.length === 0 || newCount === 0) break;
    page += 1;
  }

  return all;
}
