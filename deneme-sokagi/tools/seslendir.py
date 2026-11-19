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
  .ses-venv/bin/pip install faster-whisper          # yalnızca --denetle ve --adim için (konuşma tanıma)

Kullanım:
  .ses-venv/bin/python tools/seslendir.py                      # eksik ya da eskimiş bütün kayıtlar
  .ses-venv/bin/python tools/seslendir.py --kaynak ornek       # yalnızca bir kaynak
  .ses-venv/bin/python tools/seslendir.py --isci 0 --isci-sayisi 2 &   # işi iki işlemciye bölmek için
  .ses-venv/bin/python tools/seslendir.py --isci 1 --isci-sayisi 2
  .ses-venv/bin/python tools/seslendir.py --denetle            # kayıtları dinler (konuşma tanıma), sorunlu adımları yazar
  .ses-venv/bin/python tools/seslendir.py --adim ornek-t01-s08:1   # bir adımı yeniden kaydeder (en anlaşılır deneme)
  python3 tools/soru_cikar.py --birlestir                      # sonra bankayı yeniden birleştirin

Kaldığı yerden devam eder: güncel kaydı olan soruyu atlar. Çözüm metni değişince o sorunun kaydı yeniden üretilir.
İşlemcide yavaştır (1 saniye ses ≈ 3–4 saniye); bütün banka birkaç saat sürer.
"""
import argparse
import difflib
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
from seslendirme_metin import GIRIS, TIRNAK, cumleler, ingilizce, ozet, sayi_yazi  # noqa: E402

ARA = 0.35        # adımlar arası durak (sn)
BAS = 0.15        # başta sessizlik (sn)
BITIS = 0.4       # sonda sessizlik (sn)
SR = 24000        # kayıtların örnekleme hızı


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


def bolumler(text):
    """[(metin, dil)]: tırnak içindeki İngilizce ifadeler aynı sesle İngilizce okunur, gerisi Türkçe."""
    out = []
    for i, p in enumerate(TIRNAK.split(text)):
        if i % 2 and ingilizce(p):
            out.append((p.strip('"“”').strip(), 'en'))
        elif out and out[-1][1] == 'tr':   # Türkçe tırnak içi ifade cümleden ayrılmaz
            out[-1] = (out[-1][0] + p, 'tr')
        else:
            out.append((p, 'tr'))
    out = [(b.strip(' ,;'), dil) for b, dil in out if re.search(r'\w', b)]
    return out or [(text, 'tr')]


def oku_pcm(mp3, sr=SR):
    """mp3 → float32 dizisi (tek kanal)."""
    import numpy as np
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(mp3), '-f', 's16le', '-ac', '1', '-ar', str(sr), '-'],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768


def harfler(t):
    """Karşılaştırma için: küçük harf, sayılar ve yüzdeler yazıyla, yalnızca harfler (boşluk ve noktalama yok;
    konuşma tanıma kelimeleri farklı bölebiliyor: "yüz ellinin" / "150'nin")."""
    t = t.replace('İ', 'i').replace('I', 'ı').lower()
    t = re.sub(r'%\s?(?=\d)', 'yüzde ', t)
    t = re.sub(r'\d+', lambda m: sayi_yazi(int(m.group())), t)
    return ''.join(re.findall(r'[a-zçğıöşüâîû]', t))


def benzerlik(metin, duyulan):
    """(0–1 benzerlik, fazla harf sayısı) — çok fazla harf: model sözü uzatmış ya da tekrarlamış."""
    a, b = harfler(metin), harfler(duyulan)
    return difflib.SequenceMatcher(None, a, b).ratio(), len(b) - len(a)


def tekrarli(metin, duyulan):
    """Sonda tekrar ("… bulunur. Bulunur."): duyulanın son 1–3 kelimesi hemen öncekilerin aynısı, metinde öyle değil."""
    def son_tekrar(t):
        k = [harfler(w) for w in t.split() if harfler(w)]
        return any(len(k) >= 2 * n and k[-n:] == k[-2 * n:-n] for n in (1, 2, 3))
    return son_tekrar(duyulan) and not son_tekrar(metin)


def zayif(puan, fazla, metin, duyulan=''):
    return puan < 0.6 or fazla > max(8, 0.25 * len(harfler(metin))) or tekrarli(metin, duyulan)


def kulak(is_parcacigi):
    """Konuşma tanıma (faster-whisper, açık kaynak): kayıtları dinleyip metinle karşılaştırmak için."""
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        sys.exit('faster-whisper kurulu değil: .ses-venv/bin/pip install faster-whisper')
    model = WhisperModel('small', device='cpu', compute_type='int8', cpu_threads=is_parcacigi or (os.cpu_count() or 2))

    def dinle(x16k):
        return ' '.join(s.text for s in model.transcribe(x16k, language='tr', beam_size=1)[0]).strip()
    return dinle


def adim_sinirlari(meta):
    """Kayıttaki her adımın sesinin [başlangıç, bitiş) saniyeleri (aradaki duraklar hariç)."""
    at, n = meta['adimlar'], len(meta['adimlar'])
    return [(at[i], at[i + 1] - ARA if i < n - 1 else meta['sure'] - BITIS) for i in range(n)]


def denetle(a):
    """Bütün güncel kayıtları dinler; metinden belirgin biçimde ayrılan adımları yazar (yeniden kaydetmek için --adim)."""
    import numpy as np
    dinle = kulak(a.is_parcacigi)
    zayiflar, n = [], 0
    for d, qid, cumle, oz in isler(a.kaynak):
        if not guncel(d, qid, oz):
            continue
        meta = json.loads((d / 'ses' / f'{qid}.json').read_text(encoding='utf-8'))
        x = oku_pcm(d / 'ses' / f'{qid}.mp3', 16000)
        for i, (bas, son) in enumerate(adim_sinirlari(meta)):
            duyulan = dinle(np.ascontiguousarray(x[int(bas * 16000):int(son * 16000)]))
            puan, fazla = benzerlik(cumle[i], duyulan)
            if zayif(puan, fazla, cumle[i], duyulan):
                zayiflar.append(f'{qid}:{i}')
                print(f'{qid}:{i}  benzerlik {puan:.2f}, fazla harf {fazla:+d}\n    metin:   {cumle[i]}\n    duyulan: {duyulan}', flush=True)
        n += 1
    print(f'{n} kayıt dinlendi; sorunlu adım: {len(zayiflar)}')
    if zayiflar:
        print('Yeniden kaydetmek için:\n  .ses-venv/bin/python tools/seslendir.py --adim ' + ' '.join(zayiflar))


def main():
    ap = argparse.ArgumentParser(description='Anlatım videolarını açık kaynak Türkçe sesle seslendirir.')
    ap.add_argument('--kaynak', action='append', help='yalnızca bu kaynak (birden çok verilebilir)')
    ap.add_argument('--isci', type=int, default=0, help='bu işçinin sırası (0’dan)')
    ap.add_argument('--isci-sayisi', type=int, default=1, help='toplam işçi sayısı')
    ap.add_argument('--sinir', type=int, default=0, help='en fazla bu kadar soru (deneme için)')
    ap.add_argument('--is-parcacigi', type=int, default=0, help='PyTorch iş parçacığı (varsayılan: çekirdek / işçi)')
    ap.add_argument('--denetle', action='store_true', help='kayıtları konuşma tanımayla dinle, sorunlu adımları yaz')
    ap.add_argument('--adim', nargs='+', metavar='SORU:ADIM', help='bu adımları yeniden kaydet (ör. ornek-t01-s08:1)')
    a = ap.parse_args()
    if a.denetle:
        return denetle(a)

    if a.adim:
        istek = {}
        for s in a.adim:
            qid, _, i = s.rpartition(':')
            if not qid or not i.isdigit():
                ap.error(f'"{s}" SORU:ADIM biçiminde değil')
            istek.setdefault(qid, set()).add(int(i))
        todo = [j for j in isler(a.kaynak) if j[1] in istek]
        eksik = set(istek) - {j[1] for j in todo}
        if eksik:
            ap.error('bulunamadı: ' + ', '.join(sorted(eksik)))
        for d, qid, cumle, oz in todo:
            if not guncel(d, qid, oz):
                ap.error(f'{qid}: güncel kaydı yok; önce seslendirin')
            if max(istek[qid]) >= len(cumle):
                ap.error(f'{qid}: {len(cumle)} adım var (0–{len(cumle) - 1})')
    else:
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
    import numpy as np
    import torch
    import torchaudio as ta
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS

    threads = a.is_parcacigi or max(1, (os.cpu_count() or 2) // a.isci_sayisi)
    torch.set_num_threads(threads)
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

    def seslendir(text, tohum=1000):
        if tohum == 1000 and (text == GIRIS or text.startswith('Doğru cevap ')):
            if text not in tekrar:
                tekrar[text] = _seslendir(text, tohum)
            return tekrar[text]
        return _seslendir(text, tohum)

    def _seslendir(text, tohum):
        out = []
        parts = [(p, dil) for b, dil in bolumler(text) for p in parcala(b)]
        for i, (p, dil) in enumerate(parts):
            best = None
            for deneme in range(3):   # model sözü erken keserse ya da uzatırsa yeniden dene
                torch.manual_seed(tohum + deneme)
                w = model.generate(p, language_id=dil)
                oran = (w.shape[-1] / sr) / max(0.9, len(p) / 13.5)
                puan = abs(math.log(max(oran, 1e-3)))
                if best is None or puan < best[0]:
                    best = (puan, w)
                if 0.5 <= oran <= 2.2:
                    break
            out.append(kirp(best[1]))
            if i < len(parts) - 1:
                out.append(sessiz(0.1 if parts[i + 1][1] != dil else 0.18))
        return torch.cat(out, dim=-1)

    def kaydet(d, qid, oz, sesler):
        """Adım sesleri → <kaynak>/ses/<id>.mp3 + .json (adım başlangıçları)."""
        parcalar, adimlar, t = [sessiz(BAS)], [], BAS
        for i, w in enumerate(sesler):
            adimlar.append(round(t, 2))
            parcalar.append(w)
            t += w.shape[-1] / sr
            if i < len(sesler) - 1:
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
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', wav, '-ac', '1', '-ar', str(SR),
                        '-b:a', '40k', str(mp3) + '.tmp.mp3'], check=True)
        os.replace(str(mp3) + '.tmp.mp3', mp3)
        os.unlink(wav)
        sure = round(ses.shape[-1] / sr, 2)
        (out / f'{qid}.json').write_text(json.dumps({'ozet': oz, 'adimlar': adimlar, 'sure': sure}), encoding='utf-8')
        return sure

    if a.adim:   # yalnızca istenen adımlar: 3 deneme, konuşma tanımaya göre en anlaşılır olanı; diğer adımlar aynen kalır
        dinle = kulak(threads)
        to16k = lambda w: np.ascontiguousarray(ta.functional.resample(w, sr, 16000)[0].numpy())
        for d, qid, cumle, oz in todo:
            meta = json.loads((d / 'ses' / f'{qid}.json').read_text(encoding='utf-8'))
            x = torch.from_numpy(oku_pcm(d / 'ses' / f'{qid}.mp3', sr).copy())[None]
            sesler = [x[:, int(bas * sr):int(son * sr)] for bas, son in adim_sinirlari(meta)]
            for i in sorted(istek[qid]):
                once = benzerlik(cumle[i], dinle(to16k(sesler[i])))
                adaylar = []
                for k in range(3):
                    w = seslendir(cumle[i], tohum=2000 + 1000 * k)
                    puan, fazla = benzerlik(cumle[i], dinle(to16k(w)))
                    adaylar.append((puan - 0.01 * max(0, fazla), puan, fazla, w))
                en = max(adaylar, key=lambda c: c[0])
                if en[0] > once[0] - 0.01 * max(0, once[1]):
                    sesler[i] = en[3]
                    print(f'{qid}:{i} yeniden kaydedildi — benzerlik {once[0]:.2f} → {en[1]:.2f}, fazla harf {once[1]:+d} → {en[2]:+d}', flush=True)
                else:
                    print(f'{qid}:{i} eski kayıt daha iyi, değişmedi ({once[0]:.2f}; denemeler {", ".join(f"{c[1]:.2f}" for c in adaylar)})', flush=True)
            kaydet(d, qid, oz, sesler)
        return

    t_all = time.time()
    for n, (d, qid, cumle, oz) in enumerate(todo, 1):
        t0 = time.time()
        sure = kaydet(d, qid, oz, [seslendir(c) for c in cumle])
        gecen = time.time() - t0
        kalan = (time.time() - t_all) / n * (len(todo) - n)
        print(f'[{n}/{len(todo)}] {qid}: {len(cumle)} adım, {sure:.1f} sn ses, {gecen:.0f} sn · kalan ≈ {kalan / 60:.0f} dk', flush=True)


if __name__ == '__main__':
    main()
