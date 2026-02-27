import type { ElementHandle, Page } from "playwright";
import type { NormalizedListing, ScraperConfig } from "../types";
import { externalIdFromUrl } from "../normalize";

const DEFAULT_LISTINGS_URL = "https://www.oranjeberg.be/te-koop/residentieel";

export async function scrapeOranjeberg(
  page: Page,
  config: ScraperConfig,
  baseUrl: string
): Promise<NormalizedListing[]> {
  const results: NormalizedListing[] = [];
  const listingsUrl = config.listingsUrl ?? DEFAULT_LISTINGS_URL;
  if (!listingsUrl) return results;

  const seenUrls = new Set<string>();
  const pagesToVisit: string[] = [listingsUrl];

  for (let i = 0; i < pagesToVisit.length; i++) {
    const url = pagesToVisit[i];
    if (!url) continue;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(1500);

    if (i === 0) {
      const paginationLinks = await page.$$('.pagination-links a[href*="/page/"]');
      for (const a of paginationLinks) {
        const href = await a.getAttribute("href");
        if (!href) continue;
        try {
          const full = href.startsWith("http") ? href : new URL(href, baseUrl).href;
          if (!pagesToVisit.includes(full)) pagesToVisit.push(full);
        } catch {
          // ignore invalid URLs
        }
      }
    }

    const cards = await page.$$(".one-third .item.shadow");
    for (const card of cards) {
      const typeEl = await card.$(".item-text .type");
      const typeText = typeEl ? await typeEl.textContent() : "";
      const type = (typeText ?? "").trim();
      if (type !== "Woning") continue;

      const linkEl = await card.$("a.button-more-info, a.target");
      const href = linkEl ? await linkEl.getAttribute("href") : null;
      if (!href) continue;

      const fullUrl = href.startsWith("http") ? href : new URL(href, baseUrl).href;
      if (seenUrls.has(fullUrl)) continue;
      seenUrls.add(fullUrl);

      const data = await (card as ElementHandle<HTMLElement>).evaluate((el) => {
        const priceEl = el.querySelector(".item-text .price");
        const priceText = (priceEl?.textContent ?? "").trim();
        const priceMatch = priceText.replace(/\s/g, "").match(/[\d.]+/);
        const price = priceMatch ? parseInt(priceMatch[0].replace(/\./g, ""), 10) : 0;

        const descEl = el.querySelector(".item-text .description");
        const desc = (descEl?.textContent ?? "").trim();
        const adresEl = el.querySelector(".item-text .adres");
        const adres = (adresEl?.textContent ?? "").trim();
        const locationEl = el.querySelector(".item-text .location");
        const location = (locationEl?.textContent ?? "").trim();
        const title = desc || [adres, location].filter(Boolean).join(", ") || "Woning";
        const municipality = (location && location.trim()) || "Onbekend";

        const roomsEl = el.querySelector(".item-text .rooms");
        const roomCount = roomsEl ? roomsEl.querySelectorAll(".room").length : 0;
        const bedroomsFromRooms = roomCount > 0 ? roomCount : null;

        const allText = (el.innerText ?? "") + " " + desc;
        const slpkMatch = allText.match(/(\d+)\s*slpk\.?/i) || allText.match(/(\d+)\s*slaapkamer/i);
        const bedroomsFromText = slpkMatch ? parseInt(slpkMatch[1], 10) : null;
        const bedrooms = bedroomsFromText ?? bedroomsFromRooms;

        const surfaceMatch = allText.match(/(\d+(?:[.,]\d+)?)\s*m²/i);
        const livingSurfaceM2 = surfaceMatch ? parseFloat(surfaceMatch[1].replace(",", ".")) : null;
        const hasGarden = /tuin|garden|terras/i.test(allText);

        const slideEl = el.querySelector(".slide.blocklink[style*='background-image']");
        const style = slideEl?.getAttribute("style") ?? "";
        const imgMatch = style.match(/url\s*\(\s*['"]?([^'")]+)['"]?\s*\)/);
        const imageUrl = imgMatch ? imgMatch[1].trim() : null;

        return {
          title,
          price,
          bedrooms,
          livingSurfaceM2,
          hasGarden,
          municipality,
          imageUrl,
        };
      });

      const imageUrl = data.imageUrl
        ? data.imageUrl.startsWith("http")
          ? data.imageUrl
          : new URL(data.imageUrl, baseUrl).href
        : null;

      results.push({
        externalId: externalIdFromUrl(fullUrl),
        url: fullUrl,
        title: (data.title || "Woning").trim().slice(0, 500),
        price: data.price,
        bedrooms: data.bedrooms,
        livingSurfaceM2: data.livingSurfaceM2,
        hasGarden: data.hasGarden,
        municipality: (data.municipality && data.municipality.trim()) || "Onbekend",
        description: null,
        imageUrl,
      });
    }
  }

  return results;
}
