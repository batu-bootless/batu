#!/usr/bin/env python3
"""Deneme Sokağı — soru bankası PDF'inden soru çıkarma aracı.

Her soru için iki çıktı üretir, kaynaktaki sırayı koruyarak:
  * görsel: sorunun PDF'ten kırpılmış hâli (kaynağın soru numarası beyazla kapatılır)
  * metin : soru kökü, şekil (varsa ayrı görsel), A–E seçenekleri ve cevap anahtarı

Kullanım:
  python3 tools/soru_cikar.py KAYNAK.pdf --kaynak-id ornek --kaynak-ad "Örnek Soru Bankası" [--sinav TYT] [--tur banka|deneme]

Her soruya kalıcı bir künye verilir: 2 harf + 5 rakam (ör. YD48213; harfler sınavdan gelir, --kod-on ile değişir).

Çıktılar (deneme-sokagi/ altında):
  data/sorular/<kaynak-id>/*.png        soru ve şekil görselleri
  data/sorular/<kaynak-id>/sorular.json bu kaynağın soruları
  data/sorular/<kaynak-id>/kontrol.html görsel + metin yan yana kontrol sayfası
  data/soru-bankasi.json / .js          tüm kaynakların birleşik bankası (panel bunu kullanır)

Metin katmanı olan PDF'lerde çalışır. Taranmış (yalnızca resim) sayfalar için OCR gerekir;
araç bu sayfaları atlar ve uyarır. Yalnızca kullanım hakkına sahip olduğunuz kaynaklarla kullanın.
"""
import argparse
import html
import json
import re
import sys
import zlib
from pathlib import Path

import pdfplumber
from PIL import Image, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parents[1]
OVERRIDE = {}
NUM_RE = re.compile(r'^(\d{1,3})[.)]$')
NUM_GLUED_RE = re.compile(r'^(\d{1,3})[.)](\S.*)$')
OPT_RE = re.compile(r'(?:(?<=\s)|^)([A-E])\)\s*')
LETTERS = 'ABCDE'


def dashfix(text):
    """'----' blanks broken across lines or by kerning ('- ---') are glued back together."""
    return re.sub(r'-(?:\s+-)+', lambda m: m.group(0).replace(' ', ''), text).strip()


def tr_lower(s):
    return s.replace('I', 'ı').replace('İ', 'i').lower()


SMALL_WORDS = {'ve', 'ile', 'veya', 'ya', 'da', 'de', 'ki', 'ya da'}


def tr_title(s):
    words = s.split()
    return ' '.join(tr_lower(w) if i and tr_lower(w) in SMALL_WORDS else w[:1] + tr_lower(w[1:]) for i, w in enumerate(words))


def group_lines(words, tol=3):
    """Words -> lines (sorted top-to-bottom, left-to-right)."""
    lines = []
    for w in sorted(words, key=lambda w: (round(w['top']), w['x0'])):
        for ln in lines:
            if abs(ln['top'] - w['top']) <= tol:
                ln['words'].append(w)
                break
        else:
            lines.append({'top': w['top'], 'words': [w]})
    for ln in lines:
        ln['words'].sort(key=lambda w: w['x0'])
        ln['x0'] = ln['words'][0]['x0']
        ln['x1'] = max(w['x1'] for w in ln['words'])
        ln['bottom'] = max(w['bottom'] for w in ln['words'])
        ln['text'] = re.sub(r'-(?:\s+-)+', lambda m: m.group(0).replace(' ', ''), ' '.join(w['text'] for w in ln['words']))
        ln['size'] = max(w.get('size', 0) for w in ln['words'])
    lines.sort(key=lambda ln: ln['top'])
    return lines


def find_gutter(words, width):
    """Widest empty vertical strip in the middle of the page -> (start, end) or None."""
    step = 2.0
    occ = [0] * (int(width / step) + 2)
    for w in words:
        for b in range(int(w['x0'] / step), int(w['x1'] / step) + 1):
            occ[b] += 1
    lo, hi = int(width * 0.3 / step), int(width * 0.7 / step)
    best, run_start = None, None
    for b in range(lo, hi + 1):
        if occ[b] == 0:
            run_start = b if run_start is None else run_start
            if best is None or (b - run_start) > (best[1] - best[0]):
                best = (run_start, b)
        else:
            run_start = None
    if best and (best[1] - best[0] + 1) * step >= 8:
        return best[0] * step, (best[1] + 1) * step
    return None


