# Deneme Sokağı

Türkiye'deki tüm sınavlar (YKS, LGS, KPSS, ALES, DGS, YDS, TUS, HMGS…) için online deneme
platformunun statik ön yüzü. Kurulum gerekmez: dosyaları bir web sunucusundan (veya doğrudan
tarayıcıda) açın.

## Sayfalar
- `index.html` — ana sayfa (`styles.css`, `script.js`)
- `giris.html`, `kayit.html`, `sifre.html` — giriş, kayıt ve şifre yenileme (`auth.css`, `auth-pages.js`)
- `panel.html` — öğrenci paneli (`panel.css`, `panel.js`); giriş yapılmadan açılırsa giriş sayfasına yönlendirir

## Öğrenci paneli
Genel bakış, Denemelerim, Sonuç Analizi, Konu Eksiklerim, Yanlış Defteri, Çalışma Planı
(odak zamanlayıcı dahil), Sıralama ve Ayarlar. Mini TYT denemesi panel içinde çözülebilir.
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
