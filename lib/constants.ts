/**
 * Allowed municipalities for listings (case-insensitive match).
 * Only properties in these municipalities are shown.
 */
export const ALLOWED_MUNICIPALITIES = [
  'Gent',
  'Gentbrugge',
  'Melle',
  'Merelbeke',
  'Merelbeke-Melle',
  'Sint-Amandsberg',
  'Drongen',
  'Mariakerke',
  'Wondelgem',
  'Zwijnaarde',
  'Oostakker',
  'Destelbergen',
  'Heusen',
] as const;

/** Lowercased set for case-insensitive membership check */
export const ALLOWED_MUNICIPALITIES_LOWER = new Set(
  ALLOWED_MUNICIPALITIES.map(m => m.toLowerCase()),
);

/** Immoscoop search page: Ghent + sub-municipalities, houses, 3+ bed, 450k–650k. Load in browser, wait 10s, scrape HTML. */
export const IMMOSCOOP_SEARCH_URL =
  'https://www.immoscoop.be/zoeken/te-koop/9070-destelbergen,9031-drongen,9000-gent,9050-gentbrugge,9070-heusden,9030-mariakerke,9090-melle,9820-merelbeke,9041-oostakker,9040-sint-amandsberg,9032-wondelgem,9052-zwijnaarde/woonhuis?minBedrooms=3&minPrice=450000&maxPrice=650000';

/**
 * Substrings that indicate a listing is NOT a house (apartment, building ground, etc.).
 * If title or description contains any of these (case-insensitive), the listing is excluded.
 */
export const NON_HOUSE_TITLE_KEYWORDS = [
  'appartement',
  'apartment',
  'flat',
  'studio',
  'bouwgrond',
  'building ground',
  'bouwgronden',
  'perceel',
  'kavel',
  'grond te koop',
  'meergezinswoning', // multi-family building
] as const;
