#!/usr/bin/env python3
"""Deneme Sokağı — çıkarılmış sorulara elle düzeltme uygular ve bankayı yeniden birleştirir.

Kullanım:
  python3 tools/soru_duzelt.py data/yerel/kaynaklar/<kaynak-id> duzeltme.json

duzeltme.json: {"T1-3": {"gorsel_goster": true}, "T3-5": {"metin_ust": "…", "secenekler": ["…", …]}, …}
Anahtar "T<test>-<no>"; değerler sorunun alanlarının yerine yazılır. "gorsel_goster": true olan soru,
metne güvenle çevrilemediği için panelde ve PDF'te kaynaktan kırpılmış görseliyle gösterilir.
Çıkarma aracı yeniden çalıştırılınca düzeltmeleri bu komutla tekrar uygulayın.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from soru_cikar import merge_bank  # noqa: E402

if len(sys.argv) != 3:
    sys.exit(__doc__)
src, fixes = Path(sys.argv[1]), json.loads(Path(sys.argv[2]).read_text(encoding='utf-8'))
qs = json.loads((src / 'sorular.json').read_text(encoding='utf-8'))
by = {f"T{q['test']}-{q['no']}": q for q in qs}
for key, fields in fixes.items():
    if key not in by:
        sys.exit(f'{key}: böyle bir soru yok')
    by[key].update(fields)
    if 'metin_ust' in fields or 'metin_alt' in fields:
        by[key]['metin'] = '\n'.join(x for x in (by[key].get('metin_ust'), by[key].get('metin_alt')) if x)
(src / 'sorular.json').write_text(json.dumps(qs, ensure_ascii=False, indent=1), encoding='utf-8')
print(f'{len(fixes)} düzeltme uygulandı; bankada {merge_bank()} soru.')
