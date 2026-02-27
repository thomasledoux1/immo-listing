import type { NormalizedListing } from '../types';

const CONVAS_API_URL =
  'https://api.cms.zabun.be/sites/725b5de3-18ab-4b35-9d48-207bb3bec376/estates';
const X_SITE = '725b5de3-18ab-4b35-9d48-207bb3bec376';
const PAGE_SIZE = 20;

const DEFAULT_BODY = {
  query: {
    terms: {
      'children.general.transaction.id': [1, 3],
      'children.general.isRootEstate': ['true'],
      'children.general.headType.id': [3],
    },
    range: {
      'children.general.price.value': { gte: 450000, lte: 600000 },
    },
  },
  sort: [
    {
      field: 'children.general.transaction.id',
      values: [1, 3, 2, 4, 10, 5, 6],
    },
    { field: 'children.general.publicationDate', direction: 'DESC' as const },
  ],
  pagination: { from: 0, size: PAGE_SIZE },
};

interface ConvasGeneral {
  id?: string;
  publicationId?: string;
  title?: { nl?: string; fr?: string };
  price?: { value?: number; totalPrice?: number };
  bedroomCount?: number;
}

interface ConvasDimensions {
  areaBuild?: number;
  areaGround?: number;
}

interface ConvasChild {
  general?: ConvasGeneral;
  dimensions?: ConvasDimensions;
  pictures?: Array<{ file?: string }>;
}

interface ConvasResult {
  id: number;
  children?: ConvasChild[];
}

interface ConvasApiResponse {
  total?: { value?: number };
  results?: ConvasResult[];
}

function getChildWithGeneral(result: ConvasResult): ConvasChild | undefined {
  return result.children?.find(c => c.general != null);
}

/** Build a URL-safe slug from the title (used after the id on Convas detail pages). */
function slugFromTitle(title: string): string {
  return (
    title
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'woning'
  );
}

function resultToListing(
  result: ConvasResult,
  baseUrl: string,
): NormalizedListing | null {
  const child = getChildWithGeneral(result);
  if (!child?.general) return null;

  const g = child.general;
  const price = g.price?.value ?? g.price?.totalPrice ?? 0;
  if (price <= 0) return null;

  const title = g.title?.nl ?? g.title?.fr ?? '';
  const dimensions = child.dimensions;
  const areaBuild = dimensions?.areaBuild;
  const areaGround = dimensions?.areaGround ?? 0;
  const firstPic = child.pictures?.[0]?.file ?? null;

  const listingUrl = `${baseUrl}/nl/aanbod/${result.id}`;

  return {
    externalId: String(result.id),
    url: listingUrl,
    title: title.slice(0, 500),
    price,
    bedrooms: g.bedroomCount ?? null,
    livingSurfaceM2: areaBuild ?? null,
    hasGarden: areaGround > 0,
    municipality: 'Gent',
    description: null,
    imageUrl: firstPic ?? null,
  };
}

export async function fetchConvasFromApi(
  baseUrl: string,
): Promise<NormalizedListing[]> {
  const results: NormalizedListing[] = [];
  let from = 0;
  let totalCount: number | undefined;
  let pageLength = 0;

  do {
    const body = {
      ...DEFAULT_BODY,
      pagination: { from, size: PAGE_SIZE },
    };

    const res = await fetch(CONVAS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-site': X_SITE,
        Accept: 'application/json',
        'User-Agent':
          'GhentImmoScraper/1.0 (Personal project; listing aggregator)',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Convas API ${res.status}: ${res.statusText}`);
    }

    const json = (await res.json()) as ConvasApiResponse;
    const data = json.results ?? [];
    totalCount = json.total?.value;
    pageLength = data.length;

    for (const result of data) {
      const listing = resultToListing(result, baseUrl);
      if (listing) results.push(listing);
    }

    from += PAGE_SIZE;
  } while (
    pageLength === PAGE_SIZE &&
    (totalCount == null || from < totalCount)
  );

  return results;
}
