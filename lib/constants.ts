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
