import type { ElementHandle, Page } from "playwright";
import type { NormalizedListing, ScraperConfig } from "../types";
import { externalIdFromUrl } from "../normalize";

const MIN_PRICE = 450_000;
const MAX_PRICE = 600_000;

export async function scrapeCannoodt(
  page: Page,
  config: ScraperConfig,
  baseUrl: string
): Promise<NormalizedListing[]> {
  const results: NormalizedListing[] = [];
  const listingsUrl = config.listingsUrl ?? "https://www.cannoodt.be/aanbod";
  if (!listingsUrl) return results;

  await page.goto(listingsUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);

  // Only house listings: links that contain /huis/ (exclude appartement, commercieel, kantoor)
  const links = await page.$$('.aanbod-item a[href*="/huis/"]');
  const seenUrls = new Set<string>();

  for (const link of links) {
    const href = await link.getAttribute("href");
    if (!href) continue;
    const fullUrl = href.startsWith("http") ? href : new URL(href, baseUrl).href;
    let normalizedUrl: string;
    try {
      const urlObj = new URL(fullUrl);
      urlObj.protocol = "https:";
      if (urlObj.hostname === "www.cannoodt.be" || urlObj.hostname === "cannoodt.be") {
        urlObj.hostname = "www.cannoodt.be";
      }
      normalizedUrl = urlObj.href;
    } catch {
      normalizedUrl = fullUrl;
    }
    if (seenUrls.has(normalizedUrl)) continue;
    seenUrls.add(normalizedUrl);

    const card = await link.evaluateHandle((el) => el.closest(".aanbod-item"));
    const cardEl = card.asElement();
    if (!cardEl) continue;

    const data = await (cardEl as ElementHandle<HTMLElement>).evaluate((el) => {
      const priceEl = el.querySelector(".prijs span[itemprop='price']");
      const priceText = (priceEl?.textContent ?? "").trim();
      const priceMatch = priceText.replace(/\s/g, "").match(/[\d.]+/);
      const price = priceMatch ? parseInt(priceMatch[0].replace(/\./g, ""), 10) : 0;

      const h5 = el.querySelector("h5");
      const title = (h5?.textContent ?? "").replace(/\s*\|\s*$/, "").trim();

      const slpkEl = el.querySelector(".field-name-field-pand-slaapkamers .field-item");
      const bedroomsText = (slpkEl?.textContent ?? "").trim();
      const bedroomsParsed = bedroomsText ? parseInt(bedroomsText, 10) : NaN;
      const bedrooms = Number.isNaN(bedroomsParsed) ? null : bedroomsParsed;

      const oppBewoonEl = el.querySelector(".field-name-field-pand-tot-bew-opp .field-item");
      const oppBewoonText = (oppBewoonEl?.textContent ?? "").trim();
      const livingMatch = oppBewoonText.match(/(\d+(?:[.,]\d+)?)\s*m²/i) || oppBewoonText.match(/(\d+(?:[.,]\d+)?)m²/i);
      const livingSurfaceM2 = livingMatch ? parseFloat(livingMatch[1].replace(",", ".")) : null;

      const oppTerreinEl = el.querySelector(".field-name-field-pand-opp-terrein .field-item");
      const oppTerreinText = (oppTerreinEl?.textContent ?? "").trim();
      const terrainMatch = oppTerreinText.match(/(\d+(?:[.,]\d+)?)\s*m²/i) || oppTerreinText.match(/(\d+(?:[.,]\d+)?)m²/i);
      const terrainM2 = terrainMatch ? parseFloat(terrainMatch[1].replace(",", ".")) : null;
      const hasGarden = terrainM2 != null && terrainM2 > 0;

      const imgContainer = el.querySelector(".img-container");
      const style = (imgContainer?.getAttribute("style") ?? "");
      const imgMatch = style.match(/url\s*\(\s*['"]?([^'")]+)['"]?\s*\)/);
      const imageUrl = imgMatch ? imgMatch[1].trim() : null;

      let municipality: string | null = null;
      const locEl = el.querySelector(".field-name-field-pand-gemeente .field-item, .field-name-field-locatie .field-item, [class*='location'] .field-item, [class*='gemeente']");
      if (locEl) municipality = (locEl.textContent ?? "").trim() || null;
      if (!municipality && title) {
        const postalMatch = title.match(/\b(9\d{3})\s+([A-Za-z\-]+(?:\s+[A-Za-z\-]+)*)/);
        if (postalMatch) municipality = postalMatch[2].trim();
      }

      return {
        title,
        price,
        bedrooms,
        livingSurfaceM2,
        hasGarden,
        imageUrl,
        municipality,
      };
    });

    const price = data.price;
    if (price < MIN_PRICE || price > MAX_PRICE) continue;

    const imageUrl = data.imageUrl
      ? data.imageUrl.startsWith("http")
        ? data.imageUrl
        : new URL(data.imageUrl, baseUrl).href
      : null;

    results.push({
      externalId: externalIdFromUrl(normalizedUrl),
      url: normalizedUrl,
      title: (data.title || "Huis te koop").trim().slice(0, 500),
      price,
      bedrooms: data.bedrooms,
      livingSurfaceM2: data.livingSurfaceM2,
      hasGarden: data.hasGarden,
      municipality: data.municipality ?? "Gent",
      description: null,
      imageUrl,
    });
  }

  return results;
}
