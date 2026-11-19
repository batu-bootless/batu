// Deneme Sokağı — ana sayfanın tanıtım medyasını üretir (img/).
//
//   npm run tanitim                 → ikisi de
//   npm run tanitim -- --video      → yalnızca tablet videosu (ffmpeg gerekir)
//   npm run tanitim -- --pdf        → yalnızca PDF örnek sayfaları
//
// Tablet videosu (img/tablet-demo.webm, .mp4, .jpg): panelde gerçek bir oturum kaydedilir — Test Oluştur →
// kaynak seç → 10 soru → çöz → sonuç → başa dön. Kareler 2x çözünürlükte alınır, ekranda bir imleç çizilir;
// ffmpeg ile WebM (VP9) ve MP4 (H.264) yapılır, döngüde kesintisiz oynar.
// PDF örnek sayfaları (img/pdf-yaprak-test.jpg, img/pdf-deneme.jpg): şablonun ilk sayfaları, "Test Oluştur ve
// PDF" bölümü için. Örnek PDF ornekler/yaprak-test-tyt-temel-kavramlar.pdf ile aynı test.
// Yalnızca projenin özgün örnek içerikleri kullanılır (data/yerel kullanılmaz). Panelin ya da şablonun
// görünümü değişince yeniden çalıştırın. Gerekenler: Playwright (npm install), video için PATH'te ffmpeg.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { chromium } = require('playwright');
const { start } = require('./sunucu');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'img');
const W = 1024, H = 728;          // tablet ekranının oranı (index.html: .tablet-screen)
const SIZE = '1004:714';          // ekranın 2 katı piksel
const SPEED = 1.25;               // kayıt biraz hızlandırılır

