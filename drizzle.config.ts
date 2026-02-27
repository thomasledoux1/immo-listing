import { defineConfig } from 'drizzle-kit';

const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

export default defineConfig({
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: tursoUrl ? 'turso' : 'sqlite',
  dbCredentials: tursoUrl
    ? { url: tursoUrl, authToken: tursoToken }
    : { url: './db/local.sqlite' },
});
