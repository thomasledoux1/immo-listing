import type { NormalizedListing } from "./types";

/** Parse price from text like "€ 524 000" or "Vanaf € 319 000" */
export function parsePrice(text: string | null | undefined): number {
  if (!text) return 0;
  const match = text.replace(/\s/g, "").match(/[\d.]+/);
  return match ? parseInt(match[0].replace(/\./g, ""), 10) : 0;
}

/** Parse bedroom count from text like "3 slpkr." or "3 slaapkamers" */
export function parseBedrooms(text: string | null | undefined): number | null {
  if (!text) return null;
  const match = text.match(/(\d+)\s*(?:slpkr\.?|slaapkamer|bedroom|bed)/i);
  return match ? parseInt(match[1], 10) : null;
}

/** Parse surface from text like "216 m² woonoppervlakte" or "136 m²" */
export function parseSurface(text: string | null | undefined): number | null {
  if (!text) return null;
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*m²/i) || text.match(/(\d+(?:[.,]\d+)?)\s*sqm/i);
  if (!match) return null;
  return parseFloat(match[1].replace(",", "."));
}

/** Infer garden from text (tuin, garden, grondoppervlakte with large value, etc.) */
export function hasGardenFromText(text: string | null | undefined): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  if (lower.includes("tuin") || lower.includes("garden") || lower.includes("terras")) return true;
  if (lower.includes("grondoppervlakte") && /\d{2,}/.test(text)) return true;
  return false;
}

/** Build external_id from URL (path slug or last segment) */
export function externalIdFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    const segments = path.split("/").filter(Boolean);
    return segments.length > 0 ? segments[segments.length - 1]! : url;
  } catch {
    return url;
  }
}

/** True if URL or path indicates an apartment/flat (exclude these – we want houses only) */
export function isApartmentFromUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return (
      path.includes("/appartement") ||
      path.includes("/apartment") ||
      path.includes("/flat") ||
      path.includes("/studio")
    );
  } catch {
    return false;
  }
}

/** True if URL or path indicates a house (huis, woning, house) */
export function isHouseFromUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return (
      path.includes("/huis") ||
      path.includes("/woning") ||
      path.includes("/house") ||
      path.includes("/villa")
    );
  } catch {
    return false;
  }
}

/** True if we should only scrape houses: URL must look like a house and not an apartment */
export function isHouseListingOnly(url: string): boolean {
  if (isApartmentFromUrl(url)) return false;
  return isHouseFromUrl(url);
}

/** Exclude apartments; use when URL structure does not always include /huis/ (e.g. generic adapter) */
export function isNotApartmentUrl(url: string): boolean {
  return !isApartmentFromUrl(url);
}

/** True if card/list text indicates the listing is sold or rented (exclude – we want unsold only) */
export function isSoldOrRentedFromText(text: string | null | undefined): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return (
    lower.includes("verkocht") ||
    lower.includes("sold") ||
    lower.includes("verhuurd") ||
    lower.includes("rented") ||
    lower.includes("reserved")
  );
}

/** Allowed city slugs for Ghent area (for URL building and optional client-side filter) */
export const GHENT_AREA_CITIES = [
  "gent",
  "wondelgem",
  "sint-amandsberg",
  "gentbrugge",
  "merelbeke",
  "melle",
  "zwijnaarde",
  "oostakker",
  "evergem",
  "mariakerke",
  "drongen",
] as const;
