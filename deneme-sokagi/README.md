# Deneme Sokağı

Türkiye'deki sınavlar (YKS, LGS, KPSS, ALES, DGS, YDS, TUS, HMGS…) için online deneme platformu.
Bu klasör platformun tamamını içerir: ana sayfa, giriş/kayıt, öğrenci paneli, soru bankası, Deneme Sokağı
PDF şablonu ve soruları kaynaklardan bankaya aktaran araçlar.

Sunucu kodu yoktur: site statik dosyalardan oluşur ve herhangi bir web sunucusunda çalışır. Hesaplar demo
modunda tarayıcıda, canlı modda Supabase'te tutulur. Mimari ve sunucuya geçiş için: [`docs/MIMARI.md`](docs/MIMARI.md).

## Hızlı başlangıç

```bash
npm install                      # yalnızca test ve PDF araçları için (Playwright)
npx playwright install chromium  # Playwright'ın tarayıcısı (bir kez)
npm start                        # http://localhost:8080
```

Siteyi bir web sunucusundan açın (`npm start` ya da herhangi bir statik sunucu): panelin **PDF indir**
özelliği şablon dosyalarını okur ve tarayıcılar bunu `file://` adreslerinde engeller.

| Komut | Ne yapar |
|---|---|
| `npm start` | Yerel sunucu (`tools/sunucu.js`, bağımlılıksız) |
| `npm run kontrol` | Bütünlük kontrolü: JavaScript sözdizimi, soru bankası tutarlılığı, PDF şablonu ölçüleri |
| `npm test` | Uçtan uca test: ana sayfa, kayıt/giriş, bütün panel sayfaları, yaprak test, deneme, PDF indirme, telefon görünümü |
| `npm run pdf -- …` | Komut satırından PDF (`tools/yaprak-test-pdf.js`, ayrıntılar `tools/README.md`) |
| `npm run tanitim` | Ana sayfanın tanıtım medyası: tablet videosu (ffmpeg gerekir) ve PDF örnek sayfaları |

Soru aktarma araçları Python ister: `pip install -r tools/requirements.txt`.

## Klasör yapısı

```
index.html, styles.css, script.js        Ana sayfa
img/                                     Ana sayfa medyası: tablet videosu (webm, mp4, kapak), PDF örnek sayfaları
giris.html, kayit.html, sifre.html       Giriş, kayıt, şifre yenileme (auth.css, auth-pages.js)
auth.js, auth-config.js                  Hesap katmanı: window.DSAuth (demo ya da Supabase)
panel.html, panel.css, panel.js          Öğrenci paneli (tek sayfa, # ile gezinme)
sablon/                                  Deneme Sokağı PDF şablonu
  yaprak-test.js / .css                    şablon (window.DSYaprakTest): A4, iki sütun, bölümler, cevap anahtarı
  pdf-indir.js                             panelde PDF üretip indirme (window.DSPdf)
  yaprak-test.html                         şablonun tek başına sayfası (yazdırma, komut satırı araçları)
  fonts/                                   Liberation Sans (SIL OFL), DejaVu Sans alt kümesi
data/                                    Soru bankası
  soru-bankasi.json / .js                  birleşik banka (.js panel içindir, .json araçlar içindir; ikisi de üretilir)
  sorular/<kaynak>/                        her kaynağın soruları, paragrafları ve görselleri
  yerel/                                   yalnızca yerel deneme içerikleri — git'e ve pakete girmez (aşağıya bakın)
icerik/                                  Deneme Sokağı için yazılmış özgün sorular (ör. 80 soruluk YDS Denemesi 1)
tools/                                   İçerik araçları, yerel sunucu, kontroller (tools/README.md)
tests/smoke.js                           Uçtan uca test
ornekler/                                Şablonla üretilmiş örnek PDF'ler
docs/MIMARI.md                           Mimari, veri modeli, saklanan veriler, sunucuya geçiş
```

## Öğrenci paneli

Genel Bakış, Denemelerim, Test Oluştur, Sonuç Analizi, Konu Eksiklerim, Yanlış Defteri, Çalışma Planı
(odak zamanlayıcı dahil), Sıralama; açılır-kapanır **Test Geçmişi** (Oluşturulan Yaprak Testler, Deneme Sınavları)
ve **Paketler** (Paket Satın Al, Paketlerim, Ödemelerim — ödeme sistemi henüz yok, fiyatlar örnek); Ayarlar.
Açık / koyu tema, mobil uyum, klavye kısayolları (`/` arama, sınavda A–E ve ← →).
Sınav ekranı (test ve deneme) tam ekrana alınabilir: başlıktaki düğme ya da **F** tuşu; tarayıcı izin vermiyorsa
(iPhone Safari, gömülü sayfalar) pencereyi kaplar. Ayarlar → Sınav ekranı ile her sınav tam ekranda başlar.

