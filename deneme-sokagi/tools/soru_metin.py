"""Deneme Sokağı — a question's text, read from the PDF layout (used by soru_cikar.py).

Splits a question's area into
  * text written as text, with light markup that sablon/yaprak-test.js (DSYaprakTest.rich) renders:
      **kalın**   __altı çizili__   10^{-3}   a_{1}   {pay/payda}   and line breaks between
      paragraphs, list items (I. / II. / ●) and dialogue lines;
  * figures (drawings, charts, tables, pictures) kept as images, with their own labels inside;
  * the five options as text — or, when the options are drawings, inside the figure.

How it reads the page:
  * thin horizontal strokes under words are underlines, strokes with a number above and below
    are fraction bars, everything else that is drawn belongs to a figure;
  * smaller raised / lowered characters are exponents / indices;
  * bold comes from the font name; math fonts with their own encoding are mapped (FONT_MAP).
"""
import re
from statistics import median

OPT_MARK = re.compile(r'^([A-E])\)(.*)$')
ROMAN_ITEM = re.compile(r'^(?:I|II|III|IV|V|VI|VII|VIII|IX|X)\.$')
BULLETS = {'●', '•', '–', '-', '▪', '■'}
# Math fonts that use their own character codes (MathMagic "MM…" fonts and a few others).
FONT_MAP = {
    'MMBinary': {':': '·'}, 'MMGreek': {'r': 'π', 'p': 'π', 'a': 'α', 'b': 'β', 'D': 'Δ'},
    'MMaArrowSS': {'"': '→'}, 'MMaArrowS': {'"': '→'},
    'MMTimesRoman': {'-': '−'}, 'MMTimesBold': {'-': '−'}, 'ArialUnicodeMS': {'ﾠ': ' '},
}


def _font(w):
    return (w.get('fontname') or '').split('+')[-1]


def map_text(w):
    base = _font(w)
    for name, table in FONT_MAP.items():
        if base.startswith(name):
            return ''.join(table.get(c, c) for c in w['text'])
    return w['text']


def _ov(a0, a1, b0, b1):
    return max(0.0, min(a1, b1) - max(a0, b0))


def _lines(words, body=None):
    """Words -> lines. Normal-size words make the lines; exponents, fractions, bullets join the line they overlap most."""
    if not words:
        return []
    body = body or median(w['size'] for w in words)
    main = [w for w in words if abs(w['size'] - body) < 0.8 and not w.get('frac')]
    ids = {id(w) for w in main}
    rest = [w for w in words if id(w) not in ids]
    out = []

    def best(w, need):
        h, pick, score = w['bottom'] - w['top'], None, 0
        for ln in out:
            r = _ov(w['top'], w['bottom'], ln['ctop'], ln['cbot']) / max(0.1, min(h, ln['cbot'] - ln['ctop']))
            if r > score:
                pick, score = ln, r
        return pick if score >= need else None
    for w in sorted(main, key=lambda w: (w['top'], w['x0'])):
        ln = best(w, 0.5)
        if ln:
            ln['words'].append(w)
            ln['ctop'], ln['cbot'] = min(ln['ctop'], w['top']), max(ln['cbot'], w['bottom'])
        else:
            out.append({'words': [w], 'ctop': w['top'], 'cbot': w['bottom']})
    for w in rest:
        ln = best(w, 0.2)
        if ln:
            ln['words'].append(w)
        else:
            out.append({'words': [w], 'ctop': w['top'], 'cbot': w['bottom']})
    for ln in out:
        ln['words'].sort(key=lambda w: w['x0'])
        ln['x0'] = ln['words'][0]['x0']
        ln['x1'] = max(w['x1'] for w in ln['words'])
        ln['top'] = min(w['top'] for w in ln['words'])
        ln['bottom'] = max(w['bottom'] for w in ln['words'])
    out.sort(key=lambda ln: ln['ctop'])
    return out


def _objects(page, box):
    x0, top, x1, bot = box
    out = []
    for o in list(page.lines) + list(page.rects) + list(page.curves) + list(page.images):
        if o['x0'] >= x0 - 2 and o['x1'] <= x1 + 2 and o['top'] >= top - 2 and o['bottom'] <= bot + 2:
            out.append({'x0': o['x0'], 'x1': o['x1'], 'top': o['top'], 'bottom': o['bottom'], 'kind': o['object_type']})
    return out


