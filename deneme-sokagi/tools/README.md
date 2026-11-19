# Deneme Sokağı araçları

| Araç | İş |
|---|---|
| `soru_cikar.py` (+ `soru_metin.py`) | PDF'ten soruları metin + şekil olarak çıkarır, künye verir, bankayı birleştirir |
| `soru_ekle.py` | Yazılmış (özgün) soruları bankaya ekler |
| `soru_duzelt.py` | Çıkarılmış sorulara elle düzeltme / `gorsel_goster` uygular |
| `yaprak-test-pdf.js` | Komut satırından Deneme Sokağı PDF'i |
| `sunucu.js` | Yerel geliştirme sunucusu (`npm start`) |
| `kontrol.js` | Bütünlük kontrolü (`npm run kontrol`) |
| `sablon-kontrol.js` | PDF şablonunun referans ölçüleri |
| `html-pdf.js`, `ornek-kaynak/` | Örnek kaynak PDF'lerini üretir (araçları denemek için) |
| `tanitim-medya.js` | Ana sayfanın tanıtım medyası: tablet videosu, PDF örnek sayfaları (`npm run tanitim`) |
| `seslendir.py` (+ `seslendirme_metin.py`) | Anlatım videolarını açık kaynak Türkçe sesle seslendirir |

## 1. Soru bankası PDF'inden soru çıkarma — `soru_cikar.py`

```bash
pip install -r tools/requirements.txt
python3 tools/soru_cikar.py KAYNAK.pdf --kaynak-id kaynak-adi --kaynak-ad "Kaynak Adı" --sinav TYT
```

