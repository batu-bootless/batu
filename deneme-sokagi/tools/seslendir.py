#!/usr/bin/env python3
"""Deneme Sokağı — anlatım videolarını seslendirir: her sorunun çözümü bir ses dosyasına kaydedilir.

Ses: açık kaynak Chatterbox Multilingual (Resemble AI, MIT lisansı), Türkçe, yerleşik ses. Bilgisayarda çalışır,
anahtar ya da çevrimiçi hizmet gerekmez. Her soru için:
  data/sorular/<kaynak>/ses/<soru-id>.mp3   giriş, çözüm satırları ve doğru cevap, aralarında kısa duraklar
  data/sorular/<kaynak>/ses/<soru-id>.json  her adımın başlangıç saniyesi (video ekrandaki adımı buna göre değiştirir)
(yerel kaynaklar için data/yerel/kaynaklar/<kaynak>/ses/). Banka birleştirilince sorulara `ses` ve `ses_adimlar` eklenir.

Kurulum (bir kez, ayrı bir Python ortamında; yaklaşık 4 GB):
  python3 -m venv .ses-venv
  .ses-venv/bin/pip install torch==2.6.0 torchaudio==2.6.0 --index-url https://download.pytorch.org/whl/cpu
  .ses-venv/bin/pip install chatterbox-tts

Kullanım:
  .ses-venv/bin/python tools/seslendir.py                      # eksik ya da eskimiş bütün kayıtlar
  .ses-venv/bin/python tools/seslendir.py --kaynak ornek       # yalnızca bir kaynak
  .ses-venv/bin/python tools/seslendir.py --isci 0 --isci-sayisi 2 &   # işi iki işlemciye bölmek için
  .ses-venv/bin/python tools/seslendir.py --isci 1 --isci-sayisi 2
  python3 tools/soru_cikar.py --birlestir                      # sonra bankayı yeniden birleştirin

Kaldığı yerden devam eder: güncel kaydı olan soruyu atlar. Çözüm metni değişince o sorunun kaydı yeniden üretilir.
İşlemcide yavaştır (1 saniye ses ≈ 4 saniye); bütün banka birkaç saat sürer.
"""
import argparse
import json
import math
import os
import re
import subprocess
import sys
import tempfile
import time
import warnings
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
from seslendirme_metin import GIRIS, cumleler, ozet  # noqa: E402

ARA = 0.35        # adımlar arası durak (sn)
BAS = 0.15        # başta sessizlik (sn)
BITIS = 0.4       # sonda sessizlik (sn)


def kaynak_klasorleri():
    for base in (ROOT / 'data' / 'sorular', ROOT / 'data' / 'yerel' / 'kaynaklar'):
        if base.exists():
            for d in sorted(base.iterdir()):
                if (d / 'sorular.json').exists():
                    yield d


def isler(sadece):
    """(klasör, soru-id, cümleler, özet) — çözümü olan her soru, kaynak sırasıyla."""
    for d in kaynak_klasorleri():
        if sadece and d.name not in sadece:
            continue
        qs = json.loads((d / 'sorular.json').read_text(encoding='utf-8'))
        f = d / 'cozumler.json'
        texts = json.loads(f.read_text(encoding='utf-8')) if f.exists() else {}
        for q in qs:
            cozum = q.get('cozum') or texts.get(q['id'])
            if cozum:
                c = cumleler(cozum, q.get('cevap'))
                yield d, q['id'], c, ozet(c)


def guncel(d, qid, oz):
    j, m = d / 'ses' / f'{qid}.json', d / 'ses' / f'{qid}.mp3'
    try:
        return m.exists() and json.loads(j.read_text(encoding='utf-8')).get('ozet') == oz
    except (OSError, ValueError):
        return False


def parcala(text, en_fazla=200):
    """Uzun cümleleri ~200 karakterlik parçalara böler (model uzun metinde sözü kesebiliyor)."""
    parts, cur = [], ''
    for s in re.split(r'(?<=[.!?:,])\s+', text):
        if cur and len(cur) + 1 + len(s) > en_fazla:
            parts.append(cur)
            cur = s
        else:
            cur = f'{cur} {s}'.strip()
    if cur:
        parts.append(cur)
    return parts or [text]


