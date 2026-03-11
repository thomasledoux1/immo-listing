import type { NormalizedListing } from "../types";
import { parsePrice, parseBedrooms, parseSurface } from "../normalize";

const ERA_API_BASE = "https://www.era.be/nl/jsonapi/index/property_index";
const PAGE_SIZE = 24;

/** ERA API query params: sale, houses (46), price 450k–600k, 3+ bed, 160+ m², garden, Ghent + sub-municipalities */
const DEFAULT_PARAMS = new URLSearchParams({
  sort: "broker--field_start_date",
  "pager[offset]": "0",
  "filter[sale_or_rent]": "sale",
  "filter[property_type]": "46",
  "filter[price]": "(min:450000;max:600000)",
  "filter[amount_bedrooms]": "(min:3;max:)",
  "filter[habitable_area_m2]": "(min:160;max:)",
  "filter[outside]": "garden",
  "filter[location][municipalities]": "342",
  "filter[location][sub_municipalities]":
    "740 1104 1131 1298 1689 1808 1863 2066 2373 2380 2397 2631 2786 2828",
});

interface EraPropertyNode {
  type: string;
  id: string;
  attributes: {
    teaser?: string;
    video_data?:
      | {
          title?: string;
          price?: string;
          property_url?: string;
          property_id?: string;
        }
      | Array<Record<string, unknown>>;
  };
}

interface EraApiResponse {
  data?: EraPropertyNode[];
  meta?: { resultsCount?: number; totalCount?: number };
}

function parseTeaserField(teaser: string, pattern: RegExp): string | null {
  const m = teaser.match(pattern);
  const group = m?.[1];
  return group != null ? group.trim() : null;
}

function parseFirstImageSrc(teaser: string, baseUrl: string): string | null {
  const m = teaser.match(/src="(\/[^"]+)"/);
  const path = m?.[1];
  if (!path) return null;
  const decoded = path.replace(/&amp;/g, "&");
  return decoded.startsWith("http") ? decoded : `${baseUrl}${decoded}`;
}

function nodeToListing(node: EraPropertyNode, baseUrl: string): NormalizedListing | null {
  const attrs = node.attributes;
  const teaser = attrs.teaser ?? "";
  const videoData = Array.isArray(attrs.video_data) ? null : attrs.video_data;

  const title =
    videoData?.title ??
    parseTeaserField(teaser, /<h3[^>]*>([^<]+)<\/h3>/i) ??
    "";
  const propertyPath =
    videoData?.property_url ?? parseTeaserField(teaser, /href="(\/nl\/te-koop\/[^"]+)"/);
  if (!propertyPath) return null;

  const url = propertyPath.startsWith("http") ? propertyPath : `${baseUrl}${propertyPath}`;
  const externalId = videoData?.property_id ?? node.id;

  const priceText =
    videoData?.price ?? parseTeaserField(teaser, /field--price[^>]*>([^<]+)</);
  const price = parsePrice(priceText);
  if (price <= 0) return null;

  const bedroomsText = parseTeaserField(teaser, /field--bedrooms[^>]*>([^<]+)</);
  const surfaceText = parseTeaserField(teaser, /field--habitable-space[^>]*>([^<]+)</);
  const bedroomsNum = parseBedrooms(bedroomsText ?? "");
  const surfaceNum = parseSurface(surfaceText ?? "");

  const imageUrl = parseFirstImageSrc(teaser, baseUrl);

  const address =
    parseTeaserField(teaser, /field--(?:location|locality|city|address)[^>]*>([^<]+)</i)?.trim() ??
    parseTeaserField(teaser, /class="[^"]*location[^"]*"[^>]*>([^<]+)</i)?.trim() ??
    null;
  const municipality = address?.trim() ?? "Gent";

  return {
    externalId,
    url,
    title: title.slice(0, 500),
    price: price > 0 ? price : 500000,
    bedrooms: bedroomsNum ?? null,
    livingSurfaceM2: surfaceNum ?? null,
    hasGarden: true,
    municipality,
    address: address ?? (title ? `${title}, ${municipality}` : municipality),
    description: null,
    imageUrl,
  };
}

function buildEraApiUrl(offset: number): string {
  const p = new URLSearchParams(DEFAULT_PARAMS.toString());
  p.set("pager[offset]", String(offset));
  return `${ERA_API_BASE}?${p.toString()}`;
}

function buildUrlWithOffset(customApiUrl: string, offset: number): string {
  const u = new URL(customApiUrl);
  u.searchParams.set("pager[offset]", String(offset));
  return u.toString();
}

export async function fetchEraFromApi(
  baseUrl: string,
  customApiUrl?: string,
  options?: { debug?: boolean }
): Promise<NormalizedListing[]> {
  const debug = options?.debug ?? false;
  const results: NormalizedListing[] = [];
  let offset = 0;
  let totalCount: number | undefined;
  let pageLength = 0;

  do {
    const url = customApiUrl
      ? buildUrlWithOffset(customApiUrl, offset)
      : buildEraApiUrl(offset);

    if (debug) console.error("[era-api] GET", url);
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    if (debug) console.error("[era-api] status", res.status, res.statusText);
    if (!res.ok) throw new Error(`ERA API ${res.status}: ${res.statusText}`);

    const json = (await res.json()) as EraApiResponse;
    const data = json.data ?? [];
    totalCount = json.meta?.totalCount;
    pageLength = data.length;

    if (debug) {
      console.error("[era-api] meta", JSON.stringify(json.meta));
      console.error("[era-api] data.length", data.length);
      if (data.length > 0)
        console.error("[era-api] first node keys", Object.keys(data[0] ?? {}));
      if (data.length === 0 && offset === 0)
        console.error("[era-api] raw body slice", JSON.stringify(json).slice(0, 500));
    }

    for (const node of data) {
      const listing = nodeToListing(node, baseUrl);
      if (listing) results.push(listing);
    }

    offset += PAGE_SIZE;
  } while (
    pageLength === PAGE_SIZE &&
    (totalCount == null || offset < totalCount)
  );

  if (debug) console.error("[era-api] total listings", results.length);
  return results;
}

/** Run directly: npx tsx lib/scraper/adapters/era-api.ts */
async function main() {
  const baseUrl = "https://www.era.be";
  const apiUrl =
    "https://www.era.be/nl/jsonapi/index/property_index?sort=broker--field_start_date&pager%5Boffset%5D=0&filter%5Bsale_or_rent%5D=sale&filter%5Bproperty_type%5D=46&filter%5Bprice%5D=%28min%3A450000%3Bmax%3A600000%29&filter%5Bamount_bedrooms%5D=%28min%3A3%3Bmax%3A%29&filter%5Bhabitable_area_m2%5D=%28min%3A160%3Bmax%3A%29&filter%5Boutside%5D=garden&filter%5Blocation%5D%5Bmunicipalities%5D=342&filter%5Blocation%5D%5Bsub_municipalities%5D=740+1104+1131+1298+1689+1808+1863+2066+2373+2380+2397+2631+2786+2828";
  const listings = await fetchEraFromApi(baseUrl, apiUrl, { debug: true });
  console.log("Listings:", listings.length);
  console.log(JSON.stringify(listings.slice(0, 2), null, 2));
}

if (process.argv[1]?.includes("era-api")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
