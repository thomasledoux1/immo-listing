import type { ElementHandle, Page } from "playwright";
import type { NormalizedListing, ScraperConfig } from "../types";
import {
  parsePrice,
  parseBedrooms,
  parseSurface,
  hasGardenFromText,
  externalIdFromUrl,
  isNotApartmentUrl,
  isSoldOrRentedFromText,
} from "../normalize";

const LISTING_CARD_SELECTOR = '[data-block-type="default"]';
const LINK_SELECTOR = 'a[href*="/te-koop/"]';

/** Dewaele listing page uses lazy-loaded images (data-flickity-lazyload) and specific card structure. */
export async function scrapeDewaele(
  page: Page,
  config: ScraperConfig,
  baseUrl: string
): Promise<NormalizedListing[]> {
  const results: NormalizedListing[] = [];
  const listingsUrl = config.listingsUrl;
  if (!listingsUrl) return results;

  await page.goto(listingsUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);

  const cards = await page.$$(LISTING_CARD_SELECTOR);
  const seenUrls = new Set<string>();

  for (const card of cards) {
    const link = await card.$(LINK_SELECTOR);
    if (!link) continue;

    const href = await link.getAttribute("href");
    if (!href) continue;

    const fullUrl = href.startsWith("http") ? href : new URL(href, baseUrl).href;
    if (fullUrl.includes("te-koop/alle")) continue;
    if (seenUrls.has(fullUrl)) continue;
    if (!isNotApartmentUrl(fullUrl)) continue;
    seenUrls.add(fullUrl);

    const data = await (card as ElementHandle<HTMLElement>).evaluate((el) => {
      const titleEl = el.querySelector("h3.font-semibold, h3");
      const priceEl = el.querySelector(".property-price span");
      const imgEl = el.querySelector("img");
      const imgSrc =
        imgEl?.getAttribute("src") ??
        imgEl?.getAttribute("data-flickity-lazyload") ??
        null;
      const pinWrapper = el.querySelector('[aria-label="pin"]')?.closest("div");
      const addressSpan = pinWrapper?.querySelector("span");
      const address = addressSpan?.textContent?.trim() ?? null;
      const inner = (el.innerText ?? "").trim();
      const postalMatch = !address ? inner.match(/\b(9\d{3})\s+([A-Za-z\-]+(?:\s+[A-Za-z\-]+)*)/) : null;
      const titleText = titleEl?.textContent?.trim() ?? "";
      const municipalityFromTitle = titleText.split(/\s+te\s+koop\s+/i).pop()?.trim() ?? null;
      const municipality = municipalityFromTitle || (postalMatch ? postalMatch[2].trim() : null);
      return {
        allText: inner,
        title: titleText,
        priceText: priceEl?.textContent?.trim() ?? "",
        img: imgSrc,
        municipality,
        address: address || (titleText && municipality ? `${titleText}, ${municipality}` : municipality),
      };
    });

    if (isSoldOrRentedFromText(data.allText)) continue;

    const price = parsePrice(data.priceText || data.allText);
    if (price <= 0) continue;

    const bedrooms = parseBedrooms(data.allText);
    const surface = parseSurface(data.allText);
    const hasGarden = hasGardenFromText(data.allText);
    const img = data.img;

    results.push({
      externalId: externalIdFromUrl(fullUrl),
      url: fullUrl,
      title: (data.title || "Listing").trim().slice(0, 500),
      price,
      bedrooms,
      livingSurfaceM2: surface,
      hasGarden,
      municipality: data.municipality ?? "Onbekend",
      address: data.address ?? null,
      description: null,
      imageUrl: img ? (img.startsWith("http") ? img : new URL(img, baseUrl).href) : null,
    });
  }

  return results;
}