def main():
    ap = argparse.ArgumentParser(description='Anlatım videolarını açık kaynak Türkçe sesle seslendirir.')
    ap.add_argument('--kaynak', action='append', help='yalnızca bu kaynak (birden çok verilebilir)')
    ap.add_argument('--isci', type=int, default=0, help='bu işçinin sırası (0’dan)')
    ap.add_argument('--isci-sayisi', type=int, default=1, help='toplam işçi sayısı')
    ap.add_argument('--sinir', type=int, default=0, help='en fazla bu kadar soru (deneme için)')
    ap.add_argument('--is-parcacigi', type=int, default=0, help='PyTorch iş parçacığı (varsayılan: çekirdek / işçi)')
    a = ap.parse_args()

    todo = [j for k, j in enumerate(isler(a.kaynak)) if k % a.isci_sayisi == a.isci and not guncel(j[0], j[1], j[3])]
    if a.sinir:
        todo = todo[:a.sinir]
    print(f'işçi {a.isci}/{a.isci_sayisi}: {len(todo)} soru seslendirilecek', flush=True)
    if not todo:
        return

    os.environ.setdefault('TQDM_DISABLE', '1')
    warnings.filterwarnings('ignore')
    import logging
    logging.disable(logging.WARNING)
    import torch
    import torchaudio as ta
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS

    torch.set_num_threads(a.is_parcacigi or max(1, (os.cpu_count() or 2) // a.isci_sayisi))
    model = ChatterboxMultilingualTTS.from_pretrained(device='cpu')
    sr = model.sr
    sessiz = lambda s: torch.zeros(1, int(sr * s))

    def kirp(w):   # baştaki / sondaki sessizliği at, 40 ms pay bırak
        x = w[0].abs()
        idx = (x > 0.01).nonzero()
        if not len(idx):
            return w
        pay = int(sr * 0.04)
        return w[:, max(0, idx[0].item() - pay):min(w.shape[-1], idx[-1].item() + pay)]

    tekrar = {}   # her soruda geçen cümleler (giriş, "Doğru cevap … şıkkı."): bir kez üretilir — sabit tohumla sonuç aynı

    def seslendir(text):
        if text == GIRIS or text.startswith('Doğru cevap '):
            if text not in tekrar:
                tekrar[text] = _seslendir(text)
            return tekrar[text]
        return _seslendir(text)

    def _seslendir(text):
        out = []
        parts = parcala(text)
        for i, p in enumerate(parts):
            best = None
            for deneme in range(3):   # model sözü erken keserse ya da uzatırsa yeniden dene
                torch.manual_seed(1000 + deneme)
                w = model.generate(p, language_id='tr')
                oran = (w.shape[-1] / sr) / max(0.9, len(p) / 13.5)
                puan = abs(math.log(max(oran, 1e-3)))
                if best is None or puan < best[0]:
                    best = (puan, w)
                if 0.5 <= oran <= 2.2:
                    break
            out.append(kirp(best[1]))
            if i < len(parts) - 1:
                out.append(sessiz(0.18))
        return torch.cat(out, dim=-1)

    t_all = time.time()
    for n, (d, qid, cumle, oz) in enumerate(todo, 1):
        t0 = time.time()
        parcalar, adimlar, t = [sessiz(BAS)], [], BAS
        for i, c in enumerate(cumle):
            w = seslendir(c)
            adimlar.append(round(t, 2))
            parcalar.append(w)
            t += w.shape[-1] / sr
            if i < len(cumle) - 1:
                parcalar.append(sessiz(ARA))
                t += ARA
        parcalar.append(sessiz(BITIS))
        ses = torch.cat(parcalar, dim=-1)
        out = d / 'ses'
        out.mkdir(exist_ok=True)
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
            wav = tmp.name
        ta.save(wav, ses, sr)
        mp3 = out / f'{qid}.mp3'
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', wav, '-ac', '1', '-ar', '24000',
                        '-b:a', '40k', str(mp3) + '.tmp.mp3'], check=True)
        os.replace(str(mp3) + '.tmp.mp3', mp3)
        os.unlink(wav)
        sure = round(ses.shape[-1] / sr, 2)
        (out / f'{qid}.json').write_text(json.dumps({'ozet': oz, 'adimlar': adimlar, 'sure': sure}), encoding='utf-8')
        gecen = time.time() - t0
        kalan = (time.time() - t_all) / n * (len(todo) - n)
        print(f'[{n}/{len(todo)}] {qid}: {len(cumle)} adım, {sure:.1f} sn ses, {gecen:.0f} sn · kalan ≈ {kalan / 60:.0f} dk', flush=True)


if __name__ == '__main__':
    main()