def graphics_in(page, box, col_w):
    """Vector shapes / images inside box, ignoring column rules and separators."""
    x0, top, x1, bottom = box
    out = []
    for obj in list(page.curves) + list(page.rects) + list(page.lines) + list(page.images):
        ox0, otop, ox1, obot = obj['x0'], obj['top'], obj['x1'], obj['bottom']
        if ox0 < x0 - 2 or ox1 > x1 + 2 or otop < top - 2 or obot > bottom + 2:
            continue
        w, h = ox1 - ox0, obot - otop
        if h < 1.5 and w > 0.8 * col_w:      # horizontal separator
            continue
        if w < 1.5 and h > 0.5 * page.height:  # column rule
            continue
        out.append((ox0, otop, ox1, obot))
    return out


def union(boxes):
    return (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))


def render(page, box, dpi):
    x0, top, x1, bottom = box
    x0, top = max(0, x0), max(0, top)
    x1, bottom = min(page.width, x1), min(page.height, bottom)
    return page.crop((x0, top, x1, bottom)).to_image(resolution=dpi).original.convert('RGB'), (x0, top)


def trim(img, pad=10, sides=True):
    bbox = ImageOps.invert(img.convert('L')).point(lambda v: 255 if v > 18 else 0).getbbox()
    if not bbox:
        return img
    l, t, r, b = bbox
    if not sides:
        l, r = pad, img.width - pad
    return img.crop((max(0, l - pad), max(0, t - pad), min(img.width, r + pad), min(img.height, b + pad)))


def parse_key(text):
    """'TEST 1 … 1 2 3 … / D B C …' or '1.D 2-B' -> {test: {no: letter}}"""
    key = {}
    parts = re.split(r'(?:TEST|DENEME)\s*(\d+)', text)
    for i in range(1, len(parts), 2):
        t, body = int(parts[i]), parts[i + 1]
        found = {int(n): L for n, L in re.findall(r'(\d{1,3})\s*[.\-:)]\s*([A-E])\b', body)}
        if not found:
            lines = [ln.split() for ln in body.splitlines() if ln.strip()]
            for a, b in zip(lines, lines[1:]):
                if a and all(x.isdigit() for x in a) and len(a) == len(b) and all(x in LETTERS for x in b):
                    found.update({int(n): L for n, L in zip(a, b)})
        if found:
            key[t] = found
    return key


def split_options(lines):
    """Option lines -> list of 5 strings (handles 'A) x  B) y' on one line and wrapped options)."""
    opts = {}
    last = None
    for ln in lines:
        text = ln['text']
        marks = list(OPT_RE.finditer(text))
        if not marks:
            if last:
                opts[last] += ' ' + text
            continue
        for i, m in enumerate(marks):
            end = marks[i + 1].start() if i + 1 < len(marks) else len(text)
            opts[m.group(1)] = text[m.end():end].strip()
            last = m.group(1)
    return [opts.get(L, '') for L in LETTERS] if opts else []


