# Deneme Sokağı yaprak test şablonu (resmi şablon)

Bu klasördeki şablon Deneme Sokağı'nın **kalıcı ve tek** PDF şablonudur. Aynı dosyalar her yerde kullanılır:

- panelde **Önizle** penceresi ve **PDF indir** (`yaprak-test.html` → yazdır / PDF olarak kaydet)
- komut satırı: `node tools/yaprak-test-pdf.js …`

Düzen, referans soru bankası test PDF'inin ölçüleriyle aynıdır (A4): gri başlık bandı (logo, SORU BANKASI,
konu çubuğu, TEST rozeti), iki sütun ve aralarında dikey site adresli siyah çizgi, kendi satırında soru
numarası, iki yana yaslı metin, kalın soru cümlesi, alt alta şıklar, her sorunun altında künye
(2 harf + 5 rakam, ör. `[#YD48213]`), altta site adresi ve sayfa rozeti, isteğe bağlı cevap anahtarı.

Şablonda değişiklik yaptıktan sonra ölçüleri kontrol edin:

```bash
node tools/sablon-kontrol.js
```

Bilinçli bir tasarım değişikliğinde `tools/sablon-kontrol.js` içindeki `REF` değerlerini de güncelleyin.

Yazı tipleri `fonts/` altındadır: Liberation Sans (SIL OFL) ve DejaVu Sans alt kümesi (Bitstream Vera lisansı).
