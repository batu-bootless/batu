"""Builds ornek-soru-bankasi.html — a sample question-bank layout with original questions,
used only to test tools/soru_cikar.py. Render it to PDF with:
    node tools/html-pdf.js tools/ornek-kaynak/ornek-soru-bankasi.html tools/ornek-kaynak/ornek-soru-bankasi.pdf
All questions here were written for this project (no third-party content)."""
from html import escape
from pathlib import Path

NUMBER_LINE = '''<svg width="300" height="62" viewBox="0 0 300 62"><line x1="10" y1="30" x2="290" y2="30" stroke="#222" stroke-width="1.6"/>
<polygon points="290,30 282,26 282,34" fill="#222"/><polygon points="10,30 18,26 18,34" fill="#222"/>
<line x1="60" y1="24" x2="60" y2="36" stroke="#222" stroke-width="1.6"/><line x1="125" y1="24" x2="125" y2="36" stroke="#222" stroke-width="1.6"/>
<line x1="185" y1="24" x2="185" y2="36" stroke="#222" stroke-width="1.6"/><line x1="245" y1="24" x2="245" y2="36" stroke="#222" stroke-width="1.6"/>
<text x="60" y="54" font-size="14" text-anchor="middle" font-style="italic">a</text><text x="125" y="54" font-size="14" text-anchor="middle">0</text>
<text x="185" y="54" font-size="14" text-anchor="middle" font-style="italic">b</text><text x="245" y="54" font-size="14" text-anchor="middle" font-style="italic">c</text></svg>'''

BAR_CHART = '''<svg width="300" height="150" viewBox="0 0 300 150"><line x1="40" y1="10" x2="40" y2="120" stroke="#222" stroke-width="1.4"/>
<line x1="40" y1="120" x2="290" y2="120" stroke="#222" stroke-width="1.4"/>
<text x="34" y="124" font-size="10" text-anchor="end">0</text><text x="34" y="84" font-size="10" text-anchor="end">60</text>
<text x="34" y="44" font-size="10" text-anchor="end">120</text><text x="34" y="14" font-size="10" text-anchor="end">180</text>
<line x1="40" y1="80" x2="290" y2="80" stroke="#bbb" stroke-dasharray="3 3"/><line x1="40" y1="40" x2="290" y2="40" stroke="#bbb" stroke-dasharray="3 3"/>
<line x1="40" y1="10" x2="290" y2="10" stroke="#bbb" stroke-dasharray="3 3"/>
<rect x="65" y="40" width="44" height="80" fill="#6aa9d8"/><rect x="143" y="20" width="44" height="100" fill="#6aa9d8"/><rect x="221" y="10" width="44" height="110" fill="#2f7fbf"/>
<text x="87" y="136" font-size="11" text-anchor="middle">Ocak</text><text x="165" y="136" font-size="11" text-anchor="middle">Şubat</text><text x="243" y="136" font-size="11" text-anchor="middle">Mart</text>
<text x="160" y="148" font-size="9" text-anchor="middle">Satış miktarı (adet)</text></svg>'''

