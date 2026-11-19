# Deneme Sokağı yaprak test şablonu (resmi şablon)

Bu klasördeki şablon Deneme Sokağı'nın **kalıcı ve tek** PDF şablonudur. Aynı dosyalar her yerde kullanılır:

- panelde **Önizle** penceresi ve **PDF indir** düğmeleri: `pdf-indir.js` testi bu şablonla sayfa içinde dizer,
  her A4 sayfayı görüntüye çevirip tek PDF yapar ve indirir (yeni sekme ya da yazdırma penceresi açılmaz)
- `yaprak-test.html`: şablonun tek başına sayfası (kayıtlı bir testi `#<test-id>` ile açıp yazdırmak için)
- komut satırı: `node tools/yaprak-test-pdf.js …`

Düzen, referans soru bankası test PDF'inin ölçüleriyle aynıdır (A4): gri başlık bandı (logo, **DENEME**,
konu çubuğu, TEST / DENEME rozeti), iki sütun ve aralarında dikey site adresli siyah çizgi, kendi satırında soru
numarası, iki yana yaslı metin, kalın soru cümlesi, şıklar (kısa olanlar yan yana), her sorunun altında künye
(2 harf + 5 rakam, ör. `[#YD48213]`), altta site adresi ve sayfa rozeti, isteğe bağlı cevap anahtarı.

**Cevap anahtarı** (`test.cevapAnahtari`): `true` soruların ardından (varsayılan), `'ayri'` ayrı bir sayfada,
`false` hiç eklenmez. Panelde kullanıcı seçer.

**Deneme düzeni** (`bolumlu`, birden çok testli kaynaklarda kendiliğinden): her test ("TÜRKÇE TESTİ · 40 soru")
yeni sayfada pembe bir şeritle başlar, numaralar her testte 1'den başlar, cevap anahtarı test test verilir.
Ortak paragraflar ("35. – 36. soruları aşağıdaki parçaya göre cevaplayınız.") yönerge kutusu ve paragrafla
birlikte basılır; görsel modda paragraf da kaynaktan kırpılmış görseldir.

Şablonda değişiklik yaptıktan sonra ölçüleri kontrol edin:

```bash
node tools/sablon-kontrol.js
```

Bilinçli bir tasarım değişikliğinde `tools/sablon-kontrol.js` içindeki `REF` değerlerini de güncelleyin.

Yazı tipleri `fonts/` altındadır: Liberation Sans (SIL OFL) ve DejaVu Sans alt kümesi (Bitstream Vera lisansı).
