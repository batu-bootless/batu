/* Deneme Sokağı — yaprak test renderer.
   DSYaprakTest.render(target, test, bank, { base }) lays the questions out on A4 pages:
   column 1 top→bottom, then column 2, then the next page — the same reading order as a
   question bank. A question is never split; it moves to the next column if it does not fit.
   Used by the panel preview, sablon/yaprak-test.html (print / PDF) and tools/yaprak-test-pdf.js. */
(function (global) {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const L5 = ['A', 'B', 'C', 'D', 'E'];
  const LOGO = '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="3" y="9" width="42" height="24" rx="5" fill="#1e88e5"/><path d="M24 33v12" stroke="#1e88e5" stroke-width="4" stroke-linecap="round"/><path d="M11 17h18M11 24h12" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/><path d="M33 15l5 6-5 6" fill="none" stroke="#ffd600" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // Bold the final question sentence ("Buna göre ... kaçtır?") the way question banks do.
  function stemHtml(text) {
    const t = String(text || '').trim();
    if (!t) return '';
    const parts = t.split(/(?<=[.!?…:])\s+(?=[A-ZÇĞİÖŞÜ0-9"“(])/);
    if (parts.length > 1 && /\?$/.test(parts[parts.length - 1])) {
      return `<p>${esc(parts.slice(0, -1).join(' '))}</p><p class="stem-b">${esc(parts[parts.length - 1])}</p>`;
    }
    return `<p>${esc(t)}</p>`;
  }

  function optsHtml(opts) {
    const list = (opts || []).slice(0, 5);
    if (!list.length) return '';
    const max = Math.max(...list.map((o) => String(o).length));
    const cls = max <= 7 ? 'c5' : max <= 18 ? 'c2' : 'c1';
    return `<div class="ds-opts ${cls}">${list.map((o, i) => `<span class="ds-opt"><b>${L5[i]})</b><span>${esc(o)}</span></span>`).join('')}</div>`;
  }

  function questionEl(q, n, mode, base) {
    const el = document.createElement('div');
    if (mode === 'gorsel' && q.gorsel) {
      el.className = 'ds-q img';
      el.innerHTML = `<span class="ds-qn">${n}.</span><img src="${esc(base + q.gorsel)}" alt="Soru ${n}">`;
      return el;
    }
    el.className = 'ds-q';
    let body = '';
    if (q.sekil) {
      body += stemHtml(q.metin_ust);
      body += `<img class="ds-fig" src="${esc(base + q.sekil)}" alt="">`;
      body += stemHtml(q.metin_alt);
    } else {
      body += stemHtml(q.metin_govde || q.metin);
    }
    el.innerHTML = `<span class="ds-qn">${n}.</span>${body}${optsHtml(q.secenekler)}`;
    return el;
  }

  function headHtml(test, first, count) {
    const no = String(test.no || 1).padStart(2, '0');
    const head = `<header class="ds-head">
      <div class="ds-brand">${LOGO}<span>Deneme<b>Sokağı</b></span></div>
      <div class="ds-title"><small>${esc(test.ders || '')}</small><strong>${esc(test.baslik || 'Yaprak Test')}</strong></div>
      <div class="ds-badge"><small>YAPRAK TEST</small><b>${no}</b></div>
    </header>`;
    if (!first) return head;
    const minutes = Math.max(5, Math.round(count * (test.dkSoru || 1.5)));
    return head + `<div class="ds-info">
      ${test.ogrenciAlani === false ? '<span></span>' : '<div class="ds-fields"><span>Ad Soyad:</span><span>Sınıf:</span><span>No:</span><span>Tarih:</span></div>'}
      <span class="ds-meta">${count} soru · Önerilen süre ${minutes} dk</span>
    </div>`;
  }

  const ready = (el) => Promise.all([...el.querySelectorAll('img')].map((img) => (img.complete ? Promise.resolve() : new Promise((r) => { img.onload = img.onerror = r; }))));

  async function render(target, test, bank, opts = {}) {
    const base = opts.base || '';
    const byId = bank && bank.byId ? bank.byId : Object.fromEntries(((bank && bank.sorular) || []).map((q) => [q.id, q]));
    const qs = (test.soruIds || []).map((id) => byId[id]).filter(Boolean);
    target.classList.add('ds-doc');
    target.innerHTML = '';
    if (document.fonts && document.fonts.ready) await document.fonts.ready;

    const pages = [];
    let cols = null, ci = 0;
    const newPage = () => {
      const first = pages.length === 0;
      const page = document.createElement('section');
      page.className = 'ds-page' + (first ? '' : ' cont');
      page.innerHTML = headHtml(test, first, qs.length) +
        '<div class="ds-body"><div class="ds-col"></div><div class="ds-col"></div></div>' +
        '<footer class="ds-foot"><span>denemesokagi.com</span><span class="pg"></span><span class="next"></span></footer>';
      target.appendChild(page);
      pages.push(page);
      cols = page.querySelectorAll('.ds-col');
      ci = 0;
    };
    const place = async (el) => {
      cols[ci].appendChild(el);
      await ready(el);
      const over = () => cols[ci].scrollHeight > cols[ci].clientHeight + 1;
      if (over() && cols[ci].children.length > 1) {
        el.remove();
        if (++ci > 1) newPage();
        cols[ci].appendChild(el);
      }
    };

    newPage();
    for (let i = 0; i < qs.length; i++) await place(questionEl(qs[i], i + 1, test.mod || 'metin', base));

    if (test.cevapAnahtari !== false && qs.length) {
      const key = document.createElement('div');
      key.className = 'ds-key';
      key.innerHTML = `<h4>CEVAP ANAHTARI</h4><div class="ds-key-grid">${qs.map((q, i) => `<span>${i + 1}.<b>${esc(q.cevap || '—')}</b></span>`).join('')}</div>` +
        (qs.some((q) => !q.cevap) ? '<p>— : Kaynakta cevap anahtarı bulunamayan soru.</p>' : '');
      await place(key);
    }

    pages.forEach((p, i) => {
      p.querySelector('.pg').textContent = `${i + 1} / ${pages.length}`;
      p.querySelector('.next').textContent = i === pages.length - 1 ? 'Testin sonu.' : 'Diğer sayfaya geçiniz.';
    });
    return { pages: pages.length, questions: qs.length };
  }

  global.DSYaprakTest = { render, LOGO };
})(window);