Sonuç Analizi, Sıralama, Tamamlanan denemeler ve Genel Bakış istatistikleri **örnek veridir** ("Örnek veri"
etiketi). Kullanıcının kendi oluşturduğu testler, çözdüğü denemeler, geçmişi, yanlış defteri, planı ve profili
gerçektir ve hesap başına saklanır.

## Soru havuzu kuralları

- **Test Oluştur** iki adımlıdır. **1. Kaynak seç:** bütün denemeler ve soru bankaları kart olarak
  listelenir (önce denemeler; her grupta önce hedef sınavınkiler); bir ya da birkaçı seçilir. **2. Soru sayısı:**
  isteğe bağlı branş seçimi (Tüm branşlar ya da Türkçe, Temel Matematik…; birden çok seçilebilir), soru sayısı,
  sonra **Çöz** ya da **PDF indir**. Birden çok branşta sorular branşlar arasında dengeli paylaştırılır ve testte
  branş branş sıralanır.
- **Denemelerim → Hemen çöz** de iki adımlıdır: deneme(ler) seç, isteğe bağlı branş seç, **Başla** ya da **PDF indir**.
- PDF'te **cevap anahtarı** seçilir: *Sona ekle* (varsayılan, soruların ardından), *Ayrı sayfada* ya da *Ekleme*.
  Seçim iki ekranda ve Oluşturulan Yaprak Testler → Önizle penceresinde yapılır, hesap başına hatırlanır.
  Birlikte çözülen denemelerin sonucu ayrı ayrı kaydedilir; parça parça çözülen bir denemenin neti toplanır.
- Sorular kaynaktaki sırayla gelir; birden çok kaynakta önce soru bankaları, sonra denemeler kullanılır.
- Paragrafa bağlı sorular (cloze, okuma) bölünmez: paragrafın soruları birlikte gelir.
- Bir deneme **bitirildiğinde** çözülmüş sayılır; yarıda kapatılan deneme soruları harcamaz.
- Kullanıcıya verilmiş ya da çözülmüş soru, o kaynağın bütün soruları görülene kadar **bir daha gösterilmez**.
  Bütün soruları görülen kaynak kilitlenmez: "yeniden çözülebilir" olur ve yeni bir tur başlar.
- Sorular metin olarak gösterilir (kalın, altı çizili, üs, kesir işaretlemesiyle); şekiller görseldir. Metne güvenle
  çevrilemeyen sorular kaynaktan kırpılmış görseliyle gösterilir (`gorsel_goster`).

## Hesap sistemi

`auth.js` tek bir API (`window.DSAuth`) sunar ve iki modda çalışır:

- **Demo modu** (varsayılan): `auth-config.js` boşken hesaplar yalnızca o tarayıcıda saklanır
  (şifreler tuzlanıp SHA-256 ile özetlenir). Akışı denemek içindir, gerçek bir hesap sistemi değildir.
- **Canlı mod**: `auth-config.js` içine Supabase proje adresi ve publishable (anon) anahtar yazıldığında
  Supabase Auth kullanılır: e-posta doğrulama, şifre sıfırlama, Google ile giriş (Supabase'de açıldıysa).
  Supabase panelinde Authentication → URL Configuration altına sitenin adresini ve `panel.html`, `sifre.html`
  yönlendirme adreslerini ekleyin.

## İçerik ve telif

- `data/sorular/` ve `icerik/` içindeki sorular bu proje için yazılmış özgün sorulardır.
- Yayınevlerinin kitapları ve ÖSYM kitapçıkları izinsiz çoğaltılamaz. Kullanım izni olmayan bir kaynağı yalnızca
  kendi bilgisayarınızda sistemi denemek için `--yerel` ile aktarın: çıktılar `data/yerel/` altına yazılır, git'e
  girmez, yayına giden sayfalar onlara başvurmaz; yalnızca `npm start` sunucusu ve PDF aracı, dosyalar varsa kullanır.

## Yayına almadan önce

- `auth-config.js` → Supabase bilgileri (canlı hesaplar).
- Ana sayfadaki "Başarı Hikâyeleri" yorumları örnektir; gerçek yorumlarla (izin alınarak) değiştirilmelidir.
- Kullanım Koşulları ve KVKK metni bağlantıları doldurulmalıdır.
- Kişisel veriler şimdilik tarayıcıda tutulur; çok cihazlı kullanım için sunucuya taşınmalıdır (`docs/MIMARI.md`).
