import type { NormalizedListing } from "../types";

const LIMIT = 18;

const BASE_PARAMS = new URLSearchParams({
  negotiation: "sale",
  "type[]": "house",
  bedrooms: "3",
  min_budget: "450000",
  max_budget: "600000",
  "location[]": '{"postal_code":9000,"lat":51.0397129,"lng":3.7141549000597}',
  radius: "10",
  "country[]": "BE",
  limit: String(LIMIT),
  sort_type: "distance",
  sort_method: "asc",
  language: "nl",
});

const API_BASE = "https://www.immofrancois.be/ajax/api/sweepbright/estates";

interface ImmoFrancoisEstate {
  id?: string;
  type?: string;
  price?: { amount?: number; currency?: string; formatted?: string };
  bedrooms?: number;
  detail_url?: string;
  description_title_formatted?: string;
  description_title?: { nl?: string; en?: string; fr?: string };
  location?: { formatted_agency?: string; city?: string; street?: string; number?: string; postal_code?: string };
  sizes?: {
    liveable_area?: { size?: number; formatted?: string };
    plot_area?: { size?: number };
  };
  images?: Array<{ url?: string; ordinal?: number }>;
}

interface ImmoFrancoisResponse {
  pages?: number;
  total?: number;
  estates?: ImmoFrancoisEstate[];
}

function estateToListing(estate: ImmoFrancoisEstate): NormalizedListing | null {
  const url = estate.detail_url;
  if (!url) return null;

  const price = estate.price?.amount ?? 0;
  if (price <= 0) return null;

  const title =
    estate.description_title_formatted ??
    estate.description_title?.nl ??
    estate.description_title?.en ??
    estate.location?.formatted_agency ??
    "Woning";

  const liveable = estate.sizes?.liveable_area?.size;
  const plotArea = estate.sizes?.plot_area?.size ?? 0;
  const hasGarden = plotArea > 0;

  const images = estate.images ?? [];
  const firstImage = images.sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0))[0];
  const imageUrl = firstImage?.url ?? null;

  const loc = estate.location;
  const municipality = loc?.city?.trim() || "Onbekend";
  const streetPart = [loc?.street, loc?.number].filter(Boolean).join(" ").trim();
  const cityPart = [loc?.postal_code, loc?.city].filter(Boolean).join(" ").trim();
  const address = [streetPart, cityPart].filter(Boolean).join(", ") || title || municipality;

  return {
    externalId: estate.id ?? url,
    url,
    title: title.slice(0, 500),
    price,
    bedrooms: estate.bedrooms ?? null,
    livingSurfaceM2: liveable ?? null,
    hasGarden,
    municipality,
    address,
    description: null,
    imageUrl,
  };
}

export async function fetchImmoFrancoisFromApi(
  _baseUrl: string,
  options?: { debug?: boolean }
): Promise<NormalizedListing[]> {
  const debug = options?.debug ?? false;
  const results: NormalizedListing[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const params = new URLSearchParams(BASE_PARAMS);
    params.set("page", String(page));
    const url = `${API_BASE}?${params.toString()}`;

    if (debug) console.error("[immo-francois-api] GET", url);
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (debug) console.error("[immo-francois-api] status", res.status, res.statusText);
    if (!res.ok) {
      if (debug) {
        const text = await res.text();
        console.error("[immo-francois-api] body slice", text.slice(0, 400));
      }
      break;
    }

    const json = (await res.json()) as ImmoFrancoisResponse;
    const estates = json.estates ?? [];
    totalPages = json.pages ?? 1;

    if (debug) {
      console.error("[immo-francois-api] pages", totalPages, "estates this page", estates.length);
      if (estates.length === 0 && page === 1)
        console.error("[immo-francois-api] raw keys", Object.keys(json), "body slice", JSON.stringify(json).slice(0, 500));
    }

    for (const estate of estates) {
      const listing = estateToListing(estate);
      if (listing) results.push(listing);
    }

    if (estates.length < LIMIT) break;
    page += 1;
  } while (page <= totalPages);

  if (debug) console.error("[immo-francois-api] total listings", results.length);
  return results;
}

/** Run directly: npx tsx lib/scraper/adapters/immofrancois-api.ts */
async function main() {
  const listings = await fetchImmoFrancoisFromApi("https://www.immofrancois.be", {
    debug: true,
  });
  console.log("Listings:", listings.length);
  console.log(JSON.stringify(listings.slice(0, 2), null, 2));
}

if (process.argv[1]?.includes("immofrancois-api")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
