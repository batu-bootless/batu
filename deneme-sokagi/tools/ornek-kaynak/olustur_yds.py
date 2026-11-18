"""Builds ornek-yds-denemesi.html — a sample YDS mock exam with original questions, used to test
tools/soru_cikar.py on an English-language source. Render to PDF with:
    node tools/html-pdf.js tools/ornek-kaynak/ornek-yds-denemesi.html tools/ornek-kaynak/ornek-yds-denemesi.pdf
All questions were written for this project (no third-party content)."""
from html import escape
from pathlib import Path

# (stem, options, answer)
QUESTIONS = [
    ("Many coastal cities are investing heavily in sea walls, as rising sea levels pose a(n) ---- threat to low-lying neighbourhoods.", ["negligible", "obsolete", "reluctant", "imminent", "tentative"], "D"),
    ("The new vaccine proved highly ---- in clinical trials, reducing severe cases by more than ninety percent.", ["effective", "fragile", "hostile", "redundant", "casual"], "A"),
    ("After years of decline, the bird population has begun to ---- thanks to strict conservation measures.", ["deteriorate", "collapse", "disperse", "hesitate", "recover"], "E"),
    ("The committee decided to ---- the final decision until all the reports had been reviewed.", ["take after", "run into", "put off", "look up to", "give in"], "C"),
    ("Researchers ---- the effects of sleep deprivation on memory for over a decade before they published their first major findings.", ["have studied", "had been studying", "are studying", "will study", "study"], "B"),
    ("If the bridge ---- properly maintained, the accident ----.", ["was / will not happen", "is / would not happen", "has been / had not happened", "had been / would not have happened", "were / will not have happened"], "D"),
    ("The ancient city was abandoned ---- a series of devastating earthquakes in the fourth century.", ["despite", "following", "unless", "whereas", "although"], "B"),
    ("---- the experiment was repeated several times, the results remained inconsistent.", ["Because", "Unless", "Although", "So that", "In case"], "C"),
    ("The novel, ---- was first published in 1925, has been translated into more than forty languages.", ["that", "whom", "where", "whose", "which"], "E"),
    ("Volunteers were asked to keep a diary ---- they could record how much time they spent on their phones.", ["so that", "even if", "as though", "whereas", "unless"], "A"),
    ("The museum's collection is ---- impressive that it attracts visitors from all over the world.", ["such", "so", "too", "enough", "very"], "B"),
    ("Not only ---- the company reduce its emissions, but it also invested heavily in renewable energy.", ["does", "has", "was", "did", "had"], "D"),
    ("The professor encouraged her students ---- critically about the sources they used in their essays.", ["think", "thinking", "to think", "thought", "to have thought"], "C"),
    ("Despite its small size, the device is capable ---- storing thousands of high-resolution images.", ["at", "for", "with", "of", "on"], "D"),
    ("The rapid spread of misinformation online has ---- concerns about the role of social media in public debate.", ["risen", "lain", "fallen", "grown", "raised"], "E"),
    ("Scientists believe that the newly discovered planet ---- liquid water on its surface in the distant past.", ["must have had", "should have", "can have", "needn't have had", "will have"], "A"),
    ("The success of the project will largely depend ---- how well the teams communicate with each other.", ["in", "on", "at", "from", "by"], "B"),
    ("Unlike her colleagues, who preferred to work alone, Dr. Lee ---- collaborated with researchers from other fields.", ["rarely", "hardly", "frequently", "seldom", "barely"], "C"),
    ("The government introduced a series of measures ---- to reduce traffic congestion in the city centre.", ["designed", "designing", "to design", "having designed", "design"], "A"),
    ("By the time the rescue team arrived, the climbers ---- on the mountain for nearly two days.", ["are trapped", "have been trapped", "will be trapped", "were trapping", "had been trapped"], "E"),
]
PER_PAGE = 10   # 5 per column

