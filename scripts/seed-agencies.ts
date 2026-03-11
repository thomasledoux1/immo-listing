import { join } from 'path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { agencies } from '../db/schema';
import { AGENCIES } from '../data/agencies';

import { db } from '../db';

function seed() {
  console.log('Seeding agencies...');
  for (const a of AGENCIES) {
    db.insert(agencies)
      .values({
        name: a.name,
        slug: a.slug,
        websiteUrl: a.websiteUrl,
        scraperConfig: a.scraperConfig as unknown as Record<string, unknown>,
      })
      .onConflictDoUpdate({
        target: agencies.slug,
        set: {
          name: a.name,
          websiteUrl: a.websiteUrl,
          scraperConfig: a.scraperConfig as unknown as Record<string, unknown>,
        },
      })
      .run();
  }
  console.log(`Seeded ${AGENCIES.length} agencies.`);
}

seed();