def _cluster(boxes, gap=7):
    boxes = [list(b) for b in boxes]
    changed = True
    while changed:
        changed = False
        for i in range(len(boxes)):
            for j in range(i + 1, len(boxes)):
                a, b = boxes[i], boxes[j]
                if a[0] - gap <= b[2] and b[0] - gap <= a[2] and a[1] - gap <= b[3] and b[1] - gap <= a[3]:
                    boxes[i] = [min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3])]
                    del boxes[j]
                    changed = True
                    break
            if changed:
                break
    return [tuple(b) for b in boxes]


def _pixel_figs(page, box, words, strokes, body, cell=2.0):
    """Areas that are drawn but are neither text nor underline / fraction strokes -> boxes (pt)."""
    import numpy as np
    x0, top, x1, bot = box
    try:
        img = page.crop((max(0, x0), max(0, top), min(page.width, x1), min(page.height, bot))).to_image(resolution=144).original.convert('L')
    except Exception:
        return []
    a = np.asarray(img).copy()
    k = a.shape[1] / max(1.0, min(page.width, x1) - max(0, x0))
    ox, oy = max(0, x0), max(0, top)

    def blank(b0, t0, b1, t1, pad, below=None):
        c0, r0 = int((b0 - pad - ox) * k), int((t0 - pad - oy) * k)
        c1, r1 = int((b1 + pad - ox) * k) + 1, int((t1 + (pad if below is None else below) - oy) * k) + 1
        a[max(0, r0):max(0, r1), max(0, c0):max(0, c1)] = 255
    for w in words:   # descenders and cedillas (ş, ç, ğ) reach below the word box
        blank(w['x0'], w['top'], w['x1'], w['bottom'], 0.8, below=0.35 * w['size'])
    for o in strokes:
        blank(o['x0'], o['top'], o['x1'], o['bottom'], 1.0)
    ink = a < 225
    step = max(1, int(round(cell * k)))
    H, W = ink.shape[0] // step, ink.shape[1] // step
    if not H or not W:
        return []
    grid = ink[:H * step, :W * step].reshape(H, step, W, step).sum(axis=(1, 3)) >= 2
    seen = np.zeros_like(grid)
    out = []
    for r in range(H):
        for c in range(W):
            if not grid[r, c] or seen[r, c]:
                continue
            stack, cells = [(r, c)], []
            seen[r, c] = True
            while stack:
                y, x = stack.pop()
                cells.append((y, x))
                for dy in (-2, -1, 0, 1, 2):          # bridges one empty cell
                    for dx in (-2, -1, 0, 1, 2):
                        yy, xx = y + dy, x + dx
                        if 0 <= yy < H and 0 <= xx < W and grid[yy, xx] and not seen[yy, xx]:
                            seen[yy, xx] = True
                            stack.append((yy, xx))
            ys, xs = [p[0] for p in cells], [p[1] for p in cells]
            b = (ox + min(xs) * step / k, oy + min(ys) * step / k, ox + (max(xs) + 1) * step / k, oy + (max(ys) + 1) * step / k)
            bw, bh = b[2] - b[0], b[3] - b[1]
            if (bw < 6 and bh < 6) or (min(bw, bh) < 5 and max(bw, bh) < 40):
                continue
            # an outline around text (a frame) or a tint behind the whole question is not a figure
            inner = [w for w in words if b[0] < w['x0'] and w['x1'] < b[2] and b[1] < w['top'] and w['bottom'] < b[3]]
            area = (max(xs) - min(xs) + 1) * (max(ys) - min(ys) + 1)
            if inner and bw > 30 and bh > 12 and len(cells) < 0.25 * area and sum(len(w['text']) for w in inner) > 30:
                continue
            if bw > 0.92 * (x1 - x0) and bh > 0.8 * (bot - top):
                continue
            out.append(b)
    return out


