#!/usr/bin/env python3
"""Deneme Sokağı — metin olarak yazılmış soruları bankaya ekler (PDF'ten çıkarmadan).

Kullanım:
  python3 tools/soru_ekle.py icerik/yds-deneme-1.json

Girdi biçimi (icerik/*.py dosyaları üretir):
  {"kaynak": {"id", "ad", "sinav", "tur": "banka|deneme", "ders", "kod_on", "dk_soru"},
   "gruplar": {"grup-id": "paragraf metni (boşluklar '(17) ----' biçiminde)"},
   "sorular": [{"no", "konu", "yonerge", "grup", "metin", "secenekler": [5], "cevap": "A–E", "cozum"}]}

Her soruya kalıcı künye verilir (2 harf + 5 rakam); künyeler tekrar çalıştırmada değişmez.
Paragrafa bağlı sorular (cloze, okuma) "grup" alanıyla paragraflarına bağlanır; panel ve PDF şablonu
bu soruları paragraflarıyla birlikte, bölünmeden kullanır.
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from soru_cikar import ROOT, assign_codes, merge_bank  # noqa: E402


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    data = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
    k = data['kaynak']
    if not re.fullmatch(r'[a-z0-9-]+', k['id']):
        sys.exit('kaynak.id yalnızca küçük harf, rakam ve tire içerebilir.')
    out_dir = ROOT / 'data' / 'sorular' / k['id']
    out_dir.mkdir(parents=True, exist_ok=True)

    problems = []
    questions = []
    for i, s in enumerate(data['sorular'], start=1):
        if len(s['secenekler']) != 5 or len(set(s['secenekler'])) != 5:
            problems.append(f"soru {s['no']}: 5 farklı seçenek olmalı")
        if s['cevap'] not in 'ABCDE' or len(s['cevap']) != 1:
            problems.append(f"soru {s['no']}: cevap A–E olmalı")
        if s.get('grup') and s['grup'] not in data.get('gruplar', {}):
            problems.append(f"soru {s['no']}: '{s['grup']}' paragrafı yok")
        gid = f"{k['id']}-{s['grup']}" if s.get('grup') else None
        questions.append({
            'id': f"{k['id']}-s{s['no']:02d}", 'kaynak': k['id'], 'kaynak_ad': k['ad'], 'sinav': k['sinav'],
            'test': 1, 'no': s['no'], 'sira': i, 'sayfa': None, 'ders': k.get('ders', ''), 'konu': s.get('konu', ''),
            'yonerge': s.get('yonerge'), 'grup': gid,
            'metin': s['metin'], 'metin_ust': '', 'metin_alt': '', 'secenekler': s['secenekler'], 'cevap': s['cevap'],
            'cozum': s.get('cozum'), 'gorsel': None, 'sekil': None, 'sekil_pt': None, 'yazi_pt': None,
        })
    if problems:
        sys.exit('Hatalar:\n  ' + '\n  '.join(problems))

    assign_codes(questions, k.get('kod_on', 'DS'), out_dir)
    meta = {key: k[key] for key in ('id', 'ad', 'sinav', 'tur', 'kod_on', 'dk_soru') if key in k}
    gruplar = {f"{k['id']}-{gid}": {'metin': text} for gid, text in data.get('gruplar', {}).items()}
    (out_dir / 'kaynak.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding='utf-8')
    (out_dir / 'gruplar.json').write_text(json.dumps(gruplar, ensure_ascii=False, indent=1), encoding='utf-8')
    (out_dir / 'sorular.json').write_text(json.dumps(questions, ensure_ascii=False, indent=1), encoding='utf-8')
    total = merge_bank()
    print(f"{len(questions)} soru eklendi ({k['id']}, {k.get('tur', 'banka')}); {len(gruplar)} paragraf; "
          f"künyeler {questions[0]['kod']} … {questions[-1]['kod']}; bankada toplam {total} soru.")


if __name__ == '__main__':
    main()
