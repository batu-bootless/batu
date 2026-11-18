# Deneme Sokağı araçları

## 1. Soru bankası PDF'inden soru çıkarma — `soru_cikar.py`

```bash
pip install -r tools/requirements.txt
python3 tools/soru_cikar.py KAYNAK.pdf --kaynak-id kaynak-adi --kaynak-ad "Kaynak Adı" --sinav TYT
```

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

Deneme dosyası: `tools/ornek-kaynak/` bu proje için yazılmış özgün sorulardan oluşan örnek bir
soru bankasıdır (`python3 tools/ornek-kaynak/olustur.py` + `node tools/html-pdf.js …`).

## 2. Deneme Sokağı PDF'i — `yaprak-test-pdf.js`

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
`--karistir`, `--cevapsiz`. Panelde aynı şablon "Önizle" ve "PDF / Yazdır" ile kullanılır.
