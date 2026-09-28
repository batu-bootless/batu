# batu — Chem AI

Chem AI: kimya hesaplayıcıları, ChemAI sohbet asistanı ve forum.

| Klasör | İçerik |
| --- | --- |
| `backend/` | Django uygulaması (hesaplayıcılar, forum, mobil istemcinin kullandığı JSON API). Kaynak: `batu-bootless/chemplus`. |
| `mobile/` | Chem AI mobil uygulaması (bilgisayardan yüklenecek, aşağıya bakın). |

## Backend

```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
python manage.py test
```

Ortam değişkenleri: `DJANGO_SECRET_KEY` (üretimde mutlaka ayarlayın; token'lar bununla imzalanır), `DJANGO_DEBUG=0` (üretim).

### Mobil API

Kimlik doğrulama `Authorization: Bearer <token>` başlığıyla yapılır; bu uçlar CSRF gerektirmez.

| Uç | Yöntem | Gövde / Yanıt |
| --- | --- | --- |
| `/api/register/` | POST | `{username, email, password}` → `{token, user}` |
| `/api/login/` | POST | `{username \| email, password}` → `{token, user}` |
| `/api/me/` | GET | → `{id, username, email}` |
| `/api/chat/` | POST | `{message, context_tool?, intent?}` → `{response}` |
| `/api/forum/threads/` | GET / POST | konu listesi / yeni konu |
| `/api/forum/answers/` | POST | yeni cevap |
| `/api/forum/vote-answer/` | POST | cevaba oy |
| `/api/forum/report/` | POST | şikâyet |

## Mobil uygulamayı bu repoya ekleme

Bilgisayarınızdaki proje klasöründen yeni bir dala gönderin; bulut oturumu onu `mobile/` altına taşır:

```bash
cd <chem-ai-proje-klasörü>
git init                    # zaten git reposuysa atlayın
git add -A && git commit -m "Chem AI mobil uygulaması: ilk yükleme"
git remote add origin https://github.com/batu-bootless/batu.git
git push -u origin HEAD:chem-ai-mobile
```

Bu repo **public**: `.env`, API anahtarları ve imza dosyaları commit'e girmemeli.

## Bulut oturumları

`.claude/hooks/session-start.sh`, Claude Code bulut oturumu açıldığında backend bağımlılıklarını (ve `mobile/package.json` varsa npm paketlerini) kurar. Yerelden yeni bir bulut görevi başlatmak için: `claude --cloud "…"`; bulut oturumunu yerele almak için: `claude --teleport`.
