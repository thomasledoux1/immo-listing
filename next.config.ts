import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Load from node_modules so path resolution (getBinPath) finds the bin folder
  serverExternalPackages: ["@sparticuz/chromium"],
  // Include chromium's bin (Brotli files) in the cron scrape serverless bundle.
  // Without this, the trace omits them and executablePath() fails on Vercel.
  outputFileTracingIncludes: {
    "/api/cron/scrape": ["node_modules/@sparticuz/chromium/**"],
  },
};

export default nextConfig;
