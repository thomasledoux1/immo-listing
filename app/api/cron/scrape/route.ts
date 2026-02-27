import sparticuzChromium from '@sparticuz/chromium';
import { chromium as playwrightChromium } from 'playwright-core';
import { NextResponse } from 'next/server';
import { runScraper } from '@/lib/scraper/run';

const CRON_SECRET = process.env.CRON_SECRET;

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

function checkAuth(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  const url = request.url ? new URL(request.url) : null;
  const token =
    authHeader?.replace(/^Bearer\s+/i, '') ?? url?.searchParams.get('secret');
  return Boolean(CRON_SECRET && token === CRON_SECRET);
}

export async function GET(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return runScrape();
}

export async function POST(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return runScrape();
}

async function runScrape() {
  try {
    const executablePath = await sparticuzChromium.executablePath();
    const browser = await playwrightChromium.launch({
      args: sparticuzChromium.args,
      executablePath,
      headless: true,
    });
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();
    try {
      await runScraper(page);
    } finally {
      await browser.close();
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Scrape cron failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Scrape failed' },
      { status: 500 },
    );
  }
}