def analyze(page, box, words, num_word, col_w):
    """words: the question's words (pdfplumber, with fontname/size), number word excluded.
    Returns dict(ust, alt, fig, secenekler, yazi_pt, opts_in_fig)."""
    words = [dict(w) for w in words if w['text'].strip()]
    if not words:
        return {'ust': '', 'alt': '', 'fig': None, 'figs': [], 'parcalar': None, 'secenekler': [], 'yazi_pt': None, 'opts_in_fig': False}
    body = median(w['size'] for w in words)
    objs = _objects(page, box)

    # ---- strokes: underline / fraction bar / drawing
    underlined, used, fracs, drawn, strokes = set(), set(), [], [], []
    for o in objs:
        w, h = o['x1'] - o['x0'], o['bottom'] - o['top']
        if w < 1.5 and h < 1.5:
            continue
        if h <= 1.3 and w >= 2:
            if w > 0.7 * col_w:
                strokes.append(o)
                continue                                    # separator rule
            span = lambda wd: _ov(wd['x0'], wd['x1'], o['x0'], o['x1']) > 0.5 * max(0.1, wd['x1'] - wd['x0'])
            # a fraction bar has the numerator resting on it and the denominator just below;
            # an underline runs through the bottom of the words above it
            num = [wd for wd in words if -0.6 <= o['top'] - wd['bottom'] <= 2.5 and span(wd)]
            den = [wd for wd in words if -0.5 <= wd['top'] - o['bottom'] <= 3 and span(wd)]
            und = [wd for wd in words if wd['top'] < o['top'] and o['top'] - wd['bottom'] < -0.6 and span(wd)]
            cx = (o['x0'] + o['x1']) / 2
            centred = lambda ws: bool(ws) and abs((min(x['x0'] for x in ws) + max(x['x1'] for x in ws)) / 2 - cx) < 3 \
                and max(x['x1'] for x in ws) - min(x['x0'] for x in ws) <= w + 2
            top_part = num or und
            if den and w < 70 and centred(top_part) and centred(den) and (num or len(und) == 1):
                fracs.append((o, top_part, den))
                strokes.append(o)
                continue
            if und:
                for wd in und:
                    underlined.add(id(wd))
                strokes.append(o)
                continue
        if w < 1.3 and h > 0.5 * page.height:
            continue                                        # column rule
        drawn.append((o['x0'], o['top'], o['x1'], o['bottom']))

    for o, above, below in fracs:
        for wd in above + below:
            used.add(id(wd))
        num = ''.join(map_text(x) for x in sorted(above, key=lambda x: x['x0']))
        den = ''.join(map_text(x) for x in sorted(below, key=lambda x: x['x0']))
        words.append({'text': '{%s/%s}' % (num, den), 'x0': o['x0'], 'x1': o['x1'], 'size': body, 'frac': True,
                      'top': o['top'] - body * 0.45, 'bottom': o['bottom'] + body * 0.45, 'fontname': above[0].get('fontname', '')})
    words = [w for w in words if id(w) not in used]

    # ---- a frame drawn around plain text is not a figure
    def inside(wd, b, pad=1.5):
        cx, cy = (wd['x0'] + wd['x1']) / 2, (wd['top'] + wd['bottom']) / 2
        return b[0] - pad <= cx <= b[2] + pad and b[1] - pad <= cy <= b[3] + pad
    frames = []
    for b in drawn:
        bw, bh = b[2] - b[0], b[3] - b[1]
        if bw > 40 and bh > 14:
            inner = [d for d in drawn if d is not b and d[0] >= b[0] - 1 and d[2] <= b[2] + 1 and d[1] >= b[1] - 1 and d[3] <= b[3] + 1]
            in_words = [wd for wd in words if inside(wd, b, 0)]
            if not inner and len(_lines(in_words, body)) >= 2 and sum(len(wd['text']) for wd in in_words) > 40:
                frames.append(b)
    drawn = [d for d in drawn if d not in frames]

    # ---- figures and their labels
    # Some drawings are not reported as objects (shadings, patterns): find them in the rendered page too.
    figs = _cluster(drawn + _pixel_figs(page, box, words + [num_word], strokes, body))
    figs = [f for f in figs if (f[2] - f[0]) > 6 or (f[3] - f[1]) > 6]
    labels = set()
    for i, f in enumerate(figs):
        for wd in words:
            if inside(wd, f):
                labels.add(id(wd))
                f = (min(f[0], wd['x0']), min(f[1], wd['top']), max(f[2], wd['x1']), max(f[3], wd['bottom']))
        figs[i] = f                                         # a label sticking out of the drawing stays whole
    # first word after the number = where text lines start
    # where text lines start: the most common line start (a figure may stand next to the number)
    starts = [round(ln['x0']) for ln in _lines([w for w in words if id(w) not in labels], body)]
    indent = max(set(starts), key=lambda x: (sum(abs(x - y) <= 2 for y in starts), -x)) if starts else min(w['x0'] for w in words)
    text_w = max(w['x1'] for w in words) - indent
    for i, f in enumerate(figs):
        grew = True
        while grew:
            grew = False
            for wd in words:
                if id(wd) in labels:
                    continue
                h = wd['bottom'] - wd['top']
                beside = _ov(wd['top'], wd['bottom'], f[1], f[3]) > 0.6 * h and (0 <= wd['x0'] - f[2] < 9 or 0 <= f[0] - wd['x1'] < 9)
                if beside and len(wd['text']) <= 6:
                    labels.add(id(wd))
                    f = (min(f[0], wd['x0']), min(f[1], wd['top']), max(f[2], wd['x1']), max(f[3], wd['bottom']))
                    grew = True
        figs[i] = f
    if figs:
        changed = True
        while changed:
            changed = False
            for ln in _lines([w for w in words if id(w) not in labels], body):
                if OPT_MARK.match(ln['words'][0]['text']):
                    continue
                for i, f in enumerate(figs):
                    near = ln['bottom'] >= f[1] - 12 and ln['top'] <= f[3] + 12 and _ov(ln['x0'], ln['x1'], f[0] - 18, f[2] + 18) > 0
                    labelish = ln['x0'] > indent + 4 or (ln['x1'] - ln['x0']) < 0.2 * text_w
                    if near and labelish and (ln['x1'] - ln['x0']) < 0.8 * text_w:
                        for wd in ln['words']:
                            labels.add(id(wd))
                        figs[i] = (min(f[0], ln['x0']), min(f[1], ln['top']), max(f[2], ln['x1']), max(f[3], ln['bottom']))
                        changed = True
                        break
                if changed:
                    break
    # figures side by side (or touching) form one picture; text between stacked figures stays text
    merged = []
    for f in sorted(figs, key=lambda f: f[1]):
        if merged and f[1] <= merged[-1][3] + 6:
            m = merged[-1]
            merged[-1] = (min(m[0], f[0]), min(m[1], f[1]), max(m[2], f[2]), max(m[3], f[3]))
        else:
            merged.append(f)
    figs = merged
    for f in figs:
        for wd in words:
            if inside(wd, f, 0):
                labels.add(id(wd))
    fig = (min(f[0] for f in figs), min(f[1] for f in figs), max(f[2] for f in figs), max(f[3] for f in figs)) if figs else None

    text_words = [w for w in words if id(w) not in labels]
    lines = _lines(text_words, body)
    opt_i = next((k for k, ln in enumerate(lines) if OPT_MARK.match(map_text(ln['words'][0]))), len(lines))
    stem, opt_lines = lines[:opt_i], lines[opt_i:]

    # options drawn as pictures (or sitting inside the figure)
    opts_in_fig = any(OPT_MARK.match(w['text']) for w in words if id(w) in labels)
    if fig and opt_lines and any(_ov(fig[1], fig[3], ln['top'], ln['bottom']) > 0 for ln in opt_lines):
        opts_in_fig = True
    if opts_in_fig and fig:
        last = figs[-1]
        figs[-1] = (min([last[0]] + [ln['x0'] for ln in opt_lines]), min([last[1]] + [ln['top'] for ln in opt_lines]), max([last[2]] + [ln['x1'] for ln in opt_lines]),
                    max([last[3]] + [ln['bottom'] for ln in opt_lines]))
        fig = (min(f[0] for f in figs), min(f[1] for f in figs), max(f[2] for f in figs), max(f[3] for f in figs))
        opt_lines = []

    def toks(ln):
        base = median([w['bottom'] for w in ln['words'] if abs(w['size'] - body) < 0.6 and not w.get('frac')] or [ln['bottom']])
        out, prev, prev_kind = [], None, ''
        for w in ln['words']:
            t, kind = (w['text'] if w.get('frac') else map_text(w)), ''
            if not w.get('frac') and w['size'] < body * 0.86:
                kind = 'sup' if w['bottom'] < base - 0.8 else 'sub'
                t = ('^{%s}' if kind == 'sup' else '_{%s}') % t.strip()
            gap = w['x0'] - prev['x1'] if prev else 0
            sp = prev is not None and (gap > w['size'] * 0.13 if not kind else False)
            if prev is not None and prev_kind and not kind and gap > 0.6:
                sp = True
            out.append({'t': t, 'b': 'Bold' in _font(w) and not t.strip() in BULLETS, 'u': id(w) in underlined, 'sp': sp, 'nl': False})
            prev, prev_kind = w, kind
        return out

    def assemble(lns):
        seq, gaps = [], [b['top'] - a['bottom'] for a, b in zip(lns, lns[1:])]
        normal = median(gaps) if gaps else 0
        hang_x = None
        base_x = min((ln['x0'] for ln in lns), default=0)
        for i, ln in enumerate(lns):
            ts = toks(ln)
            if not ts:
                continue
            is_item = ROMAN_ITEM.match(ts[0]['t']) or ts[0]['t'] in BULLETS
            if seq:
                prev_ln, first, last = lns[i - 1], ts[0], seq[-1]
                # a list item's wrapped lines start where its text starts (hanging indent)
                hang = hang_x is not None and abs(ln['x0'] - hang_x) < 3
                shifted = (abs(ln['x0'] - prev_ln['x0']) > 6 or ln['x0'] > base_x + 6) and not hang
                brk = (ROMAN_ITEM.match(first['t']) or first['t'] in BULLETS or re.match(r'^\((?:I|II|III|IV|V|VI)\)$', first['t']) and prev_ln['x1'] < ln['x1'] - 30
                       or last['t'].endswith(':') or (first['t'].endswith(':') and first['b']) or shifted
                       or (first['b'] and not last['b']) or (ln['top'] - prev_ln['bottom']) > max(normal + 3.5, body * 0.55))
                if brk:
                    first['nl'] = True
                elif re.search(r'[a-zçğıöşüA-ZÇĞİÖŞÜ]-$', last['t']) and not last['t'].endswith('--'):
                    last['t'] = last['t'][:-1] + first['t']
                    ts = ts[1:]
                else:
                    first['sp'] = True
            seq.extend(ts)
            if is_item and len(ln['words']) > 1:
                hang_x = ln['words'][1]['x0']
            elif not (hang_x is not None and abs(ln['x0'] - hang_x) < 3):
                hang_x = None
        return render(seq)

    def render(seq):
        s, cur = '', (False, False)
        def close(c):
            return ('__' if c[1] else '') + ('**' if c[0] else '')
        def open_(c):
            return ('**' if c[0] else '') + ('__' if c[1] else '')
        for t in seq:
            f = (t['b'], t['u'])
            if t['nl']:
                s += close(cur) + '\n' + open_(f)
            elif f != cur:
                s += close(cur) + (' ' if t['sp'] else '') + open_(f)
            elif t['sp']:
                s += ' '
            s += t['t']
            cur = f
        s += close(cur)
        s = re.sub(r'-(?:\s+-)+', lambda m: m.group(0).replace(' ', ''), s)        # "- ---" → "----"
        s = re.sub(r'\*\*\*\*|____', '', s)
        s = re.sub(r'\*\*(\s*)\*\*', r'\1', s)
        s = re.sub(r'(\d)\s?\^\{[ıI\']\}', '\\1′', s)      # 66° 33′ — the arc-minute sign is set as a raised ı / I
        return re.sub(r'[ \t]+\n', '\n', s).strip()

    # reading order: each stem line goes before the first figure whose middle lies below the line's middle
    parts, chunk = [], []
    fi = 0
    for ln in stem:
        mid = (ln['top'] + ln['bottom']) / 2
        while fi < len(figs) and (figs[fi][1] + figs[fi][3]) / 2 < mid - 2:
            if chunk:
                parts.append(('t', chunk))
                chunk = []
            parts.append(('f', figs[fi]))
            fi += 1
        chunk.append(ln)
    if chunk:
        parts.append(('t', chunk))
    parts.extend(('f', f) for f in figs[fi:])
    ust_l = [ln for ln in stem if not fig or (ln['top'] + ln['bottom']) / 2 <= (fig[1] + fig[3]) / 2]
    alt_l = [ln for ln in stem if fig and (ln['top'] + ln['bottom']) / 2 > (fig[1] + fig[3]) / 2]

    # options: split the option lines' tokens at "A)" … "E)"
    opts, cur = {}, None
    for ln in opt_lines:
        first_in_line = True
        for t in toks(ln):
            m = OPT_MARK.match(t['t'])
            if m:
                cur = m.group(1)
                opts[cur] = [dict(t, t=m.group(2).strip(), sp=False)] if m.group(2).strip() else []
                first_in_line = False
                continue
            if cur is None:
                continue
            seq = opts[cur]
            if first_in_line and seq:                       # option text wrapped to the next line
                if re.search(r'[a-zçğıöşü]-$', seq[-1]['t']):
                    seq[-1]['t'] = seq[-1]['t'][:-1] + t['t']
                    first_in_line = False
                    continue
                t = dict(t, sp=True)
            elif not seq:
                t = dict(t, sp=False)
            seq.append(t)
            first_in_line = False
    secenekler = []
    if opts:
        for L in 'ABCDE':
            seq = opts.get(L, [])
            for k, t in enumerate(seq):
                t['nl'] = False
                if k == 0:
                    t['sp'] = False
            secenekler.append(render(seq))
    return {'ust': assemble(ust_l), 'alt': assemble(alt_l), 'fig': fig, 'figs': figs, 'secenekler': secenekler,
            'parcalar': [(k, assemble(v) if k == 't' else v) for k, v in parts] if len(figs) > 1 else None,
            'yazi_pt': round(body, 2), 'opts_in_fig': opts_in_fig}
