import type { ElementHandle, Page } from "playwright";
import type { NormalizedListing, ScraperConfig } from "../types";
import {
  parsePrice,
  parseBedrooms,
  parseSurface,
  hasGardenFromText,
  externalIdFromUrl,
  isHouseListingOnly,
  isSoldOrRentedFromText,
} from "../normalize";

const FALLBACK_LINK = "a[href*='/te-koop/']";

export async function scrapeEra(
  page: Page,
  config: ScraperConfig,
  baseUrl: string
): Promise<NormalizedListing[]> {
  const results: NormalizedListing[] = [];
  const listingsUrl = config.listingsUrl;
  if (!listingsUrl) return results;

  await page.goto(listingsUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);

  const links = await page.$$(FALLBACK_LINK);
  const seenUrls = new Set<string>();

  for (const link of links) {
    const href = await link.getAttribute("href");
    if (!href) continue;
    const fullUrl = href.startsWith("http") ? href : new URL(href, baseUrl).href;
    if (!fullUrl.includes("/te-koop/") || seenUrls.has(fullUrl)) continue;
    if (!isHouseListingOnly(fullUrl)) continue;
    seenUrls.add(fullUrl);

    const card = await link.evaluateHandle((el) => el.closest("article") ?? el.parentElement?.parentElement ?? el);
    const cardEl = card.asElement();
    if (!cardEl) continue;

    const cardData = await (cardEl as ElementHandle<HTMLElement>).evaluate((el) => {
      const h = el.querySelector("h2, h3");
      const priceEl = el.querySelector("[class*='price'], .price");
      return {
        title: h?.textContent?.trim() ?? "",
        priceText: priceEl?.textContent?.trim() ?? "",
        allText: el.innerText ?? "",
      };
    });
    const title = cardData.title || (await link.textContent()) || "";
    const allText = cardData.allText;
    if (isSoldOrRentedFromText(allText)) continue;
    const priceText = cardData.priceText || allText;
    const price = parsePrice(priceText || allText);
    if (price <= 0) continue;

    const bedrooms = parseBedrooms(allText);
    const surface = parseSurface(allText);
    const hasGarden = hasGardenFromText(allText);
    const img = await (cardEl as ElementHandle<HTMLElement>).evaluate((el) => el.querySelector("img")?.getAttribute("src") ?? null);

    const municipality =
      (await (cardEl as ElementHandle<HTMLElement>).evaluate((el) => {
        const loc = el.querySelector("[class*='location'], [class*='locality'], [class*='city'], [class*='address']");
        return loc?.textContent?.trim() ?? null;
      })) ?? "Gent";

    results.push({
      externalId: externalIdFromUrl(fullUrl),
      url: fullUrl,
      title: title.trim().slice(0, 500),
      price,
      bedrooms,
      livingSurfaceM2: surface,
      hasGarden,
      municipality,
      description: null,
      imageUrl: img ? (img.startsWith("http") ? img : new URL(img, baseUrl).href) : null,
    });
  }

  return results;
}