def extract(pdf_path, kaynak_id, kaynak_ad, sinav, dpi):
    out_dir = ROOT / 'data' / 'sorular' / kaynak_id
    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob('*.png'):
        old.unlink()

    pdf = pdfplumber.open(pdf_path)
    pages_words, key, warnings = [], {}, []
    for page in pdf.pages:
        words = page.extract_words(extra_attrs=['fontname', 'size'], x_tolerance=1.5, y_tolerance=2)
        if not words:
            warnings.append(f'Sayfa {page.page_number}: metin katmanı yok (taranmış olabilir) — OCR gerekir, atlandı.')
        if 'CEVAP ANAHTARI' in ' '.join(w['text'] for w in words).upper().replace('İ', 'I'):
            key.update(parse_key(page.extract_text() or ''))
            words = []
        pages_words.append(words)

    # Footer candidates: bottom-band lines that repeat across pages (digits ignored), page numbers, web addresses.
    foot_counts = {}
    for page, words in zip(pdf.pages, pages_words):
        for ln in group_lines([w for w in words if w['top'] > page.height * 0.85]):
            k = re.sub(r'\d+', '#', ln['text'])
            foot_counts[k] = foot_counts.get(k, 0) + 1

    def footer_top_of(page, words):
        lines = group_lines([w for w in words if w['top'] > page.height * 0.85])
        tops = [ln['top'] for ln in lines if foot_counts.get(re.sub(r'\d+', '#', ln['text']), 0) > 1
                or re.fullmatch(r'[\d\s/|-]+', ln['text']) or 'www.' in ln['text'].lower()]
        rules = [r['top'] for r in list(page.rects) + list(page.lines)
                 if r['x1'] - r['x0'] > page.width * 0.6 and r['bottom'] - r['top'] < 2.5 and r['top'] > page.height * 0.8]
        if tops and rules:
            above = [r for r in rules if r < min(tops)]
            return max(above) if above else min(tops)
        return min(tops or rules or [page.height])

    # Header lines that repeat on every question page belong to the publisher, not the test.
    q_pages = [w for w in pages_words if w]
    header_counts = {}
    for words in q_pages:
        for ln in group_lines([w for w in words if w['top'] < pdf.pages[0].height * 0.15]):
            header_counts[ln['text']] = header_counts.get(ln['text'], 0) + 1
    brand_lines = {t for t, c in header_counts.items() if c == len(q_pages) and len(q_pages) > 1}

    questions, last_no, test_no, order = [], 0, 0, 0
    for page_index, (page, words) in enumerate(zip(pdf.pages, pages_words)):
        if not words:
            continue
        W, H = page.width, page.height
        footer_top = footer_top_of(page, words)
        body = [w for w in words if w['top'] < footer_top]
        mid_words = [w for w in body if H * 0.12 < w['top'] < H * 0.9]
        gutter = find_gutter(mid_words, W)
        margin_l = min(w['x0'] for w in body) - 4
        margin_r = max(w['x1'] for w in body) + 4
        columns = [(margin_l, gutter[0] + 2), (gutter[1] - 2, margin_r)] if gutter else [(margin_l, margin_r)]

        # question starts per column
        starts = []
        for ci, (cx0, cx1) in enumerate(columns):
            cwords = [w for w in body if cx0 <= (w['x0'] + w['x1']) / 2 <= cx1]
            if not cwords:
                continue
            left = min(w['x0'] for w in cwords)
            for w in cwords:
                m = NUM_RE.match(w['text']) or NUM_GLUED_RE.match(w['text'])
                if m and w['x0'] - left < 8:
                    starts.append({'col': ci, 'n': int(m.group(1)), 'w': w, 'left': left, 'cwords': cwords})
        starts.sort(key=lambda s: (s['col'], s['w']['top']))
        # keep only numbers that continue the running sequence (or restart at 1 for a new test)
        kept = []
        for s in starts:
            if s['n'] == last_no + 1 or s['n'] == 1:
                kept.append(s)
                last_no = s['n']
        if not kept:
            continue

        first_top = min(s['w']['top'] for s in kept)
        head_lines = [ln for ln in group_lines([w for w in body if w['bottom'] < first_top - 2]) if ln['text'] not in brand_lines]
        head_text = ' '.join(ln['text'] for ln in head_lines)
        m_test = re.search(r'(?:TEST|DENEME)\s*(\d+)', head_text, re.I)
        is_title = lambda ln: not re.search(r'TEST|DENEME\s*\d|^\d+$|^\d+\s*[-–]', ln['text'], re.I)
        title_lines = sorted([ln for ln in head_lines if is_title(ln)], key=lambda ln: -ln['size'])
        if not title_lines:  # single-test sources repeat their title on every page
            all_head = group_lines([w for w in body if w['bottom'] < first_top - 2])
            title_lines = sorted([ln for ln in all_head if is_title(ln) and ln['size'] >= 9.5], key=lambda ln: -ln['size'])
        ders = OVERRIDE.get('ders') or (title_lines[0]['text'] if title_lines else '')
        konu = OVERRIDE.get('konu') or (title_lines[1]['text'] if len(title_lines) > 1 else ders)

        for i, s in enumerate(kept):
            if s['n'] == 1:
                test_no = int(m_test.group(1)) if m_test else test_no + 1
            cx0, cx1 = columns[s['col']]
            nxt = next((k for k in kept[i + 1:] if k['col'] == s['col']), None)
            top = s['w']['top'] - 6
            limit = (nxt['w']['top'] - 3) if nxt else footer_top - 2
            qwords = [w for w in s['cwords'] if top <= w['top'] < limit]
            gfx = graphics_in(page, (cx0, top, cx1, limit), cx1 - cx0)
            bottom = max([w['bottom'] for w in qwords] + [g[3] for g in gfx]) + 3
            box = (cx0, top, cx1, bottom)

            # text lines: body lines start at the column's text edge or with an option marker
            lines = group_lines(qwords)
            num_w = s['w']['x1'] - s['w']['x0']
            is_body = lambda ln: ln['x0'] <= s['left'] + num_w + 8 or OPT_RE.match(ln['text'])
            label_lines = [ln for ln in lines if not is_body(ln)]
            body_lines = [ln for ln in lines if is_body(ln)]
            fig_box = None
            if gfx:
                fig_box = union(gfx + [(ln['x0'], ln['top'], ln['x1'], ln['bottom']) for ln in label_lines])
            opt_start = next((k for k, ln in enumerate(body_lines) if OPT_RE.match(ln['text'])), len(body_lines))
            stem_lines, opt_lines = body_lines[:opt_start], body_lines[opt_start:]
            first = stem_lines[0] if stem_lines else None
            if first:  # drop the source number from the first line
                first = dict(first, text=re.sub(r'^\d{1,3}[.)]\s*', '', first['text']))
                stem_lines = [first] + stem_lines[1:]
            ust = [ln['text'] for ln in stem_lines if not fig_box or ln['bottom'] <= fig_box[1] + 1]
            alt = [ln['text'] for ln in stem_lines if fig_box and ln['top'] >= fig_box[3] - 1]

            body_sizes = sorted(w['size'] for ln in body_lines for w in ln['words'])
            yazi_pt = round(body_sizes[len(body_sizes) // 2], 2) if body_sizes else None
            order += 1
            qid = f'{kaynak_id}-t{test_no:02d}-s{s["n"]:02d}'
            img, (ox, oy) = render(page, box, dpi)
            scale = dpi / 72
            nw = s['w']
            ImageDraw.Draw(img).rectangle([(nw['x0'] - ox - 1) * scale, (nw['top'] - oy - 1) * scale, (nw['x1'] - ox + 1.5) * scale, (nw['bottom'] - oy + 1) * scale], fill='white')
            trim(img, sides=False).save(out_dir / f'{qid}.png', optimize=True)
            sekil = None
            if fig_box:
                fimg, _ = render(page, (fig_box[0] - 4, fig_box[1] - 4, fig_box[2] + 4, fig_box[3] + 4), dpi)
                trim(fimg, 6).save(out_dir / f'{qid}-sekil.png', optimize=True)
                sekil = f'data/sorular/{kaynak_id}/{qid}-sekil.png'
            questions.append({
                'id': qid, 'kaynak': kaynak_id, 'kaynak_ad': kaynak_ad, 'sinav': sinav,
                'test': test_no, 'no': s['n'], 'sira': order, 'sayfa': page.page_number,
                'ders': tr_title(ders), 'konu': tr_title(konu),
                'metin': dashfix(' '.join(ust + alt)), 'metin_ust': dashfix(' '.join(ust)), 'metin_alt': dashfix(' '.join(alt)),
                'secenekler': split_options(opt_lines),
                'cevap': None,
                'gorsel': f'data/sorular/{kaynak_id}/{qid}.png', 'sekil': sekil,
                'sekil_pt': round(fig_box[2] - fig_box[0] + 8, 1) if fig_box else None, 'yazi_pt': yazi_pt,
                'bbox': [round(v, 1) for v in box],
            })

    for q in questions:
        q['cevap'] = key.get(q['test'], {}).get(q['no'])
    return questions, warnings, key


def ascii_letters(text):
    t = text.upper().translate(str.maketrans('ÇĞİÖŞÜ', 'CGIOSU'))
    return re.sub(r'[^A-Z]', '', t)


def assign_codes(questions, prefix, out_dir):
    """Keep codes from the previous run of this source; give new questions a fresh, unused code."""
    old = {}
    prev = out_dir / 'sorular.json'
    if prev.exists():
        old = {q['id']: q.get('kod') for q in json.loads(prev.read_text(encoding='utf-8'))}
    taken = set()
    for f in (ROOT / 'data' / 'sorular').glob('*/sorular.json'):
        if f.parent != out_dir:
            taken.update(q.get('kod') for q in json.loads(f.read_text(encoding='utf-8')))
    for q in questions:
        kod = old.get(q['id'])
        if not kod or kod in taken:
            n = 10000 + zlib.crc32(q['id'].encode()) % 90000
            while f'{prefix}{n}' in taken:
                n = 10000 + (n - 10000 + 1) % 90000
            kod = f'{prefix}{n}'
        q['kod'] = kod
        taken.add(kod)


def write_outputs(kaynak_id, questions, meta):
    out_dir = ROOT / 'data' / 'sorular' / kaynak_id
    assign_codes(questions, meta['kod_on'], out_dir)
    (out_dir / 'kaynak.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding='utf-8')
    (out_dir / 'sorular.json').write_text(json.dumps(questions, ensure_ascii=False, indent=1), encoding='utf-8')

    rows = ''.join(f'''<tr><td class="n">{q["sira"]}<br><small>{q["kod"]}<br>T{q["test"]}·{q["no"]}<br>s.{q["sayfa"]}</small></td>
      <td><img src="{Path(q["gorsel"]).name}" alt=""></td>
      <td><b>{html.escape(q["ders"])} · {html.escape(q["konu"])}</b><p>{html.escape(q["metin_ust"])}</p>
      {f'<img class="fig" src="{Path(q["sekil"]).name}" alt="">' if q["sekil"] else ''}<p>{html.escape(q["metin_alt"])}</p>
      <ol type="A">{"".join(f"<li>{html.escape(o)}</li>" for o in q["secenekler"])}</ol><p>Cevap: <b>{q["cevap"] or "—"}</b></p></td></tr>''' for q in questions)
    (out_dir / 'kontrol.html').write_text(f'''<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Kontrol · {html.escape(kaynak_id)}</title>
<style>body{{font:14px/1.5 system-ui,sans-serif;margin:24px;color:#17212d}}table{{border-collapse:collapse;width:100%}}td{{border-bottom:1px solid #dde4ec;padding:12px;vertical-align:top}}
td img{{max-width:380px;border:1px solid #e3e9f1}}td.n{{font-weight:700;width:60px}}img.fig{{max-width:300px}}small{{color:#5f6e80;font-weight:400}}</style></head>
<body><h1>{html.escape(kaynak_id)} · {len(questions)} soru</h1><p>Sol: kırpılmış görsel · Sağ: metin olarak çıkarılan hâl</p><table>{rows}</table></body></html>''', encoding='utf-8')

    return merge_bank()


def merge_bank():
    """Merge every source in data/sorular/ into data/soru-bankasi.{json,js} (the panel reads the .js)."""
    all_q, gruplar, sources = [], {}, {}
    for d in sorted(p for p in (ROOT / 'data' / 'sorular').iterdir() if (p / 'sorular.json').exists()):
        all_q.extend(json.loads((d / 'sorular.json').read_text(encoding='utf-8')))
        if (d / 'gruplar.json').exists():
            gruplar.update(json.loads((d / 'gruplar.json').read_text(encoding='utf-8')))
    for q in all_q:
        if q['kaynak'] not in sources:
            mf = ROOT / 'data' / 'sorular' / q['kaynak'] / 'kaynak.json'
            m = json.loads(mf.read_text(encoding='utf-8')) if mf.exists() else {}
            sources[q['kaynak']] = {'id': q['kaynak'], 'ad': m.get('ad', q['kaynak_ad']), 'sinav': q['sinav'], 'tur': m.get('tur', 'banka'), 'dk_soru': m.get('dk_soru', 1.5), 'soru': 0}
        sources[q['kaynak']]['soru'] += 1
    bank = {'surum': 2, 'kaynaklar': list(sources.values()), 'gruplar': gruplar, 'sorular': all_q}
    data = json.dumps(bank, ensure_ascii=False)
    (ROOT / 'data' / 'soru-bankasi.json').write_text(data, encoding='utf-8')
    (ROOT / 'data' / 'soru-bankasi.js').write_text('/* tools/soru_cikar.py ve tools/soru_ekle.py tarafından üretildi — elle düzenlemeyin */\nwindow.DS_SORU_BANKASI = ' + data + ';\n', encoding='utf-8')
    return len(all_q)


def main():
    ap = argparse.ArgumentParser(description='Soru bankası PDF\'inden soruları görsel + metin olarak çıkarır.')
    ap.add_argument('pdf')
    ap.add_argument('--kaynak-id', required=True, help='kısa ad, örn. ornek (dosya/klasör adlarında kullanılır)')
    ap.add_argument('--kaynak-ad', required=True, help='görünen ad, örn. "Örnek Soru Bankası"')
    ap.add_argument('--sinav', default='TYT')
    ap.add_argument('--dpi', type=int, default=200)
    ap.add_argument('--tur', choices=['banka', 'deneme'], default='banka', help='soru bankası mı, deneme sınavı mı')
    ap.add_argument('--kod-on', help='künyenin 2 harfi (varsayılan: sınav adından, ör. YDS → YD)')
    ap.add_argument('--dk-soru', type=float, help='soru başına önerilen süre (dk)')
    ap.add_argument('--ders', help='ders adını elle belirle')
    ap.add_argument('--konu', help='konu adını elle belirle')
    a = ap.parse_args()
    if not re.fullmatch(r'[a-z0-9-]+', a.kaynak_id):
        sys.exit('--kaynak-id yalnızca küçük harf, rakam ve tire içerebilir.')
    OVERRIDE.update({k: v for k, v in (('ders', a.ders), ('konu', a.konu)) if v})
    kod_on = (a.kod_on or ascii_letters(a.sinav)[:2]).upper()
    if not re.fullmatch(r'[A-Z]{2}', kod_on):
        sys.exit('--kod-on iki harf olmalı (A–Z).')
    dk = a.dk_soru or {'YDS': 2.25, 'YÖKDİL': 2.25, 'TYT': 1.375, 'AYT': 2.25, 'LGS': 1.5, 'KPSS': 1.0, 'ALES': 2.5, 'DGS': 2.3}.get(a.sinav.upper(), 1.5)
    meta = {'id': a.kaynak_id, 'ad': a.kaynak_ad, 'sinav': a.sinav, 'tur': a.tur, 'kod_on': kod_on, 'dk_soru': dk}
    questions, warnings, key = extract(a.pdf, a.kaynak_id, a.kaynak_ad, a.sinav, a.dpi)
    total = write_outputs(a.kaynak_id, questions, meta)
    for w in warnings:
        print('UYARI:', w)
    by_test = {}
    for q in questions:
        by_test.setdefault((q['test'], q['ders'], q['konu']), []).append(q)
    for (t, d, k), qs in by_test.items():
        print(f'Test {t:>2} · {d} · {k}: {len(qs)} soru, {sum(1 for q in qs if q["cevap"])} cevaplı, {sum(1 for q in qs if q["sekil"])} şekilli')
    if questions:
        print(f'Künyeler: {questions[0]["kod"]} … {questions[-1]["kod"]}')
    print(f'{len(questions)} soru çıkarıldı ({a.kaynak_id}, {a.tur}); bankada toplam {total} soru.')


if __name__ == '__main__':
    main()
