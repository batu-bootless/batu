# Deneme Sokağı

Türkiye'deki tüm sınavlar (YKS, LGS, KPSS, ALES, DGS, YDS, TUS, HMGS…) için online deneme
platformunun statik ön yüzü. Kurulum gerekmez: dosyaları bir web sunucusundan (veya doğrudan
tarayıcıda) açın.

## Sayfalar
- `index.html` — ana sayfa (`styles.css`, `script.js`)
- `giris.html`, `kayit.html`, `sifre.html` — giriş, kayıt ve şifre yenileme (`auth.css`, `auth-pages.js`)
- `panel.html` — öğrenci paneli (`panel.css`, `panel.js`); giriş yapılmadan açılırsa giriş sayfasına yönlendirir

## Yaprak test, soru bankası ve PDF şablonu
- `sablon/` — Deneme Sokağı yaprak test şablonu (A4, iki sütun, soru bankası dizilimi)
- `data/` — soru bankası (`tools/soru_cikar.py` ile PDF'ten çıkarılır, `tools/soru_ekle.py` ile yazılı sorulardan eklenir)
- `icerik/` — Deneme Sokağı için yazılmış özgün sorular (ör. 80 soruluk YDS Denemesi 1)
- `data/yerel/` — yalnızca bu bilgisayarda deneme amaçlı kullanılan kaynaklar (`soru_cikar.py --yerel`); git'e ve yayına girmez
- `tools/` — soru çıkarma ve PDF üretme araçları (ayrıntılar: `tools/README.md`)
- `ornekler/` — şablonla üretilmiş örnek PDF'ler

## Soru havuzu kuralları
- Yaprak test oluştururken kullanıcı yalnızca **soru sayısını** seçer, sonra **Çöz** ya da **PDF indir**.
- Sorular kullanıcının hedef sınavının havuzundan (Ayarlar → Hedef sınav), kaynaktaki sırayla gelir;
  önce soru bankaları, sonra deneme kaynakları kullanılır (yaprak testler bir denemeyi erken tüketmesin diye).
- Paragrafa bağlı sorular (cloze, okuma) bölünmez: paragrafın tüm soruları birlikte gelir.
- Bir deneme, **bitirildiğinde** çözülmüş sayılır; yarıda kapatılan deneme soruları harcamaz.
- Bir kullanıcıya verilmiş (teste eklenmiş, denemede gösterilmiş) ya da çözülmüş soru ona **bir daha gösterilmez**.
  Demo modunda bu kayıt tarayıcıda tutulur; canlı sistemde kullanıcı hesabına bağlanmalıdır.
- Genel Bakış'taki **Geçmiş** kartı en son çözülen, oluşturulan ve indirilen testleri gösterir.

## Öğrenci paneli
Genel bakış, Denemelerim, Yaprak Test Oluştur, Sonuç Analizi, Konu Eksiklerim, Yanlış Defteri,
Çalışma Planı (odak zamanlayıcı dahil), Sıralama; Test Geçmişi (Oluşturulan Yaprak Testler,
Deneme Sınavları); Paketler (Paket Satın Al, Paketlerim, Ödemelerim — ödeme sistemi henüz yok,
fiyatlar örnek) ve Ayarlar. Mini TYT denemesi panel içinde çözülebilir.
Açık / koyu tema, mobil uyum ve klavye kısayolları (`/` arama, sınavda A–E ve ← →) vardır.

Paneldeki deneme sonuçları, sıralamalar ve istatistikler **örnek veridir** ("Örnek veri" etiketi).
Görevler, yanlış defteri, kayıtlar ve profil tercihleri tarayıcıda saklanır.

## Hesap sistemi
`auth.js` tek bir API (`window.DSAuth`) sunar ve iki modda çalışır:

- **Demo modu** (varsayılan): `auth-config.js` boşken hesaplar yalnızca o tarayıcıda saklanır
  (şifreler tuzlanıp SHA-256 ile özetlenir). Akışı denemek içindir, gerçek bir hesap sistemi değildir.
- **Canlı mod**: `auth-config.js` içine Supabase proje adresi ve publishable (anon) anahtar
  yazıldığında Supabase Auth kullanılır: e-posta doğrulama, şifre sıfırlama e-postası, Google ile giriş
  (Supabase'de Google sağlayıcısı açıldıysa). Supabase panelinde Authentication → URL Configuration
  altına sitenin adresini ve `panel.html`, `sifre.html` yönlendirme adreslerini ekleyin.

`assets/hero-device.png` eklenirse ana sayfadaki çizilmiş tabletin yerine geçer.

Yayından önce: ana sayfadaki "Başarı Hikâyeleri" yorumları örnektir; gerçek kullanıcı yorumlarıyla
(izin alınarak) değiştirilmelidir. Kullanım Koşulları ve KVKK metni bağlantıları doldurulmalıdır.
