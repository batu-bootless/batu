#!/usr/bin/env python3
"""Branş dosyalarını denetler: 48 soru, şık sayısı, aynı şık, paragrafların bölünmemesi, boş çözüm,
çözümde şık harfi (harfler derlemede belirlenir, çözüm onlara başvurmamalı).
Kullanım: python3 icerik/osym/dogrula.py tyt_turkce [tyt_sosyal …]   (verilmezse bütün dosyalar)"""
import importlib
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from derle import SINAVLAR, deger  # noqa: E402

secenek_sayisi = {m: c['secenek'] for c in SINAVLAR.values() for _, m in c['branslar']}
bolum = {m: 48 // c['deneme'] for c in SINAVLAR.values() for _, m in c['branslar']}
adlar = sys.argv[1:] or [p.stem for p in sorted(HERE.glob('*_*.py'))]
toplam = 0
for ad in adlar:
    m = importlib.import_module(ad)
    qs, gr = m.SORULAR, getattr(m, 'GRUPLAR', {})
    n = secenek_sayisi[ad]
    hata = []
    if len(qs) != 48:
        hata.append(f'{len(qs)} soru')
    for i, q in enumerate(qs, 1):
        if q['secenekler']:
            if len(q['secenekler']) != n or q['cevap'] not in 'ABCDE'[:n]:
                hata.append(f'{i}: sabit şıklar/cevap hatalı')
            ops = q['secenekler']
        else:
            if q['yanlis'] is None or len(q['yanlis']) != n - 1:
                hata.append(f'{i}: {n - 1} çeldirici olmalı')
                continue
            ops = [q['dogru']] + list(q['yanlis'])
        if len(set(map(str, ops))) != len(ops):
            hata.append(f'{i}: aynı şık iki kez')
        if not q['cozum'].strip():
            hata.append(f'{i}: çözüm yok')
        if re.search(r'(?:^|\s)[A-E]\) \w|\b[A-E] şıkkı|seçenek [A-E]\b|\b[A-E] seçeneği', q['cozum']):
            hata.append(f'{i}: çözümde şık harfi: {q["cozum"][:60]}')
        if q['grup'] and q['grup'] not in gr:
            hata.append(f'{i}: paragraf yok ({q["grup"]})')
        vals = [deger(o) for o in ops]
        if q['secenekler'] is None and all(v is not None for v in vals) and len(set(round(v, 9) for v in vals)) != len(vals):
            hata.append(f'{i}: sayısal şıklardan ikisi eşit')
    # a passage's questions stay together and inside one deneme
    for g in gr:
        idx = [i for i, q in enumerate(qs) if q['grup'] == g]
        if idx and (idx != list(range(idx[0], idx[-1] + 1)) or idx[0] // bolum[ad] != idx[-1] // bolum[ad]):
            hata.append(f'paragraf {g} bölünmüş: {idx}')
    toplam += len(qs)
    print(f"{ad}: {len(qs)} soru — {'tamam' if not hata else 'HATA: ' + '; '.join(hata)}")
print('toplam', toplam)
