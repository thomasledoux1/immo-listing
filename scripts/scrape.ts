import { chromium } from "playwright";
import { runScraper } from "../lib/scraper/run";

async function main() {
  console.log("Starting scraper...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();
  try {
    await runScraper(page);
  } finally {
    await browser.close();
  }
  console.log("Scraper finished.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
