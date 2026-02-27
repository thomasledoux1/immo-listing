import { and, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { agencies, listings } from "@/db/schema";
import {
  ALLOWED_MUNICIPALITIES_LOWER,
  NON_HOUSE_TITLE_KEYWORDS,
} from "@/lib/constants";

const PRICE_MIN = 450_000;
const PRICE_MAX = 600_000;

/** Listings in allowed municipalities, 450k–600k €, houses only. */
export async function getListings() {
  const municipalityValues = sql.join(
    Array.from(ALLOWED_MUNICIPALITIES_LOWER).map((m) => sql`${m}`),
    sql`, `
  );
  const municipalityCondition = sql`LOWER(TRIM(${listings.municipality})) IN (${municipalityValues})`;

  const textForKeywords = sql`LOWER(COALESCE(${listings.title}, '') || ' ' || COALESCE(${listings.description}, ''))`;
  const notNonHouseConditions = NON_HOUSE_TITLE_KEYWORDS.map(
    (keyword) => sql`${textForKeywords} NOT LIKE ${"%" + keyword + "%"}`
  );

  const rows = await db
    .select({
      id: listings.id,
      url: listings.url,
      title: listings.title,
      price: listings.price,
      bedrooms: listings.bedrooms,
      livingSurfaceM2: listings.livingSurfaceM2,
      hasGarden: listings.hasGarden,
      municipality: listings.municipality,
      imageUrl: listings.imageUrl,
      firstSeenAt: listings.firstSeenAt,
      agencyName: agencies.name,
      agencySlug: agencies.slug,
    })
    .from(listings)
    .innerJoin(agencies, eq(listings.agencyId, agencies.id))
    .where(
    and(
      isNull(listings.deletedAt),
      municipalityCondition,
      gte(listings.price, PRICE_MIN),
      lte(listings.price, PRICE_MAX),
      or(isNull(listings.bedrooms), gte(listings.bedrooms, 3)),
      ...notNonHouseConditions
    )
  )
    .orderBy(sql`${listings.firstSeenAt} desc`);

  return rows;
}
