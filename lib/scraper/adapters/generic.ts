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

export async function scrapeGeneric(
  page: Page,
  config: ScraperConfig,
  baseUrl: string
): Promise<NormalizedListing[]> {
  const results: NormalizedListing[] = [];
  const listingsUrl = config.listingsUrl;
  if (!listingsUrl) return results;

  const linkSelector = config.linkSelector ?? "a[href*='/te-koop/'], a[href*='/for-sale/'], a[href*='/property/']";

  await page.goto(listingsUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);

  const links = await page.$$(linkSelector);
  const seenUrls = new Set<string>();

  for (const link of links) {
    const href = await link.getAttribute("href");
    if (!href) continue;
    const fullUrl = href.startsWith("http") ? href : new URL(href, baseUrl).href;
    if (seenUrls.has(fullUrl)) continue;
    if (!isNotApartmentUrl(fullUrl)) continue;
    seenUrls.add(fullUrl);

    const container = await link.evaluateHandle(
      (el) => el.closest("article") ?? el.closest("[class*='card']") ?? el.closest("li") ?? el.parentElement?.parentElement ?? el
    );
    const containerEl = container.asElement();
    const root = containerEl ?? link;
    const data = await (root as ElementHandle<HTMLElement>).evaluate((el, sel) => {
      const titleEl = sel.titleSelector ? el.querySelector(sel.titleSelector) : null;
      const priceEl = sel.priceSelector ? el.querySelector(sel.priceSelector) : null;
      const imgEl = el.querySelector(sel.imageSelector ?? "img");
      const locEl = el.querySelector("[class*='location'], [class*='locality'], [class*='city'], [class*='address']");
      const municipality = (locEl?.textContent?.trim()) || null;
      const inner = (el.innerText ?? "").trim();
      const postalMatch = !municipality ? inner.match(/\b(9\d{3})\s+([A-Za-z\-]+(?:\s+[A-Za-z\-]+)*)/) : null;
      return {
        allText: inner,
        title: titleEl?.textContent?.trim() ?? "",
        priceText: priceEl?.textContent?.trim() ?? "",
        img: imgEl?.getAttribute("src") ?? null,
        municipality: municipality || (postalMatch ? postalMatch[2].trim() : null),
      };
    }, { titleSelector: config.titleSelector ?? "", priceSelector: config.priceSelector ?? "", imageSelector: config.imageSelector ?? "img" });
    const allText = data.allText;
    if (isSoldOrRentedFromText(allText)) continue;
    const title = data.title || (await link.textContent()) || "";
    const priceText = data.priceText || allText;
    const price = parsePrice(priceText || allText);
    if (price <= 0) continue;

    const bedrooms = parseBedrooms(allText);
    const surface = parseSurface(allText);
    const hasGarden = hasGardenFromText(allText);
    const img = data.img;

    results.push({
      externalId: externalIdFromUrl(fullUrl),
      url: fullUrl,
      title: (title || "Listing").trim().slice(0, 500),
      price,
      bedrooms,
      livingSurfaceM2: surface,
      hasGarden,
      municipality: data.municipality ?? "Onbekend",
      description: null,
      imageUrl: img ? (img.startsWith("http") ? img : new URL(img, baseUrl).href) : null,
    });
  }

  return results;
}
