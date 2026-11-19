/* Deneme Sokağı — PDF download inside the page (no new tab, no print dialog).
   DSPdf.build(test, bank, { base, onProgress }) lays the test out with the official template
   (DSYaprakTest.render) in an off-screen box, turns every A4 page into a picture (SVG
   foreignObject with the template's CSS, fonts and images embedded) and joins the pages into
   one PDF. DSPdf.save(blob, filename) hands the file over: through the claude.ai "downloads"
   capability when the page runs as an Artifact, otherwise as an ordinary browser download. */
(function (global) {
  'use strict';
  const SCALE = 2;                       // ≈ 190 dpi
  const A4 = { w: 595.28, h: 841.89 };   // pt

  const toDataUrl = (blob) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(blob); });
  const cache = new Map();
  async function dataUrl(url) {
    if (!cache.has(url)) cache.set(url, fetch(url).then((r) => { if (!r.ok) throw new Error(url); return r.blob(); }).then(toDataUrl));
    return cache.get(url);
  }

  // The template's stylesheet with its fonts inlined (an SVG picture cannot load files).
  let cssPromise = null;
  function templateCss() {
    if (!cssPromise) {
      cssPromise = (async () => {
        const link = [...document.querySelectorAll('link[rel="stylesheet"]')].find((l) => /yaprak-test\.css/.test(l.href));
        const href = link ? link.href : new URL('sablon/yaprak-test.css', document.baseURI).href;
        let css = await (await fetch(href)).text();
        const urls = [...new Set([...css.matchAll(/url\("?([^")]+)"?\)/g)].map((m) => m[1]))];
        for (const u of urls) css = css.split(u).join(await dataUrl(new URL(u, href).href));
        return css;
      })();
      cssPromise.catch(() => { cssPromise = null; });
    }
    return cssPromise;
  }

  async function pageToJpeg(page, css) {
    const clone = page.cloneNode(true);
    for (const img of clone.querySelectorAll('img')) {
      const src = page.querySelectorAll('img')[[...clone.querySelectorAll('img')].indexOf(img)].src;
      try { img.setAttribute('src', await dataUrl(src)); } catch (e) { img.removeAttribute('src'); }
    }
    const w = page.offsetWidth, h = page.offsetHeight;
    const wrap = document.createElement('div');
    wrap.className = 'ds-doc';
    wrap.appendChild(clone);
    const xhtml = new XMLSerializer().serializeToString(wrap);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><foreignObject x="0" y="0" width="100%" height="100%">` +
      `<div xmlns="http://www.w3.org/1999/xhtml" style="margin:0;width:${w}px;height:${h}px"><style>${css.replace(/]]>/g, '')}</style>${xhtml}</div></foreignObject></svg>`;
    // a data: URL (not a blob: URL) keeps the canvas exportable in Chromium
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    try {
      const pic = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('Sayfa çizilemedi')); i.src = url; });
      if (pic.decode) await pic.decode().catch(() => null);
      const c = document.createElement('canvas');
      c.width = Math.round(w * SCALE); c.height = Math.round(h * SCALE);
      const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(pic, 0, 0, c.width, c.height);
      const jpg = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.9));
      return { bytes: new Uint8Array(await jpg.arrayBuffer()), w: c.width, h: c.height };
    } finally {
      /* nothing to release */
    }
  }

  // Smallest useful PDF: one JPEG per A4 page.
  function jpegPdf(pages) {
    const enc = new TextEncoder(), parts = [], offs = [];
    let len = 0;
    const push = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
    const obj = (id, body) => { offs[id] = len; push(`${id} 0 obj\n${body}\nendobj\n`); };
    push('%PDF-1.4\n');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, `<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ')}] /Count ${pages.length} >>`);
    pages.forEach((p, i) => {
      const pid = 3 + i * 3, cid = pid + 1, iid = pid + 2, draw = `q ${A4.w} 0 0 ${A4.h} 0 0 cm /Im${i} Do Q`;
      obj(pid, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.w} ${A4.h}] /Resources << /XObject << /Im${i} ${iid} 0 R >> >> /Contents ${cid} 0 R >>`);
      obj(cid, `<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`);
      offs[iid] = len;
      push(`${iid} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.bytes.length} >>\nstream\n`);
      push(p.bytes);
      push('\nendstream\nendobj\n');
    });
    const size = 3 + pages.length * 3, xref = len;
    let tbl = `xref\n0 ${size}\n0000000000 65535 f \n`;
    for (let id = 1; id < size; id++) tbl += `${String(offs[id]).padStart(10, '0')} 00000 n \n`;
    push(tbl + `trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return new Blob(parts, { type: 'application/pdf' });
  }

  async function build(test, bank, opts = {}) {
    const box = document.createElement('div');
    box.setAttribute('aria-hidden', 'true');
    box.style.cssText = 'position:fixed;left:-12000px;top:0;width:210mm;pointer-events:none;';
    document.body.appendChild(box);
    try {
      const [css] = await Promise.all([templateCss(), global.DSYaprakTest.render(box, test, bank, { base: opts.base || '' })]);
      const pages = [...box.querySelectorAll('.ds-page')], out = [];
      for (let i = 0; i < pages.length; i++) {
        if (opts.onProgress) opts.onProgress(i + 1, pages.length);
        out.push(await pageToJpeg(pages[i], css));
      }
      return jpegPdf(out);
    } finally {
      box.remove();
    }
  }

  // Inside claude.ai the "downloads" capability asks the viewer and saves the file; elsewhere a normal download.
  async function save(blob, filename) {
    let dl = null;
    if (global.claude && typeof global.claude.use === 'function') {
      try { dl = await Promise.race([global.claude.use('downloads'), new Promise((r) => setTimeout(() => r(null), 10000))]); } catch (e) { dl = null; }
    }
    if (dl) return dl.save({ filename, data: blob });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
    return { status: 'saved' };
  }

  const fileName = (s) => `${String(s || 'deneme-sokagi').toLocaleLowerCase('tr').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100).replace(/-$/, '') || 'deneme-sokagi'}.pdf`;

  global.DSPdf = { build, save, fileName };
})(window);
