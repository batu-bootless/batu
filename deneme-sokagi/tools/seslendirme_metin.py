"""Deneme Sokağı — anlatım videosu seslendirmesi: çözüm metnini okunacak Türkçe cümlelere çevirir.

Yalnızca standart kütüphane kullanır; hem seslendirme aracı (tools/seslendir.py) hem banka birleştirme
(tools/soru_cikar.py → merge_bank) bunu kullanır. Panelin anlatım videosu aynı sırayı oynatır:
  1. giriş cümlesi, 2. çözümün her satırı, 3. doğru cevap (varsa).
`ozet()` bu cümlelerin özetidir: çözüm değişince kayıt eskir ve yeniden seslendirilir.
"""
import hashlib
import re

SES_SURUM = 1   # okuma kuralları ya da ses ayarları değişince artırın: bütün kayıtlar yeniden üretilir

GIRIS = 'Bu soruyu adım adım çözelim.'
HARF = {'A': 'A', 'B': 'Be', 'C': 'Ce', 'D': 'De', 'E': 'E'}   # şık harfleri okunduğu gibi
ROMA = {'I': 'bir', 'II': 'iki', 'III': 'üç', 'IV': 'dört', 'V': 'beş', 'VI': 'altı'}
SIRA = {'I': 'birinci', 'II': 'ikinci', 'III': 'üçüncü', 'IV': 'dördüncü', 'V': 'beşinci', 'VI': 'altıncı'}

