const { chromium } = require("playwright");
const path = require("path");
(async () => {
  const svgPath = process.argv[2];
  const pngPath = process.argv[3];
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1050 }, deviceScaleFactor: 1 });
  await page.goto("file:///" + path.resolve(svgPath).replace(/\\/g, "/"));
  await page.screenshot({ path: pngPath, fullPage: true, omitBackground: false });
  await browser.close();
})();
