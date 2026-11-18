/* Deneme Sokağı — yaprak test renderer.
   DSYaprakTest.render(target, test, bank, { base }) lays the questions out on A4 pages:
   column 1 top→bottom, then column 2, then the next page — the same reading order as a
   question bank. A question is never split; it moves to the next column if it does not fit.
   Used by the panel preview, sablon/yaprak-test.html (print / PDF) and tools/yaprak-test-pdf.js. */
(function (global) {
  'use strict';
  const SITE = 'www.denemesokagi.com';
  const TEXT_PT = 6.4; // question text size in yaprak-test.css (.ts-qc)
  const L5 = ['A', 'B', 'C', 'D', 'E'];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Round badge logo: street sign on a blue disc with a "DENEME SOKAĞI" sign-shaped tag.
  const LOGO = `<svg class="ts-logo" viewBox="0 0 100 100" aria-label="Deneme Sokağı">
    <circle cx="50" cy="45" r="41" fill="#1e88e5"/>
    <circle cx="50" cy="45" r="41" fill="none" stroke="#0d3a8a" stroke-width="2.5" opacity=".35"/>
    <rect x="47" y="45" width="6" height="22" rx="2" fill="#fff"/>
    <rect x="22" y="21" width="56" height="28" rx="6" fill="#fff"/>
    <path d="M30 31h26M30 39h17" stroke="#1e88e5" stroke-width="4.2" stroke-linecap="round"/>
    <path d="M63 28l7 7-7 7" fill="none" stroke="#ffc400" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M6 71h80l8 9-8 9H6z" fill="#17212d"/>
    <text x="46" y="83.2" text-anchor="middle" font-family="DS Head, DejaVu Sans, sans-serif" font-weight="700" font-size="7.6" fill="#fff">DENEME SOKAĞI</text>
  </svg>`;

  // Stable short code for each question, shown like "[#DS-48213]".
  function code(q) {
    if (q.kod) return q.kod;
    let h = 0x811c9dc5;
    for (const ch of String(q.id)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
    return 'DS' + (10000 + (h % 90000));
  }

  // Question banks set the question sentence in bold ("… hangisidir?"), the lead-in in regular weight.
  function stemHtml(text) {
    const t = String(text || '').trim();
    if (!t) return '';
    const parts = t.split(/(?<=[.!?…:])\s+(?=[A-ZÇĞİÖŞÜ0-9"“(])/);
    if (parts.length > 1 && /\?$/.test(parts[parts.length - 1])) {
      return `<p>${esc(parts.slice(0, -1).join(' '))}</p><p class="stem-b">${esc(parts[parts.length - 1])}</p>`;
    }
    return /\?$/.test(t) ? `<p class="stem-b">${esc(t)}</p>` : `<p>${esc(t)}</p>`;
  }
  const optsHtml = (opts) => (opts && opts.length
    ? `<div class="ts-opts">${opts.slice(0, 5).map((o, i) => `<span class="ts-opt"><b>${L5[i]})</b>${esc(o)}</span>`).join('')}</div>` : '');

  function questionEl(q, n, mode, base) {
    const el = document.createElement('div');
    let content;
    if (mode === 'gorsel' && q.gorsel) {
      el.className = 'ts-q img';
      content = `<img src="${esc(base + q.gorsel)}" alt="Soru ${n}">`;
    } else {
      el.className = 'ts-q';
      content = q.sekil
        ? stemHtml(q.metin_ust) + `<img class="ts-fig" src="${esc(base + q.sekil)}" alt=""${q.sekil_pt && q.yazi_pt ? ` style="width:${(q.sekil_pt * TEXT_PT / q.yazi_pt).toFixed(1)}pt"` : ''}>` + stemHtml(q.metin_alt)
        : stemHtml(q.metin_govde || q.metin);
      content += optsHtml(q.secenekler);
    }
    el.innerHTML = `<div class="ts-qn">${n}.</div><div class="ts-qc">${content}</div><div class="ts-code">[#${esc(code(q))}]</div>`;
    return el;
  }

  const bandHtml = (test) => `<header class="ts-band">${LOGO}
      <h1 class="ts-title">${esc(test.ust || 'SORU BANKASI')}</h1>
      <div class="ts-subject">${esc(test.baslik || test.ders || '')}</div>
      <div class="ts-test"><span>TEST</span><span>${esc(test.no || 1)}</span></div>
    </header>`;

  const ready = (el) => Promise.all([...el.querySelectorAll('img')].map((img) => (img.complete ? Promise.resolve() : new Promise((r) => { img.onload = img.onerror = r; }))));

  async function render(target, test, bank, opts = {}) {
    const base = opts.base || '';
    const byId = bank && bank.byId ? bank.byId : Object.fromEntries(((bank && bank.sorular) || []).map((q) => [q.id, q]));
    const qs = (test.soruIds || []).map((id) => byId[id]).filter(Boolean);
    target.classList.add('ds-doc');
    target.innerHTML = '';
    if (document.fonts && document.fonts.load) {
      await Promise.all(['400 10pt "DS Text"', '700 10pt "DS Text"', '400 10pt "DS Head"', '700 10pt "DS Head"'].map((f) => document.fonts.load(f, 'AĞşİ').catch(() => null)));
    }

    const pages = [];
    let cols = null, ci = 0;
    const newPage = () => {
      const first = pages.length === 0;
      const page = document.createElement('section');
      page.className = 'ds-page' + (first ? ' first' : ' cont');
      page.innerHTML = (first ? bandHtml(test) : '') +
        `<div class="ds-body"><div class="ds-col"></div><div class="ds-col"></div><span class="ts-rule"></span><span class="ts-vurl">${SITE}</span></div>` +
        `<footer class="ts-foot"><span class="ts-url"><i>▶</i>${SITE}</span><span class="ts-pg"></span></footer>`;
      target.appendChild(page);
      pages.push(page);
      cols = page.querySelectorAll('.ds-col');
      ci = 0;
    };
    const place = async (el) => {
      cols[ci].appendChild(el);
      await ready(el);
      if (cols[ci].scrollHeight > cols[ci].clientHeight + 1 && cols[ci].children.length > 1) {
        el.remove();
        if (++ci > 1) newPage();
        cols[ci].appendChild(el);
      }
    };

    newPage();
    for (let i = 0; i < qs.length; i++) await place(questionEl(qs[i], i + 1, test.mod || 'metin', base));

    if (test.cevapAnahtari !== false && qs.length) {
      const key = document.createElement('div');
      key.className = 'ts-key';
      key.innerHTML = `<h4>CEVAP ANAHTARI</h4><div class="ts-key-grid">${qs.map((q, i) => `<span>${i + 1}.<b>${esc(q.cevap || '—')}</b></span>`).join('')}</div>` +
        (qs.some((q) => !q.cevap) ? '<p>— : Kaynakta cevap anahtarı bulunamayan soru.</p>' : '');
      await place(key);
    }

    pages.forEach((p, i) => { p.querySelector('.ts-pg').textContent = String(i + 1); });
    // On the last page the column rule stops where the questions stop, as in the printed banks.
    const last = pages[pages.length - 1], body = last.querySelector('.ds-body');
    const used = Math.max(...[...last.querySelectorAll('.ds-col')].map((c) => (c.lastElementChild ? c.lastElementChild.offsetTop + c.lastElementChild.offsetHeight - c.offsetTop : 0)));
    if (used && used < body.clientHeight) {
      last.querySelector('.ts-rule').style.bottom = `${body.clientHeight - used}px`;
      const v = last.querySelector('.ts-vurl');
      if (used < v.offsetHeight + 40) v.remove(); else v.style.top = `${used / 2}px`;
    }
    return { pages: pages.length, questions: qs.length };
  }

  global.DSYaprakTest = { render, LOGO, code };
})(window);
