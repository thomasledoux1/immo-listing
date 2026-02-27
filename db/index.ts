import { createClient } from '@libsql/client';
import { join } from 'node:path';
import {
  drizzle as drizzleLibsql,
  type LibSQLDatabase,
} from 'drizzle-orm/libsql';
import * as schema from './schema';

const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

export const db = tursoUrl
  ? drizzleLibsql(
      createClient({ url: tursoUrl, authToken: tursoToken ?? undefined }),
      { schema },
    )
  : (() => {
      // require() so better-sqlite3 isn't loaded when TURSO_* is set (e.g. Vercel)
      /* eslint-disable @typescript-eslint/no-require-imports */
      const Database =
        require('better-sqlite3') as typeof import('better-sqlite3');
      const { drizzle } =
        require('drizzle-orm/better-sqlite3') as typeof import('drizzle-orm/better-sqlite3');
      /* eslint-enable @typescript-eslint/no-require-imports */
      const dbPath =
        process.env.DATABASE_PATH ?? join(process.cwd(), 'db', 'local.sqlite');
      return drizzle(new Database(dbPath), {
        schema,
      }) as unknown as LibSQLDatabase<typeof schema>;
    })();
