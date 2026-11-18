// Deneme Sokağı PDF şablonu kontrolü — şablonun ölçüleri referans PDF'ten sapmasın diye.
// Kullanım: node tools/sablon-kontrol.js
// sablon/yaprak-test.html'i örnek bir testle açar ve başlık, sütun, numara, kod ve alt bilgi
// konumlarını (mm) referans test PDF'inden ölçülen değerlerle karşılaştırır. Sapma ±0,6 mm'yi
// geçerse hata verir (çıkış kodu 1). Şablonda bilinçli bir değişiklik yapılırsa REF güncellenir.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const TOL = 0.6; // mm
// Referans: soru bankası test PDF'i (A4), pdfplumber ile ölçüldü.
const REF = {
  'bant yüksekliği': 27.6,
  'logo sol': 16.3, 'logo üst': 4.3, 'logo boyu': 20.3,
  'Başlık (DENEME) sol': 45.3,
  'konu çubuğu sol': 106.9, 'konu çubuğu üst': 18.3, 'konu çubuğu sağ': 207.8,
  'TEST rozeti sol': 173.6, 'TEST rozeti üst': 2.0,
  'sütun çizgisi sol': 106.1, 'sütun çizgisi genişliği': 0.6, 'sütun çizgisi üst': 30.5,
  '1. soru no sol': 15.5, '1. soru no üst': 30.9,
  'sağ sütun soru no sol': 113.4,
  'soru kodu sağ': 96.4,
  'soru metni sol': 22.4, 'soru metni sağ': 93.6,
};

(async () => {
  const bank = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/soru-bankasi.json'), 'utf8'));
  const ids = bank.sorular.filter((q) => q.sinav === 'TYT').slice(0, 10).map((q) => q.id);
  const test = { id: 'kontrol', baslik: 'Kontrol', ders: 'TYT', no: 1, mod: 'metin', soruIds: ids, cevapAnahtari: true };
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.addInitScript((t) => { window.__DS_TEST__ = t; }, test);
  await page.goto('file://' + path.join(ROOT, 'sablon/yaprak-test.html'));
  await page.waitForFunction(() => window.__DS_READY__ === true);
  const got = await page.evaluate(() => {
    const MM = 96 / 25.4;
    const pg = document.querySelector('.ds-page').getBoundingClientRect();
    const r = (sel, el) => { const b = (el || document.querySelector(sel)).getBoundingClientRect(); return { l: (b.left - pg.left) / MM, t: (b.top - pg.top) / MM, r: (b.right - pg.left) / MM, b: (b.bottom - pg.top) / MM, w: b.width / MM, h: b.height / MM }; };
    const cols = document.querySelectorAll('.ds-page')[0].querySelectorAll('.ds-col');
    const firstNo = r(null, cols[0].querySelector('.ts-qn')), rightNo = r(null, cols[1].querySelector('.ts-qn'));
    const code = cols[0].querySelector('.ts-code'), codeRange = document.createRange();
    codeRange.selectNodeContents(code);
    const cb = codeRange.getBoundingClientRect();
    const qc = r(null, cols[0].querySelector('.ts-qc'));
    return {
      'bant yüksekliği': r('.ts-band').h,
      'logo sol': r('.ts-logo').l, 'logo üst': r('.ts-logo').t, 'logo boyu': r('.ts-logo').w,
      'Başlık (DENEME) sol': r('.ts-title').l,
      'konu çubuğu sol': r('.ts-subject').l, 'konu çubuğu üst': r('.ts-subject').t, 'konu çubuğu sağ': r('.ts-subject').r,
      'TEST rozeti sol': r('.ts-test').l, 'TEST rozeti üst': r('.ts-test').t,
      'sütun çizgisi sol': r('.ts-rule').l, 'sütun çizgisi genişliği': r('.ts-rule').w, 'sütun çizgisi üst': r('.ts-rule').t,
      '1. soru no sol': firstNo.l, '1. soru no üst': firstNo.t,
      'sağ sütun soru no sol': rightNo.l,
      'soru kodu sağ': (cb.right - pg.left) / MM,
      'soru metni sol': qc.l, 'soru metni sağ': qc.r,
    };
  });
  await browser.close();
  let fail = 0;
  for (const [k, ref] of Object.entries(REF)) {
    const v = got[k], ok = Math.abs(v - ref) <= TOL;
    if (!ok) fail++;
    console.log(`${ok ? 'tamam' : 'SAPMA'}  ${k.padEnd(26)} referans ${ref.toFixed(1).padStart(6)} mm   şablon ${v.toFixed(1).padStart(6)} mm`);
  }
  console.log(fail ? `\n${fail} ölçü referanstan ±${TOL} mm'den fazla sapıyor.` : `\nŞablon referansla uyumlu (${Object.keys(REF).length} ölçü, ±${TOL} mm).`);
  process.exit(fail ? 1 : 0);
})();
