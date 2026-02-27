export interface NormalizedListing {
  externalId: string;
  url: string;
  title: string;
  price: number;
  bedrooms: number | null;
  livingSurfaceM2: number | null;
  hasGarden: boolean;
  /** Municipality / city (e.g. "Gent", "Sint-Amandsberg") when known */
  municipality?: string | null;
  description: string | null;
  imageUrl: string | null;
}

export interface ScraperConfig {
  /** When set, fetch listings from this API URL (e.g. ERA jsonapi); no browser needed */
  apiUrl?: string;
  /** When true, fetch from Convas POST API (x-site + body); no browser needed */
  convasApi?: boolean;
  /** When true, fetch from Top Vastgoed WordPress admin-ajax (POST); no browser needed */
  topVastgoedApi?: boolean;
  /** When true, fetch from Immo Francois SweepBright API (GET); no browser needed */
  immoFrancoisApi?: boolean;
  /** Single URL (used when listingsUrls not set) */
  listingsUrl?: string;
  /** Multiple URLs to scrape (e.g. one per city); merged and deduped */
  listingsUrls?: string[];
  listingSelector?: string;
  linkSelector?: string;
  titleSelector?: string;
  priceSelector?: string;
  bedroomsSelector?: string;
  surfaceSelector?: string;
  gardenSelector?: string;
  imageSelector?: string;
  dateSelector?: string;
}
