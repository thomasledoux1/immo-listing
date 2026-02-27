import type { ElementHandle, Page } from "playwright";
import type { NormalizedListing, ScraperConfig } from "../types";
import {
  parsePrice,
  parseSurface,
  hasGardenFromText,
  externalIdFromUrl,
  isSoldOrRentedFromText,
} from "../normalize";

const LISTINGS_URL =
  "https://www.zimmo.be/nl/zoeken/?search=eyJmaWx0ZXIiOnsic3RhdHVzIjp7ImluIjpbIkZPUl9TQUxFIiwiVEFLRV9PVkVSIl19LCJjYXRlZ29yeSI6eyJpbiI6WyJIT1VTRSJdfSwicHJpY2UiOnsidW5rbm93biI6dHJ1ZSwicmFuZ2UiOnsibWluIjo0NTAwMDAsIm1heCI6NjAwMDAwfX0sImJlZHJvb21zIjp7InVua25vd24iOnRydWUsInJhbmdlIjp7Im1pbiI6M319LCJwbGFjZUlkIjp7ImluIjpbMTUwNiwxNTE4LDE1MTcsMTUxOSwxNTExLDE1MTAsMTUxMiwxNTEzLDE1MTUsMTUxNiwxNTE0LDE1MjgsMTUyOSwxNTMwLDE0OTQsMTQ5NV19fSwicGFnaW5nIjp7ImZyb20iOjAsInNpemUiOjE3fSwic29ydGluZyI6W3sidHlwZSI6IkRBVEUiLCJvcmRlciI6IkRFU0MifV19&p=1#gallery";

/** Parse bedroom count from Zimmo meta (e.g. "4" inside .bedroom-icon or "3 slaapkamers") */
function parseBedroomsFromMeta(text: string | null | undefined): number | null {
  if (!text) return null;
  const trimmed = text.trim();
  const onlyDigit = /^\d+$/.exec(trimmed);
  if (onlyDigit) return parseInt(onlyDigit[0], 10);
  const match = trimmed.match(/(\d+)\s*(?:slpkr\.?|slaapkamer|bedroom|bed|bdr\.?)/i);
  return match ? parseInt(match[1], 10) : null;
}

export async function scrapeZimmo(
  page: Page,
  config: ScraperConfig,
  baseUrl: string
): Promise<NormalizedListing[]> {
  const results: NormalizedListing[] = [];
  const listingsUrl = config.listingsUrl ?? LISTINGS_URL;
  if (!listingsUrl) return results;

  await page.goto(listingsUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);

  const linkSelector = 'a.property-item_link[href*="/te-koop/huis/"]';
  const links = await page.$$(linkSelector);
  const seenUrls = new Set<string>();

  for (const link of links) {
    const href = await link.getAttribute("href");
    if (!href) continue;
    const fullUrl = href.startsWith("http") ? href : new URL(href, baseUrl).href;
    if (seenUrls.has(fullUrl)) continue;
    seenUrls.add(fullUrl);

    const container = await link.evaluateHandle((el) =>
      el.closest(".property-item") ?? el.parentElement?.parentElement ?? el
    );
    const containerEl = container.asElement();
    const root = containerEl ?? link;

    const data = await (root as ElementHandle<HTMLElement>).evaluate((el) => {
      const priceEl = el.querySelector(".property-item_price");
      const priceText = (priceEl?.textContent ?? "").trim();
      const titleEl = el.querySelector(".property-item_title a");
      const addressEl = el.querySelector(".property-item_address");
      const addressText = (addressEl?.textContent ?? "").trim();
      const metaEl = el.querySelector(".property-item_meta-info");
      const metaText = (metaEl?.textContent ?? "").trim();
      const bedroomEl = el.querySelector(".bedroom-icon.property-item_icon");
      const bedroomText = (bedroomEl?.textContent ?? "").trim();
      const imgEl = el.querySelector("img.property-thumb");
      const bodyText = (el.innerText ?? "").trim();
      return {
        priceText,
        title: (titleEl?.textContent ?? "").trim(),
        addressText,
        metaText,
        bedroomText,
        allText: bodyText,
        img: imgEl?.getAttribute("src") ?? null,
      };
    });

    if (isSoldOrRentedFromText(data.allText)) continue;

    const price = parsePrice(data.priceText || data.allText);
    if (price <= 0) continue;

    const title = data.title || "Huis te koop";
    const bedrooms = parseBedroomsFromMeta(data.bedroomText || data.metaText);
    const surface = parseSurface(data.metaText || data.allText);
    const hasGarden = hasGardenFromText(data.allText);

    const municipality = data.addressText
      ? (() => {
          const lastLine = data.addressText.split(/\s*\n\s*/).pop()?.trim() ?? "";
          return lastLine.replace(/^\d+\s*/, "").trim() || "Onbekend";
        })()
      : "Onbekend";

    results.push({
      externalId: externalIdFromUrl(fullUrl),
      url: fullUrl,
      title: (title || "Listing").trim().slice(0, 500),
      price,
      bedrooms,
      livingSurfaceM2: surface,
      hasGarden,
      municipality,
      description: null,
      imageUrl: data.img
        ? data.img.startsWith("http")
          ? data.img
          : new URL(data.img, baseUrl).href
        : null,
    });
  }

  return results;
}
