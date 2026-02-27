import type { ElementHandle, Page } from "playwright";
import type { NormalizedListing, ScraperConfig } from "../types";
import {
  parsePrice,
  parseBedrooms,
  parseSurface,
  hasGardenFromText,
  externalIdFromUrl,
  isSoldOrRentedFromText,
} from "../normalize";

const DEFAULT_LISTINGS_URL =
  "https://www.trevi.be/nl/panden-te-koop/huizen?purpose=0&pagenumber=&office=&estatecategory=1&zips%5B%5D=9090_Melle&zips%5B%5D=9820_Merelbeke&zips%5B%5D=%5BStad%5D12_Gent+%2B+Deelgemeenten&minprice=450000&maxprice=600000&rooms=3&estateid=";

export async function scrapeTrevi(
  page: Page,
  config: ScraperConfig,
  baseUrl: string
): Promise<NormalizedListing[]> {
  const results: NormalizedListing[] = [];
  const listingsUrl = config.listingsUrl ?? DEFAULT_LISTINGS_URL;
  if (!listingsUrl) return results;

  const seenUrls = new Set<string>();
  let pageNum = 1;
  const maxPages = 20;

  while (pageNum <= maxPages) {
    const url = listingsUrl.includes("pagenumber=")
      ? listingsUrl.replace(/pagenumber=[^&]*/, `pagenumber=${pageNum}`)
      : pageNum === 1
        ? listingsUrl
        : `${listingsUrl}${listingsUrl.includes("?") ? "&" : "?"}pagenumber=${pageNum}`;

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2500);

    const links = await page.$$('a[href*="/nl/pand/"][href*="/huis/"]');
    if (links.length === 0) break;

    for (const link of links) {
      const href = await link.getAttribute("href");
      if (!href) continue;
      if (!/\/pand\/\d+\//.test(href)) continue;

      const fullUrl = href.startsWith("http") ? href : new URL(href, baseUrl).href;
      if (seenUrls.has(fullUrl)) continue;

      const card = await link.evaluateHandle(
        (el) =>
          el.closest("article") ??
          el.closest("[class*='card']") ??
          el.closest("li") ??
          el.parentElement?.parentElement?.parentElement ??
          el
      );
      const cardEl = card.asElement();
      if (!cardEl) continue;

      const allText = await (cardEl as ElementHandle<HTMLElement>).evaluate(
        (el) => (el.innerText ?? "").trim()
      );
      if (isSoldOrRentedFromText(allText)) continue;
      seenUrls.add(fullUrl);

      const price = parsePrice(allText);
      if (price <= 0) continue;

      const bedrooms = parseBedrooms(allText);
      const livingSurfaceM2 = parseSurface(allText);
      const hasGarden = hasGardenFromText(allText);

      const title =
        (await (cardEl as ElementHandle<HTMLElement>).evaluate((el) => {
          const h = el.querySelector("h2, h3, h4, [class*='title']");
          return h?.textContent?.trim() ?? "";
        })) ||
        (await link.textContent()) ||
        "Huis";

      const img = await (cardEl as ElementHandle<HTMLElement>).evaluate(
        (el) => el.querySelector("img")?.getAttribute("src") ?? null
      );
      const imageUrl = img ? (img.startsWith("http") ? img : new URL(img, baseUrl).href) : null;

      const municipality = await (cardEl as ElementHandle<HTMLElement>).evaluate((el) => {
        const loc = el.querySelector("[class*='location'], [class*='locality'], [class*='city'], [class*='address'], [class*='place']");
        const text = loc?.textContent?.trim();
        if (text) return text;
        const inner = (el.innerText ?? "").trim();
        const postalMatch = inner.match(/\b(9\d{3})\s+([A-Za-z\-]+(?:\s+[A-Za-z\-]+)*)/);
        if (postalMatch) return postalMatch[2].trim();
        return null;
      });

      results.push({
        externalId: externalIdFromUrl(fullUrl),
        url: fullUrl,
        title: title.trim().slice(0, 500),
        price,
        bedrooms,
        livingSurfaceM2,
        hasGarden,
        municipality: municipality ?? "Gent",
        description: null,
        imageUrl,
      });
    }

    pageNum += 1;
  }

  return results;
}
