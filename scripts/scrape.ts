import { chromium, type Browser } from "playwright";
import { runScraper } from "../lib/scraper/run";

async function main() {
  console.log("Starting scraper...");
  const launchOptions = {
    headless: true,
    args: ["--disable-blink-features=AutomationControlled"],
  };
  let browser: Browser;
  try {
    browser = await chromium.launch({
      ...launchOptions,
      channel: "chrome",
    });
  } catch {
    browser = await chromium.launch(launchOptions);
  }
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 720 },
    locale: "en-GB",
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
