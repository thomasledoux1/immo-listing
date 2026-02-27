/**
 * Top 20 immo agencies in Ghent (non-aggregators).
 * Excludes Zimmo, Immoweb, Realo, HouseMatch, Belles Demeures portal.
 * Only houses (no apartments); only unsold (te koop).
 * Cities: Gent, Wondelgem, Sint-Amandsberg, Gentbrugge, Merelbeke, Melle, Zwijnaarde, Oostakker, Evergem, Mariakerke, Drongen.
 */
export const GHENT_AREA_CITY_SLUGS = [
  'gent',
  'wondelgem',
  'sint-amandsberg',
  'gentbrugge',
  'merelbeke',
  'melle',
  'zwijnaarde',
  'oostakker',
  'evergem',
  'mariakerke',
  'drongen',
] as const;

export interface AgencyScraperConfig {
  /** When set, fetch from this API (e.g. ERA jsonapi) instead of scraping */
  apiUrl?: string;
  /** When true, fetch from Convas POST API */
  convasApi?: boolean;
  /** When true, fetch from Top Vastgoed admin-ajax API */
  topVastgoedApi?: boolean;
  /** When true, fetch from Immo Francois SweepBright API */
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

export interface AgencyConfig {
  name: string;
  slug: string;
  websiteUrl: string;
  scraperConfig: AgencyScraperConfig;
}

export const AGENCIES: AgencyConfig[] = [
  {
    name: 'ERA Wonen Gent',
    slug: 'era-wonen-gent',
    websiteUrl: 'https://www.era.be',
    scraperConfig: {
      apiUrl:
        'https://www.era.be/nl/jsonapi/index/property_index?sort=broker--field_start_date&pager%5Boffset%5D=0&filter%5Bsale_or_rent%5D=sale&filter%5Bproperty_type%5D=46&filter%5Bprice%5D=%28min%3A450000%3Bmax%3A600000%29&filter%5Bamount_bedrooms%5D=%28min%3A3%3Bmax%3A%29&filter%5Bhabitable_area_m2%5D=%28min%3A160%3Bmax%3A%29&filter%5Boutside%5D=garden&filter%5Blocation%5D%5Bmunicipalities%5D=342&filter%5Blocation%5D%5Bsub_municipalities%5D=740+1104+1131+1298+1689+1808+1863+2066+2373+2380+2397+2631+2786+2828',
    },
  },
  {
    name: 'Convas Gent',
    slug: 'convas-gent',
    websiteUrl: 'https://www.convas.be',
    scraperConfig: {
      convasApi: true,
    },
  },
  {
    name: 'Cannoodt',
    slug: 'cannoodt',
    websiteUrl: 'https://www.cannoodt.be',
    scraperConfig: {
      listingsUrl: 'https://www.cannoodt.be/aanbod',
    },
  },
  {
    name: 'Top Vastgoed',
    slug: 'top-vastgoed',
    websiteUrl: 'https://topvastgoed.be',
    scraperConfig: {
      topVastgoedApi: true,
    },
  },
  {
    name: 'Immo Da Vinci',
    slug: 'immo-da-vinci',
    websiteUrl: 'https://www.immodavinci.be',
    scraperConfig: {
      listingsUrl:
        'https://www.immodavinci.be/residentieel/kopen/woningen/9000-gent+9031-gent-drongen+9040-gent-sint-amandsberg+9040-gent+9041-gent-oostakker+9050-gent-gentbrugge+9050-gent-ledeberg+9051-gent+9051-gent-sint-denijs-westrem+9052-gent-zwijnaarde+9820-merelbeke?priceMax=600000',
    },
  },
  {
    name: 'Oranjeberg',
    slug: 'oranjeberg',
    websiteUrl: 'https://www.oranjeberg.be',
    scraperConfig: {
      listingsUrl: 'https://www.oranjeberg.be/te-koop/residentieel',
    },
  },
  {
    name: 'Immo Francois',
    slug: 'immo-francois',
    websiteUrl: 'https://www.immofrancois.be',
    scraperConfig: {
      immoFrancoisApi: true,
    },
  },
  {
    name: 'Trevi',
    slug: 'trevi-gent',
    websiteUrl: 'https://www.trevi.be',
    scraperConfig: {
      listingsUrl:
        'https://www.trevi.be/nl/panden-te-koop/huizen?purpose=0&pagenumber=&office=&estatecategory=1&zips%5B%5D=9070_Destelbergen&zips%5B%5D=9070_Heusden+%28O.Vl.%29&zips%5B%5D=9090_Melle&zips%5B%5D=9820_Merelbeke&zips%5B%5D=%5BStad%5D12_Gent+%2B+Deelgemeenten&minprice=450000&maxprice=600000&rooms=3&estateid=',
    },
  },
  {
    name: 'Immoweb',
    slug: 'immoweb',
    websiteUrl: 'https://www.immoweb.be',
    scraperConfig: {
      listingsUrl:
        'https://www.immoweb.be/en/search/house/for-sale?countries=BE&postalCodes=9000,9030,9031,9032,9040,9041,9050,9070,9090,9820,9940&minPrice=450000&maxPrice=600000&priceType=SALE_PRICE&page=1&orderBy=newest',
    },
  },
  {
    name: 'Zimmo',
    slug: 'zimmo',
    websiteUrl: 'https://www.zimmo.be',
    scraperConfig: {
      listingsUrl:
        'https://www.zimmo.be/nl/zoeken/?search=eyJmaWx0ZXIiOnsic3RhdHVzIjp7ImluIjpbIkZPUl9TQUxFIiwiVEFLRV9PVkVSIl19LCJjYXRlZ29yeSI6eyJpbiI6WyJIT1VTRSJdfSwicHJpY2UiOnsidW5rbm93biI6dHJ1ZSwicmFuZ2UiOnsibWluIjo0NTAwMDAsIm1heCI6NjAwMDAwfX0sImJlZHJvb21zIjp7InVua25vd24iOnRydWUsInJhbmdlIjp7Im1pbiI6M319LCJwbGFjZUlkIjp7ImluIjpbMTUwNiwxNTE4LDE1MTcsMTUxOSwxNTExLDE1MTAsMTUxMiwxNTEzLDE1MTUsMTUxNiwxNTE0LDE1MjgsMTUyOSwxNTMwLDE0OTQsMTQ5NV19fSwicGFnaW5nIjp7ImZyb20iOjAsInNpemUiOjE3fSwic29ydGluZyI6W3sidHlwZSI6IkRBVEUiLCJvcmRlciI6IkRFU0MifV19&p=1#gallery',
    },
  },
];
