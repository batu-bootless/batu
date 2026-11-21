#!/usr/bin/env python3
"""Deneme Sokağı — ÖSYM / MEB biçiminde özgün denemeler (Deneme Sokağı için yazıldı).

Her sınavın her branşı (ÖSYM kitapçığındaki test) için bir dosya vardır: icerik/osym/<sınav>_<branş>.py.
Dosyada 48 soru bulunur (SORULAR); ilk 24'ü sınavın 1. denemesine, sonraki 24'ü 2. denemesine girer
(YDS: 48 soruluk tek deneme). Denemelerde testler ÖSYM sırasıyla dizilir, her test kendi başlığıyla basılır.

Bu araç:
  • şıkları sıralar: sayısal şıklar küçükten büyüğe, "Yalnız I · I ve II …" şıkları ÖSYM sırasıyla;
    öteki sorularda doğru şıkkın harfi her testte A–E (LGS: A–D) arasında dengeli dağıtılır,
  • paragraf sorularını paragraflarıyla birlikte tutar,
  • her denemeyi icerik/osym/json/<id>.json olarak yazar ve tools/soru_ekle.py ile bankaya ekler.

Çalıştırma:  python3 icerik/osym/derle.py            (bütün sınavlar)
             python3 icerik/osym/derle.py tyt ayt    (yalnız bunlar)
"""
import importlib
import json
import random
import re
import subprocess
import sys
from fractions import Fraction
from math import pi, sqrt
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))

# sınav → kaynak bilgisi ve testler (ÖSYM / MEB sırası) — (branş adı, dosya)
SINAVLAR = {
    'tyt': dict(sinav='TYT', kod_on='TY', dk_soru=1.125, secenek=5, deneme=2, branslar=[
        ('Türkçe', 'tyt_turkce'), ('Sosyal Bilimler', 'tyt_sosyal'), ('Temel Matematik', 'tyt_matematik'),
        ('Fen Bilimleri', 'tyt_fen')]),
    'ayt': dict(sinav='AYT', kod_on='AY', dk_soru=1.125, secenek=5, deneme=2, branslar=[
        ('Türk Dili ve Edebiyatı-Sosyal Bilimler-1', 'ayt_tde_sos1'), ('Sosyal Bilimler-2', 'ayt_sos2'),
        ('Matematik', 'ayt_matematik'), ('Fen Bilimleri', 'ayt_fen')]),
    'lgs': dict(sinav='LGS', kod_on='LG', dk_soru=1.72, secenek=4, deneme=2, branslar=[
        ('Türkçe', 'lgs_turkce'), ('T.C. İnkılap Tarihi ve Atatürkçülük', 'lgs_inkilap'),
        ('Din Kültürü ve Ahlak Bilgisi', 'lgs_din'), ('Yabancı Dil', 'lgs_ingilizce'),
        ('Matematik', 'lgs_matematik'), ('Fen Bilimleri', 'lgs_fen')]),
    'kpss': dict(sinav='KPSS', kod_on='KP', dk_soru=1.08, secenek=5, deneme=2, branslar=[
        ('Genel Yetenek', 'kpss_gy'), ('Genel Kültür', 'kpss_gk')]),
    'ales': dict(sinav='ALES', kod_on='AL', dk_soru=1.5, secenek=5, deneme=2, branslar=[
        ('Sayısal', 'ales_sayisal'), ('Sözel', 'ales_sozel')]),
    'dgs': dict(sinav='DGS', kod_on='DG', dk_soru=1.5, secenek=5, deneme=2, branslar=[
        ('Sayısal', 'dgs_sayisal'), ('Sözel', 'dgs_sozel')]),
    'yds': dict(sinav='YDS', kod_on='YD', dk_soru=2.25, secenek=5, deneme=1, ilk_no=2, branslar=[
        ('', 'yds_ingilizce')]),
}
PARAGRAF = 'soruları aşağıdaki parçaya göre cevaplayınız.'


