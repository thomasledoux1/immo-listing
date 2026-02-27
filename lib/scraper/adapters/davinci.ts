import type { ElementHandle, Page } from "playwright";
import type { NormalizedListing, ScraperConfig } from "../types";
import { externalIdFromUrl } from "../normalize";

const MIN_PRICE = 450_000;
const MAX_PRICE = 600_000;

const DEFAULT_LISTINGS_URL =
  "https://www.immodavinci.be/residentieel/kopen/woningen/9000-gent+9031-gent-drongen+9040-gent-sint-amandsberg+9040-gent+9041-gent-oostakker+9050-gent-gentbrugge+9050-gent-ledeberg+9051-gent+9051-gent-sint-denijs-westrem+9052-gent-zwijnaarde?priceMax=600000";

export async function scrapeDaVinci(
  page: Page,
  config: ScraperConfig,
  baseUrl: string
): Promise<NormalizedListing[]> {
  const results: NormalizedListing[] = [];
  const listingsUrl = config.listingsUrl ?? DEFAULT_LISTINGS_URL;
  if (!listingsUrl) return results;

  const seenUrls = new Set<string>();
  let pageNum = 1;
  let hasNext = true;

  while (hasNext) {
    const url =
      pageNum === 1
        ? listingsUrl
        : listingsUrl.includes("?")
          ? `${listingsUrl}&page=${pageNum}`
          : `${listingsUrl}?page=${pageNum}`;

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);

    const links = await page.$$('a.gallcell[href*="/detail/"]');
    if (links.length === 0) break;

    for (const link of links) {
      const href = await link.getAttribute("href");
      if (!href) continue;
      if (href.toLowerCase().includes("appartement")) continue;

      const fullUrl = href.startsWith("http") ? href : new URL(href, baseUrl).href;
      if (seenUrls.has(fullUrl)) continue;

      const cardEl = link.asElement();
      if (!cardEl) continue;

      const data = await (cardEl as ElementHandle<HTMLElement>).evaluate((el) => {
        const allText = (el.innerText ?? "").trim();
        if (allText.includes("Verkocht")) return null;

        const priceEl = el.querySelector(".price");
        const priceText = (priceEl?.textContent ?? "").trim();
        const priceMatch = priceText.replace(/\s/g, "").match(/[\d.]+/);
        const price = priceMatch ? parseInt(priceMatch[0].replace(/\./g, ""), 10) : 0;

        const contentP = el.querySelector(".content p");
        const title = (contentP?.textContent ?? "").replace(/\s+/g, " ").trim();

        const iconSpans = Array.from(el.querySelectorAll(".content .icons .item span"));
        let bedrooms: number | null = null;
        let livingSurfaceM2: number | null = null;
        let groundM2: number | null = null;
        for (const span of iconSpans) {
          const t = (span.textContent ?? "").trim();
          const slpkMatch = t.match(/(\d+)\s*slpk\.?/i);
          if (slpkMatch) {
            bedrooms = parseInt(slpkMatch[1], 10);
          }
          const mMatch = t.match(/(\d+(?:[.,]\d+)?)\s*m/i);
          if (mMatch) {
            const val = parseFloat(mMatch[1].replace(",", "."));
            if (livingSurfaceM2 == null) livingSurfaceM2 = val;
            else if (groundM2 == null) groundM2 = val;
          }
        }
        const hasGarden = groundM2 != null && groundM2 > 0;

        const img = el.querySelector(".image img, img");
        const imgSrc = img?.getAttribute("src") ?? null;

        let municipality: string | null = null;
        const locEl = el.querySelector("[class*='location'], [class*='address'], [class*='place'], .content [class*='city']");
        if (locEl) municipality = (locEl.textContent ?? "").trim() || null;
        if (!municipality && title) {
          const postalMatch = title.match(/\b(9\d{3})\s+([A-Za-z\-]+(?:\s+[A-Za-z\-]+)*)/);
          if (postalMatch) municipality = postalMatch[2].trim();
          const afterComma = title.split(",").pop()?.trim();
          if (afterComma && /^[A-Za-z\-]+/.test(afterComma)) municipality = municipality ?? afterComma;
        }

        return {
          title,
          price,
          bedrooms,
          livingSurfaceM2,
          hasGarden,
          imageUrl: imgSrc,
          municipality,
        };
      });

      if (data === null) continue;
      seenUrls.add(fullUrl);

      const price = data.price;
      if (price < MIN_PRICE || price > MAX_PRICE) continue;

      const imageUrl = data.imageUrl
        ? data.imageUrl.startsWith("http")
          ? data.imageUrl
          : new URL(data.imageUrl, baseUrl).href
        : null;

      results.push({
        externalId: externalIdFromUrl(fullUrl),
        url: fullUrl,
        title: (data.title || "Woning").trim().slice(0, 500),
        price,
        bedrooms: data.bedrooms,
        livingSurfaceM2: data.livingSurfaceM2,
        hasGarden: data.hasGarden,
        municipality: data.municipality ?? "Gent",
        description: null,
        imageUrl,
      });
    }

    const nextLink = await page.$(`a[href*="page=${pageNum + 1}"]`);
    hasNext = nextLink !== null;
    pageNum += 1;
  }

  return results;
}