# (stem, [figure_svg | None, stem_after | None], options, answer)
TESTS = [
    ("MATEMATİK", "TEMEL KAVRAMLAR", [
        ("a, b ve c birbirinden farklı rakamlardır. Buna göre a + b + c toplamının alabileceği en büyük değer kaçtır?", None, None, ["21", "22", "23", "24", "27"], "D"),
        ("x ve y pozitif tam sayılar olmak üzere x + y = 12 olduğuna göre x · y çarpımının alabileceği en büyük değer kaçtır?", None, None, ["32", "36", "35", "40", "44"], "B"),
        ("Ardışık üç tek sayının toplamı 63 olduğuna göre bu sayıların en büyüğü kaçtır?", None, None, ["19", "21", "25", "23", "27"], "D"),
        ("−3² + (−2)³ işleminin sonucu kaçtır?", None, None, ["−17", "−1", "1", "9", "17"], "A"),
        ("a bir tam sayı olmak üzere 3a + 5 ifadesi bir çift sayıdır. Buna göre aşağıdakilerden hangisi kesinlikle tek sayıdır?", None, None, ["a + 1", "2a", "a²", "3a + 1", "a + 3"], "C"),
        ("Rakamları farklı üç basamaklı en büyük çift sayı ile rakamları farklı üç basamaklı en küçük tek sayının farkı kaçtır?", None, None, ["873", "883", "879", "885", "893"], "B"),
        ("Aşağıdaki sayı doğrusunda a, b ve c sayıları gösterilmiştir.", NUMBER_LINE, "Buna göre aşağıdakilerden hangisi kesinlikle pozitiftir?", ["a · b", "a + b", "c − b", "a · c", "a − b"], "C"),
        ("x = 2³ · 3 ve y = 2² · 3² olduğuna göre EKOK(x, y) kaçtır?", None, None, ["72", "36", "48", "108", "144"], "A"),
        ("Toplamları 40 olan iki doğal sayıdan biri diğerinin 3 katından 4 fazladır. Buna göre küçük sayı kaçtır?", None, None, ["8", "10", "11", "12", "9"], "E"),
        ("a = 0,4 ve b = 0,25 olduğuna göre a / b oranı kaçtır?", None, None, ["0,1", "1,2", "1,5", "1,6", "2,5"], "D"),
    ]),
    ("MATEMATİK", "YÜZDE PROBLEMLERİ", [
        ("Bir ürünün fiyatı %20 artırıldıktan sonra 240 TL olmuştur. Buna göre ürünün ilk fiyatı kaç TL'dir?", None, None, ["180", "192", "200", "210", "220"], "C"),
        ("Bir sayının %30'u 45 olduğuna göre bu sayının %50'si kaçtır?", None, None, ["60", "65", "70", "75", "90"], "D"),
        ("Fiyatı 400 TL olan bir ürüne önce %25 zam, ardından yeni fiyatı üzerinden %20 indirim yapılıyor. Buna göre ürünün son fiyatı kaç TL'dir?", None, None, ["380", "400", "410", "420", "440"], "B"),
        ("Bir sınıftaki öğrencilerin %40'ı kızdır. Sınıfa 6 kız öğrenci daha katıldığında kız öğrencilerin oranı %50 oluyor. Buna göre sınıfta başlangıçta kaç öğrenci vardır?", None, None, ["24", "27", "30", "32", "36"], "C"),
        ("Bir mağazanın ilk üç aydaki satış miktarları aşağıdaki grafikte gösterilmiştir.", BAR_CHART, "Buna göre mart ayındaki satış miktarı ocak ayına göre yüzde kaç artmıştır?", ["%30", "%50", "%40", "%60", "%75"], "B"),
        ("Maliyeti 80 TL olan bir ürün %35 kârla satılıyor. Buna göre ürünün satış fiyatı kaç TL'dir?", None, None, ["108", "104", "100", "112", "115"], "A"),
        ("Bir tuzlu su karışımının %15'i tuzdur. Buna göre 200 gramlık karışımda kaç gram su vardır?", None, None, ["150", "160", "165", "170", "185"], "D"),
        ("Bir öğrenci 120 soruluk bir denemedeki soruların %75'ini doğru yanıtlamıştır. Buna göre öğrencinin yanlış yanıtladığı ya da boş bıraktığı soru sayısı kaçtır?", None, None, ["25", "30", "35", "40", "45"], "B"),
        ("Bir sayı %40 azaltılıyor, elde edilen sayı da %50 artırılıyor. Buna göre son sayı ilk sayıya göre nasıl değişmiştir?", None, None, ["%10 azalmıştır.", "%10 artmıştır.", "Değişmemiştir.", "%20 azalmıştır.", "%5 artmıştır."], "A"),
        ("Etiket fiyatı 150 TL olan bir kitap %12 indirimle satılıyor. Buna göre kitabın satış fiyatı kaç TL'dir?", None, None, ["128", "130", "135", "138", "132"], "E"),
    ]),
    ("TÜRKÇE", "YAZIM KURALLARI", [
        ("Aşağıdaki cümlelerin hangisinde yazım yanlışı vardır?", None, None, ["Herkes bu konuda hemfikirdi.", "Yarın ki toplantıya katılamayacağım.", "Kitabı bir solukta okudu.", "Bu yıl kış erken geldi.", "Akşam eve geç döndü."], "B"),
        ("Aşağıdaki cümlelerin hangisinde \"de\" bağlacının yazımıyla ilgili bir yanlışlık yapılmıştır?", None, None, ["Sen de bizimle gel.", "Kitabı da getirmeyi unutma.", "Evde kimse yoktu.", "O da bu işe çok sevindi.", "Annemde bu filmi izlemek istiyor."], "E"),
        ("Aşağıdaki cümlelerin hangisinde büyük harflerin kullanımıyla ilgili bir yanlışlık vardır?", None, None, ["Ankara'ya dün akşam vardık.", "Bu yaz Karadeniz'e gideceğiz.", "Nobel Ödülü'nü kazanan yazar türk edebiyatının önemli isimlerindendir.", "Toplantı pazartesi günü yapılacak.", "Türkçe dersini çok seviyorum."], "C"),
        ("Aşağıdaki cümlelerin hangisinde \"ki\"nin yazımı yanlıştır?", None, None, ["Duydum ki işten ayrılmışsın.", "Seninki daha güzel olmuş.", "Bahçedeki çiçekler açtı.", "Öyleki herkes şaşırdı.", "Sanki her şey yolundaydı."], "D"),
        ("Aşağıdaki cümlelerin hangisinde sayıların yazımıyla ilgili bir yanlışlık vardır?", None, None, ["Saat 14.30'da buluşalım.", "Yarışmada 3. oldu.", "Kitabın on beşinci sayfasını aç.", "Kitap 250 sayfadan oluşuyor.", "Sınava ikiyüz öğrenci girdi."], "E"),
        ("Aşağıdaki cümlelerin hangisinde kesme işaretinin kullanımı yanlıştır?", None, None, ["Bu yıl Haziran'da tatile çıkacağız.", "Türkiye'nin başkenti Ankara'dır.", "Ali'nin kitabı masada kaldı.", "TDK'nin yeni sözlüğü yayımlandı.", "Atatürk'ün doğduğu ev müze oldu."], "A"),
        ("Aşağıdaki kelimelerden hangisinin yazımı doğrudur?", None, None, ["yanlız", "orijinal", "herkez", "şöför", "eşortman"], "B"),
        ("Aşağıdaki cümlelerin hangisinde bitişik yazılması gereken bir sözcük ayrı yazılmıştır?", None, None, ["Bu konuyu hiçbir zaman unutmayacağım.", "Kar yağışı yüzünden okullar tatil edildi.", "Her şey yolunda gidiyor.", "Akşam yemeğine bir kaç arkadaş geldi.", "Sınavdan önce biraz dinlendi."], "D"),
        ("Aşağıdaki cümlelerin hangisinde \"mi\" soru ekinin yazımı yanlıştır?", None, None, ["Yarın gelecek misin?", "Bu kitabı okudun mu?", "Ödevini bitirdinmi?", "Sen de mi oradaydın?", "Hava güzel mi?"], "C"),
        ("Aşağıdaki cümlelerin hangisinde kısaltmanın yazımı yanlıştır?", None, None, ["Dr. Ayşe Hanım muayeneye başladı.", "Toplantı TBMM'de yapıldı.", "Mektubu Prof. Dr. Ahmet Bey'e iletin.", "Paket 5 kg geldi.", "THY'nın uçağı rötar yaptı."], "E"),
    ]),
]

