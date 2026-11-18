// Deneme Sokağı yaprak test PDF'i üretir (sablon/yaprak-test.html şablonuyla).
//
// Bankadan doğrudan:
//   node tools/yaprak-test-pdf.js --konu "Yüzde Problemleri" --mod gorsel --out ornekler/yuzde-gorsel.pdf
//   node tools/yaprak-test-pdf.js --konu "Temel Kavramlar,Yüzde Problemleri" --adet 20 --mod metin --out ornekler/karma.pdf
// Hazır test tanımıyla (panelin kaydettiği biçim):
//   node tools/yaprak-test-pdf.js --test test.json --out test.pdf
//
// Seçenekler: --kaynak <id>  --konu "a,b"  --adet N  --mod gorsel|metin  --baslik "..."  --no N
//             --karistir (kaynak sırası yerine karışık)  --cevapsiz (cevap anahtarı ekleme)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const arg = (name, def) => { const i = process.argv.indexOf('--' + name); return i > -1 ? (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true) : def; };

function fromBank() {
  const bank = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/soru-bankasi.json'), 'utf8'));
  const konular = String(arg('konu', '')).split(',').map((s) => s.trim()).filter(Boolean);
  let qs = bank.sorular.filter((q) => (!arg('kaynak') || q.kaynak === arg('kaynak')) && (!konular.length || konular.includes(q.konu)));
  qs.sort((a, b) => a.sira - b.sira);                        // keep the question bank's own order
  if (arg('karistir')) qs.sort(() => Math.random() - 0.5);
  qs = qs.slice(0, Number(arg('adet', qs.length)));
  if (!qs.length) throw new Error('Seçilen ölçütlere uyan soru bulunamadı.');
  const dersler = [...new Set(qs.map((q) => q.ders))];
  return {
    id: 'cli-' + Date.now().toString(36),
    baslik: arg('baslik', konular.length === 1 ? konular[0] : 'Karma Test'),
    ders: `${qs[0].sinav} · ${dersler.join(' – ')}`,
    no: Number(arg('no', 1)),
    mod: arg('mod', 'metin'),
    soruIds: qs.map((q) => q.id),
    cevapAnahtari: !arg('cevapsiz'),
  };
}

(async () => {
  const out = arg('out');
  if (!out) { console.error('Kullanım: node tools/yaprak-test-pdf.js (--test test.json | --konu "...") --out cikti.pdf'); process.exit(1); }
  const test = arg('test') ? JSON.parse(fs.readFileSync(arg('test'), 'utf8')) : fromBank();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.addInitScript((t) => { window.__DS_TEST__ = t; }, test);
  await page.goto('file://' + path.join(ROOT, 'sablon/yaprak-test.html'), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__DS_READY__ === true, null, { timeout: 30000 });
  const pages = await page.evaluate(() => document.querySelectorAll('.ds-page').length);
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  await page.pdf({ path: out, preferCSSPageSize: true, printBackground: true });
  await browser.close();
  console.log(`PDF yazıldı: ${out} · ${test.soruIds.length} soru · ${pages} sayfa · ${test.mod}`);
})().catch((e) => { console.error(e.message); process.exit(1); });
