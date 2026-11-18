# Deneme Sokağı araçları

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

Sütunlar, soru numaraları, test/ders/konu başlıkları ve cevap anahtarı otomatik bulunur.
`data/sorular/<kaynak-id>/kontrol.html` sayfası her sorunun görselini ve metnini yan yana
gösterir; yayına almadan önce buradan kontrol edin. Tüm kaynaklar
`data/soru-bankasi.json` ve `data/soru-bankasi.js` (panelin kullandığı) dosyalarında birleşir.

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
başlık bandı (logo, SORU BANKASI, konu çubuğu, TEST rozeti), sütunlar arasında dikey site adresli çizgi,
her sorunun altında soru kodu, altta site adresi ve sayfa rozeti, isteğe bağlı cevap anahtarı.
Yazı tipleri `sablon/fonts/` altında (Liberation Sans: SIL OFL, DejaVu Sans: Bitstream Vera lisansı).

```bash
node tools/yaprak-test-pdf.js --konu "Yüzde Problemleri" --mod gorsel --out ornekler/yuzde.pdf
node tools/yaprak-test-pdf.js --konu "Temel Kavramlar,Yüzde Problemleri" --adet 20 --mod metin --out ornekler/karma.pdf
node tools/yaprak-test-pdf.js --test test.json --out test.pdf   # paneldeki test tanımıyla
```

Seçenekler: `--kaynak <id>`, `--adet N`, `--mod gorsel|metin`, `--baslik "…"`, `--no N`,
`--ust "DENEME SINAVI"` (bant başlığı), `--karistir`, `--cevapsiz`. Panelde aynı şablon "Önizle" ve "PDF / Yazdır" ile kullanılır.

## 4. Şablon kontrolü — `sablon-kontrol.js`

`node tools/sablon-kontrol.js` şablonun 19 ölçüsünü referans PDF'le karşılaştırır (±0,6 mm).
