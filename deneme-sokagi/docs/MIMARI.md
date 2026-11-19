# Deneme Sokağı — mimari

Bu belge sistemin parçalarını, veri modelini, tarayıcıda saklanan verileri ve sunucuya geçerken neyin nereye
taşınacağını anlatır. Kurulum ve günlük kullanım için `README.md`, içerik araçları için `tools/README.md`,
PDF şablonu için `sablon/README.md`.

## Katmanlar

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Sayfalar     index.html · giris/kayit/sifre.html · panel.html                 │
│              (HTML + CSS + sade JavaScript, derleme adımı yok)                │
├──────────────────────────────────────────────────────────────────────────────┤
│ Hesap        auth.js → window.DSAuth   demo: tarayıcı · canlı: Supabase Auth  │
│ Soru bankası data/soru-bankasi.js → window.DS_SORU_BANKASI   (salt okunur)    │
│ Şablon / PDF sablon/yaprak-test.js → window.DSYaprakTest                      │
│              sablon/pdf-indir.js   → window.DSPdf                             │
│ Kişisel veri panel.js içinde, tarayıcı depolaması (hesap başına)              │
├──────────────────────────────────────────────────────────────────────────────┤
│ Araçlar      tools/*.py  PDF / yazılı içerik → data/sorular → soru-bankasi    │
│              tools/*.js  sunucu, kontrol, şablon ölçü testi, komut satırı PDF │
└──────────────────────────────────────────────────────────────────────────────┘
```

`panel.html` betikleri bu sırayla yükler: `auth-config.js`, `auth.js`, `data/soru-bankasi.js`,
`sablon/yaprak-test.js`, `sablon/pdf-indir.js`, `panel.js`. Her dosya tek bir global nesne yayınlar; `panel.js`
bir IIFE'dir, dışarıya bir şey açmaz.

### panel.js

- **Gezinme:** `#genel`, `#denemeler`, `#test-olustur`… — `ROUTES` tablosu her sayfanın görünüm (`v`) ve
  olay bağlama (`after`) fonksiyonunu tutar; `render()` her geçişte sayfayı yeniden çizer.
- **Durum:** `state` (sekme, seçimler), `user` (oturum + profil), hesap başına veriler (`loadProgress()`).
- **Soru havuzu:** `BANK` (`DSYaprakTest.bank()` — ana banka, varsa yerel banka). `offered()` tekrar etmeme
  kuralını, `newRound()` biten kaynağın yeni turunu, `pickQuestions()` paragraf bütünlüğünü,
  `mixBranches()` branşlar arası dengeyi uygular.
- **Sınav ekranı:** `openPlayer(sorular, başlık, süre, { mode, onFinish })` — sonuç `{ D, Y, B, net, status }`.
  Tam ekran: Fullscreen API (sayfanın tamamı), izin yoksa `.modal-back.fs` ile pencereyi kaplar; F tuşu açar/kapatır,
  Esc önce tam ekrandan çıkar; sınav kapanınca tam ekran da kapanır.
- **Açıklamalı çözüm / anlatım videosu:** `solHtml(q)` çözümü (`cozum`) gösterir; `openLesson(q, etiket)` aynı metni
  adım adım oynatan videoyu açar (sınavın üstünde ayrı bir katman; tuşlar videoya gider). Seslendirme tarayıcının
  Web Speech API'siyle, cihazın Türkçe sesiyle yapılır (`speakable()` işaretlemeyi okunur metne çevirir); ses yoksa
  süreler metin uzunluğundan hesaplanır. Ses tercihi tarayıcıda `ds-video-ses` anahtarında tutulur.
- **PDF:** `downloadTest(test)` → `DSPdf.build()` (sayfa içinde) → `DSPdf.save()` (claude.ai önizlemesinde
  `downloads` izniyle, başka yerde doğrudan indirme).

### Şablon (sablon/yaprak-test.js)

`DSYaprakTest.render(hedef, test, banka, { base })` testi A4 sayfalara dizer: sütun 1 → sütun 2 → sonraki sayfa,
soru bölünmez, sorular arasında eşit boşluk. `test.bolumlu` ise her branş yeni sayfada şeritle başlar, numaralar
branş içinde 1'den başlar. `rich()` metin işaretlemesini (`**kalın**`, `__altı çizili__`, `x^{2}`, `a_{1}`,
`{pay/payda}`) HTML'e çevirir; panelin sınav ekranı da aynı fonksiyonu kullanır. `test.cevapAnahtari`: `true`
soruların ardından, `'ayri'` ayrı sayfada, `false` yok. Ölçüler referans PDF'e bağlıdır:
`npm run sablon-kontrol`.

## Veri modeli — soru bankası

`data/soru-bankasi.json` (tarayıcı için aynısı `.js` olarak, `window.DS_SORU_BANKASI = …`). Elle düzenlenmez;
`tools/soru_cikar.py`, `tools/soru_ekle.py` ve `tools/soru_duzelt.py` kaynak klasörlerinden üretir. Açıklamalı
çözümler her kaynağın klasöründeki `cozumler.json` dosyasındadır (`{ "soru-id": "çözüm" }`) ve birleştirmede
sorulara `cozum` olarak eklenir; kaynak yeniden çıkarılınca kaybolmaz.

```jsonc
{
  "surum": 2,
  "kaynaklar": [{ "id": "ds-yds-1", "ad": "…", "sinav": "YDS", "tur": "deneme|banka", "dk_soru": 2.25, "soru": 80 }],
  "gruplar":   { "<grup-id>": { "metin": "paragraf (boşluklar '(17) ----')", "gorsel": "…png?", "yonerge": "…?" } },
  "sorular":   [ /* aşağıdaki alanlar */ ]
}
```

| Alan | Anlamı |
|---|---|
| `id` | Kalıcı kimlik: `<kaynak>-tNN-sNN` (PDF'ten) ya da `<kaynak>-sNN` (yazılı) |
| `kod` | Künye: 2 harf + 5 rakam (ör. `YD48213`), bankada benzersiz, PDF'te sorunun altında |
| `kaynak`, `kaynak_ad`, `sinav` | Kaynak kimliği ve adı, sınav (TYT, YDS…) |
| `test`, `no`, `sira`, `sayfa` | Kaynaktaki test ve soru numarası, genel sıra, kaynak sayfası |
| `bolum`, `ders`, `konu` | Branş (test: "Türkçe"), ders ("Tarih"), konu ("Sözcükte Anlam") |
| `metin`, `metin_ust`, `metin_alt` | Soru metni (işaretlemeli); şeklin üstü ve altı |
| `sekil`, `sekil_pt`, `yazi_pt` | Şekil görseli ve kaynaktaki boyutu (şablonda doğru ölçek için) |
| `parcalar` | Birden çok şekilli sorularda sıralı `{metin}` / `{sekil, sekil_pt}` parçaları |
| `secenekler` | 5 seçenek (işaretlemeli) ya da şıklar şekildeyse boş |
| `cevap` | `A`–`E` (kaynakta yoksa `null`) |
| `gorsel` | Sorunun kaynaktan kırpılmış hâli (yedek gösterim) |
| `gorsel_goster` | `true`: metne güvenle çevrilemedi, görseliyle gösterilir |
| `grup`, `yonerge` | Paragraf grubu; bölüm yönergesi |
| `cozum` | Açıklamalı çözüm (işaretlemeli, satır satır); PDF'ten çıkarılan kaynaklarda `cozumler.json`'dan gelir |

## Tarayıcıda saklanan veriler

Hesap verileri `ds-<ad>:<e-posta>` anahtarlarıyla, hesap başına tutulur (`ukey()`); eski sürümlerin
tarayıcı-geneli kayıtları ilk açan hesaba bir kez taşınır (`userData()`).

| Anahtar (`ds-…:<e-posta>`) | İçerik |
|---|---|
| `yaprak-tests` | Oluşturulan yaprak testler: `{ id, no, baslik, soruIds[], dk, olusturma, sonuc }` |
| `seen` | Tekrar etmeme kaydı: `{ used: {soruId: zaman}, solved: {soruId: zaman} }` |
| `deneme-sonuc` | Deneme başına toplam sonuç: `{ D, Y, B, net, soru, tarih }` |
| `history` | Deneme Sınavları listesi (çözülen denemeler, branş denemeleri) |
| `activity` | Genel Bakış → Geçmiş kartı (çözüldü / oluşturuldu / indirildi) |
| `wrongs` | Yanlış defteri |
| `plan` | Haftalık çalışma planı ve görevler |
| `reg` | Yaklaşan Türkiye geneli denemelere kayıtlar |
| `profile` | Ayarlar: ad, il, okul, hedef sınav/alan, hedef net, bildirim tercihleri |
| `notif-read` | Bildirimler okundu mu |
| `pdf-cevap-anahtari` | PDF cevap anahtarı tercihi: `sona` / `ayri` / `yok` |
| `tam-ekran` | Sınavları tam ekranda başlat (Ayarlar → Sınav ekranı) |

Tarayıcı tercihleri (hesaptan bağımsız): `ds-theme` (açık/koyu), `ds-sb-groups` (yan menü grupları),
`ds-pomo-*` (odak zamanlayıcı). Demo hesapları: `ds-demo-users`, `ds-demo-session`. Girişten sonra dönülecek
sayfa: `sessionStorage` → `ds-next`.

## Sunucuya geçiş

Arayüz değişmeden sunucuya taşınabilecek şekilde ayrılmıştır:

1. **Hesaplar** — hazır: `auth-config.js`'e Supabase adresi ve anahtarı yazılınca canlı moda geçer.
2. **Kişisel veriler** — yukarıdaki tablodaki her anahtar bir tabloya karşılık gelir (`kullanici_id` + alanlar).
   `panel.js`'te okuma/yazma `store.get/set(ukey(...))` ve `userData()` üzerinden yapılır; bu iki nokta bir API
   istemcisine çevrilerek tablolar kullanılabilir (Supabase'de satır düzeyinde güvenlik: her kullanıcı yalnızca
   kendi satırları). Tekrar etmeme kaydı (`seen`) ve sonuçlar sunucuda tutulunca çok cihazlı kullanım açılır.
3. **Soru bankası** — `soru-bankasi.json` biçimi doğrudan bir `sorular` tablosuna (+ `kaynaklar`, `gruplar`)
   yüklenebilir; görseller nesne depolamasına. Panel bugün bankanın tamamını yükler; büyüyünce kaynak/branş
   bazında sorgulamaya geçilmelidir (cevap anahtarı sunucuda tutulup puanlama sunucuda yapılmalı).
4. **Örnek veriler** — Sonuç Analizi, Sıralama, Tamamlanan denemeler, Genel Bakış istatistikleri ve Paketler
   şimdilik örnektir; gerçek sonuçlar ve ödeme altyapısı geldiğinde bu görünümler o verilere bağlanır.

## Kontroller

- `npm run kontrol` — sözdizimi, soru bankası tutarlılığı (benzersiz kimlik/künye, kaynak/paragraf bağları,
  A–E cevap, 5 seçenek, görsellerin varlığı, .js = .json), şablon ölçüleri.
- `npm test` — gerçek tarayıcıda uçtan uca akışlar; hiçbir sayfada JS hatası, konsol hatası ya da 4xx/5xx yok.