# Questions per page (column-major: first half left column, second half right column).
PAGE_SPLIT = [6, 4]

CSS = '''@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; font-family: "DejaVu Serif", "Liberation Serif", Georgia, serif; color: #111; }
.page { width: 210mm; height: 297mm; padding: 13mm 14mm 10mm; display: flex; flex-direction: column; page-break-after: always; }
.head { display: flex; justify-content: space-between; align-items: stretch; border-bottom: 1.2mm solid #0a8f6a; padding-bottom: 3mm; }
.head .l small { display: block; font: 700 8pt "DejaVu Sans", Arial, sans-serif; letter-spacing: 1.5pt; color: #0a8f6a; }
.head .l b { font: 700 17pt "DejaVu Sans", Arial, sans-serif; }
.head .l span { display: block; font: 700 10pt "DejaVu Sans", Arial, sans-serif; color: #444; margin-top: 1mm; }
.head .r { background: #0a8f6a; color: #fff; border-radius: 2mm; padding: 2mm 5mm; text-align: center; font: 700 9pt "DejaVu Sans", Arial, sans-serif; }
.head .r b { display: block; font-size: 18pt; }
.cols { flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 0 10mm; margin-top: 6mm; position: relative; }
.cols::before { content: ""; position: absolute; left: 50%; top: 0; bottom: 0; border-left: 0.3mm solid #999; }
.col { display: flex; flex-direction: column; gap: 9mm; }
.q { font-size: 10.5pt; line-height: 1.5; }
.q .n { font: 700 11pt "DejaVu Sans", Arial, sans-serif; margin-right: 1.5mm; }
.q p { margin: 0 0 2mm; }
.q .fig { margin: 1mm 0 2mm 6mm; }
.q ol { list-style: none; margin: 2mm 0 0 6mm; padding: 0; }
.q li { margin: 0.8mm 0; }
.foot { display: flex; justify-content: space-between; font: 8pt "DejaVu Sans", Arial, sans-serif; color: #555; border-top: 0.3mm solid #999; padding-top: 2mm; }
.key h2 { font: 700 16pt "DejaVu Sans", Arial, sans-serif; margin: 6mm 0 4mm; }
.key table { border-collapse: collapse; width: 100%; font: 10pt "DejaVu Sans", Arial, sans-serif; margin-bottom: 6mm; }
.key td, .key th { border: 0.3mm solid #999; padding: 2mm; text-align: center; }
.key th { background: #e6f4ef; }'''


