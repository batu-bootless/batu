// Usage: node tools/html-pdf.js <input.html> <output.pdf>
// Renders a local HTML file to an A4 PDF with Chromium (Playwright).
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) { console.error('Kullanım: node tools/html-pdf.js <girdi.html> <cikti.pdf>'); process.exit(1); }
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + path.resolve(input), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.pdf({ path: output, preferCSSPageSize: true, printBackground: true });
  await browser.close();
  console.log('PDF yazıldı:', output);
})();