Seçenekler: `--tur banka|deneme` (deneme kaynakları panelde Denemelerim → Hemen çöz'de de çıkar),
`--kod-on XX` (künye harfleri), `--dk-soru` (soru başına süre), `--ders` / `--konu` (elle başlık).

Her soruya kalıcı bir **künye** verilir: 2 harf + 5 rakam (ör. `YD48213`). Harfler sınavdan gelir
(YDS → YD, TYT → TY). Künye bankada benzersizdir ve araç tekrar çalıştırıldığında değişmez.

Her soru, kaynaktaki sırası korunarak iki biçimde çıkarılır:

- **Görsel:** sorunun PDF'ten kırpılmış hâli (`data/sorular/<kaynak-id>/<id>.png`).
  Kaynağın soru numarası beyazla kapatılır; Deneme Sokağı şablonu kendi numarasını basar.
- **Metin:** soru kökü, varsa şekil (ayrı görsel `…-sekil.png`), A–E seçenekleri ve
  "Cevap Anahtarı" sayfasından okunan doğru cevap.

Sütunlar, soru numaraları, test/ders/konu başlıkları ve cevap anahtarı otomatik bulunur. Cevap anahtarı
"Cevap Anahtarı" sayfasından ya da testin son sayfasının altındaki "1-A 2-B 3-C …" satırından okunur.
Konu, testin ilk sayfasındaki başlıktan alınır ve testin sonraki sayfalarında sürer; "1. ÜNİTE" gibi ünite
etiketleri konu sayılmaz.
`data/sorular/<kaynak-id>/kontrol.html` sayfası her sorunun görselini ve metnini yan yana
gösterir; yayına almadan önce buradan kontrol edin. Tüm kaynaklar
`data/soru-bankasi.json` ve `data/soru-bankasi.js` (panelin kullandığı) dosyalarında birleşir.

**Deneme kitapçıkları** da okunur (`--tur deneme`):

```bash
python3 tools/soru_cikar.py DENEME.pdf --kaynak-id x --kaynak-ad "…" --sinav TYT --tur deneme --sayfalar 3-31 --dk-soru 1.32
```

- Her testte numara 1'den başlar; test adı ("TYT TÜRKÇE TESTİ") sorunun **bölümü** olur.
- "Tarih (1-5), Coğrafya (6-10) …" satırından **ders**, "KONU DAĞILIMI" tablosundan **konu** alınır.
- Sütunlu cevap anahtarı ("TÜRKÇE TESTİ 1. B …") okunur; `--kitapcik A|B` hangi kitapçığın alınacağını seçer.
- "35. - 36. soruları aşağıdaki parçaya göre cevaplayınız." kutusu ve altındaki parça **ortak paragraf** olur
  (görsel + metin); "16.-20. soruları …" gibi parçasız kutular o soruların **yönergesi** olur.
- `--sayfalar` kapak, açıklama ve boş sayfaları atlar; kenardaki dikey yazılar (yayınevi adı) soru metnine girmez.

**Metin olarak çıkarma** (`tools/soru_metin.py`): sorular yazı olarak alınır, yalnızca şekiller görseldir.
Kalın, altı çizili, üs, alt indis ve kesirler işaretlenir (`**kalın**`, `__altı çizili__`, `10^{-3}`, `a_{1}`,
`{pay/payda}`); I-II-III maddeleri, diyalog ve formül satırları ayrı satırda kalır. Şekiller hem çizim nesnelerinden
hem sayfanın piksel taramasından bulunur; şekil içindeki etiketler görselde kalır, birden çok şekilli soru
"metin → şekil → metin" parçaları olarak saklanır. Metne güvenle çevrilemeyen soru (ör. kelimelerin altına yazılmış
Romen rakamları, karakter karşılığı olmayan yazı tipleri — `(cid:25)`) kendiliğinden, tablo biçimli seçenekler gibi
durumlar `tools/soru_duzelt.py` ile `"gorsel_goster": true` yapılır ve kırpılmış görseliyle gösterilir.

**`--yerel`**: çıktılar `data/yerel/kaynaklar/<kaynak-id>/` altına, birleşik hâli `data/yerel/soru-bankasi.{json,js}`
dosyasına yazılır. `data/yerel/` git'e girmez ve yayınlanan sayfalara konmaz; panel ve şablon bu bilgisayarda onu da
okur (Denemelerim'de "Yalnız test" etiketiyle). Kullanım izni olmayan bir kaynağı yalnızca şablonu ve sistemi
denemek için böyle kullanın; yayına almak için yayınevinden izin gerekir.

Sınırlar: metin katmanı olan PDF'lerde çalışır; taranmış (yalnızca resim) sayfalar için OCR
gerekir ve araç bu sayfaları atlayıp uyarır. Sayfa düzeni çok farklı kaynaklarda ayar gerekebilir.

**Telif:** Yalnızca sahibi olduğunuz ya da kullanım izni aldığınız kaynaklarla kullanın.
Yayınevlerinin soru bankaları ve ÖSYM'nin soru kitapçıkları izinsiz çoğaltılamaz.

Deneme dosyaları: `tools/ornek-kaynak/` bu proje için yazılmış özgün sorulardan oluşur — TYT soru
bankası (`olustur.py`) ve YDS denemesi (`olustur_yds.py`); PDF'e çevirmek için `node tools/html-pdf.js …`.

Filigran kaldırma yoktur: filigran kaynağın sahibini gösterir. Kendi kaynağınızın filigransız
aslını kullanın.

## 2. Yazılmış soruları ekleme — `soru_ekle.py`

PDF'ten çıkarmadan, metin olarak yazılmış özgün soruları bankaya ekler. Soru dosyaları `icerik/`
altında durur; her dosya bir Python betiğidir ve çalıştırılınca aynı adlı JSON'u üretir.

```bash
python3 icerik/yds_deneme_1.py                       # → icerik/yds-deneme-1.json
python3 tools/soru_ekle.py icerik/yds-deneme-1.json  # → data/sorular/ds-yds-1/ + soru-bankasi.{json,js}
```

JSON biçimi: `kaynak` (id, ad, sinav, `tur: banka|deneme`, ders, `kod_on`, `dk_soru`), `gruplar`
(paragraf metinleri; boşluklar `(17) ----` biçiminde) ve `sorular` (no, konu, yonerge, grup, metin,
5 seçenek, cevap, cozum). Araç her soruda 5 farklı seçenek, A–E cevap ve paragrafın var olduğunu denetler;
künyeleri `soru_cikar.py` ile aynı kuralla verir.

Paragrafa bağlı sorular (cloze test, okuma) panelde de PDF'te de paragraflarıyla birlikte gelir ve
yaprak testte **bölünmez**: bir paragrafın soruları ya hepsi birlikte teste girer ya hiç girmez.
Her bölümün başında yönerge kutusu (ör. "17 – 26: For these questions, …") basılır.

`icerik/yds_deneme_1.py` — **Deneme Sokağı YDS Denemesi 1**: 80 özgün soru, yaygın YDS dağılımı
(1–6 kelime, 7–16 dil bilgisi, 17–26 cloze test, 27–36 cümle tamamlama, 37–42 çeviri, 43–62 okuma,
63–68 diyalog, 69–74 anlamca en yakın cümle, 75–80 anlam bütünlüğünü bozan cümle). Her sorunun Türkçe
çözümü vardır; cevaplar A–E'ye eşit dağılır (her harf 16). Yayına almadan önce bir İngilizce öğretmeninin
okuması önerilir. Örnek PDF: `ornekler/ds-yds-denemesi-1.pdf`.

## 3. Deneme Sokağı PDF'i — `yaprak-test-pdf.js`

`sablon/yaprak-test.html` şablonuyla A4, iki sütunlu, soru bankası dizilimli PDF üretir: ilk sayfada gri
başlık bandı (logo, DENEME, konu çubuğu, TEST rozeti), sütunlar arasında dikey site adresli çizgi,
her sorunun altında soru kodu, altta site adresi ve sayfa rozeti, isteğe bağlı cevap anahtarı.
Yazı tipleri `sablon/fonts/` altında (Liberation Sans: SIL OFL, DejaVu Sans: Bitstream Vera lisansı).

```bash
node tools/yaprak-test-pdf.js --konu "Yüzde Problemleri" --mod gorsel --out ornekler/yuzde.pdf
node tools/yaprak-test-pdf.js --konu "Temel Kavramlar,Yüzde Problemleri" --adet 20 --mod metin --out ornekler/karma.pdf
node tools/yaprak-test-pdf.js --test test.json --out test.pdf   # paneldeki test tanımıyla
```

Seçenekler: `--kaynak <id>`, `--adet N`, `--mod gorsel|metin`, `--baslik "…"`, `--no N`,
`--ust "…"` (bant başlığı, varsayılan DENEME), `--rozet DENEME` (rozet yazısı, varsayılan TEST),
`--bolumlu` (deneme düzeni; birden çok testli kaynakta kendiliğinden), `--karistir`, `--cevapsiz`
(cevap anahtarı eklenmez), `--anahtar-ayri` (cevap anahtarı ayrı sayfada).
Panel aynı şablonu kullanır: "Önizle" ve "PDF indir" (PDF sayfa içinde üretilir, `sablon/pdf-indir.js`).

## 4. Şablon kontrolü — `sablon-kontrol.js`

`node tools/sablon-kontrol.js` şablonun 19 ölçüsünü referans PDF'le karşılaştırır (±0,6 mm).

## 5. Elle düzeltme — `soru_duzelt.py`

```bash
python3 tools/soru_duzelt.py data/sorular/<kaynak-id> duzeltme.json
```

`duzeltme.json`: `{"T1-3": {"gorsel_goster": true}, "T3-5": {"metin_ust": "…", "secenekler": ["…", "…", "…", "…", "…"]}}`.
Anahtar `T<test>-<no>`; verilen alanlar sorunun alanlarının yerine yazılır ve banka yeniden birleştirilir.
`soru_cikar.py` yeniden çalıştırılırsa düzeltmeleri bu komutla tekrar uygulayın.

## Açıklamalı çözümler — `cozumler.json`

Panelde her sorunun altındaki "Açıklamalı Çözümünü Gör" düğmesi sorunun `cozum` alanını gösterir. PDF'ten çıkarılan
kaynaklarda çözümler kaynak klasöründeki `cozumler.json` dosyasında tutulur (`data/sorular/<kaynak>/` ya da
`data/yerel/kaynaklar/<kaynak>/`):

```json
{ "ornek-t01-s04": "Üs, işaretten önce uygulanır: −3^{2} = −9.\n(−2)^{3} = −8.\n−9 + (−8) = **−17**" }
```

Metin, soru metniyle aynı işaretlemeyi kullanır (`**kalın**`, `x^{2}`, `{pay/payda}`); `\n` yeni satırdır, `•` ile
başlayan satırlar madde olur. Doğru cevap panelde ayrıca gösterilir. Dosya değişince bankayı yeniden birleştirin:

```bash
python3 tools/soru_cikar.py --birlestir
```

`soru_cikar.py` bir kaynağı yeniden çıkarınca `cozumler.json` olduğu gibi kalır. `npm run kontrol` her kaydın bir soruya
karşılık geldiğini denetler ve kaç sorunun çözümü olduğunu yazar. Yazılı içeriklerde (`soru_ekle.py`) çözüm, sorunun
kendi `cozum` alanındadır.

## Anlatım videosu seslendirmesi — `seslendir.py`

Panelin anlatım videosu, sorunun kaydı varsa onu çalar (yoksa cihazın Türkçe sesi okur). Kayıtlar açık kaynak
[Chatterbox Multilingual](https://github.com/resemble-ai/chatterbox) modeliyle (MIT lisansı, Türkçe, yerleşik ses)
bu bilgisayarda üretilir; anahtar ya da çevrimiçi hizmet gerekmez. Model, ürettiği sese duyulmayan bir filigran
(Resemble PerTh) ekler. Her soru için kaynak klasöründe:

- `ses/<soru-id>.mp3` — giriş ("Bu soruyu adım adım çözelim."), çözümün her satırı, doğru cevap; aralarında kısa
  duraklar (mono, 24 kHz, 40 kbps; soru başına ~100 KB).
- `ses/<soru-id>.json` — `{"ozet", "adimlar": [her adımın başlangıç saniyesi], "sure"}`.

Okunacak cümleleri `seslendirme_metin.py` hazırlar: işaretlemeyi ve sayıları okunur Türkçeye çevirir (`3^{2}` →
"üç kare", `{1/4}` → "bir bölü dört", `1.500` → "bin beş yüz", `%20` → "yüzde yirmi", `II.` → "iki"). `ozet`
bu cümlelerin özetidir: çözüm metni değişince kayıt eskir; birleştirme eski kaydı soruya eklemez, araç da yeniden
üretir. Okuma kuralları değişince `SES_SURUM`'u artırın.

Kurulum (bir kez, ayrı bir Python ortamında; ~4 GB, `.ses-venv/` git dışıdır):

```bash
python3 -m venv .ses-venv
```

```bash
.ses-venv/bin/pip install torch==2.6.0 torchaudio==2.6.0 --index-url https://download.pytorch.org/whl/cpu
```

```bash
.ses-venv/bin/pip install chatterbox-tts
```

Kullanım (eksik ya da eskimiş bütün kayıtlar; kaldığı yerden devam eder):

```bash
.ses-venv/bin/python tools/seslendir.py
```

`--kaynak ornek` yalnızca bir kaynağı, `--isci 0 --isci-sayisi 2` (ve ikinci işlemde `--isci 1`) işi iki işleme
bölerek seslendirir; `--sinir 5` deneme içindir.

Model arada bir sözü uzatır (son kelimeyi tekrarlar) ya da bir kelimeyi bulanık okur. Kayıtları denetlemek için
açık kaynak konuşma tanıma (faster-whisper) kurun (`.ses-venv/bin/pip install faster-whisper`), sonra:

```bash
.ses-venv/bin/python tools/seslendir.py --denetle
```

Her adımı dinleyip metinle karşılaştırır; belirgin biçimde ayrılan adımları (`soru-id:adım`) ve onları yeniden
kaydedecek komutu yazar. `--adim ornek-t01-s08:1 …` yalnızca o adımları yeniden kaydeder: üç deneme üretir, en
anlaşılır olanı eskisinden iyiyse yerine koyar; sorunun diğer adımlarına dokunmaz. İşlemcide yavaştır (1 saniye ses ≈ 3–4 saniye); bütün banka birkaç
saat sürer. Bitince bankayı yeniden birleştirin (`python3 tools/soru_cikar.py --birlestir`). `npm run kontrol`
dosyaların varlığını, adım sürelerini ve silinmiş sorulara ait artık kayıtları denetler; kaç videonun
seslendirildiğini yazar. Yerel kaynakların kayıtları `data/yerel/` altında kalır, depoya girmez.

## 6. Yerel sunucu ve kontroller — `sunucu.js`, `kontrol.js`

- `npm start` (`node tools/sunucu.js [port]`) siteyi `http://localhost:8080`'de açar. `data/yerel/` varsa
  oradaki yerel bankayı panel ve şablon sayfalarına yalnızca bu sunucu ekler.
- `npm run kontrol` (`node tools/kontrol.js`) JavaScript sözdizimini, soru bankasının tutarlılığını ve şablon
  ölçülerini denetler; bir sorun varsa ayrıntısıyla yazar ve 1 koduyla çıkar.
- `npm test` (`node tests/smoke.js`) ana akışları gerçek bir tarayıcıda dener.

## 7. Ana sayfa tanıtım medyası — `tanitim-medya.js`

- **Tablet videosu** (`img/tablet-demo.webm` + `.mp4`, kapak `img/tablet-demo.jpg`): ana sayfadaki tabletin
  ekranı, panelden kaydedilmiş sessiz bir videodur ve durmadan döngüde oynar. Araç panelde bir oturum oynatır
  (Test Oluştur → kaynak → 10 soru → çöz → sonuç → başa dönüş), 2x kareleri ve çizilen imleci WebM (VP9) ve
  MP4'e (H.264) çevirir. Sistemde "hareketi azalt" açık olanlara kapak görseli gösterilir (`script.js`).
- **PDF örnek sayfaları** (`img/pdf-yaprak-test.jpg`, `img/pdf-deneme.jpg`): "Kendi Testini Oluştur, PDF Olarak
  İndir" bölümündeki sayfalar; şablonun gerçek çıktısıdır. Bölümdeki "Örnek PDF'i gör" bağlantısı
  `ornekler/yaprak-test-tyt-temel-kavramlar.pdf` dosyasını açar.

Panelin ya da şablonun görünümü değişince yeniden üretin:

```bash
npm run tanitim                # ikisi de (video için PATH'te ffmpeg olmalı)
npm run tanitim -- --pdf       # yalnızca PDF sayfaları
npm run tanitim -- --video     # yalnızca video
```

Araç kendi sunucusunu `data/yerel/` olmadan açar: yalnızca projenin özgün örnek içerikleri görünür.
