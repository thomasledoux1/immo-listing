import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real, unique } from "drizzle-orm/sqlite-core";

export const agencies = sqliteTable("agencies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  websiteUrl: text("website_url").notNull(),
  scraperConfig: text("scraper_config", { mode: "json" }).$type<Record<string, unknown>>(),
  createdAt: text("created_at").default(sql`(datetime('now'))`).notNull(),
});

export const listings = sqliteTable(
  "listings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    agencyId: integer("agency_id").notNull().references(() => agencies.id),
    externalId: text("external_id").notNull(),
    url: text("url").notNull(),
    title: text("title").notNull(),
    price: integer("price").notNull(),
    bedrooms: integer("bedrooms"),
    livingSurfaceM2: real("living_surface_m2"),
    hasGarden: integer("has_garden", { mode: "boolean" }).notNull(),
    municipality: text("municipality"),
    description: text("description"),
    imageUrl: text("image_url"),
    firstSeenAt: text("first_seen_at").notNull(),
    lastSeenAt: text("last_seen_at").notNull(),
    rawUpdatedAt: text("raw_updated_at"),
    deletedAt: text("deleted_at"),
  },
  (t) => [unique().on(t.agencyId, t.externalId)]
);

export type Agency = typeof agencies.$inferSelect;
export type NewAgency = typeof agencies.$inferInsert;
export type Listing = typeof listings.$inferSelect;
export type NewListing = typeof listings.$inferInsert;