_BIR = ['', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz']
_ON = ['', 'on', 'yirmi', 'otuz', 'kırk', 'elli', 'altmış', 'yetmiş', 'seksen', 'doksan']


def _yuzler(n):
    y, k = divmod(n, 100)
    o, b = divmod(k, 10)
    out = []
    if y:
        out.append('yüz' if y == 1 else f'{_BIR[y]} yüz')
    if o:
        out.append(_ON[o])
    if b:
        out.append(_BIR[b])
    return ' '.join(out)


def sayi_yazi(n):
    """1876 → 'bin sekiz yüz yetmiş altı'"""
    if n == 0:
        return 'sıfır'
    out = []
    for deger, ad in ((10 ** 9, 'milyar'), (10 ** 6, 'milyon'), (1000, 'bin')):
        k, n = divmod(n, deger)
        if k:
            out.append(ad if (k == 1 and ad == 'bin') else f'{_yuzler(k)} {ad}')
    if n:
        out.append(_yuzler(n))
    return ' '.join(out)


def _sayi(m):
    """'1.500' → 'bin beş yüz', '0,25' → 'sıfır virgül yirmi beş', '31’er' → 'otuz birer'"""
    tam, _, kesir = m.group(1).partition(',')
    yazi = sayi_yazi(int(tam.replace('.', '')))
    if kesir:
        sifir = len(kesir) - len(kesir.lstrip('0'))
        kalan = kesir.lstrip('0')
        yazi += ' virgül ' + ' '.join(['sıfır'] * sifir + ([sayi_yazi(int(kalan))] if kalan else []))
    return f' {yazi}{m.group(2) or ""} '


BIRIM = {'cm': 'santimetre', 'mm': 'milimetre', 'km': 'kilometre', 'kg': 'kilogram', 'mg': 'miligram', 'mL': 'mililitre',
         'ml': 'mililitre', 'dk': 'dakika', 'sn': 'saniye', 'sa': 'saat', 'm': 'metre', 'g': 'gram', 'L': 'litre'}   # sayıdan sonra

KESIR = re.compile(r'\{((?:[^{}/]|\{[^{}]*\})+)/((?:[^{}]|\{[^{}]*\})+)\}')   # {pay/payda}, one level of {…} inside

TR_HARF = re.compile(r'[çğıöşüÇĞİÖŞÜâîû]')
EN_KELIME = re.compile(r"\b(the|a|an|to|of|is|it|that|and|by|with|from|was|were|be|been|have|has|had|who|whom|which|at|in|on|"
                       r"for|as|this|her|his|them|their|someone|something|not|so|than|until|just|since|while|although|"
                       r"because|did|do|does|will|would|can|could|should|nor|but|or|its|they|he|she|we|you|i)\b", re.I)
EN_HECE = re.compile(r'th|sh|ch|ph|wh|ing\b|tion|ee|oo|ea|ou|ly\b|[qw]|\w*x\w', re.I)
TIRNAK = re.compile(r'(["“][^"”\n]+["”])')


def ingilizce(parca):
    """Tırnak içi ifade İngilizce mi? (Türkçe harf yok; İngilizce bir işlev kelimesi ya da yazım özelliği var)"""
    ic = parca.strip('"“”')
    return bool(re.search(r'[A-Za-z]', ic)) and not TR_HARF.search(ic) and bool(EN_KELIME.search(ic) or EN_HECE.search(ic))


def okunur(t):
    """Çözüm satırı (işaretlemeli) → seslendirilecek düz Türkçe metin. Tırnak içindeki İngilizce ifadeler olduğu gibi
    (tırnaklarıyla) kalır: seslendirme onları İngilizce okur, sayı / Romen rakamı dönüşümü uygulanmaz."""
    t = str(t or '')
    if TIRNAK.search(t):
        parcalar = TIRNAK.split(t)
        if any(ingilizce(p) for p in parcalar[1::2]):
            out = [(re.sub(r'\*\*|__', '', p).replace('…', ' ') if i % 2 and ingilizce(p) else _okunur(p))
                   for i, p in enumerate(parcalar)]
            return re.sub(r'\s+', ' ', re.sub(r'\s+([,.:?!])', r'\1', ' '.join(x for x in out if x))).strip()
    return _okunur(t)


def _okunur(t):
    t = re.sub(r'\*\*|__', '', t)
    t = re.sub(r'\b(cm|mm|km|m)\s*(?:\^\{2\}|²)', lambda m: f' {BIRIM[m.group(1)]} kare ', t)   # cm² → santimetre kare
    t = re.sub(r'\b(cm|mm|km|m)\s*(?:\^\{3\}|³)', lambda m: f' {BIRIM[m.group(1)]} küp ', t)
    t = re.sub(KESIR, r' \1 bölü \2 ', t)                                   # {(a^{2} − b^{2})/b^{2}} too
    t = t.replace('^{2}', ' kare ').replace('^{3}', ' küp ')
    t = re.sub(r'\^\{([^{}]*)\}', r' üssü \1', t)
    t = re.sub(r'_\{([^{}]*)\}', r' \1', t)
    t = t.replace('²', ' kare ').replace('³', ' küp ')
    t = re.sub(r'%\s?(?=\d)', 'yüzde ', t)
    # Roman numerals ("II. cümle"), not a letter in a formula ("V = πr²h")
    t = re.sub(r'(?<![^\W\d_])(VI|IV|V|III|II|I)\s*[–-]\s*(VI|IV|V|III|II|I)\.(?=\s+[a-zçğıöşü])',
               lambda m: f'{SIRA[m.group(1)]} ile {SIRA[m.group(2)]}', t)                      # "I–III. cümleler"
    t = re.sub(r'(?<![^\W\d_])(VI|IV|V|III|II|I)\.(?=\s+[a-zçğıöşü])', lambda m: SIRA[m.group(1)], t)   # "II. cümlede" → ikinci
    t = re.sub(r'(?<![^\W\d_])(VI|IV|V|III|II|I)(?![^\W\d_])(?!\s*[=<>≤≥])\.?', lambda m: ROMA[m.group(1)], t)
    for a, b in (('√', ' kök '), ('·', ' çarpı '), ('×', ' çarpı '), ('⇒', ', '), ('→', ', '), ('➪', ', '),
                 ('≈', ' yaklaşık '), ('°', ' derece'), ('′', ' dakika'), ('✓', ', doğru.'), ('✗', ', yanlış.'), ('…', '.'),
                 ('≤', ' küçük eşit '), ('≥', ' büyük eşit '), (' < ', ' küçüktür '), (' > ', ' büyüktür '),
                 ('∠', ' açı '), ('∥', ' paralel '), ('π', ' pi ')):
        t = t.replace(a, b)
    t = re.sub(r'(\d)!', r'\1 faktöriyel', t)                                    # 3! → üç faktöriyel
    t = re.sub(r'\b([01]?\d|2[0-3])\.([0-5]\d)\b(?![.,]\d)', r'\1 \2', t)          # saat 13.24 → on üç yirmi dört
    t = re.sub(r'(\d)\s*(' + '|'.join(BIRIM) + r')(?=[\'’/]|dir\b|dır\b|de\b|da\b|den\b|dan\b|[^\w]|$)',
               lambda m: f'{m.group(1)} {BIRIM[m.group(2)]}', t)                   # 5 cm → beş santimetre
    t = re.sub(r'(?<=\w)/(dk|sa|sn|s)\b', lambda m: ' bölü ' + BIRIM.get(m.group(1), 'saniye'), t)   # km/sa, adım/dk
    t = re.sub(r'(?<=[\d)])\s*/\s*(?=[\d(])', ' bölü ', t)
    t = re.sub(r'\s*/\s*', ' ya da ', t)                                          # tek/çift → tek ya da çift
    t = t.replace(' = ', ' eşittir ').replace(' − ', ' eksi ').replace(' + ', ' artı ')
    t = re.sub(r'\s[–—]\s', ', ', t)                                              # Zamir – Zarf
    t = re.sub(r'[−–](?=[\d(])', ' eksi ', t)
    t = re.sub(r'(?<!\w)[−–](?=\w)', ' eksi ', t).replace('(+', '( artı ')        # −a → eksi a
    t = re.sub(r'(?<![\w)])\+(?=\w)', ' artı ', t)
    t = re.sub(r'(\d)(?=[^\W\d_])', r'\1 ', t)                        # 3x → 3 x
    t = re.sub(r'(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?)(?:[\'’]([^\W\d_]+))?', _sayi, t)
    t = re.sub(r'[\'’]', '', t)                                          # 31’er → otuz birer
    t = t.replace(';', ',')
    t = re.sub(r'[|•●()\[\]{}]', ' ', t)
    t = re.sub(r'\s+([,.:?!])', r'\1', t)
    return re.sub(r'\s+', ' ', t).strip()


def cumleler(cozum, cevap):
    """Videonun adımları sırasıyla seslendirilecek cümleler (panelin openLesson sırasıyla aynı)."""
    satirlar = [s.strip() for s in str(cozum or '').split('\n') if s.strip()]
    out = [GIRIS] + [okunur(s) or '…' for s in satirlar]
    if cevap in HARF:
        out.append(f'Doğru cevap {HARF[cevap]} şıkkı.')
    return out


def ozet(cumle_listesi):
    return hashlib.sha1((f'v{SES_SURUM}\n' + '\n'.join(cumle_listesi)).encode('utf-8')).hexdigest()[:16]