// a drawn cursor and a click ring, so the viewer sees where the "user" clicks
const CURSOR = () => {
  const add = () => {
    if (document.getElementById('fx-cursor')) return;
    const st = document.createElement('style');
    st.textContent = `#fx-cursor{position:fixed;left:0;top:0;width:26px;height:26px;z-index:2147483647;pointer-events:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}
      .fx-ring{position:fixed;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;background:rgba(30,136,229,.28);border:2px solid rgba(30,136,229,.7);z-index:2147483646;pointer-events:none;animation:fxr .45s ease-out forwards}
      @keyframes fxr{from{transform:scale(.3);opacity:1}to{transform:scale(1.35);opacity:0}}`;
    document.head.appendChild(st);
    const c = document.createElement('div');
    c.id = 'fx-cursor';
    c.innerHTML = '<svg viewBox="0 0 26 26" width="26" height="26"><path d="M4 2.5v19.2l5.1-4.9 3.3 7.4 3.4-1.5-3.3-7.3h7z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.body.appendChild(c);
    const put = (x, y) => { c.style.transform = `translate(${x - 4}px,${y - 2.5}px)`; };
    put(...(window.__fxPos || [700, 560]));
    document.addEventListener('mousemove', (e) => { window.__fxPos = [e.clientX, e.clientY]; put(e.clientX, e.clientY); }, true);
    document.addEventListener('mousedown', (e) => {
      const r = document.createElement('div'); r.className = 'fx-ring'; r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px';
      document.body.appendChild(r); setTimeout(() => r.remove(), 500);
    }, true);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();
};

function ffmpeg(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
  if (r.error) throw new Error('ffmpeg bulunamadı (PATH\'te olmalı)');
  if (r.status !== 0) throw new Error('ffmpeg hata verdi');
}

// First pages of two template PDFs, as images for the homepage section.
async function pdfPages(browser, B) {
  const bank = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/soru-bankasi.json'), 'utf8'));
  const ids = (keep) => bank.sorular.filter(keep).sort((a, b) => a.sira - b.sira).map((q) => q.id);
  const tests = [
    ['pdf-yaprak-test.jpg', { id: 'tanitim-1', baslik: 'Temel Kavramlar', ders: 'TYT · Temel Matematik', no: 1, mod: 'metin',
      soruIds: ids((q) => q.kaynak === 'ornek' && q.konu === 'Temel Kavramlar').slice(0, 10), cevapAnahtari: true }],
    ['pdf-deneme.jpg', { id: 'tanitim-2', baslik: 'YDS Denemesi 1', ders: 'YDS · İngilizce', no: 1, ust: 'DENEME', rozet: 'DENEME', mod: 'metin',
      soruIds: ids((q) => q.kaynak === 'ds-yds-1'), cevapAnahtari: true }],
  ];
  for (const [file, test] of tests) {
    const ctx = await browser.newContext({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 0.75 });
    const p = await ctx.newPage();
    await p.addInitScript((t) => { window.__DS_TEST__ = t; }, test);
    await p.goto(B + 'sablon/yaprak-test.html');
    await p.waitForFunction(() => window.__DS_READY__ === true, null, { timeout: 30000 });
    await p.locator('.ds-page').first().screenshot({ path: path.join(OUT, file), type: 'jpeg', quality: 86 });
    await ctx.close();
  }
  console.log('PDF sayfaları yazıldı: img/pdf-yaprak-test.jpg, img/pdf-deneme.jpg');
}

(async () => {
  const only = ['--video', '--pdf'].filter((f) => process.argv.includes(f));
  const want = (f) => !only.length || only.includes(f);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-video-'));
  const srv = await start(0, { yerel: false });
  const B = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await chromium.launch();
  fs.mkdirSync(OUT, { recursive: true });
  try {
    if (want('--pdf')) await pdfPages(browser, B);
    if (want('--video')) await tabletVideo(browser, B, tmp);
  } finally {
    await browser.close();
    srv.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e.message); process.exit(1); });

// Tablet video: a real panel session, recorded and encoded.
async function tabletVideo(browser, B, tmp) {
  {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));

    // demo account (not recorded)
    await p.goto(B + 'kayit.html');
    await p.fill('#name', 'Deniz Kaya'); await p.fill('#email', 'tanitim@example.com'); await p.fill('#password', 'Tanitim12345');
    await p.selectOption('#exam', 'YKS'); await p.check('#terms', { force: true }); await p.click('#submitBtn');
    await p.waitForURL(/panel\.html/); await p.waitForTimeout(800);
    await p.addInitScript(CURSOR);
    await p.goto(B + 'panel.html#test-olustur'); await p.reload();   // a reload runs the cursor script (a # change does not)
    await p.waitForSelector('.src-card'); await p.waitForSelector('#fx-cursor', { state: 'attached' }); await p.waitForTimeout(1500);
    const answers = await p.evaluate(() => window.DS_SORU_BANKASI.sorular.filter((q) => q.kaynak === 'ornek')
      .sort((a, b) => a.sira - b.sira).slice(0, 10).map((q) => 'ABCDE'.indexOf(q.cevap)));

    // cursor helpers: eased moves of a fixed duration, smooth scrolling to a target, click with a ring
    let mx = 700, my = 560;
    await p.mouse.move(mx, my);
    const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    const glide = async (x, y, ms = 550) => {
      const x0 = mx, y0 = my, s0 = Date.now();
      for (;;) {
        const k = Math.min(1, (Date.now() - s0) / ms), t = ease(k);
        await p.mouse.move(x0 + (x - x0) * t, y0 + (y - y0) * t);
        if (k >= 1) break;
      }
      mx = x; my = y;
    };
    const reveal = async (sel) => {
      for (let k = 0; k < 40; k++) {
        const bb = await p.locator(sel).first().boundingBox();
        const over = bb.y + bb.height - (H - 70), under = 90 - bb.y;
        if (over <= 0 && under <= 0) return;
        await p.mouse.wheel(0, over > 0 ? Math.min(60, over) : -Math.min(60, under)); await p.waitForTimeout(28);
      }
    };
    const toTop = async () => {
      for (let k = 0; k < 60 && (await p.evaluate(() => window.scrollY)) > 0; k++) { await p.mouse.wheel(0, -60); await p.waitForTimeout(28); }
    };
    const click = async (sel, { ms = 550, wait = 450 } = {}) => {
      await reveal(sel);
      const bb = await p.locator(sel).first().boundingBox();
      await glide(bb.x + bb.width / 2, bb.y + bb.height / 2, ms); await p.waitForTimeout(90);
      await p.mouse.down(); await p.waitForTimeout(70); await p.mouse.up();
      await p.waitForTimeout(wait);
    };

    // record: CDP screencast frames with their timestamps
    const cdp = await ctx.newCDPSession(p);
    const frames = [];
    cdp.on('Page.screencastFrame', async (f) => {
      const file = path.join(tmp, `f${String(frames.length).padStart(5, '0')}.jpg`);
      fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
      frames.push({ file, t: f.metadata.timestamp });
      try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch (e) { /* stopping */ }
    });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 94, maxWidth: W * 2, maxHeight: H * 2, everyNthFrame: 1 });
    await p.waitForTimeout(1000);

    await click('.src-card:has-text("Örnek Soru Bankası")', { wait: 550 });
    await click('[data-src-next]', { wait: 900 });
    await click('[data-preset="10"]', { wait: 450 });
    await click('[data-make="coz"]', { wait: 1200 });
    const plan = [answers[0], answers[1], (answers[2] + 1) % 5, answers[3]];   // three right, one wrong
    for (let i = 0; i < plan.length; i++) {
      await click(`.pl-q [data-opt="${plan[i]}"]`, { ms: 500, wait: 500 });
      if (i < plan.length - 1) await click('[data-pl="next"]', { ms: 480, wait: 800 });
    }
    await click('[data-pl="finish"]', { wait: 550 });
    if (await p.$('[data-pl="finish-now"]')) await click('[data-pl="finish-now"]', { wait: 1800 });
    await glide(560, 380, 800); await p.waitForTimeout(1200);
    // back to the first screen, so the loop joins up
    await click('[data-pl="close-now"]', { wait: 700 });
    await click('[data-src-back]', { wait: 700 });
    await click('.src-card:has-text("Örnek Soru Bankası")', { wait: 350 });
    await toTop();
    await glide(700, 560, 700); await p.waitForTimeout(600);
    await cdp.send('Page.stopScreencast');
    await p.waitForTimeout(300);
    if (errors.length) throw new Error('Sayfa hatası: ' + errors.join(' | '));
    if (frames.length < 50) throw new Error('Kayıt alınamadı');

    // frames → constant-rate video (each frame lasts until the next one)
    const list = path.join(tmp, 'list.txt');
    const end = frames[frames.length - 1].t + 0.7;
    fs.writeFileSync(list, frames.map((f, i) => `file '${f.file}'\nduration ${Math.max(0.001, (i + 1 < frames.length ? frames[i + 1].t : end) - f.t).toFixed(4)}\n`).join('')
      + `file '${frames[frames.length - 1].file}'\n`);
    const vf = `setpts=PTS/${SPEED},fps=30,scale=${SIZE}:flags=lanczos,format=yuv420p`;
    const src = ['-f', 'concat', '-safe', '0', '-i', list, '-vf', vf, '-an'];
    ffmpeg([...src, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '37', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', path.join(OUT, 'tablet-demo.webm')]);
    ffmpeg([...src, '-c:v', 'libx264', '-preset', 'slow', '-crf', '25', '-profile:v', 'high', '-movflags', '+faststart', path.join(OUT, 'tablet-demo.mp4')]);
    ffmpeg(['-i', path.join(OUT, 'tablet-demo.mp4'), '-vframes', '1', '-q:v', '4', path.join(OUT, 'tablet-demo.jpg')]);
    const kb = (f) => Math.round(fs.statSync(path.join(OUT, f)).size / 1024);
    console.log(`Video yazıldı: img/tablet-demo.webm (${kb('tablet-demo.webm')} KB), .mp4 (${kb('tablet-demo.mp4')} KB), .jpg · `
      + `${((end - frames[0].t) / SPEED).toFixed(1)} sn, ${frames.length} kare`);
  }
}
