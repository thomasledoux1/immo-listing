import { createClient } from '@libsql/client';
import { drizzle as drizzleLibsql } from 'drizzle-orm/libsql';
import * as schema from './schema';

const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

export const db = tursoUrl
  ? drizzleLibsql(
      createClient({ url: tursoUrl, authToken: tursoToken ?? undefined }),
      { schema },
    )
  : (() => {
      const { join } = require('path');
      const Database = require('better-sqlite3');
      const { drizzle } = require('drizzle-orm/better-sqlite3');
      const dbPath =
        process.env.DATABASE_PATH ?? join(process.cwd(), 'db', 'local.sqlite');
      return drizzle(new Database(dbPath), { schema });
    })();