CSS = '''@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; font-family: "Liberation Sans", Arial, sans-serif; color: #111; }
.page { width: 210mm; height: 297mm; padding: 12mm 14mm 10mm; display: flex; flex-direction: column; page-break-after: always; }
.head { display: flex; justify-content: space-between; align-items: center; border-bottom: 1mm solid #2b6cb0; padding-bottom: 3mm; }
.head small { display: block; font: 700 8pt "DejaVu Sans", Arial, sans-serif; letter-spacing: 1.5pt; color: #2b6cb0; }
.head b { font: 700 17pt "DejaVu Sans", Arial, sans-serif; }
.head span { display: block; font: 700 10pt "DejaVu Sans", Arial, sans-serif; color: #444; margin-top: 1mm; }
.head .r { border: 0.6mm solid #2b6cb0; color: #2b6cb0; border-radius: 2mm; padding: 2mm 5mm; font: 700 12pt "DejaVu Sans", Arial, sans-serif; }
.cols { flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 0 10mm; margin-top: 6mm; position: relative; }
.cols::before { content: ""; position: absolute; left: 50%; top: 0; bottom: 0; border-left: 0.3mm solid #9ab; }
.col { display: flex; flex-direction: column; gap: 8mm; }
.box { border: 0.4mm solid #222; padding: 2mm 3mm; font: 700 9pt "Liberation Sans", Arial, sans-serif; }
.q { font-size: 10pt; line-height: 1.4; }
.q p { margin: 0 0 2.5mm; font-weight: 700; }
.q .n { margin-right: 1.5mm; }
.q .opts { display: grid; grid-template-columns: 1fr 1fr; gap: 2mm 4mm; margin-left: 6mm; }
.q .opts.one { grid-template-columns: 1fr; }
.foot { display: flex; justify-content: space-between; font: 8pt "DejaVu Sans", Arial, sans-serif; color: #555; border-top: 0.3mm solid #9ab; padding-top: 2mm; }
.key h2 { font: 700 16pt "DejaVu Sans", Arial, sans-serif; margin: 6mm 0 4mm; }
.key table { border-collapse: collapse; width: 100%; font: 10pt "DejaVu Sans", Arial, sans-serif; }
.key td, .key th { border: 0.3mm solid #999; padding: 2mm; text-align: center; }
.key th { background: #e6eef8; }'''


def q_html(n, stem, opts, _ans):
    one = max(len(o) for o in opts) > 16
    cells = ''.join(f'<span>{L}) {escape(o)}</span>' for L, o in zip('ABCDE', opts))
    return f'<div class="q"><p><span class="n">{n}.</span>{escape(stem)}</p><div class="opts{" one" if one else ""}">{cells}</div></div>'


def build():
    pages = []
    for p in range(0, len(QUESTIONS), PER_PAGE):
        chunk = QUESTIONS[p:p + PER_PAGE]
        half = (len(chunk) + 1) // 2
        left = ''.join(q_html(p + i + 1, *q) for i, q in enumerate(chunk[:half]))
        right = ''.join(q_html(p + half + i + 1, *q) for i, q in enumerate(chunk[half:]))
        box = '<div class="box">1–20: For these questions, choose the best word or expression to fill the space.</div>' if p == 0 else ''
        pages.append(f'''<section class="page"><div class="head"><div><small>ÖRNEK YDS DENEMESİ</small><b>İNGİLİZCE</b><span>KELİME VE DİL BİLGİSİ</span></div><div class="r">DENEME 1</div></div>
          <div class="cols"><div class="col">{box}{left}</div><div class="col">{right}</div></div>
          <div class="foot"><span>Örnek YDS Denemesi · çıkarma aracı test dosyası</span><span>{len(pages) + 1}</span></div></section>''')
    key = '<table><tr>' + ''.join(f'<th>{i}</th>' for i in range(1, 11)) + '</tr><tr>' + ''.join(f'<td>{q[2]}</td>' for q in QUESTIONS[:10]) + '</tr></table>'
    key2 = '<table><tr>' + ''.join(f'<th>{i}</th>' for i in range(11, 21)) + '</tr><tr>' + ''.join(f'<td>{q[2]}</td>' for q in QUESTIONS[10:]) + '</tr></table>'
    pages.append(f'<section class="page key"><h2>CEVAP ANAHTARI</h2><h3 style="font:700 11pt DejaVu Sans,Arial;margin:4mm 0 2mm">DENEME 1</h3>{key}<div style="height:4mm"></div>{key2}<div style="flex:1"></div><div class="foot"><span>Örnek YDS Denemesi · çıkarma aracı test dosyası</span><span>{len(pages) + 1}</span></div></section>')
    html = f'<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Örnek YDS Denemesi</title><style>{CSS}</style></head><body>{"".join(pages)}</body></html>'
    out = Path(__file__).with_name('ornek-yds-denemesi.html')
    out.write_text(html, encoding='utf-8')
    print('yazıldı:', out)


if __name__ == '__main__':
    build()