def q_html(n, stem, fig, after, opts, _ans):
    out = [f'<div class="q"><p><span class="n">{n}.</span>{escape(stem)}</p>']
    if fig:
        out.append(f'<div class="fig">{fig}</div>')
    if after:
        out.append(f'<p>{escape(after)}</p>')
    out.append('<ol>' + ''.join(f'<li>{L}) {escape(o)}</li>' for L, o in zip('ABCDE', opts)) + '</ol></div>')
    return ''.join(out)


def build():
    pages, page_no = [], 0
    for t_index, (ders, konu, qs) in enumerate(TESTS, start=1):
        start = 0
        for count in PAGE_SPLIT:
            chunk = qs[start:start + count]
            if not chunk:
                break
            page_no += 1
            half = (len(chunk) + 1) // 2
            cols = [chunk[:half], chunk[half:]]
            col_html = ''.join('<div class="col">' + ''.join(q_html(start + i + 1 + (0 if c == 0 else half), *q) for i, q in enumerate(col)) + '</div>' for c, col in enumerate(cols))
            pages.append(f'''<section class="page"><div class="head"><div class="l"><small>ÖRNEK SORU BANKASI</small><b>{ders}</b><span>{konu}</span></div>
              <div class="r">TEST<b>{t_index}</b></div></div><div class="cols">{col_html}</div>
              <div class="foot"><span>Örnek Soru Bankası · çıkarma aracı test dosyası</span><span>{page_no}</span></div></section>''')
            start += count
    page_no += 1
    rows = ''.join(f'<h3 style="font:700 11pt DejaVu Sans,Arial;margin:4mm 0 2mm">TEST {i}</h3><table><tr>' + ''.join(f'<th>{n}</th>' for n in range(1, len(qs) + 1)) + '</tr><tr>' + ''.join(f'<td>{q[4]}</td>' for q in qs) + '</tr></table>' for i, (_, _, qs) in enumerate(TESTS, start=1))
    pages.append(f'<section class="page key"><h2>CEVAP ANAHTARI</h2>{rows}<div style="flex:1"></div><div class="foot"><span>Örnek Soru Bankası · çıkarma aracı test dosyası</span><span>{page_no}</span></div></section>')
    html = f'<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Örnek Soru Bankası</title><style>{CSS}</style></head><body>{"".join(pages)}</body></html>'
    out = Path(__file__).with_name('ornek-soru-bankasi.html')
    out.write_text(html, encoding='utf-8')
    print('yazıldı:', out)


if __name__ == '__main__':
    build()