class S(dict):
    """Bir soru. dogru + yanlis (4 çeldirici; LGS 3) ya da sabit sıralı secenekler + cevap."""
    def __init__(self, ders, konu, kok, dogru=None, yanlis=None, cozum='', grup=None, secenekler=None, cevap=None, yonerge=None,
                 kaydir=True):
        # kaydir=False: sayısal şıklar dengelenmez (ör. yıllar — uydurma yıl çeldiricisi üretilmez)
        super().__init__(ders=ders, konu=konu, kok=kok, dogru=dogru, yanlis=yanlis, cozum=cozum, grup=grup,
                         secenekler=secenekler, cevap=cevap, yonerge=yonerge, kaydir=kaydir)


# ---- şık sırası -------------------------------------------------------------------------------------
def deger(s):
    """Sayısal şıkkın değeri (sıralamak için) ya da None: 12 · 1,5 · −3 · 2.400 · {3/4} · 2√3 · {√3/2} · 3π · %20"""
    t = str(s).strip().replace('−', '-').replace('–', '-').replace('**', '')
    t = re.sub(r'\s*(TL|cm|m|km|kg|g|L|mL|dk|sa|sn|saat|gün|yıl|derece|°|cm²|m²|cm³|m³|birim|birimkare|kuruş|lira|tane|kişi|adet|metre|litre|%)$', '', t)
    t = t.lstrip('%').strip()
    m = re.fullmatch(r'\{(.+)/(.+)\}', t)
    if m:
        a, b = deger(m.group(1)), deger(m.group(2))
        return a / b if a is not None and b not in (None, 0) else None
    m = re.fullmatch(r'(-?\d*(?:,\d+)?)\s*√\s*(\d+(?:,\d+)?)', t)
    if m:
        k = m.group(1)
        return (float(k.replace(',', '.')) if k not in ('', '-') else (-1 if k == '-' else 1)) * sqrt(float(m.group(2).replace(',', '.')))
    m = re.fullmatch(r'(-?\d*(?:,\d+)?)\s*π', t)
    if m:
        k = m.group(1)
        return (float(k.replace(',', '.')) if k not in ('', '-') else (-1 if k == '-' else 1)) * pi
    if re.fullmatch(r'-?\d{1,3}(\.\d{3})+(,\d+)?', t):
        t = t.replace('.', '')
    if re.fullmatch(r'-?\d+(,\d+)?', t):
        return float(t.replace(',', '.'))
    return None


