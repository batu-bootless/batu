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


def okunur(t):
    """Çözüm satırı (işaretlemeli) → seslendirilecek düz Türkçe metin."""
    t = str(t or '')
    t = re.sub(r'\*\*|__', '', t)
    t = re.sub(r'\{([^{}/]+)/([^{}]+)\}', r' \1 bölü \2 ', t)
    t = t.replace('^{2}', ' kare').replace('^{3}', ' küp')
    t = re.sub(r'\^\{([^{}]*)\}', r' üssü \1', t)
    t = re.sub(r'_\{([^{}]*)\}', r' \1', t)
    t = t.replace('²', ' kare').replace('³', ' küp')
    t = re.sub(r'%\s?(?=\d)', 'yüzde ', t)
    t = re.sub(r'(?<![^\W\d_])(VI|IV|V|III|II|I)(?![^\W\d_])\.?', lambda m: ROMA[m.group(1)], t)
    for a, b in (('√', ' kök '), ('·', ' çarpı '), ('×', ' çarpı '), ('⇒', ', '), ('→', ', '), ('➪', ', '),
                 ('≈', ' yaklaşık '), ('°', ' derece'), ('′', ' dakika'), ('✓', ', doğru.'), ('✗', ', yanlış.'), ('…', '.')):
        t = t.replace(a, b)
    t = t.replace(' = ', ' eşittir ').replace(' − ', ' eksi ').replace(' + ', ' artı ')
    t = re.sub(r'[−–](?=[\d(])', ' eksi ', t)
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
