// Deneme Sokağı — uçtan uca duman testi:  node tests/smoke.js   (npm test)
//
// Siteyi tools/sunucu.js ile rastgele bir portta açar ve gerçek bir tarayıcıda (Playwright / Chromium)
// ana akışları dener: ana sayfa, kayıt, bütün panel sayfaları, yaprak test (kaynak → branş → çöz → sonuç),
// PDF indirme, deneme (seç → başla → yarıda kapat → soru harcanmaz), deneme PDF'i, çıkış / hatalı şifre / giriş
// ve telefon görünümü. Hiçbir sayfada JavaScript hatası, konsol hatası ya da 4xx/5xx yanıt olmamalı.
// Yalnızca depodaki örnek içerikleri kullanır (data/yerel gerekmez). Başarısızlıkta 1 koduyla çıkar.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium, devices } = require('playwright');
const { start } = require('../tools/sunucu');

const results = [];
const issues = [];          // console errors, page errors, failed requests
async function step(name, fn) {
  try { const note = await fn(); results.push({ name, ok: true, note }); console.log(`  ✓ ${name}${note ? ` — ${note}` : ''}`); }
  catch (e) { results.push({ name, ok: false }); console.log(`  ✗ ${name}\n      ${String(e && e.message || e).split('\n')[0]}`); }
}
const watch = (page, label) => {
  page.on('pageerror', (e) => issues.push(`${label}: JS hatası: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') issues.push(`${label}: konsol: ${m.text()}`); });
  page.on('response', (r) => { if (r.status() >= 400) issues.push(`${label}: ${r.status()} ${r.url()}`); });
};
const isPdf = (file) => fs.readFileSync(file).subarray(0, 5).toString() === '%PDF-';
const pdfPages = (file) => (fs.readFileSync(file, 'latin1').match(/\/Type \/Page\b/g) || []).length;

(async () => {
  const server = await start(0);
  const B = `http://127.0.0.1:${server.address().port}/`;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-smoke-'));
  const browser = await chromium.launch();
  const email = `test${Date.now()}@example.com`, pass = 'Guclu.Sifre42';
  console.log(`Deneme Sokağı duman testi — ${B}`);

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage();
  watch(p, 'masaüstü');
  const go = async (hash) => { await p.evaluate((h) => { location.hash = h; }, hash); await p.waitForTimeout(450); };

  await step('Ana sayfa açılıyor', async () => {
    await p.goto(B);
    if (!/Deneme Sokağı/.test(await p.title())) throw new Error('başlık yok');
    if (!(await p.$('a[href="kayit.html"]'))) throw new Error('Kayıt bağlantısı yok');
  });

  await step('Kayıt olup panele giriliyor (demo modu)', async () => {
    await p.goto(B + 'kayit.html');
    await p.fill('#name', 'Deniz Kaya'); await p.fill('#email', email); await p.fill('#password', pass);
    await p.selectOption('#exam', 'YDS'); await p.check('#terms', { force: true }); await p.click('#submitBtn');
    await p.waitForURL(/panel\.html/, { timeout: 10000 }); await p.waitForTimeout(600);
  });

  await step('Bütün panel sayfaları açılıyor', async () => {
    const routes = await p.$$eval('.sb-nav a[data-route]', (a) => a.map((x) => x.dataset.route));
    for (const r of routes) {
      await go(r);
      if (!(await p.textContent('#pageTitle')).trim()) throw new Error(`${r}: başlık boş`);
      if (!(await p.$('#content .view, #content section, #content .card'))) throw new Error(`${r}: içerik yok`);
    }
    return `${routes.length} sayfa`;
  });

  await step('Yaprak test: kaynak seç → 5 soru → çöz → sonuç', async () => {
    await go('test-olustur');
    await p.click('.src-card:has-text("Kelime ve Dil Bilgisi")'); await p.click('[data-src-next]'); await p.waitForTimeout(300);
    await p.click('[data-preset="5"]'); await p.click('[data-make="coz"]'); await p.waitForSelector('.pl-q');
    if ((await p.$$('.optik-row')).length !== 5) throw new Error('5 soru gelmedi');
    await p.keyboard.press('a'); await p.click('[data-pl="finish"]');
    if (await p.$('[data-pl="finish-now"]')) await p.click('[data-pl="finish-now"]');
    await p.waitForSelector('.res-stats');
    const res = await p.$$eval('.res-stats b', (x) => x.map((e) => e.textContent).join(' / '));
    await p.click('[data-pl="close-now"]'); await p.waitForTimeout(400);
    return `D / Y / B / Net: ${res}`;
  });

  await step('Yaprak test PDF indiriliyor', async () => {
    await p.click('[data-preset="5"]');
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.click('[data-make="indir"]')]);
    const file = path.join(tmp, dl.suggestedFilename()); await dl.saveAs(file);
    if (!isPdf(file)) throw new Error('PDF değil');
    return `${dl.suggestedFilename()}, ${pdfPages(file)} sayfa`;
  });

  await step('PDF cevap anahtarı ayrı sayfada', async () => {
    await p.click('.pdf-opt input[value="ayri"] + span'); await p.click('[data-preset="5"]');
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.click('[data-make="indir"]')]);
    const file = path.join(tmp, 'anahtar-' + dl.suggestedFilename()); await dl.saveAs(file);
    const n = pdfPages(file);
    if (await p.$eval('.pdf-opt input:checked', (x) => x.value) !== 'ayri') throw new Error('seçim hatırlanmadı');
    await p.click('.pdf-opt input[value="sona"] + span');
    if (n < 2) throw new Error(`cevap anahtarı ayrı sayfada değil (${n} sayfa)`);
    return `${n} sayfa (sorular + cevap anahtarı)`;
  });

  await step('Deneme: seç → başla → yarıda kapat (soru harcanmaz)', async () => {
    await go('denemeler');
    await p.click('.src-card:has-text("YDS Denemesi")'); await p.click('[data-src-next]'); await p.waitForTimeout(300);
    const before = await p.textContent('.dn-stats div b');
    await p.click('[data-dn="basla"]'); await p.waitForSelector('.pl-q');
    await p.click('[data-pl="close"]'); await p.waitForTimeout(300);
    if (await p.$('[data-pl="close-now"]')) await p.click('[data-pl="close-now"]');
    await p.waitForTimeout(400);
    const after = await p.textContent('.dn-stats div b');
    if (before !== after) throw new Error(`soru sayısı değişti (${before} → ${after})`);
    return `${after} soru`;
  });

  await step('Deneme PDF indiriliyor', async () => {
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 120000 }), p.click('[data-dn="pdf"]')]);
    const file = path.join(tmp, dl.suggestedFilename()); await dl.saveAs(file);
    if (!isPdf(file)) throw new Error('PDF değil');
    return `${pdfPages(file)} sayfa`;
  });

  await step('Çıkış, hatalı şifre uyarısı, yeniden giriş', async () => {
    await go('ayarlar');
    await p.click('[data-action="logout"]'); await p.waitForURL(/giris\.html/, { timeout: 5000 });
    await p.fill('#email', email); await p.fill('#password', 'yanlis-sifre'); await p.click('#submitBtn'); await p.waitForTimeout(800);
    if (!(await p.textContent('#formAlert')).trim()) throw new Error('hata mesajı çıkmadı');
    await p.fill('#password', pass); await p.click('#submitBtn'); await p.waitForURL(/panel\.html/, { timeout: 5000 });
  });

  await step('Telefon görünümü taşmıyor', async () => {
    const m = await browser.newContext({ ...devices['iPhone 13'] });
    const ph = await m.newPage(); watch(ph, 'telefon');
    await ph.goto(B + 'kayit.html');
    await ph.fill('#name', 'Deniz Kaya'); await ph.fill('#email', 'm' + email); await ph.fill('#password', pass);
    await ph.selectOption('#exam', 'YKS'); await ph.check('#terms', { force: true }); await ph.click('#submitBtn');
    await ph.waitForURL(/panel\.html/, { timeout: 10000 }); await ph.waitForTimeout(500);
    for (const r of ['genel', 'denemeler', 'test-olustur']) {
      await ph.evaluate((h) => { location.hash = h; }, r); await ph.waitForTimeout(400);
      const w = await ph.evaluate(() => document.documentElement.scrollWidth);
      if (w > 391) throw new Error(`${r}: sayfa ${w}px genişliyor`);
    }
    await m.close();
  });

  await step('Hiçbir sayfada hata yok (JS, konsol, 4xx/5xx)', async () => {
    if (issues.length) throw new Error(issues.slice(0, 5).join(' | '));
  });

  await browser.close();
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  const failed = results.filter((r) => !r.ok).length;
  console.log(failed ? `\n${failed}/${results.length} adım başarısız.` : `\n${results.length}/${results.length} adım başarılı.`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