ROMA = {'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5}


def roma_listesi(s):
    """'Yalnız II' → (2,) · 'I ve III' → (1, 3) · 'I, II ve III' → (1, 2, 3); değilse None"""
    t = str(s).strip()
    m = re.fullmatch(r'Yalnız (I|II|III|IV|V)', t)
    if m:
        return (ROMA[m.group(1)],)
    parts = re.split(r',\s*|\s+ve\s+', t)
    if len(parts) >= 2 and all(p in ROMA for p in parts):
        return tuple(ROMA[p] for p in parts)
    return None


SADE = re.compile(r'^(?P<on>%?)(?P<sayi>-?\d{1,3}(?:\.\d{3})+(?:,\d+)?|-?\d+(?:,\d+)?)(?P<son>(?: [^\d\s]+)?)$')


def birim(x, tamsayi=False):
    """Doğru cevaba göre "yuvarlak" çeldirici adımı: x'i tam bölen, x'in en çok üçte biri olan en büyük d · 10^k
    (d ∈ 1, 2, 2,5, 3, 4, 5, 6, 8). 3000 → 1000 · 35 → 5 · 24 → 8 · 7,2 → 0,8 · 2 → 0,5"""
    x = abs(x)
    if x == 0:
        return 1.0
    best = None
    for k in range(0 if tamsayi else -3, 8):
        for d in (1, 2, 2.5, 3, 4, 5, 6, 8):
            u = d * 10 ** k
            if u <= x / 3 + 1e-12 and abs(x / u - round(x / u)) < 1e-9 and (not tamsayi or u == int(u)):
                best = u if best is None or u > best else best
    return best or (1.0 if tamsayi else x / 4)


def kaydir(ops, dogru, hedef):
    """Sade sayısal şıklarda (12 · 1,5 · 2.400 · %40 · 25 TL) doğru cevabı hedef sıraya getirir: doğru cevabın
    bir yanından en uzak çeldiriciler çıkarılır, öbür yana doğru cevabın yuvarlak katlarıyla yeni çeldiriciler
    eklenir. Var olan şıklar yazıldıkları gibi kalır. Olmazsa (biçim uymuyor, değer sıfırın altına düşüyor) None."""
    ms = [SADE.match(str(o).replace('−', '-')) for o in ops]
    if not all(ms) or len({(m['on'], m['son']) for m in ms}) != 1:
        return None
    on, son = ms[0]['on'], ms[0]['son']
    binlik = any('.' in m['sayi'] for m in ms)
    val = lambda m: float(m['sayi'].replace('.', '').replace(',', '.'))
    pairs = sorted(((val(m), str(o)) for m, o in zip(ms, ops)), key=lambda x: x[0])
    vals = [v for v, _ in pairs]
    d = val(SADE.match(str(dogru).replace('−', '-')))
    p = vals.index(d)
    if p == hedef:
        return None
    tamsayi = all(v == int(v) for v in vals)
    var = set(round(v, 9) for v in vals)
    alt = [x for x in pairs if x[0] < d]
    ust = [x for x in pairs if x[0] > d]
    yon = 1 if hedef < p else -1          # yeni çeldiriciler doğru cevabın üstüne (1) ya da altına (−1)
    k = abs(p - hedef)
    if yon == 1:
        alt = alt[k:]                     # en küçükler çıkar
    else:
        ust = ust[:len(ust) - k]          # en büyükler çıkar
    yeni = []
    for u in [birim(d, tamsayi) / 2 ** j for j in range(4)]:   # yetmezse adım yarıya iner
        if tamsayi and u != int(u):
            break
        yeni = []
        for i in range(1, 40):
            v = round(d + yon * u * i, 9)
            if v in var or v in yeni or (vals[0] >= 0 and v <= 0):
                continue
            yeni.append(v)
            if len(yeni) == k:
                break
        if len(yeni) == k:
            break
    if len(yeni) < k:
        return None

    def yaz(v):
        s = f'{abs(v):.6f}'.rstrip('0').rstrip('.')
        tam, _, kes = s.partition('.')
        if binlik:
            tam = f'{int(tam):,}'.replace(',', '.')
        return on + ('−' if v < 0 else '') + tam + (',' + kes if kes else '') + son
    out = [o for _, o in alt] + [str(dogru)] + [o for _, o in ust] + [yaz(v) for v in yeni]
    return out if len(set(out)) == len(out) else None


def sirala(q, rnd, harf_sirasi):
    """→ (secenekler, cevap harfi)"""
    if q['secenekler']:
        return q['secenekler'], q['cevap']
    ops = [q['dogru']] + list(q['yanlis'])
    if len(set(map(str, ops))) != len(ops):
        raise ValueError(f"aynı şık iki kez: {q['kok'][:60]}")
    vals = [deger(o) for o in ops]
    if all(v is not None for v in vals) and len(set(round(v, 9) for v in vals)) == len(vals):
        hedef = 'ABCDE'.index(next(harf_sirasi))
        if q.get('kaydir', True):
            ops = kaydir(ops, q['dogru'], hedef) or ops
        ops = [o for _, o in sorted(zip([deger(o) for o in ops], ops), key=lambda x: x[0])]
    elif all(roma_listesi(o) for o in ops):
        ops = sorted(ops, key=lambda o: (len(roma_listesi(o)), roma_listesi(o)))
    else:
        harf = next(harf_sirasi)
        i = 'ABCDE'.index(harf)
        rest = list(q['yanlis'])
        rnd.shuffle(rest)
        ops = rest[:i] + [q['dogru']] + rest[i:]
    return ops, 'ABCDE'[ops.index(q['dogru'])]


def dengeli(harfler, n, rnd):
    """n soruluk test için harf sırası: her harf eşit sayıda, karışık"""
    seq = [harfler[i % len(harfler)] for i in range(n)]
    rnd.shuffle(seq)
    return iter(seq)


# ---- derleme ----------------------------------------------------------------------------------------
def brans_sorulari(modul):
    m = importlib.import_module(modul)
    qs, gruplar = m.SORULAR, getattr(m, 'GRUPLAR', {})
    return qs, gruplar


def derle(kisa):
    cfg = SINAVLAR[kisa]
    n_den = cfg['deneme']
    parcalar = []          # her branş: (ad, sorular, gruplar)
    for ad, modul in cfg['branslar']:
        qs, gr = brans_sorulari(modul)
        assert len(qs) == 48, f'{modul}: {len(qs)} soru (48 olmalı)'
        parcalar.append((ad, qs, gr))
    per = 48 // n_den
    cikti = []
    for d in range(n_den):
        no_d = cfg.get('ilk_no', 1) + d
        kid = f"ds-{kisa}-{no_d}"
        kaynak = {'id': kid, 'ad': f"Deneme Sokağı {cfg['sinav']} Denemesi {no_d}", 'sinav': cfg['sinav'], 'tur': 'deneme',
                  'ders': '', 'kod_on': cfg['kod_on'], 'dk_soru': cfg['dk_soru']}
        if cfg['secenek'] == 4:
            kaynak['secenek'] = 4
        rnd = random.Random(f'{kid}-ds')
        harfler = 'ABCDE'[:cfg['secenek']]
        sorular, gruplar, no = [], {}, 0
        for ti, (ad, qs, gr) in enumerate(parcalar, start=1):
            parca = qs[d * per:(d + 1) * per]
            sira = dengeli(harfler, len(parca), rnd)
            for q in parca:
                if q['yanlis'] is not None:
                    assert len(q['yanlis']) == cfg['secenek'] - 1, f"{kid}: {len(q['yanlis'])} çeldirici: {q['kok'][:60]}"
                elif q['secenekler']:
                    assert len(q['secenekler']) == cfg['secenek'] and q['cevap'] in harfler, q['kok'][:60]
                ops, cevap = sirala(q, rnd, sira)
                no += 1
                g = None
                if q['grup']:
                    g = f"{ti}-{q['grup']}"
                    if g not in gruplar:
                        metin = gr[q['grup']]
                        gruplar[g] = {'metin': metin, 'yonerge': PARAGRAF} if isinstance(metin, str) else metin
                sorular.append({'no': no, 'test': ti, 'brans': ad or None, 'ders': q['ders'], 'konu': q['konu'],
                                'yonerge': q['yonerge'], 'grup': g, 'metin': q['kok'], 'secenekler': ops,
                                'cevap': cevap, 'cozum': q['cozum']})
        out = HERE / 'json' / f'{kid}.json'
        out.parent.mkdir(exist_ok=True)
        out.write_text(json.dumps({'kaynak': kaynak, 'gruplar': gruplar, 'sorular': sorular}, ensure_ascii=False, indent=1), encoding='utf-8')
        cikti.append(out)
        dag = {L: sum(1 for s in sorular if s['cevap'] == L) for L in harfler}
        print(f"{kid}: {len(sorular)} soru · cevap dağılımı {dag}")
    return cikti


def main():
    secim = sys.argv[1:] or list(SINAVLAR)
    for kisa in secim:
        for f in derle(kisa):
            subprocess.run([sys.executable, str(ROOT / 'tools' / 'soru_ekle.py'), str(f)], check=True)


if __name__ == '__main__':
    main()
