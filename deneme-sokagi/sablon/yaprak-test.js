/* Deneme Sokağı — yaprak test renderer.
   DSYaprakTest.render(target, test, bank, { base }) lays the questions out on A4 pages:
   column 1 top→bottom, then column 2, then the next page — the same reading order as a
   question bank. A question is never split; it moves to the next column if it does not fit.
   test.cevapAnahtari: true = answer key after the questions, 'ayri' = on a page of its own, false = none.
   Used by the panel preview, sablon/yaprak-test.html (print / PDF) and tools/yaprak-test-pdf.js. */
(function (global) {
  'use strict';
  const SITE = 'www.denemesokagi.com';
  const TEXT_PT = 6.4; // question text size in yaprak-test.css (.ts-qc)
  const L5 = ['A', 'B', 'C', 'D', 'E'];
  const trUp = (s) => String(s || '').toLocaleUpperCase('tr');
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

  // Light markup written by tools/soru_metin.py (and allowed in hand-written questions):
  //   **kalın**  __altı çizili__  10^{-3}  a_{1}  {pay/payda}
  function rich(s) {
    return esc(s)
      .replace(/\{([^{}/]+)\/([^{}]+)\}/g, '<span class="frac"><span>$1</span><span>$2</span></span>')
      .replace(/\^\{([^{}]*)\}/g, '<sup>$1</sup>')
      .replace(/_\{([^{}]*)\}/g, '<sub>$1</sub>')
      .replace(/\*\*([\s\S]+?)\*\*/g, '<b>$1</b>')
      .replace(/__([\s\S]+?)__/g, '<u>$1</u>');
  }
  const LIST_LINE = /^(?:\*\*|__)*(?:(?:I|II|III|IV|V|VI|VII|VIII|IX|X)\.\s|[●•▪■]\s?)/;

  // Question banks set the question sentence in bold ("… hangisidir?"), the lead-in in regular weight.
  function stemHtml(text) {
    const t = String(text || '').trim();
    if (!t) return '';
    // Text read from the page layout already carries its bold parts and line structure.
    if (/\*\*/.test(t)) return t.split('\n').map((ln) => `<p${LIST_LINE.test(ln) ? ' class="li"' : ''}>${rich(ln)}</p>`).join('');
    if (t.includes('\n')) {
      return `<p class="ts-dlg">${t.split('\n').map((ln) => { const m = ln.match(/^([^:]{1,24}):\s*(.*)$/); return m ? `<b>${esc(m[1])}:</b> ${rich(m[2])}` : rich(ln); }).join('<br>')}</p>`;
    }
    if (/----/.test(t)) return `<p class="stem-b">${rich(t)}</p>`;
    const parts = t.split(/(?<=[.!?…:])\s+(?=[A-ZÇĞİÖŞÜ0-9"“(])/);
    if (parts.length > 1 && /\?$/.test(parts[parts.length - 1])) {
      return `<p>${rich(parts.slice(0, -1).join(' '))}</p><p class="stem-b">${rich(parts[parts.length - 1])}</p>`;
    }
    return /\?$/.test(t) ? `<p class="stem-b">${rich(t)}</p>` : `<p>${rich(t)}</p>`;
  }
  // Short options sit in one row (or 3 + 2), as in printed tests; longer ones one per line.
  const optLen = (o) => String(o || '').replace(/\*\*|__|[{}^_]/g, '').replace(/\/[^ ]*/g, '').length;
  const optsHtml = (opts) => (opts && opts.length
    ? `<div class="ts-opts${Math.max(...opts.map(optLen)) <= 9 ? ' row5' : Math.max(...opts.map(optLen)) <= 20 ? ' row3' : ''}">${opts.slice(0, 5).map((o, i) => `<span class="ts-opt"><b>${L5[i]})</b>${rich(o)}</span>`).join('')}</div>` : '');

  function questionEl(q, n, mode, base) {
    const el = document.createElement('div');
    let content;
    const noText = !q.metin && !q.metin_ust && !q.metin_alt && !(q.secenekler || []).some(Boolean);
    if (q.gorsel && (mode === 'gorsel' || noText || q.gorsel_goster)) {
      el.className = 'ts-q img';
      content = `<img src="${esc(base + q.gorsel)}" alt="Soru ${n}">`;
    } else {
      el.className = 'ts-q';
      // figures keep the size they had next to the source's text
      const fig = (src, pt) => `<img class="ts-fig" src="${esc(base + src)}" alt=""${pt && q.yazi_pt ? ` style="width:${(pt * TEXT_PT / q.yazi_pt).toFixed(1)}pt"` : ''}>`;
      content = q.parcalar ? q.parcalar.map((p) => (p.sekil ? fig(p.sekil, p.sekil_pt) : stemHtml(p.metin))).join('')
        : q.sekil ? stemHtml(q.metin_ust) + fig(q.sekil, q.sekil_pt) + stemHtml(q.metin_alt)
          : stemHtml(q.metin_govde || q.metin);
      content += optsHtml(q.secenekler);
    }
    el.innerHTML = `<div class="ts-qn">${n}.</div><div class="ts-qc">${content}</div><div class="ts-code">[#${esc(code(q))}]</div>`;
    return el;
  }

  // "1–6: For these questions, …" box at the start of each section.
  function yonergeEl(a, b, text) {
    const el = document.createElement('div');
    el.className = 'ts-yon';
    el.innerHTML = /^soru/i.test(text)
      ? `<b>${a === b ? `${a}.` : `${a}. – ${b}.`}</b> ${esc(text)}`
      : `<b>${a === b ? a : `${a} – ${b}`}:</b> ${esc(text)}`;
    return el;
  }
  // Deneme: each test ("TÜRKÇE TESTİ") opens with a bar, as in the printed booklets.
  function sectionEl(name, count) {
    const el = document.createElement('div');
    el.className = 'ts-sec';
    el.innerHTML = `<b>${esc(trUp(name))} TESTİ</b><span>${count} soru</span>`;
    return el;
  }
  // Passage for cloze / reading questions; "(17) ----" blanks get this test's question numbers.
  function passageEl(g, gid, qs, numOf, mode, base) {
    const el = document.createElement('div');
    if (mode === 'gorsel' && g.gorsel) {
      el.className = 'ts-passage img';
      el.innerHTML = `<img src="${esc(base + g.gorsel)}" alt="">`;
      return el;
    }
    el.className = 'ts-passage';
    el.innerHTML = `<p>${esc(g.metin).replace(/\((\d+)\) ----/g, (m, n) => {
      const q = qs.find((x) => x.grup === gid && String(x.no) === n);
      return q ? `<b>(${numOf[q.id]}) ----</b>` : '<b>----</b>';
    })}</p>`;
    return el;
  }

  const bandHtml = (test) => `<header class="ts-band">${LOGO}
      <h1 class="ts-title">${esc(test.ust || 'DENEME')}</h1>
      <div class="ts-subject">${esc(test.baslik || test.ders || '')}</div>
      <div class="ts-test"><span>${esc(test.rozet || 'TEST')}</span><span>${esc(test.no || 1)}</span></div>
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
    const mode = test.mod || 'metin';
    const groups = (bank && bank.gruplar) || {};
    // A deneme ("bolumlu") is split into its tests; numbering restarts in each test.
    const secOf = (q) => (test.bolumlu ? (q.bolum || q.ders || '') : '');
    const secs = [], numOf = {}, secOfQ = {};
    for (const q of qs) {
      if (!secs.length || secs[secs.length - 1].ad !== secOf(q) || (test.bolumlu && secs[secs.length - 1].kaynak !== q.kaynak)) secs.push({ ad: secOf(q), kaynak: q.kaynak, qs: [] });
      const sec = secs[secs.length - 1];
      sec.qs.push(q);
      numOf[q.id] = sec.qs.length;
      secOfQ[q.id] = sec;
    }
    let prevYon = null, prevGrup = null, prevSec = null;
    for (let i = 0; i < qs.length; i++) {
      const q = qs[i], n = numOf[q.id], qEl = questionEl(q, n, mode, base);
      const lead = [], S = secOfQ[q.id], sec = S.ad, g = q.grup ? groups[q.grup] : null;
      if (test.bolumlu && S !== prevSec) {
        if (prevSec !== null) newPage();   // each test starts on a new page
        lead.push(sectionEl(sec, S.qs.length));
        prevYon = prevGrup = null;
      }
      prevSec = S;
      if (g && g.yonerge) {
        if (q.grup !== prevGrup) {
          let j = i;
          while (j + 1 < qs.length && qs[j + 1].grup === q.grup) j++;
          lead.push(yonergeEl(n, numOf[qs[j].id], g.yonerge));
        }
      } else if (q.yonerge && q.yonerge !== prevYon) {
        let j = i;
        while (j + 1 < qs.length && qs[j + 1].yonerge === q.yonerge && secOfQ[qs[j + 1].id] === S) j++;
        lead.push(yonergeEl(n, numOf[qs[j].id], q.yonerge));
      }
      if (g && q.grup !== prevGrup) lead.push(passageEl(g, q.grup, qs, numOf, mode, base));
      prevYon = g && g.yonerge ? null : (q.yonerge || null);
      prevGrup = q.grup || null;
      if (lead.length) {
        const unit = document.createElement('div');
        unit.className = 'ts-unit';
        lead.concat(qEl).forEach((x) => unit.appendChild(x));
        await place(unit);
      } else {
        await place(qEl);
      }
    }

    if (test.cevapAnahtari !== false && qs.length) {
      if (test.cevapAnahtari === 'ayri') newPage();
      for (const [k, sec] of secs.entries()) {
        const key = document.createElement('div');
        key.className = 'ts-key';
        key.innerHTML = (k === 0 ? '<h4>CEVAP ANAHTARI</h4>' : '') + (sec.ad ? `<h5>${esc(trUp(sec.ad))} TESTİ</h5>` : '') +
          `<div class="ts-key-grid">${sec.qs.map((q) => `<span>${numOf[q.id]}.<b>${esc(q.cevap || '—')}</b></span>`).join('')}</div>` +
          (k === secs.length - 1 && qs.some((q) => !q.cevap) ? '<p>— : Kaynakta cevap anahtarı bulunamayan soru.</p>' : '');
        await place(key);
      }
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

  // Main bank + the optional local-only bank (data/yerel/soru-bankasi.js, never published).
  function bank() {
    const a = global.DS_SORU_BANKASI, b = global.DS_SORU_BANKASI_YEREL;
    if (!a || !b) return a || b || null;
    return Object.assign({}, a, { kaynaklar: a.kaynaklar.concat(b.kaynaklar), gruplar: Object.assign({}, a.gruplar, b.gruplar), sorular: a.sorular.concat(b.sorular) });
  }

  global.DSYaprakTest = { render, LOGO, code, bank, rich, stemHtml, questionEl };
})(window);
