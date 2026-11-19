/* Deneme Sokağı — Öğrenci Paneli
   Vanilla JS: hash router, SVG charts, exam player, plan + pomodoro.
   All figures are sample data (marked "Örnek veri" in the UI) until a backend is connected. */
(() => {
  'use strict';

  /* ---------------- helpers ---------------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dec = (n) => (Number.isInteger(n) ? 0 : Number.isInteger(n * 2) ? 1 : 2);
  const fmt = (n, d = dec(n)) => Number(n).toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const icon = (id, cls = '') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
  const store = {
    get(k, f) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : f; } catch (e) { return f; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  };
  const uid = () => Math.random().toString(36).slice(2, 9);
  const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  const DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  const DAYS_S = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  const dShort = (d) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  const hm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  /* ---------------- sample data ---------------- */
  const SUBJ = {
    tr: { name: 'Türkçe', short: 'Türkçe', q: 40, c: 'var(--c-tr)', avg: 22.4 },
    sos: { name: 'Sosyal Bilimler', short: 'Sosyal', q: 20, c: 'var(--c-sos)', avg: 9.8 },
    mat: { name: 'Temel Matematik', short: 'Matematik', q: 40, c: 'var(--c-mat)', avg: 12.6 },
    dil: { name: 'İngilizce', short: 'İngilizce', c: 'var(--c-dil)' },
    fen: { name: 'Fen Bilimleri', short: 'Fen', q: 20, c: 'var(--c-fen)', avg: 6.9 },
    all: { name: 'Genel', c: 'var(--brand)' },
  };
  const SK = ['tr', 'sos', 'mat', 'fen'];
  const AVG_TOTAL = SK.reduce((a, k) => a + SUBJ[k].avg, 0);

  const EXAMS = [
    { id: 't1', name: 'TYT Deneme 1', short: 'D1', date: '2026-09-13', tr: 28.5, sos: 12.25, mat: 18.5, fen: 9, rank: 9840, total: 31200 },
    { id: 't2', name: 'TYT Deneme 2', short: 'D2', date: '2026-09-27', tr: 29.75, sos: 13, mat: 20, fen: 9.75, rank: 8120, total: 32950 },
    { id: 't3', name: 'TYT Deneme 3', short: 'D3', date: '2026-10-04', tr: 30.5, sos: 13.25, mat: 21.5, fen: 9.75, rank: 7310, total: 33400 },
    { id: 't4', name: 'TYT Deneme 4', short: 'D4', date: '2026-10-11', tr: 29, sos: 12.5, mat: 21.25, fen: 9, rank: 8590, total: 34120 },
    { id: 't5', name: 'TYT Deneme 5', short: 'D5', date: '2026-10-18', tr: 31.25, sos: 14, mat: 23.5, fen: 10.75, rank: 6050, total: 35010 },
    { id: 'tg4', name: 'Türkiye Geneli TYT 4', short: 'TG4', date: '2026-10-25', tr: 32, sos: 14.25, mat: 24, fen: 11, rank: 5470, total: 36880 },
    { id: 't6', name: 'TYT Deneme 6', short: 'D6', date: '2026-11-01', tr: 32.5, sos: 15, mat: 25.25, fen: 11.25, rank: 4980, total: 37200 },
    { id: 'tg5', name: 'Türkiye Geneli TYT 5', short: 'TG5', date: '2026-11-08', tr: 33.75, sos: 15.5, mat: 26.25, fen: 12, rank: 4218, total: 38540 },
  ];
  EXAMS.forEach((e) => { e.net = SK.reduce((a, k) => a + e[k], 0); e.d = new Date(e.date + 'T10:15:00'); });
  const LAST = EXAMS[EXAMS.length - 1];
  const PREV = EXAMS[EXAMS.length - 2];
  const estScore = (net) => 160 + net * 2.6; // rough sample estimate, labelled "yaklaşık"

  // D / Y / B from a net (net = D − Y/4)
  function dyb(net, q) {
    const c = Math.ceil(net);
    for (const k of [1, 0]) {
      const D = c + k, Y = Math.round((D - net) * 4), B = q - D - Y;
      if (B >= 0) return { D, Y, B };
    }
    return { D: c, Y: Math.round((c - net) * 4), B: 0 };
  }

  const TOPICS = [
    { s: 'mat', n: 'Temel Kavramlar', p: 90, q: 42 }, { s: 'mat', n: 'Sayı Basamakları', p: 84, q: 30 },
    { s: 'mat', n: 'Rasyonel Sayılar', p: 79, q: 28 }, { s: 'mat', n: 'Yüzde Problemleri', p: 48, q: 36 },
    { s: 'mat', n: 'Fonksiyonlar', p: 52, q: 24 }, { s: 'mat', n: 'Olasılık', p: 61, q: 18 }, { s: 'mat', n: 'Üçgenler', p: 57, q: 26 },
    { s: 'tr', n: 'Sözcükte Anlam', p: 92, q: 40 }, { s: 'tr', n: 'Cümlede Anlam', p: 88, q: 38 }, { s: 'tr', n: 'Paragraf', p: 86, q: 96 },
    { s: 'tr', n: 'Yazım Kuralları', p: 68, q: 22 }, { s: 'tr', n: 'Ses Bilgisi', p: 64, q: 14 },
    { s: 'fen', n: 'Fizik · Elektrik', p: 41, q: 20 }, { s: 'fen', n: 'Fizik · Hareket', p: 62, q: 18 },
    { s: 'fen', n: 'Kimya · Mol Kavramı', p: 45, q: 16 }, { s: 'fen', n: 'Kimya · Atom', p: 71, q: 14 },
    { s: 'fen', n: 'Biyoloji · Hücre', p: 76, q: 16 }, { s: 'fen', n: 'Biyoloji · Ekoloji', p: 66, q: 12 },
    { s: 'sos', n: 'Tarih · Osmanlı Kuruluş', p: 73, q: 20 }, { s: 'sos', n: 'Coğrafya · İklim', p: 50, q: 16 },
    { s: 'sos', n: 'Felsefe', p: 81, q: 14 }, { s: 'sos', n: 'Din Kültürü', p: 86, q: 12 },
  ];
  const level = (p) => (p < 55 ? 'bad' : p < 75 ? 'warn' : 'good');
  const levelTxt = { bad: 'Kritik', warn: 'Geliştirilmeli', good: 'Güçlü' };

  const QUESTIONS = [
    { s: 'mat', t: '3x − 7 = 2x + 5 olduğuna göre x kaçtır?', o: ['10', '11', '12', '13', '14'], a: 2,
      sol: ['Bilinmeyenleri bir tarafa, sayıları diğer tarafa topla.', '3x − 2x = 5 + 7', 'x = 12'] },
    { s: 'mat', t: "Bir sınıftaki öğrencilerin %40'ı kızdır. Sınıfa 6 kız öğrenci daha katıldığında kız öğrencilerin oranı %50 oluyor. Buna göre sınıfta başlangıçta kaç öğrenci vardır?", o: ['24', '27', '32', '30', '36'], a: 3,
      sol: ['Başlangıçta n öğrenci olsun; kız sayısı 0,4n.', '(0,4n + 6) / (n + 6) = 1/2', '0,8n + 12 = n + 6  ⇒  0,2n = 6', 'n = 30'] },
    { s: 'tr', t: 'Aşağıdaki cümlelerin hangisinde yazım yanlışı vardır?', o: ['Herkes bu konuda hemfikirdi.', 'Yarın ki toplantıya katılamayacağım.', 'Kitabı bir solukta okudu.', 'Bu yıl kış erken geldi.', 'Akşam eve geç döndü.'], a: 1,
      sol: ['Sıfat yapan "-ki" eki kendinden önceki sözcüğe bitişik yazılır.', 'Doğrusu: "Yarınki toplantıya katılamayacağım."'] },
    { s: 'fen', t: "Sürtünmesiz yatay düzlemde duran 2 kg kütleli bir cisme 10 N büyüklüğünde yatay bir kuvvet uygulanıyor. Cismin ivmesi kaç m/s²'dir?", o: ['2', '4', '5', '10', '20'], a: 2,
      sol: ["Newton'un ikinci yasası: F = m · a", '10 = 2 · a', 'a = 5 m/s²'] },
    { s: 'sos', t: 'Kaynağını ve döküldüğü yeri Türkiye sınırları içinde bulunduran en uzun akarsu hangisidir?', o: ['Fırat', 'Sakarya', 'Kızılırmak', 'Yeşilırmak', 'Dicle'], a: 2,
      sol: ['Fırat ve Dicle Türkiye sınırları dışına çıkar.', "Kızılırmak (yaklaşık 1.355 km) Türkiye'de doğup Karadeniz'e dökülen en uzun akarsudur."] },
  ];
  const L5 = ['A', 'B', 'C', 'D', 'E'];

  const WRONG_DEFAULT = [
    { id: 'w1', q: 1, topic: 'Yüzde Problemleri', src: 'Türkiye Geneli TYT 5 · Soru 77', date: '8 Kas', kind: 'Bilgi eksiği', your: 'C' },
    { id: 'w2', q: 2, topic: 'Yazım Kuralları', src: 'TYT Deneme 6 · Soru 9', date: '1 Kas', kind: 'Dikkat hatası', your: 'A' },
    { id: 'w3', q: 3, topic: 'Fizik · Dinamik', src: 'Türkiye Geneli TYT 5 · Soru 104', date: '8 Kas', kind: 'Süre yetmedi', your: '—' },
    { id: 'w4', q: 4, topic: 'Coğrafya · Akarsular', src: 'TYT Deneme 5 · Soru 48', date: '18 Eki', kind: 'Bilgi eksiği', your: 'A' },
    { id: 'w5', q: 0, topic: 'Denklemler', src: 'TYT Deneme 4 · Soru 64', date: '11 Eki', kind: 'Dikkat hatası', your: 'B' },
  ];

  // Upcoming exams are placed on the next Sundays so the demo stays current.
  function nextDow(dow, h, m, plusWeeks = 0) {
    const now = new Date(), d = new Date(now);
    d.setDate(d.getDate() + ((dow - d.getDay() + 7) % 7) + plusWeeks * 7);
    d.setHours(h, m, 0, 0);
    if (d <= now) d.setDate(d.getDate() + 7);
    return d;
  }
  const UPCOMING = [
    { id: 'u1', name: 'Türkiye Geneli TYT 6', type: 'TYT', date: nextDow(0, 10, 15), dur: 165, q: 120, reg: true },
    { id: 'u2', name: 'AYT Sayısal Deneme 3', type: 'AYT', date: nextDow(0, 10, 15, 1), dur: 180, q: 80, reg: false },
    { id: 'u3', name: 'Türkiye Geneli TYT 7', type: 'TYT', date: nextDow(0, 10, 15, 2), dur: 165, q: 120, reg: false },
  ];
  const PRACTICE = [
    { id: 'p1', name: 'Mini TYT Denemesi', type: 'Mini', q: 5, dur: 10, desc: 'Her dersten karma 5 soru', play: true },
    { id: 'p2', name: 'Matematik Branş Denemesi', type: 'Branş', q: 40, dur: 50, desc: 'TYT Temel Matematik' },
    { id: 'p3', name: 'Fen Bilimleri Branş Denemesi', type: 'Branş', q: 20, dur: 25, desc: 'Fizik, Kimya, Biyoloji' },
    { id: 'p4', name: 'Paragraf Hız Testi', type: 'Konu', q: 20, dur: 20, desc: 'Türkçe · Paragraf' },
  ];

  const NOTIFS = [
    { t: 'Türkiye Geneli TYT 6 kaydın alındı', s: 'Sınavdan 15 dakika önce hatırlatacağız.', time: '2 sa' },
    { t: 'Türkiye Geneli TYT 5 sonuçların açıklandı', s: `${fmt(LAST.net)} net · Türkiye ${fmt(LAST.rank, 0)}.`, time: '1 gün' },
    { t: 'Yeni video çözümler', s: 'Fizik · Elektrik konusuna 12 video eklendi.', time: '2 gün' },
  ];

  // Study minutes for the last 18 weeks (seeded, so every visit shows the same calendar).
  const HEAT = (() => {
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const days = [], today = new Date(); today.setHours(0, 0, 0, 0);
    const end = new Date(today); end.setDate(end.getDate() + (6 - ((end.getDay() + 6) % 7))); // to Sunday
    const start = new Date(end); start.setDate(start.getDate() - 18 * 7 + 1);
    for (let d = new Date(start), i = 0; d <= end; d.setDate(d.getDate() + 1), i++) {
      const date = new Date(d), back = Math.round((today - date) / 864e5);
      let min = 0;
      if (back < 0) min = -1;                       // future
      else if (back < 12) min = 70 + Math.round(rnd() * 150);
      else if (back === 12) min = 0;
      else min = rnd() < 0.18 ? 0 : Math.round(20 + rnd() * 200);
      days.push({ date, min });
    }
    return days;
  })();
  function heatStats() {
    const past = HEAT.filter((d) => d.min >= 0);
    let streak = 0;
    for (let i = past.length - 1; i >= 0 && past[i].min > 0; i--) streak++;
    const week = past.slice(-7).reduce((a, d) => a + d.min, 0);
    const prevWeek = past.slice(-14, -7).reduce((a, d) => a + d.min, 0);
    const active = past.filter((d) => d.min > 0).length;
    const total = past.reduce((a, d) => a + d.min, 0);
    return { streak, week, prevWeek, active, total, days: past.length };
  }
  const hrs = (m) => `${Math.floor(m / 60)} sa ${m % 60} dk`;

  /* ---------------- question bank (tools/soru_cikar.py → data/soru-bankasi.js) ---------------- */
  const BANK = (window.DSYaprakTest && window.DSYaprakTest.bank()) || window.DS_SORU_BANKASI || { kaynaklar: [], sorular: [] };
  BANK.byId = Object.fromEntries(BANK.sorular.map((q) => [q.id, q]));
  BANK.src = Object.fromEntries(BANK.kaynaklar.map((k) => [k.id, k]));
  function dersKey(name) {
    const n = String(name || '').toLocaleLowerCase('tr');
    if (/ingilizce|almanca|fransızca|arapça|rusça|yabancı dil|english/.test(n)) return 'dil';
    if (n.includes('türkçe') || n.includes('edebiyat')) return 'tr';
    if (n.includes('matematik') || n.includes('geometri')) return 'mat';
    if (/fen|fizik|kimya|biyoloji/.test(n)) return 'fen';
    if (/sosyal|tarih|coğrafya|felsefe|din/.test(n)) return 'sos';
    return 'all';
  }
  // One question shape for the player: built-in sample questions and bank questions.
  const qItem = (q, i) => q && { s: q.s, t: q.t, o: q.o, a: q.a, sol: q.sol || [], ref: { q: i } };
  const bankItem = (b) => {
    if (!b) return null;
    const g = b.grup && BANK.gruplar ? BANK.gruplar[b.grup] : null;
    return {
      s: dersKey(b.ders), t: b.metin, ust: b.metin_ust, alt: b.metin_alt, fig: b.sekil, img: b.gorsel, o: b.secenekler || [],
      figW: b.sekil_pt && b.yazi_pt ? Math.round(b.sekil_pt * 15.5 / b.yazi_pt) : null, imgOnly: !!b.gorsel_goster,
      parts: b.parcalar ? b.parcalar.map((p) => (p.sekil ? { fig: p.sekil, w: b.yazi_pt ? Math.round(p.sekil_pt * 15.5 / b.yazi_pt) : null } : { t: p.metin })) : null,
      a: b.cevap ? L5.indexOf(b.cevap) : null, sol: b.cozum ? [b.cozum] : [], konu: b.konu, no: b.no, yon: b.yonerge || (g && g.yonerge) || null,
      passage: g ? g.metin : null, passageImg: g && g.gorsel ? g.gorsel : null, ref: { bank: b.id },
    };
  };
  const wq = (w) => (w.bank ? bankItem(BANK.byId[w.bank]) : qItem(QUESTIONS[w.q], w.q));
  const minutesFor = (n) => Math.max(5, Math.round(n * 1.5));

  /* ---------------- packages (sample prices; payments are not live yet) ---------------- */
  const DAY = 864e5;
  const PACKAGES = [
    { id: 'yks-pro', sinav: 'YKS', ad: 'YKS Pro', desc: 'TYT ve AYT için eksiksiz hazırlık', aylik: 349, yillik: 2490, featured: true,
      ozellik: ['Tüm TYT ve AYT denemeleri', 'Her ay Türkiye geneli deneme', 'Her soruya video çözüm', 'Sınırsız yaprak test oluşturma', 'Konu analizi ve çalışma planı'] },
    { id: 'yks-deneme', sinav: 'YKS', ad: 'YKS Deneme Paketi', desc: 'Yalnızca deneme çözmek isteyenler için', aylik: 149, yillik: 990,
      ozellik: ['20 TYT + 10 AYT deneme', 'Türkiye geneli sıralama', 'Video çözümler'] },
    { id: 'lgs-pro', sinav: 'LGS', ad: 'LGS Pro', desc: '8. sınıf öğrencileri için', aylik: 249, yillik: 1790,
      ozellik: ['Tüm LGS denemeleri', 'Sözel ve sayısal bölüm denemeleri', 'Kazanım bazlı analiz', 'Sınırsız yaprak test'] },
    { id: 'kpss-pro', sinav: 'KPSS', ad: 'KPSS Pro', desc: 'GY-GK, Eğitim Bilimleri ve ÖABT', aylik: 299, yillik: 2190,
      ozellik: ['Lisans, önlisans ve ortaöğretim denemeleri', 'Puan türüne göre tahmini puan', 'Video çözümler', 'Sınırsız yaprak test'] },
    { id: 'ales-dgs', sinav: 'Diğer', ad: 'ALES · DGS Paketi', desc: 'Sayısal ve sözel denemeler', aylik: 199, yillik: 1390,
      ozellik: ['ALES ve DGS denemeleri', 'Türkiye geneli sıralama', 'Video çözümler'] },
    { id: 'yaprak', sinav: 'Tümü', ad: 'Yaprak Test Paketi', desc: 'Konu tekrarı için sınırsız test', aylik: 99, yillik: 690,
      ozellik: ['Sınırsız yaprak test oluşturma', 'Görsel veya metin dizgisi', 'PDF çıktısı ve cevap anahtarı'] },
  ];
  const MY_PACKAGES = [
    { id: 'yks-pro', donem: 'yillik', bas: new Date(Date.now() - 323 * DAY), bit: new Date(Date.now() + 42 * DAY), deneme: [8, 40] },
    { id: 'yaz-kampi', ad: 'Yaz Kampı Paketi', donem: 'tek', bas: new Date(Date.now() - 140 * DAY), bit: new Date(Date.now() - 80 * DAY),
      ozellik: ['8 haftalık TYT kampı', '16 deneme', 'Haftalık canlı soru çözümü'] },
  ];
  const orderNo = (d, n) => `DS-${d.getFullYear()}-${n}`;
  const PAYMENTS = [
    { tarih: MY_PACKAGES[0].bas, no: orderNo(MY_PACKAGES[0].bas, '104812'), paket: 'YKS Pro · Yıllık', yontem: 'Kredi kartı', tutar: 2490, durum: 'Ödendi' },
    { tarih: MY_PACKAGES[1].bas, no: orderNo(MY_PACKAGES[1].bas, '087305'), paket: 'Yaz Kampı Paketi', yontem: 'Kredi kartı', tutar: 490, durum: 'Ödendi' },
    { tarih: new Date(MY_PACKAGES[1].bas.getTime() - 12 * DAY), no: orderNo(MY_PACKAGES[1].bas, '085119'), paket: 'YKS Deneme Paketi · Aylık', yontem: 'Banka kartı', tutar: 149, durum: 'İade edildi' },
  ];
  const price = (n) => `${fmt(n, 0)} ₺`;

  /* ---------------- state ---------------- */
  const state = {
    exam: LAST.id, analizSubj: 'mat', eksikFilter: 'all', wrongFilter: 'Tümü', examTab: 'pratik', rankTab: 'tr',
    histFilter: 'Tümü', pkgTab: 'Tümü', billing: 'yillik',
    b: { sec: [], adim: 1, adet: 10, branslar: [] },          // Yaprak Test Oluştur: sources, step, question count, branches
    dn: { sec: [], adim: 1, branslar: [] },   // Denemelerim → Hemen çöz: chosen denemeler and branches (none = all)
  };
  let user = null;
  let charts = [];      // redraw callbacks for the current view
  // personal data, loaded per account in loadProgress()
  let upcomingReg = {}, wrongs = [], profile = null, plan = null;
  /* ---------------- per-user progress: created tests, seen questions, activity ---------------- */
  // A question the user has been given (in a test they created or a deneme they started) is never offered again.
  const ukey = (name) => `ds-${name}:${(user && user.email) || 'misafir'}`;
  let ytests = [], seen = { used: {}, solved: {} }, activity = [];
  // Data that earlier versions kept per browser moves (once) to the account that opens the panel first.
  function userData(name, fallback) {
    const own = store.get(ukey(name), undefined);
    if (own !== undefined) return own;
    const old = store.get('ds-' + name, undefined);
    if (old !== undefined) {
      store.set(ukey(name), old);
      try { localStorage.removeItem('ds-' + name); } catch (e) { /* storage unavailable */ }
      return old;
    }
    return fallback;
  }
  function loadProgress() {
    profile = userData('profile', null);
    wrongs = userData('wrongs', WRONG_DEFAULT);
    upcomingReg = userData('reg', Object.fromEntries(UPCOMING.map((u) => [u.id, u.reg])));
    plan = loadPlan();
    ytests = store.get(ukey('yaprak-tests'), []);
    seen = Object.assign({ used: {}, solved: {} }, store.get(ukey('seen'), {}));
    activity = store.get(ukey('activity'), []);
  }
  const saveTests = () => store.set(ukey('yaprak-tests'), ytests);
  const saveSeen = () => store.set(ukey('seen'), seen);
  const isSeen = (id) => !!(seen.used[id] || seen.solved[id]);
  function markUsed(ids) { const t = Date.now(); ids.forEach((id) => { seen.used[id] = seen.used[id] || t; }); saveSeen(); }
  function markSolved(ids) { const t = Date.now(); ids.forEach((id) => { seen.solved[id] = t; seen.used[id] = seen.used[id] || t; }); saveSeen(); }
  function logActivity(ev) {
    activity.unshift({ id: uid(), at: new Date().toISOString(), ...ev });
    activity = activity.slice(0, 60);
    store.set(ukey('activity'), activity);
  }
  function saveHistory(entry) {
    const h = userData('history', []);
    h.unshift({ id: 'h-' + uid(), tarih: new Date().toISOString(), ...entry });
    store.set(ukey('history'), h.slice(0, 80));
  }
  // Which question pools belong to the user's target exam (Ayarlar → Hedef sınav).
  const EXAM_POOLS = { YKS: ['TYT', 'AYT'], YDS: ['YDS'], 'YÖKDİL': ['YÖKDİL', 'YDS'], LGS: ['LGS'], KPSS: ['KPSS'], ALES: ['ALES'], DGS: ['DGS'], TUS: ['TUS'], DUS: ['DUS'], HMGS: ['HMGS'], 'MSÜ': ['MSÜ', 'TYT'], 'MEB-AGS': ['MEB-AGS'] };
  const poolSinav = () => EXAM_POOLS[user.exam] || [user.exam];
  const srcOrder = (q) => BANK.kaynaklar.findIndex((k) => k.id === q.kaynak);
  const srcRank = (q) => ((BANK.src[q.kaynak] || {}).tur === 'deneme' ? 1000 : 0) + srcOrder(q);
  // Questions that share a passage (cloze, reading) are taken together or not at all.
  function pickQuestions(fresh, n) {
    const out = [], done = new Set();
    for (const q of fresh) {
      if (out.length >= n) break;
      if (done.has(q.id)) continue;
      const unit = q.grup ? fresh.filter((x) => x.grup === q.grup) : [q];
      unit.forEach((x) => done.add(x.id));
      if (out.length + unit.length <= n) out.push(...unit);
    }
    return out;
  }
  const dkFor = (qs) => Math.max(5, Math.round(qs.reduce((a, q) => a + ((BANK.src[q.kaynak] || {}).dk_soru || 1.5), 0)));
  const pad2 = (n) => String(n).padStart(2, '0');

  /* ---------------- plan (shared by overview + plan view) ---------------- */
  const weekStart = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; })();
  const todayIdx = (new Date().getDay() + 6) % 7; // 0 = Monday
  const PLAN_TEMPLATE = [
    [['mat', 'Yüzde problemleri · 30 soru'], ['tr', 'Paragraf · 20 soru'], ['fen', 'Elektrik konu tekrarı']],
    [['mat', 'Fonksiyonlar · konu anlatımı'], ['sos', 'İklim · 25 soru'], ['tr', 'Yazım kuralları tekrarı']],
    [['fen', 'Mol kavramı · video + 20 soru'], ['mat', 'Yüzde problemleri · 30 soru'], ['all', 'Yanlış defteri tekrarı']],
    [['tr', 'Paragraf · 25 soru'], ['mat', 'Üçgenler · 20 soru'], ['fen', 'Hareket · 15 soru']],
    [['mat', 'Matematik branş denemesi'], ['sos', 'Osmanlı kuruluş tekrarı']],
    [['all', 'Mini TYT denemesi'], ['fen', 'Hücre · 20 soru']],
    [['all', 'Türkiye Geneli TYT 6 · 10:15'], ['all', 'Deneme analizi + yanlışlar']],
  ];
  function loadPlan() {
    const key = weekStart.toISOString().slice(0, 10);
    const saved = userData('plan', null);
    if (saved && saved.week === key) return saved;
    const days = PLAN_TEMPLATE.map((list, di) => list.map(([s, t], ti) => ({ id: uid(), s, t, done: di < todayIdx || (di === todayIdx && ti < 2) })));
    const plan = { week: key, days };
    store.set(ukey('plan'), plan);
    return plan;
  }
  const savePlan = () => store.set(ukey('plan'), plan);
  const findTask = (id) => { for (const d of plan.days) { const t = d.find((x) => x.id === id); if (t) return t; } return null; };

  /* ---------------- UI primitives ---------------- */
  function toast(msg) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `${icon('check')}<span>${esc(msg)}</span>`;
    $('#toasts').appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 260); }, 2600);
  }
  const subjChip = (s) => `<span class="chip" style="--c:${SUBJ[s].c}"><i></i>${SUBJ[s].name}</span>`;
  const delta = (v, txt, invert = false) => {
    const good = invert ? v < 0 : v > 0;
    if (v === 0) return `<span class="delta muted">—</span>`;
    return `<span class="delta ${good ? 'up' : 'down'}">${icon(good ? 'up' : 'down')}${txt}</span>`;
  };
  const track = (p, c, avg) => `<div class="track" style="--c:${c}"><i data-w="${Math.max(0, Math.min(100, p))}%"></i>${avg != null ? `<em style="--avg:${avg}%"></em>` : ''}</div>`;
  const ringSvg = (p, label, sub) => {
    const C = 2 * Math.PI * 63;
    return `<div class="ring"><svg viewBox="0 0 150 150"><circle class="r-bg" cx="75" cy="75" r="63"/><circle class="r-fg" cx="75" cy="75" r="63" stroke-dasharray="${C}" stroke-dashoffset="${C}" data-ring="${C * (1 - p / 100)}"/></svg><div class="ring-in"><b>${label}</b><span>${sub}</span></div></div>`;
  };
  const countAttr = (v, d, pre = '', suf = '') => `data-count="${v}" data-dec="${d ?? dec(v)}" data-pre="${esc(pre)}" data-suf="${esc(suf)}"`;

  function animateIn(root) {
    // numbers
    $$('[data-count]', root).forEach((el) => {
      const to = parseFloat(el.dataset.count), d = +el.dataset.dec, pre = el.dataset.pre || '', suf = el.dataset.suf || '';
      const out = (v) => { el.textContent = pre + fmt(v, d) + suf; };
      if (reduce) return out(to);
      const t0 = performance.now(), dur = 1100;
      const step = (now) => { const k = Math.min(1, (now - t0) / dur); out(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
    // bars + rings (start from 0 so the CSS transition plays)
    setTimeout(() => {
      $$('[data-w]', root).forEach((i) => { i.style.width = i.dataset.w; });
      $$('[data-h]', root).forEach((i) => { i.style.height = i.dataset.h; });
      $$('[data-ring]', root).forEach((c) => { c.style.strokeDashoffset = c.dataset.ring; });
    }, 40);
  }

  /* ---------------- charts ---------------- */
  function lineChart(host, { labels, values, min, max, step, target, tip, animate = true }) {
    const W = Math.max(260, host.clientWidth), H = host.clientHeight || 260;
    const P = { l: 34, r: 18, t: 26, b: 30 };
    const n = values.length;
    const X = (i) => P.l + (n === 1 ? 0 : (i * (W - P.l - P.r)) / (n - 1));
    const Y = (v) => P.t + ((max - v) / (max - min)) * (H - P.t - P.b);
    let grid = '';
    for (let v = min; v <= max + 1e-9; v += step) {
      grid += `<line class="grid-line" x1="${P.l}" x2="${W - P.r}" y1="${Y(v)}" y2="${Y(v)}"/><text class="ax-label" x="${P.l - 8}" y="${Y(v) + 4}" text-anchor="end">${fmt(v, 0)}</text>`;
    }
    const pts = values.map((v, i) => [X(i), Y(v)]);
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < n; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], cx = (x0 + x1) / 2; d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`; }
    const area = `${d} L${pts[n - 1][0]},${H - P.b} L${pts[0][0]},${H - P.b} Z`;
    const gid = 'ag' + uid();
    const [lx, ly] = pts[n - 1];
    const colW = (W - P.l - P.r) / Math.max(1, n - 1);
    host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Net gelişimi grafiği">
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--brand);stop-opacity:.26"/><stop offset="1" style="stop-color:var(--brand);stop-opacity:0"/></linearGradient></defs>
      ${grid}
      ${target != null ? `<line class="lc-target" x1="${P.l}" x2="${W - P.r}" y1="${Y(target)}" y2="${Y(target)}"/><text class="lc-target-label" x="${W - P.r}" y="${Y(target) - 7}" text-anchor="end">Hedef ${fmt(target)}</text>` : ''}
      <path class="lc-area" d="${area}" fill="url(#${gid})"/>
      <path class="lc-line" d="${d}"/>
      <circle class="lc-halo" cx="${lx}" cy="${ly}" r="10"/>
      ${pts.map(([x, y], i) => `<circle class="lc-dot${i === n - 1 ? ' last' : ''}" cx="${x}" cy="${y}" r="${i === n - 1 ? 5.5 : 4}"/>`).join('')}
      <text class="lc-val" x="${lx}" y="${ly - 15}" text-anchor="middle">${fmt(values[n - 1])}</text>
      ${labels.map((l, i) => `<text class="ax-label" x="${X(i)}" y="${H - 8}" text-anchor="middle">${l}</text>`).join('')}
      ${pts.map(([x], i) => `<rect data-i="${i}" x="${x - colW / 2}" y="0" width="${colW}" height="${H}" fill="transparent"/>`).join('')}
    </svg><div class="tip"></div>`;
    const tipEl = $('.tip', host);
    $$('rect[data-i]', host).forEach((r) => {
      const show = () => { const i = +r.dataset.i; tipEl.innerHTML = tip(i); tipEl.style.left = pts[i][0] + 'px'; tipEl.style.top = pts[i][1] + 'px'; tipEl.classList.add('on'); };
      r.addEventListener('pointerenter', show);
      r.addEventListener('pointerdown', show);
      r.addEventListener('pointerleave', () => tipEl.classList.remove('on'));
    });
    if (animate && !reduce) {
      const line = $('.lc-line', host), ar = $('.lc-area', host), L = line.getTotalLength();
      line.style.strokeDasharray = L; line.style.strokeDashoffset = L; ar.style.opacity = 0;
      $$('.lc-dot, .lc-val, .lc-halo', host).forEach((el) => { el.style.opacity = 0; });
      line.getBoundingClientRect();
      line.style.transition = 'stroke-dashoffset 1.5s cubic-bezier(.2,.8,.2,1)';
      line.style.strokeDashoffset = 0;
      ar.style.transition = 'opacity 1s .6s'; ar.style.opacity = 1;
      $$('.lc-dot', host).forEach((el, i) => { el.style.transition = `opacity .3s ${0.15 + (i / n) * 1.2}s`; el.style.opacity = 1; });
      $$('.lc-val, .lc-halo', host).forEach((el) => { el.style.transition = 'opacity .4s 1.4s'; el.style.opacity = ''; });
    }
  }

  function sparkline(values, invert = false) {
    const min = Math.min(...values), max = Math.max(...values), n = values.length;
    const pts = values.map((v, i) => [(i / (n - 1)) * 100, 30 - ((invert ? max - v : v - min) / (max - min || 1)) * 26]);
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
    return `<svg viewBox="0 0 100 34" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" fill="none" style="stroke:var(--brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/><circle cx="${pts[n - 1][0]}" cy="${pts[n - 1][1]}" r="2.6" style="fill:var(--brand)"/></svg>`;
  }

  function distChart(host, bins, mine, animate = true) {
    const W = Math.max(260, host.clientWidth), H = host.clientHeight || 200;
    const P = { l: 8, r: 8, t: 24, b: 24 };
    const max = Math.max(...bins), bw = (W - P.l - P.r) / bins.length;
    const myBin = Math.min(bins.length - 1, Math.floor(mine / 10));
    const xMine = P.l + (mine / 120) * (W - P.l - P.r);
    host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Net dağılımı">
      ${bins.map((b, i) => { const h = (b / max) * (H - P.t - P.b); return `<rect class="bin${i === myBin ? ' me' : ''}" x="${P.l + i * bw + 3}" width="${bw - 6}" rx="5" y="${animate && !reduce ? H - P.b : H - P.b - h}" height="${animate && !reduce ? 0 : h}" data-y="${H - P.b - h}" data-hh="${h}"/>`; }).join('')}
      ${bins.map((_, i) => `<text class="ax-label" x="${P.l + i * bw + bw / 2}" y="${H - 6}" text-anchor="middle">${i * 10}</text>`).join('')}
      <line class="me-line" x1="${xMine}" x2="${xMine}" y1="${P.t - 6}" y2="${H - P.b}"/>
      <text class="me-label" x="${Math.min(W - 30, xMine)}" y="${P.t - 10}" text-anchor="middle">Sen · ${fmt(mine)}</text>
    </svg>`;
    if (animate && !reduce) requestAnimationFrame(() => $$('rect.bin', host).forEach((r, i) => { r.style.transitionDelay = i * 40 + 'ms'; r.setAttribute('y', r.dataset.y); r.setAttribute('height', r.dataset.hh); }));
  }

  /* ---------------- views ---------------- */
  const greet = () => { const h = new Date().getHours(); return h < 5 ? 'İyi geceler' : h < 12 ? 'Günaydın' : h < 18 ? 'İyi günler' : 'İyi akşamlar'; };

  const ACT = { cozuldu: ['check', 'Çözüldü', 'good'], olusturuldu: ['filepen', 'Oluşturuldu', 'blue'], indirildi: ['download', 'PDF indirildi', 'warn'] };
  function ago(iso) {
    const sec = (Date.now() - new Date(iso)) / 1000;
    if (sec < 60) return 'az önce';
    if (sec < 3600) return `${Math.floor(sec / 60)} dk önce`;
    if (sec < 86400) return `${Math.floor(sec / 3600)} sa önce`;
    const d = Math.floor(sec / 86400);
    return d === 1 ? 'dün' : `${d} gün önce`;
  }
  function activityCard() {
    const list = activity.slice(0, 6);
    return `<section class="card s-12">
      <div class="card-h"><div><h2>Geçmiş</h2><p>En son çözdüğün, oluşturduğun ve indirdiğin testler</p></div><a class="link-btn" href="#yaprak-testler">Tüm testler</a></div>
      ${list.length ? `<ul class="act">${list.map((a, i) => { const [ic, lbl, cls] = ACT[a.tur] || ACT.olusturuldu; return `<li style="animation-delay:${i * 50}ms"><span class="act-ic ${cls}">${icon(ic)}</span><span class="act-txt"><b>${esc(a.ad)}</b><span>${esc(a.detay || '')}</span></span><span class="act-meta"><span class="chip ${cls}">${lbl}${a.net != null ? ' · ' + fmt(a.net) + ' net' : ''}</span><small>${ago(a.at)}</small></span></li>`; }).join('')}</ul>`
        : `<div class="act-empty"><p class="muted">Henüz bir test çözmedin. İlk yaprak testini oluşturduğunda burada görünecek.</p><a class="btn btn-yellow btn-sm" href="#test-olustur">${icon('plus')} Yaprak test oluştur</a></div>`}
    </section>`;
  }

  function kpi({ ic, label, value, d, pre = '', suf = '', small = '', deltaHtml, foot, spark }) {
    return `<article class="card kpi s-3">
      <div class="kpi-top"><span class="kpi-ic">${icon(ic)}</span>${deltaHtml || ''}</div>
      <p class="kpi-label">${label}</p>
      <p class="kpi-val"><span ${countAttr(value, d, pre, suf)}>${pre}${fmt(value, d ?? dec(value))}${suf}</span> ${small ? `<small>${small}</small>` : ''}</p>
      ${spark ? `<div class="spark">${spark}</div>` : ''}
      <p class="kpi-foot">${foot}</p>
    </article>`;
  }

  function examTip(i) {
    const e = EXAMS[i];
    return `${e.name}<br><b>${fmt(e.net)} net</b> · ${dShort(e.d)}<br>${SK.map((k) => `${SUBJ[k].short} ${fmt(e[k])}`).join(' · ')}`;
  }

  function vOverview() {
    const up = UPCOMING[0];
    const today = plan.days[todayIdx];
    const weak = [...TOPICS].sort((a, b) => a.p - b.p).slice(0, 5);
    const hs = heatStats();
    const goalNet = profile?.goalNet || 100;
    const gain = (LAST.net - EXAMS[0].net) / (EXAMS.length - 1);
    const left = Math.max(0, goalNet - LAST.net);
    const pct = Math.min(100, (LAST.net / goalNet) * 100);
    const weekQ = [410, 455, 520, 480, 575, 642];
    return `<div class="view">
      <section class="card hero-card s-12">
        <div>
          <h2>${greet()}, ${esc(user.first)}</h2>
          <p>Son denemede netini <b>${fmt(LAST.net - PREV.net)}</b> artırdın. Bu hafta <b>Yüzde Problemleri</b> ve <b>Fizik · Elektrik</b> konularına odaklanman öneriliyor.</p>
          <span class="streak">${icon('flame')} ${hs.streak} günlük çalışma serisi</span>
        </div>
        <div class="next-exam">
          <small>Sıradaki deneme</small>
          <h3>${up.name} · ${DAYS[up.date.getDay()]} ${hm(up.date)}</h3>
          <div class="countdown" data-countdown="${up.date.toISOString()}">
            <div><b data-cd="d">0</b><span>gün</span></div><div><b data-cd="h">00</b><span>saat</span></div>
            <div><b data-cd="m">00</b><span>dakika</span></div><div><b data-cd="s">00</b><span>saniye</span></div>
          </div>
          <button class="btn btn-yellow btn-play" data-action="start-mini">${icon('play')} Şimdi mini deneme çöz</button>
        </div>
      </section>

      ${kpi({ ic: 'chart', label: 'Son deneme neti', value: LAST.net, small: '/ 120', deltaHtml: delta(LAST.net - PREV.net, `${fmt(LAST.net - PREV.net)} net`), foot: `Türkiye ortalaması ${fmt(AVG_TOTAL, 1)} net`, spark: sparkline(EXAMS.map((e) => e.net)) })}
      ${kpi({ ic: 'sparkle', label: 'Tahmini TYT puanı (yaklaşık)', value: Math.round(estScore(LAST.net)), d: 0, deltaHtml: delta(1, `${fmt(Math.round(estScore(LAST.net) - estScore(PREV.net)), 0)} puan`), foot: 'Son deneme netine göre hesaplanır', spark: sparkline(EXAMS.map((e) => estScore(e.net))) })}
      ${kpi({ ic: 'trophy', label: 'Türkiye sıralaması', value: LAST.rank, d: 0, suf: '.', small: `/ ${fmt(LAST.total, 0)}`, deltaHtml: delta(1, `${fmt(PREV.rank - LAST.rank, 0)} sıra`), foot: `İlk %${fmt((LAST.rank / LAST.total) * 100, 1)} içindesin`, spark: sparkline(EXAMS.map((e) => e.rank), true) })}
      ${kpi({ ic: 'check', label: 'Bu hafta çözülen soru', value: weekQ[weekQ.length - 1], d: 0, deltaHtml: delta(1, `%${fmt(Math.round((weekQ[5] / weekQ[4] - 1) * 100), 0)}`), foot: `Çalışma süresi: ${hrs(hs.week)}`, spark: sparkline(weekQ) })}

      ${activityCard()}

      <section class="card s-8">
        <div class="card-h"><div><h2>Net gelişimi</h2><p>Son ${EXAMS.length} TYT denemesi · hedef çizgisi ${fmt(goalNet)} net</p></div>
          <div class="legend"><span><i style="--c:var(--brand)"></i>Toplam net</span><span><i class="dash"></i>Hedef</span></div></div>
        <div class="chart" id="netChart"></div>
      </section>

      <section class="card s-4 goal">
        <div class="card-h" style="width:100%;margin-bottom:4px"><h2>Hedefim</h2><a class="link-btn" href="#ayarlar">Düzenle</a></div>
        ${ringSvg(pct, `%${fmt(pct, 0)}`, `${fmt(LAST.net)} / ${fmt(goalNet)} net`)}
        <h3>${esc(profile?.goalText || 'Boğaziçi Üniversitesi · Bilgisayar Mühendisliği')}</h3>
        <div class="goal-stats">
          <div><small>Kalan</small><b>${fmt(left)} net</b></div>
          <div><small>Ortalama artış</small><b>+${fmt(Math.round(gain * 4) / 4)} / deneme</b></div>
        </div>
        <p class="small muted">Bu hızla yaklaşık ${Math.max(1, Math.ceil(left / gain))} deneme sonra hedefine ulaşırsın.</p>
      </section>

      <section class="card s-4 wrap-md">
        <div class="card-h"><div><h2>Ders bazlı netler</h2><p>${LAST.name}</p></div></div>
        <div class="sbar">
          ${SK.map((k) => `<div class="sbar-row"><div class="sbar-top"><b><i style="--c:${SUBJ[k].c}"></i>${SUBJ[k].name}</b><span><strong>${fmt(LAST[k])}</strong> / ${SUBJ[k].q}</span></div>${track((LAST[k] / SUBJ[k].q) * 100, SUBJ[k].c, (SUBJ[k].avg / SUBJ[k].q) * 100)}</div>`).join('')}
          <p class="sbar-note">Çizgi işareti: Türkiye ortalaması</p>
        </div>
      </section>

      <section class="card s-4 wrap-md">
        <div class="card-h"><div><h2>Bugünün görevleri</h2><p>${DAYS[new Date().getDay()]}, ${dShort(new Date())}</p></div><a class="link-btn" href="#plan">Plana git</a></div>
        <div class="task-progress" style="margin-bottom:12px"><span id="taskCount">${today.filter((t) => t.done).length}/${today.length}</span><div class="mini-track"><i id="taskBar" data-w="${today.length ? (today.filter((t) => t.done).length / today.length) * 100 : 0}%"></i></div></div>
        <ul class="tasks">${today.map(taskItem).join('') || '<li class="muted small">Bugün için görev yok. Plana görev ekleyebilirsin.</li>'}</ul>
      </section>

      <section class="card s-4">
        <div class="card-h"><div><h2>Konu eksiklerim</h2><p>En düşük başarı oranları</p></div><a class="link-btn" href="#eksikler">Tümü</a></div>
        <ul class="weak">${weak.map((t) => `<li><span class="w-name">${t.n}<small>${SUBJ[t.s].name} · ${t.q} soru çözüldü</small></span><span class="pct ${level(t.p)}">%${t.p}</span>${track(t.p, `var(--${level(t.p)})`)}</li>`).join('')}</ul>
      </section>

      <section class="card s-8">
        <div class="card-h"><div><h2>Çalışma takvimi</h2><p>Son 18 hafta · günlük çalışma süresi</p></div></div>
        ${heatmap()}
        <div class="heat-stats">
          <div><small>Bu hafta</small><b>${hrs(hs.week)}</b></div>
          <div><small>Aktif gün</small><b>${hs.active} / ${hs.days}</b></div>
          <div><small>Toplam</small><b>${Math.round(hs.total / 60)} saat</b></div>
        </div>
      </section>

      <section class="card s-4">
        <div class="card-h"><div><h2>Sıralamam</h2><p>${LAST.name}</p></div><a class="link-btn" href="#siralama">Detay</a></div>
        <p class="rank-big"><span ${countAttr(LAST.rank, 0, '', '.')}>${fmt(LAST.rank, 0)}.</span> <small>/ ${fmt(LAST.total, 0)}</small></p>
        <p class="small muted">Türkiye geneli · ${delta(1, `${fmt(PREV.rank - LAST.rank, 0)} sıra yükseldin`)}</p>
        <div class="rank-rows">
          <div><span>İl (${esc(user.city)})</span><b>512. / 5.904</b></div>
          <div><span>Okul</span><b>3. / 86</b></div>
          <div><span>Yüzdelik dilim</span><b>İlk %${fmt((LAST.rank / LAST.total) * 100, 1)}</b></div>
        </div>
      </section>

      <section class="card s-5">
        <div class="card-h"><div><h2>Yaklaşan denemeler</h2><p>Kayıt olduğun denemeler için hatırlatma alırsın</p></div><a class="link-btn" href="#denemeler">Tümü</a></div>
        <ul class="upc">${UPCOMING.map(upcItem).join('')}</ul>
      </section>

      <section class="card s-7">
        <div class="card-h"><div><h2>Son denemeler</h2><p>Satıra tıklayarak detaylı analizi aç</p></div></div>
        <div class="table-wrap"><table class="t"><thead><tr><th>Deneme</th><th>Tarih</th>${SK.map((k) => `<th class="r">${SUBJ[k].short}</th>`).join('')}<th class="r">Net</th><th class="r">Sıra</th></tr></thead>
        <tbody>${EXAMS.slice(-5).reverse().map((e) => `<tr data-action="open-exam" data-id="${e.id}" style="cursor:pointer"><td><b>${e.name}</b></td><td>${dShort(e.d)}</td>${SK.map((k) => `<td class="r">${fmt(e[k])}</td>`).join('')}<td class="r"><b>${fmt(e.net)}</b></td><td class="r">${fmt(e.rank, 0)}.</td></tr>`).join('')}</tbody></table></div>
      </section>
    </div>`;
  }
  function afterOverview(animate) {
    const host = $('#netChart');
    const goalNet = profile?.goalNet || 100;
    const draw = (a) => lineChart(host, { labels: EXAMS.map((e) => e.short), values: EXAMS.map((e) => e.net), min: 60, max: Math.max(100, Math.ceil(goalNet / 10) * 10), step: 10, target: goalNet, tip: examTip, animate: a });
    draw(animate);
    charts.push(() => draw(false));
  }
  const taskItem = (t) => `<li><label class="task${t.done ? ' done' : ''}" data-task="${t.id}"><input type="checkbox" ${t.done ? 'checked' : ''} aria-label="${esc(t.t)}"><span class="cbox">${icon('check')}</span><span class="task-txt"><b>${esc(t.t)}</b><span>${SUBJ[t.s].name}</span></span></label></li>`;
  const upcItem = (u) => `<li><span class="datebox"><b>${u.date.getDate()}</b><span>${MONTHS[u.date.getMonth()]}</span></span><span class="upc-txt"><b>${u.name}</b><span>${DAYS[u.date.getDay()]} ${hm(u.date)} · ${u.dur} dk · ${u.q} soru</span></span>${upcomingReg[u.id] ? `<button class="chip good" data-action="unregister" data-id="${u.id}" title="Kaydı iptal et">${icon('check')} Kayıtlı</button>` : `<button class="btn btn-soft btn-sm" data-action="register" data-id="${u.id}">Kaydol</button>`}</li>`;

  function heatmap() {
    const lv = (m) => (m <= 0 ? 0 : m < 60 ? 1 : m < 120 ? 2 : m < 180 ? 3 : 4);
    return `<div class="heat-wrap"><div class="heat-box"><div class="heat-days">${DAYS_S.map((d, i) => `<span>${i % 2 === 0 ? d : ''}</span>`).join('')}</div>
      <div class="heat">${HEAT.map((d, i) => `<i data-l="${d.min < 0 ? 0 : lv(d.min)}" style="animation-delay:${Math.floor(i / 7) * 18}ms${d.min < 0 ? ';opacity:.35' : ''}" title="${dShort(d.date)} · ${d.min < 0 ? 'henüz değil' : d.min ? hrs(d.min) : 'çalışma yok'}"></i>`).join('')}</div></div></div>
      <div class="heat-foot"><span>${dShort(HEAT[0].date)} – ${dShort(HEAT[HEAT.length - 1].date)}</span><span class="heat-scale">Az <i style="background:var(--surface-2);border:1px solid var(--border)"></i>${[1, 2, 3, 4].map((l) => `<i class="lv" data-l="${l}"></i>`).join('')} Çok</span></div>`;
  }

  /* --- Denemelerim --- */
  function vExams() {
    const tab = state.examTab;
    const tabs = [['pratik', 'Hemen çöz'], ['yaklasan', 'Yaklaşan'], ['tamamlanan', 'Tamamlanan']];
    let body = '';
    if (tab === 'yaklasan') {
      body = UPCOMING.map((u) => `<article class="card ex-card">
        <div class="ex-top"><span class="chip blue">${u.type}</span>${upcomingReg[u.id] ? '<span class="chip good">Kayıtlı</span>' : '<span class="chip">Kayıt açık</span>'}</div>
        <h3>${u.name}</h3>
        <div class="ex-meta"><span>${icon('calendar')}${dShort(u.date)}, ${DAYS[u.date.getDay()]}</span><span>${icon('clock')}${hm(u.date)} · ${u.dur} dk</span><span>${icon('file')}${u.q} soru</span></div>
        <div class="countdown" data-countdown="${u.date.toISOString()}" style="margin:0"><div><b data-cd="d">0</b><span>gün</span></div><div><b data-cd="h">00</b><span>saat</span></div><div><b data-cd="m">00</b><span>dk</span></div><div><b data-cd="s">00</b><span>sn</span></div></div>
        <div class="ex-foot"><span class="small muted">Türkiye geneli sıralamaya dahil</span>${upcomingReg[u.id] ? `<button class="btn btn-ghost btn-sm" data-action="unregister" data-id="${u.id}">Kaydı iptal et</button>` : `<button class="btn btn-blue btn-sm" data-action="register" data-id="${u.id}">Kaydol</button>`}</div>
      </article>`).join('');
    } else if (tab === 'pratik') {
      const tb = `<div class="toolbar s-12"><div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" aria-selected="${k === tab}" class="${k === tab ? 'on' : ''}" data-action="exam-tab" data-k="${k}">${l}</button>`).join('')}</div><span class="small muted">Denemeleri seç; istersen yalnızca bir testini çöz</span></div>`;
      return `<div class="view">${tb}${vDenemeSec()}</div>`;
    } else {
      body = [...EXAMS].reverse().map((e) => `<article class="card ex-card">
        <div class="ex-top"><span class="chip blue">TYT</span><span class="chip">${dShort(e.d)}</span></div>
        <h3>${e.name}</h3>
        <div class="ex-meta">${SK.map((k) => `<span>${SUBJ[k].short} <b>${fmt(e[k])}</b></span>`).join('')}</div>
        <div class="ex-foot"><span class="ex-net"><b>${fmt(e.net)}</b> net · ${fmt(e.rank, 0)}.</span><button class="btn btn-soft btn-sm" data-action="open-exam" data-id="${e.id}">Analiz ${icon('arrow')}</button></div>
      </article>`).join('');
    }
    return `<div class="view">
      <div class="toolbar s-12"><div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" aria-selected="${k === tab}" class="${k === tab ? 'on' : ''}" data-action="exam-tab" data-k="${k}">${l}</button>`).join('')}</div>
      <span class="small muted">${tab === 'tamamlanan' ? `${EXAMS.length} deneme tamamlandı` : `${Object.values(upcomingReg).filter(Boolean).length} denemeye kayıtlısın`}</span></div>
      <div class="ex-grid s-12">${body}</div>
    </div>`;
  }

  /* --- Sonuç Analizi --- */
  function vAnaliz() {
    const e = EXAMS.find((x) => x.id === state.exam) || LAST;
    const i = EXAMS.indexOf(e), p = EXAMS[i - 1];
    const rows = SK.map((k) => ({ k, ...dyb(e[k], SUBJ[k].q), net: e[k] }));
    const tot = rows.reduce((a, r) => ({ D: a.D + r.D, Y: a.Y + r.Y, B: a.B + r.B }), { D: 0, Y: 0, B: 0 });
    const subj = state.analizSubj;
    return `<div class="view">
      <div class="toolbar s-12">
        <label class="field" style="flex-direction:row;align-items:center;gap:10px">Deneme
          <select class="select" id="examSelect">${[...EXAMS].reverse().map((x) => `<option value="${x.id}" ${x.id === e.id ? 'selected' : ''}>${x.name} · ${dShort(x.d)}</option>`).join('')}</select>
        </label>
        <span class="chip">${DAYS[e.d.getDay()]}, ${dShort(e.d)} · 120 soru · 165 dk</span>
      </div>
      ${kpi({ ic: 'chart', label: 'Toplam net', value: e.net, small: '/ 120', deltaHtml: p ? delta(e.net - p.net, `${fmt(Math.abs(e.net - p.net))} net`) : '', foot: `D ${tot.D} · Y ${tot.Y} · B ${tot.B}` })}
      ${kpi({ ic: 'sparkle', label: 'Tahmini TYT puanı (yaklaşık)', value: Math.round(estScore(e.net)), d: 0, foot: 'Örnek hesaplama' })}
      ${kpi({ ic: 'trophy', label: 'Türkiye sıralaması', value: e.rank, d: 0, suf: '.', small: `/ ${fmt(e.total, 0)}`, deltaHtml: p ? delta(p.rank - e.rank, `${fmt(Math.abs(p.rank - e.rank), 0)} sıra`) : '', foot: `${fmt(e.total, 0)} katılımcı` })}
      ${kpi({ ic: 'target', label: 'Türkiye ortalamasına göre', value: e.net - AVG_TOTAL, d: 1, pre: '+', small: 'net', foot: `Türkiye ortalaması ${fmt(AVG_TOTAL, 1)} net` })}

      <section class="card s-7">
        <div class="card-h"><div><h2>Ders bazlı sonuç</h2><p>Net = Doğru − Yanlış / 4</p></div></div>
        <div class="table-wrap"><table class="t"><thead><tr><th>Ders</th><th class="r">Soru</th><th class="r">D</th><th class="r">Y</th><th class="r">B</th><th class="r">Net</th><th class="r">Türkiye ort.</th><th class="r">Fark</th></tr></thead>
        <tbody>${rows.map((r) => `<tr><td>${subjChip(r.k)}</td><td class="r">${SUBJ[r.k].q}</td><td class="r" style="color:var(--good)">${r.D}</td><td class="r" style="color:var(--bad)">${r.Y}</td><td class="r muted">${r.B}</td><td class="r"><b>${fmt(r.net)}</b></td><td class="r muted">${fmt(SUBJ[r.k].avg, 1)}</td><td class="r">${delta(1, fmt(r.net - SUBJ[r.k].avg, 1))}</td></tr>`).join('')}
        <tr><td><b>Toplam</b></td><td class="r">120</td><td class="r"><b>${tot.D}</b></td><td class="r"><b>${tot.Y}</b></td><td class="r"><b>${tot.B}</b></td><td class="r"><b>${fmt(e.net)}</b></td><td class="r muted">${fmt(AVG_TOTAL, 1)}</td><td class="r">${delta(1, fmt(e.net - AVG_TOTAL, 1))}</td></tr></tbody></table></div>
      </section>

      <section class="card s-5">
        <div class="card-h"><div><h2>Sen ve Türkiye ortalaması</h2><p>Soru sayısına oranla</p></div>
          <div class="legend"><span><i style="--c:var(--brand)"></i>Sen</span><span><i style="--c:var(--surface-2);border:1px dashed var(--faint)"></i>Ortalama</span></div></div>
        <div class="gbars">${SK.map((k) => `<div class="gb"><div class="gb-cols"><i style="--c:${SUBJ[k].c}" data-h="${(e[k] / SUBJ[k].q) * 100}%"><span>${fmt(e[k])}</span></i><i class="avg" data-h="${(SUBJ[k].avg / SUBJ[k].q) * 100}%"><span>${fmt(SUBJ[k].avg, 1)}</span></i></div><small>${SUBJ[k].short}</small></div>`).join('')}</div>
      </section>

      <section class="card s-12">
        <div class="card-h"><div><h2>Konu bazlı başarı</h2><p>Son 4 denemedeki soruların konu dağılımına göre</p></div>
          <div class="tabs">${SK.map((k) => `<button class="${k === subj ? 'on' : ''}" data-action="analiz-subj" data-k="${k}">${SUBJ[k].short}</button>`).join('')}</div></div>
        <div class="topic-grid">${TOPICS.filter((t) => t.s === subj).map(topicCard).join('')}</div>
      </section>
    </div>`;
  }
  const topicCard = (t) => `<div class="topic"><div class="topic-top"><span>${t.n}</span><span class="pct ${level(t.p)}">%${t.p}</span></div>${track(t.p, `var(--${level(t.p)})`)}<div class="topic-foot"><span>${t.q} soru · ${levelTxt[level(t.p)]}</span><button class="link-btn" data-action="add-plan" data-topic="${esc(t.n)}" data-s="${t.s}">+ Plana ekle</button></div></div>`;

  /* --- Konu Eksiklerim --- */
  function vEksikler() {
    const f = state.eksikFilter;
    const list = TOPICS.filter((t) => f === 'all' || t.s === f).sort((a, b) => a.p - b.p);
    const cnt = (lv) => list.filter((t) => level(t.p) === lv).length;
    return `<div class="view">
      <div class="toolbar s-12"><div class="tabs">${[['all', 'Tümü'], ...SK.map((k) => [k, SUBJ[k].short])].map(([k, l]) => `<button class="${k === f ? 'on' : ''}" data-action="eksik-filter" data-k="${k}">${l}</button>`).join('')}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><span class="chip bad">${cnt('bad')} kritik</span><span class="chip warn">${cnt('warn')} geliştirilmeli</span><span class="chip good">${cnt('good')} güçlü</span></div></div>
      <section class="card s-12">
        <div class="card-h"><div><h2>Konu eksiklerim</h2><p>Başarı oranı en düşük konudan başlayarak sıralandı. "Plana ekle" ile bugünkü programına ekleyebilirsin.</p></div></div>
        <div class="topic-grid">${list.map((t) => `<div class="topic"><div class="topic-top"><span>${t.n}<br><small class="muted" style="font-weight:400">${SUBJ[t.s].name}</small></span><span class="pct ${level(t.p)}">%${t.p}</span></div>${track(t.p, `var(--${level(t.p)})`)}<div class="topic-foot"><span>${t.q} soru · ${levelTxt[level(t.p)]}</span><button class="link-btn" data-action="add-plan" data-topic="${esc(t.n)}" data-s="${t.s}">+ Plana ekle</button></div></div>`).join('')}</div>
      </section>
    </div>`;
  }

  /* --- Yanlış Defteri --- */
  function vYanlislar() {
    const kinds = ['Tümü', 'Bilgi eksiği', 'Dikkat hatası', 'Süre yetmedi'];
    const f = state.wrongFilter;
    const list = wrongs.filter((w) => f === 'Tümü' || w.kind === f);
    const kc = { 'Bilgi eksiği': 'bad', 'Dikkat hatası': 'warn', 'Süre yetmedi': 'blue' };
    return `<div class="view">
      <div class="toolbar s-12"><div class="tabs">${kinds.map((k) => `<button class="${k === f ? 'on' : ''}" data-action="wrong-filter" data-k="${k}">${k}</button>`).join('')}</div><span class="small muted">${wrongs.length} soru defterde</span></div>
      <div class="wrong-list s-12">${list.length ? list.map((w) => { const q = wq(w); if (!q) return ''; return `<article class="card wrong" data-wrong="${w.id}">
        <div><div class="wrong-meta">${subjChip(q.s)}<span class="chip ${kc[w.kind]}">${w.kind}</span><span class="chip">${esc(w.topic)}</span></div>
        <p>${esc(q.t)}</p>
        <p class="wrong-src">${esc(w.src)} · ${w.date} · Senin cevabın: <b>${w.your}</b> · Doğru cevap: <b style="color:var(--good)">${q.a == null ? '—' : L5[q.a]}</b></p></div>
        <div class="wrong-actions"><button class="btn btn-blue btn-sm" data-action="retry" ${w.bank ? `data-bank="${w.bank}"` : `data-q="${w.q}"`}>Tekrar çöz</button>${q.sol.length ? `<button class="btn btn-soft btn-sm" data-action="video" data-q="${w.q}">${icon('video')} Video çözüm</button>` : ''}<button class="btn btn-ghost btn-sm" data-action="learned" data-id="${w.id}">${icon('check')} Öğrendim</button></div>
      </article>`; }).join('') : `<section class="card"><p class="muted">Bu filtrede soru yok. Denemelerde yanlış yaptığın sorular buraya otomatik eklenir.</p></section>`}</div>
    </div>`;
  }

  /* --- Çalışma Planı --- */
  function vPlan() {
    const all = plan.days.flat(), done = all.filter((t) => t.done).length;
    const hs = heatStats();
    return `<div class="view">
      <section class="card s-12">
        <div class="card-h"><div><h2>Bu haftanın planı</h2><p>${dShort(weekStart)} – ${dShort(new Date(weekStart.getTime() + 6 * 864e5))} · ${done}/${all.length} görev tamamlandı</p></div>
          <div class="task-progress" style="min-width:200px"><div class="mini-track"><i data-w="${all.length ? (done / all.length) * 100 : 0}%"></i></div><span>%${all.length ? Math.round((done / all.length) * 100) : 0}</span></div></div>
        <form class="form-row" id="planForm" style="margin-bottom:18px">
          <label class="field">Ders<select class="select" id="pf-s">${['mat', 'tr', 'fen', 'sos', 'all'].map((k) => `<option value="${k}">${SUBJ[k].name}</option>`).join('')}</select></label>
          <label class="field field-grow">Görev<input class="input" id="pf-t" maxlength="80" placeholder="Örn. Türev · 25 soru" required></label>
          <label class="field">Gün<select class="select" id="pf-d">${DAYS_S.map((d, i) => `<option value="${i}" ${i === todayIdx ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
          <button class="btn btn-blue" type="submit">${icon('plus')} Ekle</button>
        </form>
        <div class="week">${plan.days.map((list, di) => { const date = new Date(weekStart.getTime() + di * 864e5); return `<div class="day${di === todayIdx ? ' today' : ''}"><div class="day-h"><span>${DAYS_S[di]}${di === todayIdx ? ' · Bugün' : ''}</span><b>${date.getDate()}</b></div>
          ${list.map((t) => `<div class="pchip${t.done ? ' done' : ''}" style="--c:${SUBJ[t.s].c}" data-pchip="${t.id}" role="checkbox" aria-checked="${t.done}" tabindex="0"><span class="cbox">${icon('check')}</span><span class="pt">${esc(t.t)}</span><button data-action="del-task" data-id="${t.id}" aria-label="Görevi sil">${icon('x')}</button></div>`).join('')}</div>`; }).join('')}</div>
      </section>

      <section class="card s-4 pomo">
        <div class="card-h" style="width:100%;margin-bottom:0"><div><h2>Odak zamanlayıcı</h2><p>25 dk çalış, 5 dk mola</p></div></div>
        <div class="tabs" id="pomoMode"><button class="on" data-min="25">Odak 25</button><button data-min="50">Odak 50</button><button data-min="5">Mola 5</button></div>
        <div class="ring" id="pomoRing"><svg viewBox="0 0 150 150"><circle class="r-bg" cx="75" cy="75" r="63"/><circle class="r-fg" cx="75" cy="75" r="63" stroke-dasharray="${2 * Math.PI * 63}" stroke-dashoffset="0"/></svg><div class="ring-in"><b id="pomoTime">25:00</b><span id="pomoLabel">Hazır</span></div></div>
        <div class="pomo-ctrl"><button class="btn btn-yellow btn-play" id="pomoStart">${icon('play')} Başlat</button><button class="btn btn-ghost" id="pomoReset" aria-label="Sıfırla">${icon('reset')}</button></div>
        <p class="pomo-done" id="pomoDone">Bugün tamamlanan odak: ${store.get('ds-pomo-' + new Date().toDateString(), 0)}</p>
      </section>

      <section class="card s-8">
        <div class="card-h"><div><h2>Haftalık özet</h2><p>Plan ve çalışma takviminden</p></div></div>
        <div class="sbar">${['mat', 'tr', 'fen', 'sos'].map((k) => { const ts = all.filter((t) => t.s === k), d = ts.filter((t) => t.done).length; return `<div class="sbar-row"><div class="sbar-top"><b><i style="--c:${SUBJ[k].c}"></i>${SUBJ[k].name}</b><span><strong>${d}</strong> / ${ts.length} görev</span></div>${track(ts.length ? (d / ts.length) * 100 : 0, SUBJ[k].c)}</div>`; }).join('')}</div>
        <div class="heat-stats"><div><small>Bu hafta çalışma</small><b>${hrs(hs.week)}</b></div><div><small>Geçen hafta</small><b>${hrs(hs.prevWeek)}</b></div><div><small>Seri</small><b>${hs.streak} gün</b></div></div>
      </section>
    </div>`;
  }

  let pomo = { total: 25 * 60, left: 25 * 60, timer: null };
  function afterPlan() {
    $('#planForm').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const t = $('#pf-t').value.trim();
      if (!t) return;
      plan.days[+$('#pf-d').value].push({ id: uid(), s: $('#pf-s').value, t, done: false });
      savePlan(); toast('Görev plana eklendi'); render(false);
    });
    const C = 2 * Math.PI * 63;
    const ring = $('#pomoRing .r-fg');
    const paint = () => {
      const m = Math.floor(pomo.left / 60), s = pomo.left % 60;
      $('#pomoTime').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      ring.style.strokeDashoffset = C * (1 - pomo.left / pomo.total);
      $('#pomoLabel').textContent = pomo.timer ? 'Odaklan' : pomo.left === pomo.total ? 'Hazır' : 'Duraklatıldı';
      $('#pomoStart').innerHTML = pomo.timer ? `${icon('pause')} Duraklat` : `${icon('play')} ${pomo.left === pomo.total ? 'Başlat' : 'Devam'}`;
    };
    const stop = () => { clearInterval(pomo.timer); pomo.timer = null; };
    $('#pomoStart').addEventListener('click', () => {
      if (pomo.timer) { stop(); return paint(); }
      pomo.timer = setInterval(() => {
        pomo.left--;
        if (pomo.left <= 0) {
          stop(); pomo.left = pomo.total;
          const k = 'ds-pomo-' + new Date().toDateString(), n = store.get(k, 0) + 1; store.set(k, n);
          const el = $('#pomoDone'); if (el) el.textContent = `Bugün tamamlanan odak: ${n}`;
          toast('Süre doldu. Kısa bir mola ver!');
        }
        if ($('#pomoTime')) paint(); else stop();
      }, 1000);
      paint();
    });
    $('#pomoReset').addEventListener('click', () => { stop(); pomo.left = pomo.total; paint(); });
    $$('#pomoMode button').forEach((b) => b.addEventListener('click', () => {
      stop(); $$('#pomoMode button').forEach((x) => x.classList.toggle('on', x === b));
      pomo.total = pomo.left = +b.dataset.min * 60; paint();
    }));
    paint();
  }

  /* --- Sıralama --- */
  const MASK = ['Z*** A.', 'M*** K.', 'E*** T.', 'B*** Y.', 'S*** D.', 'A*** Ç.', 'K*** Ö.', 'D*** E.', 'Ö*** S.', 'İ*** G.'];
  const CITIES = ['Ankara', 'İstanbul', 'İzmir', 'Bursa', 'Konya', 'Kayseri', 'Antalya', 'Eskişehir'];
  const RANKS = {
    tr: { label: 'Türkiye', rank: LAST.rank, total: LAST.total, prev: PREV.rank, top: [116.25, 115.5, 114.75, 114.75, 114], near: [87.75, 87.75, 87.5, 87.5, 87.25] },
    il: { label: 'İl', rank: 512, total: 5904, prev: 601, top: [114.75, 113.5, 112.25, 111.75, 111], near: [87.75, 87.75, 87.5, 87.5, 87.25] },
    okul: { label: 'Okul', rank: 3, total: 86, prev: 4, top: [96.25, 91.5, 87.5, 85.75, 83] },
  };
  const DIST = [450, 1600, 3300, 5000, 6000, 6000, 5200, 4290, 3300, 2300, 850, 250];
  function vSiralama() {
    const r = RANKS[state.rankTab];
    let rows = '';
    if (state.rankTab === 'okul') {
      rows = r.top.map((n, i) => i + 1 === r.rank ? meRow(i + 1, n) : `<tr><td>${i + 1}.</td><td>${MASK[i]}</td><td>${esc(user.school)}</td><td class="r"><b>${fmt(n)}</b></td></tr>`).join('');
    } else {
      rows = r.top.map((n, i) => `<tr><td>${i + 1}.</td><td>${MASK[i]}</td><td>${state.rankTab === 'il' ? esc(user.city) : CITIES[i]}</td><td class="r"><b>${fmt(n)}</b></td></tr>`).join('')
        + `<tr class="gap"><td colspan="4">⋯</td></tr>`
        + r.near.map((n, j) => { const rk = r.rank - 2 + j; return rk === r.rank ? meRow(rk, n) : `<tr><td>${fmt(rk, 0)}.</td><td>${MASK[(j + 5) % MASK.length]}</td><td>${state.rankTab === 'il' ? esc(user.city) : CITIES[(j + 3) % CITIES.length]}</td><td class="r"><b>${fmt(n)}</b></td></tr>`; }).join('');
    }
    return `<div class="view">
      <div class="toolbar s-12"><div class="tabs">${Object.entries(RANKS).map(([k, v]) => `<button class="${k === state.rankTab ? 'on' : ''}" data-action="rank-tab" data-k="${k}">${v.label}</button>`).join('')}</div><span class="chip">${LAST.name} · ${dShort(LAST.d)}</span></div>
      <section class="card s-4">
        <div class="card-h"><div><h2>${r.label} sıralaman</h2><p>${fmt(r.total, 0)} katılımcı arasında</p></div></div>
        <p class="rank-big"><span ${countAttr(r.rank, 0, '', '.')}>${fmt(r.rank, 0)}.</span> <small>/ ${fmt(r.total, 0)}</small></p>
        <p class="small muted" style="margin-top:6px">${delta(r.prev - r.rank, `${fmt(r.prev - r.rank, 0)} sıra yükseldin`)}</p>
        <div class="rank-rows"><div><span>Yüzdelik dilim</span><b>İlk %${fmt((r.rank / r.total) * 100, 1)}</b></div><div><span>Netin</span><b>${fmt(LAST.net)}</b></div><div><span>Önceki deneme</span><b>${fmt(r.prev, 0)}.</b></div></div>
      </section>
      <section class="card s-8">
        <div class="card-h"><div><h2>Sıralama tablosu</h2><p>İsimler gizlilik için kısaltılmıştır</p></div></div>
        <div class="table-wrap"><table class="t" style="min-width:420px"><thead><tr><th>Sıra</th><th>Öğrenci</th><th>${state.rankTab === 'okul' ? 'Okul' : 'İl'}</th><th class="r">Net</th></tr></thead><tbody>${rows}</tbody></table></div>
      </section>
      <section class="card s-12">
        <div class="card-h"><div><h2>Türkiye geneli net dağılımı</h2><p>${LAST.name} · ${fmt(LAST.total, 0)} katılımcı · 10'ar netlik aralıklar</p></div></div>
        <div class="chart dist" id="distChart"></div>
      </section>
    </div>`;
  }
  const meRow = (rk, n) => `<tr class="me"><td>${fmt(rk, 0)}.</td><td>${esc(user.name)} (Sen)</td><td>${state.rankTab === 'okul' ? esc(user.school) : esc(user.city)}</td><td class="r">${fmt(n)}</td></tr>`;
  function afterSiralama(animate) { const h = $('#distChart'); distChart(h, DIST, LAST.net, animate); charts.push(() => distChart(h, DIST, LAST.net, false)); }

  /* --- Ayarlar --- */
  const EXAM_OPTS = ['YKS', 'LGS', 'KPSS', 'ALES', 'DGS', 'YDS', 'YÖKDİL', 'TUS', 'DUS', 'HMGS', 'MSÜ', 'MEB-AGS'];
  const CITY_OPTS = ['Adana', 'Ankara', 'Antalya', 'Bursa', 'Diyarbakır', 'Erzurum', 'Eskişehir', 'Gaziantep', 'İstanbul', 'İzmir', 'Kayseri', 'Kocaeli', 'Konya', 'Malatya', 'Mersin', 'Samsun', 'Trabzon', 'Diğer'];
  function vAyarlar() {
    const p = { exam: user.exam, alan: user.alan, goalNet: 100, goalText: 'Boğaziçi Üniversitesi · Bilgisayar Mühendisliği', notif: { remind: true, results: true, weekly: false }, ...profile };
    const theme = effectiveDark() ? 'dark' : 'light';
    return `<div class="view">
      <section class="card s-7">
        <div class="card-h"><div><h2>Profil</h2><p>Sıralama ve öneriler bu bilgilere göre hazırlanır</p></div></div>
        <form id="profileForm" class="form-grid">
          <label class="field">Ad soyad<input class="input" id="pr-name" value="${esc(user.name)}" maxlength="60" required></label>
          <label class="field">E-posta<input class="input" id="pr-email" value="${esc(user.email)}" disabled></label>
          <label class="field">İl<select class="select" id="pr-city">${CITY_OPTS.map((c) => `<option ${c === user.city ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
          <label class="field">Okul<input class="input" id="pr-school" value="${esc(user.school)}" maxlength="80"></label>
          <label class="field">Hedef sınav<select class="select" id="pr-exam">${EXAM_OPTS.map((x) => `<option ${x === p.exam ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
          <div class="field">Alan<div class="seg">${['Sayısal', 'Eşit Ağırlık', 'Sözel', 'Dil'].map((a) => `<label><input type="radio" name="pr-alan" value="${a}" ${a === p.alan ? 'checked' : ''}><span>${a === 'Eşit Ağırlık' ? 'EA' : a}</span></label>`).join('')}</div></div>
          <label class="field">Hedef net<input class="input" id="pr-goal" type="number" min="1" max="120" step="0.25" value="${p.goalNet}"></label>
          <label class="field">Hedef bölüm / okul<input class="input" id="pr-goaltext" value="${esc(p.goalText)}" maxlength="90"></label>
          <div style="grid-column:1/-1;display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-blue" type="submit">Değişiklikleri kaydet</button></div>
        </form>
      </section>
      <section class="card s-5">
        <div class="card-h"><div><h2>Tercihler</h2><p>Görünüm ve bildirimler</p></div></div>
        <div class="toggle-row"><div><b>Tema</b><span>Varsayılan açık tema; istersen koyu temaya geç</span></div><div class="seg" id="themeSeg">${[['light', 'Açık'], ['dark', 'Koyu']].map(([k, l]) => `<label><input type="radio" name="theme" value="${k}" ${k === theme ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
        ${[['remind', 'Deneme hatırlatmaları', 'Kayıtlı denemelerden 15 dk önce'], ['results', 'Sonuç bildirimleri', 'Sonuçlar açıklandığında'], ['weekly', 'Haftalık rapor e-postası', 'Her pazartesi gelişim özeti']].map(([k, t, s]) => `<div class="toggle-row"><div><b>${t}</b><span>${s}</span></div><span class="switch"><input type="checkbox" id="nt-${k}" data-notif="${k}" ${p.notif[k] ? 'checked' : ''} aria-label="${t}"><i></i></span></div>`).join('')}
      </section>
      <section class="card s-12">
        <div class="card-h"><div><h2>Hesap</h2><p>Oturum ve güvenlik</p></div></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-ghost" data-action="reset-pw">Şifre sıfırlama bağlantısı gönder</button><button class="btn btn-ghost" data-action="logout">${icon('logout')} Çıkış yap</button></div>
      </section>
    </div>`;
  }
  function afterAyarlar() {
    $('#profileForm').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const name = $('#pr-name').value.trim() || user.name;
      profile = {
        ...profile, name, city: $('#pr-city').value, school: $('#pr-school').value.trim(), exam: $('#pr-exam').value,
        alan: ($('input[name="pr-alan"]:checked') || {}).value || user.alan,
        goalNet: Math.min(120, Math.max(1, parseFloat($('#pr-goal').value) || 100)), goalText: $('#pr-goaltext').value.trim(),
        notif: Object.fromEntries($$('[data-notif]').map((c) => [c.dataset.notif, c.checked])),
      };
      store.set(ukey('profile'), profile);
      if (window.DSAuth && window.DSAuth.updateProfile) { try { await window.DSAuth.updateProfile({ name, exam: profile.exam, alan: profile.alan }); } catch (e) { /* keep local copy */ } }
      applyUser(); toast('Profil kaydedildi');
    });
    $$('#themeSeg input').forEach((r) => r.addEventListener('change', () => setTheme(r.value)));
    $$('[data-notif]').forEach((c) => c.addEventListener('change', () => toast(c.checked ? 'Bildirim açıldı' : 'Bildirim kapatıldı')));
  }

  /* --- Yaprak Test Oluştur: 1) the user picks the denemeler / soru bankaları, 2) the test and how many questions --- */
  const nextTestNo = () => ytests.reduce((m, t) => Math.max(m, t.no || 0), 0) + 1;
  // Branch (test) of a question; sources that name the same branch differently are joined.
  const BRANS_ALIAS = { TYT: { Matematik: 'Temel Matematik' } };
  const bolumOf = (q) => { const b = q.bolum || q.ders || ''; return (BRANS_ALIAS[q.sinav] || {})[b] || b; };
  // Several branches chosen: take questions from them in turn, so each branch gets its share.
  function mixBranches(list, br) {
    if (!br || br.length < 2) return list;
    const buckets = br.map((p) => list.filter((q) => bolumOf(q) === p)), out = [];
    while (buckets.some((bk) => bk.length)) buckets.forEach((bk) => { if (bk.length) out.push(bk.shift()); });
    return out;
  }
  const srcQs = (id) => BANK.sorular.filter((q) => q.kaynak === id);
  // A source is never "used up": once every question of it has been seen, it starts a new round
  // (questions still do not repeat inside a round).
  const srcAllSeen = (id) => { const qs = srcQs(id); return qs.length > 0 && qs.every((q) => isSeen(q.id)); };
  const offered = (q) => !isSeen(q.id) || srcAllSeen(q.kaynak);
  function newRound(ids) {
    let n = 0;
    for (const id of ids) if (srcAllSeen(id)) for (const q of srcQs(id)) { delete seen.used[q.id]; delete seen.solved[q.id]; n++; }
    if (n) saveSeen();
  }
  const srcFreshN = (id) => srcQs(id).filter(offered).length;
  // Every source is offered; denemeler first, the user's own exam first inside each group.
  function builderSources() {
    const mine = poolSinav(), at = (k) => BANK.kaynaklar.indexOf(k);
    return BANK.kaynaklar.slice().sort((a, b) => (b.tur === 'deneme') - (a.tur === 'deneme') || mine.includes(b.sinav) - mine.includes(a.sinav) || at(a) - at(b));
  }
  // Selected sources (bank sources before denemeler, so a deneme is not used up first), optional test filter.
  const selPool = () => BANK.sorular
    .filter((q) => (state.b.sec || []).includes(q.kaynak) && (!(state.b.branslar || []).length || state.b.branslar.includes(bolumOf(q))))
    .sort((a, b) => srcRank(a) - srcRank(b) || a.sira - b.sira);
  const selFresh = () => selPool().filter(offered);
  const stepsHtml = (n, a = 'Kaynak seç', b = 'Soru sayısı') => `<ol class="steps" aria-label="Adımlar"><li class="${n === 1 ? 'on' : 'done'}">${n > 1 ? icon('check') : '<i>1</i>'} ${a}</li><li class="${n === 2 ? 'on' : ''}"><i>2</i> ${b}</li></ol>`;

  function vTestOlustur() {
    const b = state.b;
    if (!BANK.kaynaklar.length) {
      return `<div class="view"><section class="card s-12 empty"><h2>Soru havuzu hazırlanıyor</h2><p class="muted">Henüz deneme ya da soru bankası eklenmedi.</p></section></div>`;
    }
    b.sec = (b.sec || []).filter((id) => BANK.src[id] && srcFreshN(id));
    if (b.adim === 2 && b.sec.length) return vBuilderCount();
    b.adim = 1;
    return vBuilderSources();
  }

  // Selectable source card, shared by Yaprak Test Oluştur and Denemelerim. o.chip / o.meta add deneme details.
  function srcCard(k, sel, o = {}) {
    const all = srcQs(k.id), round = srcAllSeen(k.id), fresh = all.filter(offered).length, on = sel.includes(k.id);
    const parts = [...new Set(all.map(bolumOf))].filter(Boolean);
    const pct = all.length ? (all.length - fresh) / all.length * 100 : 0;
    return `<label class="src-card${on ? ' on' : ''}${fresh ? '' : ' off'}">
      <input type="checkbox" data-src="${esc(k.id)}" ${on ? 'checked' : ''} ${fresh ? '' : 'disabled'} aria-label="${esc(k.ad)}">
      <span class="src-check">${icon('check')}</span>
      <span class="src-top"><span class="chip blue">${esc(k.sinav)}</span><span class="chip">${k.tur === 'deneme' ? 'Deneme' : 'Soru bankası'}</span>${k.yerel ? '<span class="chip warn">Yalnız test</span>' : ''}${o.chip ? o.chip(k, all.length, fresh) : ''}</span>
      <b class="src-name">${esc(k.ad)}</b>
      <span class="src-parts">${esc(parts.slice(0, 5).join(' · '))}</span>
      <span class="src-bar" aria-hidden="true"><i style="width:${pct.toFixed(1)}%"></i></span>
      <span class="src-meta">${round ? `<b>${all.length}</b> soru · yeniden çözülebilir` : `<b>${fresh}</b> yeni soru · ${all.length} soru`}${o.meta ? o.meta(k, all.length, fresh) : ''}</span>
    </label>`;
  }
  function vBuilderSources() {
    const srcs = builderSources(), den = srcs.filter((k) => k.tur === 'deneme'), ban = srcs.filter((k) => k.tur !== 'deneme');
    const open = srcs.filter((k) => srcFreshN(k.id));
    const group = (title, list) => (list.length ? `<h3 class="src-h">${title}<span>${list.length}</span></h3><div class="src-grid">${list.map((k) => srcCard(k, state.b.sec)).join('')}</div>` : '');
    return `<div class="view">
      <section class="card s-12 qb-src">
        <div class="card-h"><div><h2>Yaprak test oluştur</h2><p>Soruların geleceği denemeleri seç, sonra soru sayısını belirle. Birden fazla seçebilirsin.</p></div>${stepsHtml(1)}</div>
        <div class="src-tools"><button type="button" class="btn btn-ghost btn-sm" data-src-all ${open.length ? '' : 'disabled'}>${icon('check')} Tümünü seç</button><button type="button" class="btn btn-ghost btn-sm" data-src-none>Seçimi temizle</button></div>
        ${group('Denemeler', den)}${group('Soru bankaları', ban)}
        <div class="src-foot"><span id="srcSum" class="small muted"></span><span class="spacer"></span><button type="button" class="btn btn-blue" data-src-next>Devam et ${icon('arrow')}</button></div>
      </section>
    </div>`;
  }

  function vBuilderCount() {
    const b = state.b;
    const parts = [...new Set(BANK.sorular.filter((q) => b.sec.includes(q.kaynak) && offered(q)).map(bolumOf))].filter(Boolean);
    b.branslar = (b.branslar || []).filter((p) => parts.includes(p));
    if (b.branslar.length === parts.length) b.branslar = [];          // every branch = no filter
    const inSel = (p) => BANK.sorular.filter((q) => b.sec.includes(q.kaynak) && offered(q) && (!p || bolumOf(q) === p));
    const bransCard = (key, label) => {
      const n = inSel(key).length, on = key ? b.branslar.includes(key) : !b.branslar.length;
      return `<button type="button" class="brans-card${on ? ' on' : ''}${key ? '' : ' all'}" data-brans="${esc(key)}" aria-pressed="${on}"><b>${esc(label)}</b><span>${n} yeni soru</span></button>`;
    };
    const pool = selPool(), fresh = pool.filter(offered), max = fresh.length;
    b.adet = Math.max(1, Math.min(b.adet || 10, max));
    const presets = [...new Set([5, 10, 20, 40].filter((n) => n < max).concat(max))];
    const solvedN = pool.filter((q) => seen.solved[q.id]).length;
    const usedN = pool.filter((q) => seen.used[q.id] && !seen.solved[q.id]).length;
    const pct = pool.length ? (pool.length - max) / pool.length * 100 : 0;
    return `<div class="view">
      <section class="card s-8 qb-builder">
        <div class="card-h"><div><h2>Yaprak test oluştur</h2><p>Kaç soru istediğini seç. Sorular, daha önce karşına çıkmamış sorulardan gelir.</p></div>${stepsHtml(2)}</div>
        <div class="sel-row"><span class="sel-chips">${b.sec.map((id) => `<span class="chip blue">${esc(BANK.src[id].ad)}</span>`).join('')}</span><button type="button" class="btn btn-ghost btn-sm" data-src-back>${icon('back')} Kaynakları değiştir</button></div>
        ${parts.length > 1 ? `<div class="brans"><h3 class="src-h">Branş<span>${parts.length}</span></h3>
          <div class="brans-grid" role="group" aria-label="Branş seç">${bransCard('', 'Tüm branşlar')}${parts.map((p) => bransCard(p, p)).join('')}</div>
          <p class="small muted">Bir ya da birkaç branş seç; test yalnızca o branşların sorularından oluşur.</p></div>` : ''}
        <div class="count-box">
          <button type="button" class="step" data-step="-1" aria-label="Bir soru azalt">−</button>
          <div class="count-val"><output id="b-count">${b.adet}</output><span>soru</span></div>
          <button type="button" class="step" data-step="1" aria-label="Bir soru artır">+</button>
        </div>
        <input type="range" id="b-range" min="1" max="${max}" value="${b.adet}" aria-label="Soru sayısı">
        <div class="presets" role="group" aria-label="Hazır soru sayıları">${presets.map((n) => `<button type="button" class="${n === b.adet ? 'on' : ''}" data-preset="${n}">${n === max ? `Tümü · ${n}` : n}</button>`).join('')}</div>
        <p class="count-sub">Önerilen süre <b id="b-dk">${dkFor(fresh.slice(0, b.adet))} dk</b> · Deneme Sokağı şablonunda, kaynaktaki soru sırasıyla</p>
        <div class="make-row"><button type="button" class="btn btn-blue btn-lg btn-play" data-make="coz">${icon('play')} Çöz</button><button type="button" class="btn btn-yellow btn-lg" data-make="indir">${icon('download')} PDF indir</button></div>
        <p class="small muted">Oluşturduğun test "Oluşturulan Yaprak Testler" sayfasına kaydedilir. İçindeki sorular sana bir daha gösterilmez.</p>
      </section>
      <section class="card s-4 b-sum">
        <div class="card-h"><div><h2>Seçtiğin havuz</h2><p>${b.sec.length} kaynak${b.branslar.length ? ` · ${esc(b.branslar.join(', '))}` : ''}</p></div></div>
        ${ringSvg(pct, `%${fmt(pct, 0)}`, 'gördüğün sorular')}
        <dl class="sum-list">
          <div><dt>Yeni soru</dt><dd>${max}</dd></div>
          <div><dt>Çözülen</dt><dd>${solvedN}</dd></div>
          <div><dt>Teste eklenen, çözülmeyen</dt><dd>${usedN}</dd></div>
          <div><dt>Toplam</dt><dd>${pool.length}</dd></div>
        </dl>
        <p class="small muted">Her sorunun kalıcı bir künyesi vardır (ör. ${esc((fresh[0] || {}).kod || '')}); PDF'te sorunun altında görünür.</p>
      </section>
    </div>`;
  }

  // Step 1 behaviour shared by both pickers: toggle cards, select all / none, live summary, "Devam et".
  function bindPicker(st, list, noun) {
    const sum = () => {
      const n = st.sec.reduce((a, id) => a + srcFreshN(id), 0);
      $('#srcSum').innerHTML = st.sec.length ? `<b>${st.sec.length}</b> ${noun} seçildi · <b>${n}</b> yeni soru` : `Devam etmek için en az bir ${noun} seç`;
      $('[data-src-next]').disabled = !st.sec.length;
    };
    const sync = () => {
      $$('[data-src]').forEach((x) => { x.checked = st.sec.includes(x.dataset.src); x.closest('.src-card').classList.toggle('on', x.checked); });
      sum();
    };
    $$('[data-src]').forEach((x) => x.addEventListener('change', () => {
      st.sec = x.checked ? [...new Set([...st.sec, x.dataset.src])] : st.sec.filter((id) => id !== x.dataset.src);
      sync();
    }));
    $('[data-src-all]').addEventListener('click', () => { st.sec = list().filter((k) => srcFreshN(k.id)).map((k) => k.id); sync(); });
    $('[data-src-none]').addEventListener('click', () => { st.sec = []; sync(); });
    $('[data-src-next]').addEventListener('click', () => {
      if (!st.sec.length) return toast(`Önce en az bir ${noun} seç`);
      st.adim = 2; st.bolum = ''; if (st.branslar) st.branslar = [];
      render(false); window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    sum();
  }
  function afterTestOlustur() {
    const b = state.b;
    if (b.adim !== 2) return bindPicker(b, builderSources, 'kaynak');
    $('[data-src-back]').addEventListener('click', () => { b.adim = 1; render(false); });
    $$('[data-brans]').forEach((x) => x.addEventListener('click', () => {
      const k = x.dataset.brans;
      b.branslar = !k ? [] : b.branslar.includes(k) ? b.branslar.filter((p) => p !== k) : [...b.branslar, k];
      render(false);
    }));
    const range = $('#b-range');
    const set = (n) => {
      const max = +range.max;
      b.adet = Math.max(1, Math.min(max, n));
      range.value = b.adet;
      $('#b-count').textContent = b.adet;
      $('#b-dk').textContent = `${dkFor(selFresh().slice(0, b.adet))} dk`;
      $$('[data-preset]').forEach((x) => x.classList.toggle('on', +x.dataset.preset === b.adet));
      const c = $('#b-count'); c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump');
    };
    range.addEventListener('input', () => set(+range.value));
    $$('[data-step]').forEach((x) => x.addEventListener('click', () => set(b.adet + +x.dataset.step)));
    $$('[data-preset]').forEach((x) => x.addEventListener('click', () => set(+x.dataset.preset)));
    $$('[data-make]').forEach((x) => x.addEventListener('click', () => createTest(x.dataset.make)));
  }
  function createTest(action) {
    newRound(state.b.sec);
    const br = state.b.branslar || [], pool = selFresh(), at = new Map(pool.map((q, i) => [q.id, i]));
    const qs = pickQuestions(mixBranches(pool, br), state.b.adet);
    // in the test the questions stay together by branch, each branch in source order
    if (br.length > 1) qs.sort((a, b) => br.indexOf(bolumOf(a)) - br.indexOf(bolumOf(b)) || at.get(a.id) - at.get(b.id));
    if (!qs.length) return toast('Bu sayıda soruya uyan yeni soru yok; paragraf soruları bölünmeden verilir. Sayıyı artırmayı dene.');
    if (qs.length < state.b.adet) toast(`Paragraf soruları bölünmediği için test ${qs.length} soru oldu.`);
    const konular = [...new Set(qs.map((q) => q.konu))], bolumler = [...new Set(qs.map(bolumOf))];
    const test = {
      id: 'yt-' + uid(), no: nextTestNo(), mod: 'metin',
      baslik: konular.length === 1 ? konular[0] : bolumler.length === 1 && bolumler[0] ? `${bolumler[0]} Testi`
        : state.b.branslar.length > 1 && bolumler.length <= 3 ? bolumler.join(' + ') : `${[...new Set(qs.map((q) => q.sinav))].join(' · ')} Karma Test`,
      ders: [...new Set(qs.map((q) => `${q.sinav} · ${q.ders}`))].join(' – '),
      soruIds: qs.map((q) => q.id), cevapAnahtari: true, olusturma: new Date().toISOString(),
      kaynak: [...new Set(qs.map((q) => (BANK.src[q.kaynak] || {}).ad || q.kaynak_ad))].join(', '), konular, dk: dkFor(qs), sonuc: null,
    };
    ytests.unshift(test); saveTests();
    markUsed(test.soruIds);
    logActivity({ tur: action === 'indir' ? 'indirildi' : 'olusturuldu', ad: test.baslik, detay: `Yaprak test ${pad2(test.no)} · ${qs.length} soru`, ref: test.id });
    if (action === 'indir') downloadTest(test, false); else solveTest(test.id);
    if (routeKey() === 'test-olustur') render(false);
  }
  // PDF is built inside the page (sablon/pdf-indir.js) and saved as a file: no new tab, no print dialog.
  let pdfBusy = false;
  function progressToast(msg) {
    let el = $('#toasts .toast.prog');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast prog';
      el.innerHTML = `${icon('download')}<span></span>`;
      $('#toasts').appendChild(el);
    }
    el.querySelector('span').textContent = msg;
    return el;
  }
  async function downloadTest(test, log = true) {
    if (pdfBusy) return toast('PDF hazırlanıyor, lütfen bekle');
    if (!window.DSPdf || !window.DSYaprakTest) return toast('PDF şablonu yüklenemedi');
    pdfBusy = true;
    const prog = progressToast('PDF hazırlanıyor…');
    try {
      const blob = await window.DSPdf.build(test, BANK, { base: '', onProgress: (i, n) => progressToast(`PDF hazırlanıyor… ${i}/${n} sayfa`) });
      prog.remove();
      const r = await window.DSPdf.save(blob, window.DSPdf.fileName(test.baslik));
      if (log) logActivity({ tur: 'indirildi', ad: test.baslik, detay: `Yaprak test ${pad2(test.no)} · ${test.soruIds.length} soru`, ref: test.id });
      toast(r && r.status === 'delivered' ? 'PDF gönderildi' : 'PDF indirildi');
    } catch (e) {
      prog.remove();
      const code = e && e.code;
      toast(code === 'declined' ? 'İndirme iptal edildi' : code === 'rate_limited' ? 'Bir indirme onayı zaten açık' : `PDF oluşturulamadı${e && e.message ? ': ' + e.message : ''}`);
    } finally {
      pdfBusy = false;
    }
  }

  async function openTestPreview(test) {
    const root = $('#modalRoot');
    root.innerHTML = `<div class="modal-back"><div class="modal wide" role="dialog" aria-modal="true" aria-labelledby="pvTitle">
      <div class="pl-head"><div><h2 id="pvTitle">${esc(test.baslik)}</h2><p>Yaprak test ${String(test.no).padStart(2, '0')} · ${test.soruIds.length} soru · ${test.mod === 'gorsel' ? 'Görsel' : 'Metin'}${test.kaynak ? ' · ' + esc(test.kaynak) : ''}</p></div><span style="margin-left:auto"></span><button class="icon-btn" data-pv="close" aria-label="Kapat">${icon('x')}</button></div>
      <div class="pv-body"><p class="pv-loading">Sayfalar hazırlanıyor…</p><div class="pv-doc ds-doc preview" id="pvDoc"></div></div>
      <div class="pl-foot"><span class="small muted" id="pvInfo"></span><span class="spacer"></span>
        <button class="btn btn-ghost btn-sm" data-pv="pdf">${icon('download')} PDF indir</button>
        ${test.sonuc ? `<span class="chip good">Çözüldü · ${fmt(test.sonuc.net)} net</span>` : `<button class="btn btn-yellow btn-sm btn-play" data-pv="solve">${icon('play')} Testi çöz</button>`}</div></div></div>`;
    const close = () => { document.removeEventListener('keydown', onKey); root.innerHTML = ''; };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    root.onclick = (e) => {
      if (e.target.classList.contains('modal-back')) return close();
      const b = e.target.closest('[data-pv]');
      if (!b) return;
      if (b.dataset.pv === 'close') close();
      else if (b.dataset.pv === 'solve') { close(); solveTest(test.id); }
      else if (b.dataset.pv === 'pdf') downloadTest(test);
    };
    if (!window.DSYaprakTest) { $('.pv-loading').textContent = 'Şablon yüklenemedi.'; return; }
    const doc = $('#pvDoc');
    const r = await window.DSYaprakTest.render(doc, test, BANK, { base: '' });
    const loading = $('.pv-loading'); if (loading) loading.remove();
    doc.style.zoom = Math.min(1, (doc.parentElement.clientWidth - 32) / 794);
    $('#pvInfo').textContent = `${r.pages} sayfa · A4 · Deneme Sokağı şablonu`;
  }
  function solveTest(id) {
    const t = ytests.find((x) => x.id === id);
    if (!t) return;
    const items = t.soruIds.map((q) => bankItem(BANK.byId[q])).filter(Boolean);
    if (!items.length) return toast('Bu testin soruları bankada bulunamadı');
    if (t.sonuc) return toast('Bu testi çözdün; sorular tekrar gösterilmez.');
    openPlayer(items, t.baslik, (t.dk || minutesFor(items.length)) * 60, {
      mode: t.mod,
      onFinish: (r) => {
        t.sonuc = { D: r.D, Y: r.Y, B: r.B, net: r.net, tarih: new Date().toISOString() }; saveTests();
        markSolved(t.soruIds);
        logActivity({ tur: 'cozuldu', ad: t.baslik, detay: `Yaprak test ${pad2(t.no)} · ${r.D} D · ${r.Y} Y · ${r.B} B`, net: r.net, ref: t.id });
        if (['yaprak-testler', 'genel', 'test-olustur'].includes(routeKey())) render(false);
      },
    });
  }

  /* --- Oluşturulan Yaprak Testler --- */
  function vYaprakTestler() {
    const list = ytests;
    const cards = list.map((t) => {
      const d = new Date(t.olusturma), r = t.sonuc;
      return `<article class="card ex-card">
        <div class="ex-top"><span class="chip blue">Yaprak test ${String(t.no).padStart(2, '0')}</span>${r ? `<span class="chip good">Çözüldü · ${fmt(r.net)} net</span>` : '<span class="chip">Çözülmedi</span>'}</div>
        <h3>${esc(t.baslik)}</h3><p class="small muted">${esc(t.ders)}${t.kaynak ? ' · ' + esc(t.kaynak) : ''}</p>
        <div class="ex-meta"><span>${icon('file')}${t.soruIds.length} soru</span><span>${icon('clock')}${t.dk || minutesFor(t.soruIds.length)} dk</span><span>${icon('eye')}${t.mod === 'gorsel' ? 'Görsel' : 'Metin'}</span><span>${icon('calendar')}${dShort(d)}</span></div>
        ${r ? `<div class="yt-score"><span class="g">D ${r.D}</span><span class="b">Y ${r.Y}</span><span>B ${r.B}</span></div>` : ''}
        <div class="ex-foot"><button class="btn btn-ghost btn-sm" data-action="yt-del" data-id="${esc(t.id)}" aria-label="Testi sil">${icon('trash')}</button>
          <span class="btn-pair"><button class="btn btn-soft btn-sm" data-action="yt-preview" data-id="${esc(t.id)}" aria-label="Önizle">${icon('eye')}</button><button class="btn btn-soft btn-sm" data-action="yt-pdf" data-id="${esc(t.id)}">${icon('download')} PDF</button>${r ? '' : `<button class="btn btn-blue btn-sm" data-action="yt-solve" data-id="${esc(t.id)}">Çöz</button>`}</span></div>
      </article>`;
    }).join('');
    return `<div class="view">
      <div class="toolbar s-12"><span class="small muted">${list.length} yaprak test · çözülen testlerin soruları tekrar gösterilmez</span><a class="btn btn-yellow btn-sm" href="#test-olustur">${icon('plus')} Yeni yaprak test</a></div>
      ${list.length ? `<div class="ex-grid s-12">${cards}</div>` : `<section class="card s-12 empty"><h2>Henüz yaprak test oluşturmadın</h2><p class="muted">Kaç soru istediğini seç, testin birkaç saniyede hazır olsun.</p><a class="btn btn-yellow" href="#test-olustur">${icon('plus')} İlk yaprak testini oluştur</a></section>`}
    </div>`;
  }

  /* --- Deneme Sınavları (test geçmişi) --- */
  function historyRows() {
    const exams = EXAMS.map((e) => {
      const t = SK.reduce((acc, k) => { const r = dyb(e[k], SUBJ[k].q); return { D: acc.D + r.D, Y: acc.Y + r.Y, B: acc.B + r.B }; }, { D: 0, Y: 0, B: 0 });
      return { id: e.id, ad: e.name, tur: e.id.startsWith('tg') ? 'Türkiye Geneli' : 'Deneme', d: e.d, soru: 120, ...t, net: e.net, rank: e.rank, analiz: true };
    });
    const mine = userData('history', []).map((h) => ({ ...h, d: new Date(h.tarih) }));
    return [...mine, ...exams].sort((a, b) => b.d - a.d);
  }
  function vDenemeGecmisi() {
    const all = historyRows(), f = state.histFilter;
    const rows = all.filter((r) => f === 'Tümü' || r.tur === f);
    const tyt = all.filter((r) => r.soru === 120);
    const avg = tyt.reduce((a, r) => a + r.net, 0) / (tyt.length || 1);
    const best = tyt.reduce((m, r) => (r.net > m.net ? r : m), { net: 0, ad: '' });
    return `<div class="view">
      ${kpi({ ic: 'file', label: 'Çözülen deneme', value: all.length, d: 0, foot: `${tyt.length} TYT · ${all.length - tyt.length} diğer deneme` })}
      ${kpi({ ic: 'chart', label: 'Ortalama TYT neti', value: Math.round(avg * 4) / 4, small: '/ 120', foot: `Türkiye ortalaması ${fmt(AVG_TOTAL, 1)} net` })}
      ${kpi({ ic: 'trophy', label: 'En yüksek net', value: best.net, small: '/ 120', foot: esc(best.ad) })}
      ${kpi({ ic: 'check', label: 'Çözülen soru', value: all.reduce((a, r) => a + r.soru, 0), d: 0, foot: 'Denemelerdeki toplam soru' })}
      <section class="card s-12">
        <div class="card-h"><div><h2>Deneme sınavları</h2><p>Çözdüğün denemeler, en yeniden eskiye</p></div>
          <div class="tabs">${['Tümü', 'Türkiye Geneli', 'Deneme', 'Mini'].map((k) => `<button class="${k === f ? 'on' : ''}" data-action="hist-filter" data-k="${k}">${k}</button>`).join('')}</div></div>
        <div class="table-wrap"><table class="t"><thead><tr><th>Deneme</th><th>Tür</th><th>Tarih</th><th class="r">Soru</th><th class="r">D</th><th class="r">Y</th><th class="r">B</th><th class="r">Net</th><th class="r">Sıra</th><th></th></tr></thead>
        <tbody>${rows.map((r) => `<tr><td><b>${esc(r.ad)}</b></td><td><span class="chip ${r.tur === 'Türkiye Geneli' ? 'blue' : r.tur === 'Mini' ? 'warn' : ''}">${r.tur}</span></td><td>${dShort(r.d)} ${r.d.getFullYear()}</td><td class="r">${r.soru}</td><td class="r" style="color:var(--good)">${r.D}</td><td class="r" style="color:var(--bad)">${r.Y}</td><td class="r muted">${r.B}</td><td class="r"><b>${fmt(r.net)}</b></td><td class="r">${r.rank ? fmt(r.rank, 0) + '.' : '—'}</td><td class="r">${r.analiz ? `<button class="btn btn-soft btn-sm" data-action="open-exam" data-id="${r.id}">Analiz</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="10" class="muted">Bu türde deneme yok.</td></tr>'}</tbody></table></div>
      </section>
    </div>`;
  }
  /* --- Denemelerim → Hemen çöz: 1) pick denemeler, 2) optional single test, then Başla or PDF --- */
  const denemeSources = () => builderSources().filter((k) => k.tur === 'deneme');
  // The questions a session gets: each selected deneme's unseen questions (in booklet order), optionally one test.
  const dnGroups = () => denemeSources().filter((k) => state.dn.sec.includes(k.id))
    .map((k) => ({ k, qs: srcQs(k.id).filter((q) => offered(q) && (!state.dn.branslar.length || state.dn.branslar.includes(bolumOf(q)))).sort((a, b) => a.sira - b.sira) }))
    .filter((g) => g.qs.length);
  function vDenemeSec() {
    const d = state.dn;
    d.sec = (d.sec || []).filter((id) => BANK.src[id] && srcFreshN(id));
    if (d.adim === 2 && d.sec.length) return vDenemeBasla();
    d.adim = 1;
    const list = denemeSources(), open = list.filter((k) => srcFreshN(k.id)), sonuc = store.get(ukey('deneme-sonuc'), {});
    const chip = (k, n) => { const r = sonuc[k.id]; return r ? `<span class="chip good">${r.soru && r.soru < n ? `${r.soru}/${n} soru` : 'Çözüldü'} · ${fmt(r.net)} net</span>` : ''; };
    const meta = (k, n) => ` · ${Math.round(n * k.dk_soru)} dk`;
    const extra = PRACTICE.map((p) => `<article class="card ex-card">
        <div class="ex-top"><span class="chip blue">${p.type}</span>${p.play ? '<span class="chip good">Hemen başlayabilirsin</span>' : ''}</div>
        <h3>${p.name}</h3><p class="small muted">${p.desc}</p>
        <div class="ex-meta"><span>${icon('file')}${p.q} soru</span><span>${icon('clock')}${p.dur} dk</span></div>
        <div class="ex-foot"><span class="small muted">İstediğin zaman çöz</span><button class="btn ${p.play ? 'btn-yellow' : 'btn-soft'} btn-sm btn-play" data-action="${p.play ? 'start-mini' : 'start-locked'}">${icon('play')} Başla</button></div>
      </article>`).join('');
    return `<section class="card s-12 qb-src">
        <div class="card-h"><div><h2>Deneme çöz</h2><p>Çözmek istediğin denemeleri seç ve devam et. Birden fazla seçersen art arda tek oturumda çözülür.</p></div>${stepsHtml(1, 'Deneme seç', 'Başla')}</div>
        <div class="src-tools"><button type="button" class="btn btn-ghost btn-sm" data-src-all ${open.length ? '' : 'disabled'}>${icon('check')} Tümünü seç</button><button type="button" class="btn btn-ghost btn-sm" data-src-none>Seçimi temizle</button></div>
        ${list.length ? `<h3 class="src-h">Denemeler<span>${list.length}</span></h3><div class="src-grid">${list.map((k) => srcCard(k, d.sec, { chip, meta })).join('')}</div>` : '<p class="muted">Henüz deneme eklenmedi.</p>'}
        <div class="src-foot"><span id="srcSum" class="small muted"></span><span class="spacer"></span><button type="button" class="btn btn-blue" data-src-next>Devam et ${icon('arrow')}</button></div>
      </section>
      <h3 class="src-h s-12" style="margin:6px 0 -6px">Örnek ve paket denemeleri</h3>
      <div class="ex-grid s-12">${extra}</div>`;
  }
  function vDenemeBasla() {
    const d = state.dn, sonuc = store.get(ukey('deneme-sonuc'), {});
    const parts = [...new Set(BANK.sorular.filter((q) => d.sec.includes(q.kaynak) && offered(q)).map(bolumOf))].filter(Boolean);
    d.branslar = (d.branslar || []).filter((p) => parts.includes(p));
    if (d.branslar.length === parts.length) d.branslar = [];          // every branch = the whole deneme
    const inSel = (p) => BANK.sorular.filter((q) => d.sec.includes(q.kaynak) && offered(q) && (!p || bolumOf(q) === p));
    const bransCard = (key, label) => {
      const qs = inSel(key), on = key ? d.branslar.includes(key) : !d.branslar.length;
      return `<button type="button" class="brans-card${on ? ' on' : ''}${key ? '' : ' all'}" data-brans="${esc(key)}" aria-pressed="${on}"><b>${esc(label)}</b><span>${qs.length} soru · ${dkFor(qs)} dk</span></button>`;
    };
    const groups = dnGroups(), qs = groups.flatMap((g) => g.qs), dk = dkFor(qs);
    return `<section class="card s-8 qb-builder dn-start">
        <div class="card-h"><div><h2>Denemeye başla</h2><p>Süre, seçtiğin soruların sayısına göre ayarlanır. Deneme bitince soruları çözülmüş sayılır.</p></div>${stepsHtml(2, 'Deneme seç', 'Başla')}</div>
        <div class="sel-row"><span class="sel-chips">${d.sec.map((id) => `<span class="chip blue">${esc(BANK.src[id].ad)}</span>`).join('')}</span><button type="button" class="btn btn-ghost btn-sm" data-src-back>${icon('back')} Denemeleri değiştir</button></div>
        ${parts.length > 1 ? `<div class="brans"><h3 class="src-h">Branş<span>${parts.length}</span></h3>
          <div class="brans-grid" role="group" aria-label="Branş seç">${bransCard('', 'Tüm branşlar')}${parts.map((p) => bransCard(p, p)).join('')}</div>
          <p class="small muted">Bir ya da birkaç branş seç; yalnızca o branşların soruları gelir. Seçmezsen deneme tüm branşlarla çözülür.</p></div>` : ''}
        <div class="dn-stats"><div><b>${qs.length}</b><span>soru</span></div><div><b>${dk}</b><span>dakika</span></div><div><b>${groups.length}</b><span>deneme</span></div></div>
        <ul class="dn-list">${groups.map((g) => `<li><b>${esc(g.k.ad)}</b><span>${g.qs.length} soru · ${esc([...new Set(g.qs.map(bolumOf))].filter(Boolean).join(' · '))}</span></li>`).join('')}</ul>
        <div class="make-row"><button type="button" class="btn btn-blue btn-lg btn-play" data-dn="basla">${icon('play')} Başla</button><button type="button" class="btn btn-yellow btn-lg" data-dn="pdf">${icon('download')} PDF indir</button></div>
        <p class="small muted">Yarıda kapatırsan sorular harcanmaz; daha sonra yeniden başlayabilirsin. Daha önce gördüğün sorular gelmez.</p>
      </section>
      <section class="card s-4 b-sum">
        <div class="card-h"><div><h2>Son sonuçların</h2><p>Seçtiğin denemelerde</p></div></div>
        <dl class="sum-list">${d.sec.map((id) => { const r = sonuc[id]; return `<div><dt>${esc(BANK.src[id].ad)}${r && r.soru ? `<small>${r.soru} / ${srcQs(id).length} soru çözüldü</small>` : ''}</dt><dd>${r ? `${fmt(r.net)} net` : '—'}</dd></div>`; }).join('')}</dl>
        <p class="small muted">Sonuçlar Test Geçmişi → Deneme Sınavları sayfasında da listelenir.</p>
      </section>`;
  }
  function afterExams() {
    if (state.examTab !== 'pratik' || !$('.qb-src, .dn-start')) return;
    const d = state.dn;
    if (d.adim !== 2) return bindPicker(d, denemeSources, 'deneme');
    $('[data-src-back]').addEventListener('click', () => { d.adim = 1; render(false); });
    $$('[data-brans]').forEach((x) => x.addEventListener('click', () => {
      const k = x.dataset.brans;
      d.branslar = !k ? [] : d.branslar.includes(k) ? d.branslar.filter((p) => p !== k) : [...d.branslar, k];
      render(false);
    }));
    $('[data-dn="basla"]').addEventListener('click', startDenemeSel);
    $('[data-dn="pdf"]').addEventListener('click', denemeSelPdf);
  }
  const bransAd = () => { const b = state.dn.branslar; return !b.length ? '' : b.length === 1 ? `${b[0]} Branş Denemesi` : b.join(' + '); };
  const dnTitle = (groups) => `${groups.length === 1 ? groups[0].k.ad : `${groups.length} deneme`}${bransAd() ? ` · ${bransAd()}` : ''}`;
  function startDenemeSel() {
    newRound(state.dn.sec);
    const groups = dnGroups(), qs = groups.flatMap((g) => g.qs), bolum = bransAd();
    if (!qs.length) return toast('Seçtiğin denemelerde yeni soru kalmadı');
    // Questions count as seen once the deneme is finished; closing it early keeps them available.
    openPlayer(qs.map(bankItem), dnTitle(groups), dkFor(qs) * 60, {
      mode: 'metin',
      onFinish: (r) => {
        markSolved(qs.map((q) => q.id));
        const all = store.get(ukey('deneme-sonuc'), {});
        let i0 = 0;
        for (const g of groups) {   // one result per deneme, even when several were solved together
          const s = r.status.slice(i0, i0 + g.qs.length); i0 += g.qs.length;
          const D = s.filter((x) => x === 'ok').length, Y = s.filter((x) => x === 'no').length, B = s.filter((x) => x === 'empty').length, net = D - Y / 4;
          const ad = g.k.ad + (bolum ? ` · ${bolum}` : '');
          // A deneme solved test by test adds up (its questions never repeat, so the parts do not overlap).
          const prev = all[g.k.id], total = srcQs(g.k.id).length;
          const acc = prev && prev.soru != null && prev.soru + g.qs.length <= total ? prev : { D: 0, Y: 0, B: 0, soru: 0 };
          all[g.k.id] = { D: acc.D + D, Y: acc.Y + Y, B: acc.B + B, net: acc.D + D - (acc.Y + Y) / 4, soru: acc.soru + g.qs.length, tarih: new Date().toISOString() };
          saveHistory({ ad, tur: 'Deneme', soru: g.qs.length, D, Y, B, net });
          logActivity({ tur: 'cozuldu', ad, detay: `${g.k.sinav} denemesi · ${g.qs.length} soru`, net });
        }
        store.set(ukey('deneme-sonuc'), all);
        if (['denemeler', 'genel'].includes(routeKey())) render(false);
      },
    });
  }
  // The selection in the Deneme Sokağı template: one part per test, answer key at the end.
  function denemeSelPdf() {
    const groups = dnGroups(), qs = groups.flatMap((g) => g.qs);
    if (!qs.length) return toast('Seçtiğin denemelerde yeni soru kalmadı');
    const test = {
      id: 'dn-' + uid(), baslik: dnTitle(groups), ders: [...new Set(groups.map((g) => g.k.sinav))].join(' · '), no: 1, ust: 'DENEME', rozet: 'DENEME', mod: 'metin',
      bolumlu: new Set(qs.map(bolumOf)).size > 1, soruIds: qs.map((q) => q.id), cevapAnahtari: true,
    };
    downloadTest(test, false);
  }
  function saveMini(r) {
    saveHistory({ ad: 'Mini TYT Denemesi', tur: 'Mini', soru: QUESTIONS.length, D: r.D, Y: r.Y, B: r.B, net: r.net });
    logActivity({ tur: 'cozuldu', ad: 'Mini TYT Denemesi', detay: `Mini deneme · ${QUESTIONS.length} soru`, net: r.net });
  }

  /* --- Paketler --- */
  const yearlySave = (p) => Math.round((1 - p.yillik / (p.aylik * 12)) * 100);
  function vPaketAl() {
    const tab = state.pkgTab, per = state.billing, now = new Date();
    const owned = new Set(MY_PACKAGES.filter((m) => m.bit > now).map((m) => m.id));
    const list = PACKAGES.filter((p) => tab === 'Tümü' || p.sinav === tab || p.sinav === 'Tümü');
    return `<div class="view">
      <div class="toolbar s-12"><div class="tabs">${['Tümü', 'YKS', 'LGS', 'KPSS', 'Diğer'].map((k) => `<button class="${k === tab ? 'on' : ''}" data-action="pkg-tab" data-k="${k}">${k}</button>`).join('')}</div>
        <div class="seg" role="radiogroup" aria-label="Ödeme dönemi">${[['aylik', 'Aylık'], ['yillik', 'Yıllık']].map(([k, l]) => `<label><input type="radio" name="billing" value="${k}" ${k === per ? 'checked' : ''} data-action="billing"><span>${l}${k === 'yillik' ? '<em class="save-tag">indirimli</em>' : ''}</span></label>`).join('')}</div></div>
      <div class="pkg-grid s-12">${list.map((p) => {
        const amount = per === 'yillik' ? p.yillik : p.aylik;
        return `<article class="card pkg${p.featured ? ' featured' : ''}">
          ${p.featured ? '<span class="ribbon">En çok tercih edilen</span>' : ''}
          <div><span class="chip blue">${p.sinav === 'Tümü' ? 'Tüm sınavlar' : p.sinav}</span></div>
          <h3>${p.ad}</h3><p class="small muted">${p.desc}</p>
          <p class="price"><b>${price(amount)}</b><span>/ ${per === 'yillik' ? 'yıl' : 'ay'}</span></p>
          <p class="small ${per === 'yillik' ? 'good-txt' : 'muted'}">${per === 'yillik' ? `Aylık ${price(Math.round(p.yillik / 12))} · %${yearlySave(p)} tasarruf` : `Yıllık alırsan %${yearlySave(p)} tasarruf`}</p>
          <ul class="feat">${p.ozellik.map((o) => `<li>${icon('check')}<span>${o}</span></li>`).join('')}</ul>
          ${owned.has(p.id) ? `<button class="btn btn-ghost" disabled>${icon('check')} Paketin aktif</button>` : `<button class="btn ${p.featured ? 'btn-yellow' : 'btn-blue'}" data-action="buy" data-id="${p.id}">Satın al</button>`}
        </article>`;
      }).join('')}</div>
      <p class="s-12 small muted">Fiyatlar örnektir ve KDV dahildir. Ödeme sistemi henüz aktif değil.</p>
    </div>`;
  }
  function openBuy(id) {
    const p = PACKAGES.find((x) => x.id === id);
    if (!p) return;
    const per = state.billing, amount = per === 'yillik' ? p.yillik : p.aylik, root = $('#modalRoot');
    root.innerHTML = `<div class="modal-back"><div class="modal xs" role="dialog" aria-modal="true" aria-labelledby="buyTitle">
      <div class="pl-head"><div><h2 id="buyTitle">Sipariş özeti</h2><p>${p.ad}</p></div><span style="margin-left:auto"></span><button class="icon-btn" data-buy="close" aria-label="Kapat">${icon('x')}</button></div>
      <div class="buy-body">
        <dl class="sum-list"><div><dt>Paket</dt><dd>${p.ad}</dd></div><div><dt>Dönem</dt><dd>${per === 'yillik' ? '12 ay' : '1 ay'}</dd></div><div><dt>Başlangıç</dt><dd>Ödeme onaylandığında</dd></div><div class="total"><dt>Toplam (KDV dahil)</dt><dd>${price(amount)}</dd></div></dl>
        <div class="notice">${icon('clock')}<div><b>Ödeme sistemi henüz aktif değil</b><span>Ödeme altyapısı eklendiğinde bu adımdan güvenli ödeme sayfasına geçilecek. Şimdilik satın alma yapılamıyor.</span></div></div>
      </div>
      <div class="pl-foot"><span class="spacer"></span><button class="btn btn-ghost btn-sm" data-buy="close">Vazgeç</button><button class="btn btn-yellow btn-sm" disabled>Ödemeye geç (yakında)</button></div></div></div>`;
    const close = () => { document.removeEventListener('keydown', onKey); root.innerHTML = ''; };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    root.onclick = (e) => { if (e.target.classList.contains('modal-back') || e.target.closest('[data-buy="close"]')) close(); };
  }
  function vPaketlerim() {
    const now = new Date();
    return `<div class="view">${MY_PACKAGES.map((m) => {
      const p = PACKAGES.find((x) => x.id === m.id) || { ad: m.ad, ozellik: m.ozellik || [] };
      const active = m.bit > now, total = m.bit - m.bas, left = Math.max(0, Math.ceil((m.bit - now) / DAY));
      return `<section class="card s-6 mypkg${active ? '' : ' expired'}">
        <div class="card-h"><div><h2>${p.ad}</h2><p>${m.donem === 'yillik' ? 'Yıllık' : m.donem === 'aylik' ? 'Aylık' : 'Dönemlik'} paket · ${dShort(m.bas)} ${m.bas.getFullYear()} – ${dShort(m.bit)} ${m.bit.getFullYear()}</p></div>${active ? '<span class="chip good">Aktif</span>' : '<span class="chip">Süresi doldu</span>'}</div>
        ${active ? `<div class="sbar-row"><div class="sbar-top"><b>Kalan süre</b><span><strong>${left}</strong> gün</span></div>${track(((m.bit - now) / total) * 100, 'var(--brand)')}</div>` : ''}
        ${active && m.deneme ? `<div class="use-grid"><div><small>Kullanılan deneme</small><b>${m.deneme[0]} / ${m.deneme[1]}</b>${track((m.deneme[0] / m.deneme[1]) * 100, 'var(--c-mat)')}</div><div><small>Yaprak test</small><b>${ytests.length} oluşturuldu</b><span class="small muted">Sınırsız</span></div><div><small>Video çözüm</small><b>Açık</b><span class="small muted">Tüm denemelerde</span></div></div>` : ''}
        <ul class="feat">${p.ozellik.map((o) => `<li>${icon('check')}<span>${o}</span></li>`).join('')}</ul>
        <div class="ex-foot">${active ? `<span class="small muted">Yenileme tarihi: ${dShort(m.bit)} ${m.bit.getFullYear()}</span><a class="btn btn-soft btn-sm" href="#paket-al">Paketi yenile</a>` : `<span class="small muted">Bu paketin süresi doldu</span><a class="btn btn-blue btn-sm" href="#paket-al">Yeni paket seç</a>`}</div>
      </section>`;
    }).join('')}</div>`;
  }
  function vOdemeler() {
    const paid = PAYMENTS.filter((p) => p.durum === 'Ödendi').reduce((a, p) => a + p.tutar, 0);
    return `<div class="view">
      <div class="s-12 notice">${icon('clock')}<div><b>Ödeme sistemi henüz aktif değil</b><span>Aktif olduğunda tüm ödemelerin ve faturaların burada listelenecek. Aşağıdaki kayıtlar örnektir.</span></div></div>
      <section class="card s-12"><div class="card-h"><div><h2>Ödeme geçmişi</h2><p>${PAYMENTS.length} işlem · toplam ödenen ${price(paid)}</p></div></div>
        <div class="table-wrap"><table class="t"><thead><tr><th>Tarih</th><th>Sipariş no</th><th>Paket</th><th>Ödeme yöntemi</th><th class="r">Tutar</th><th>Durum</th><th></th></tr></thead>
        <tbody>${PAYMENTS.map((p) => `<tr><td>${dShort(p.tarih)} ${p.tarih.getFullYear()}</td><td class="muted">${p.no}</td><td><b>${p.paket}</b></td><td>${p.yontem}</td><td class="r"><b>${price(p.tutar)}</b></td><td><span class="chip ${p.durum === 'Ödendi' ? 'good' : 'warn'}">${p.durum}</span></td><td class="r"><button class="btn btn-ghost btn-sm" data-action="invoice">${icon('download')} Fatura</button></td></tr>`).join('')}</tbody></table></div>
      </section>
    </div>`;
  }

  /* ---------------- router ---------------- */
  const ROUTES = {
    genel: { title: 'Genel Bakış', v: vOverview, after: afterOverview },
    denemeler: { title: 'Denemelerim', v: vExams, after: afterExams },
    analiz: { title: 'Sonuç Analizi', v: vAnaliz },
    eksikler: { title: 'Konu Eksiklerim', v: vEksikler },
    yanlislar: { title: 'Yanlış Defteri', v: vYanlislar },
    plan: { title: 'Çalışma Planı', v: vPlan, after: afterPlan },
    siralama: { title: 'Sıralama', v: vSiralama, after: afterSiralama },
    ayarlar: { title: 'Ayarlar', v: vAyarlar, after: afterAyarlar },
    'test-olustur': { title: 'Yaprak Test Oluştur', v: vTestOlustur, after: afterTestOlustur },
    'yaprak-testler': { title: 'Oluşturulan Yaprak Testler', v: vYaprakTestler },
    'deneme-gecmisi': { title: 'Deneme Sınavları', v: vDenemeGecmisi },
    'paket-al': { title: 'Paket Satın Al', v: vPaketAl },
    paketlerim: { title: 'Paketlerim', v: vPaketlerim },
    odemeler: { title: 'Ödemelerim', v: vOdemeler },
  };
  const routeKey = () => { const k = location.hash.slice(1); return ROUTES[k] ? k : 'genel'; };

  function render(animate = true) {
    const key = routeKey(), r = ROUTES[key], content = $('#content');
    charts = [];
    content.innerHTML = r.v();
    if (!animate) $$('.view > *', content).forEach((el) => { el.style.animation = 'none'; });
    $('#pageTitle').textContent = r.title;
    document.title = `${r.title} | Deneme Sokağı`;
    $$('.sb-nav a[data-route]').forEach((a) => a.classList.toggle('active', a.dataset.route === key));
    const activeGroup = $('.sb-nav a.active') && $('.sb-nav a.active').closest('.sb-group');
    if (activeGroup && activeGroup.classList.contains('closed')) setSbGroup(activeGroup.dataset.grup, true);   // the open page stays visible
    if (r.after) r.after(animate);
    if (animate) animateIn(content);
    else {
      $$('[data-w]', content).forEach((i) => { i.style.transition = 'none'; i.style.width = i.dataset.w; });
      $$('[data-h]', content).forEach((i) => { i.style.transition = 'none'; i.style.height = i.dataset.h; });
      $$('[data-ring]', content).forEach((c) => { c.style.transition = 'none'; c.style.strokeDashoffset = c.dataset.ring; });
    }
    tickCountdowns();
  }
  window.addEventListener('hashchange', () => { closeSidebar(); render(true); window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); });
  let rz;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => charts.forEach((f) => f()), 150); });

  function tickCountdowns() {
    $$('[data-countdown]').forEach((el) => {
      const ms = Math.max(0, new Date(el.dataset.countdown) - Date.now());
      const set = (k, v) => { const b = $(`[data-cd="${k}"]`, el); if (b) b.textContent = v; };
      set('d', Math.floor(ms / 864e5)); set('h', String(Math.floor(ms / 36e5) % 24).padStart(2, '0'));
      set('m', String(Math.floor(ms / 6e4) % 60).padStart(2, '0')); set('s', String(Math.floor(ms / 1e3) % 60).padStart(2, '0'));
    });
  }
  setInterval(tickCountdowns, 1000);

  /* ---------------- content actions (delegated) ---------------- */
  function toggleTask(id, el) {
    const t = findTask(id); if (!t) return;
    t.done = !t.done; savePlan();
    el.classList.toggle('done', t.done);
    if (el.matches('[role="checkbox"]')) el.setAttribute('aria-checked', t.done);
    const today = plan.days[todayIdx], d = today.filter((x) => x.done).length;
    if ($('#taskCount')) { $('#taskCount').textContent = `${d}/${today.length}`; $('#taskBar').style.width = `${(d / today.length) * 100}%`; }
    if (t.done) toast('Görev tamamlandı');
  }
  document.addEventListener('change', (e) => {
    const lab = e.target.closest('label.task');
    if (lab) toggleTask(lab.dataset.task, lab);
  });
  $('#content').addEventListener('keydown', (e) => {
    const chip = e.target.closest('[data-pchip]');
    if (chip && (e.key === ' ' || e.key === 'Enter') && !e.target.closest('button')) { e.preventDefault(); toggleTask(chip.dataset.pchip, chip); }
  });
  $('#content').addEventListener('change', (e) => {
    if (e.target.id === 'examSelect') { state.exam = e.target.value; render(true); }
  });
  $('#content').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-pchip]');
    const a = e.target.closest('[data-action]');
    if (chip && !a) return toggleTask(chip.dataset.pchip, chip);
    if (!a) return;
    const act = a.dataset.action;
    switch (act) {
      case 'start-mini': return openPlayer(QUESTIONS.map(qItem), 'Mini TYT Denemesi', 10 * 60, { onFinish: saveMini });
      case 'start-locked': return toast('Bu örnek panelde yalnızca Mini TYT Denemesi çözülebilir');
      case 'retry': { const it = a.dataset.bank ? bankItem(BANK.byId[a.dataset.bank]) : qItem(QUESTIONS[+a.dataset.q], +a.dataset.q); return it && openPlayer([it], 'Yanlış defteri · tekrar', 3 * 60); }
      case 'yt-preview': { const t = ytests.find((x) => x.id === a.dataset.id); return t && openTestPreview(t); }
      case 'yt-solve': return solveTest(a.dataset.id);
      case 'yt-pdf': { const t = ytests.find((x) => x.id === a.dataset.id); return t && downloadTest(t); }
      case 'yt-del': {
        if (!a.dataset.armed) {
          a.dataset.armed = '1'; a.classList.add('armed'); a.textContent = 'Silmek için tekrar tıkla';
          setTimeout(() => { if (a.isConnected) { delete a.dataset.armed; a.classList.remove('armed'); a.innerHTML = icon('trash'); } }, 3000);
          return;
        }
        ytests = ytests.filter((x) => x.id !== a.dataset.id); saveTests(); toast('Yaprak test silindi'); return render(false);
      }
      case 'hist-filter': state.histFilter = a.dataset.k; return render(false);
      case 'pkg-tab': state.pkgTab = a.dataset.k; return render(false);
      case 'billing': state.billing = a.value; return render(false);
      case 'buy': return openBuy(a.dataset.id);
      case 'invoice': return toast('Faturalar, ödeme sistemi aktif olduğunda indirilebilecek');
      case 'video': return openVideo(+a.dataset.q);
      case 'register': upcomingReg[a.dataset.id] = true; store.set(ukey('reg'), upcomingReg); toast('Denemeye kaydoldun. Hatırlatma göndereceğiz.'); return render(false);
      case 'unregister': upcomingReg[a.dataset.id] = false; store.set(ukey('reg'), upcomingReg); toast('Deneme kaydın iptal edildi'); return render(false);
      case 'open-exam': state.exam = a.dataset.id; location.hash = 'analiz'; return;
      case 'exam-tab': state.examTab = a.dataset.k; return render(true);
      case 'analiz-subj': state.analizSubj = a.dataset.k; return render(false);
      case 'eksik-filter': state.eksikFilter = a.dataset.k; return render(true);
      case 'wrong-filter': state.wrongFilter = a.dataset.k; return render(true);
      case 'rank-tab': state.rankTab = a.dataset.k; return render(true);
      case 'add-plan': plan.days[todayIdx].push({ id: uid(), s: a.dataset.s, t: `${a.dataset.topic} · 20 soru`, done: false }); savePlan(); return toast(`${a.dataset.topic} bugünkü plana eklendi`);
      case 'del-task': { e.stopPropagation(); for (const d of plan.days) { const i = d.findIndex((t) => t.id === a.dataset.id); if (i > -1) d.splice(i, 1); } savePlan(); return render(false); }
      case 'learned': {
        const card = a.closest('[data-wrong]');
        wrongs = wrongs.filter((w) => w.id !== a.dataset.id); store.set(ukey('wrongs'), wrongs);
        card.style.transition = 'opacity .3s, transform .3s'; card.style.opacity = 0; card.style.transform = 'translateX(16px)';
        setTimeout(() => render(false), 300); return toast('Soru defterden çıkarıldı');
      }
      case 'reset-pw': return resetPassword();
      case 'logout': return logout();
    }
  });

  /* ---------------- exam player ---------------- */
  // items: [{ s, t, o, a (index | null), sol, img?, fig?, ust?, alt?, konu?, ref }]
  // opts.mode 'gorsel' shows the question image with A–E answer buttons; opts.onFinish(result) receives D/Y/B/net.
  function openPlayer(items, title, seconds, opts = {}) {
    const qs = items, mode = opts.mode || 'metin';
    const st = { cur: 0, ans: qs.map(() => null), flag: qs.map(() => false), left: seconds, timer: null, done: false, wrong: [] };
    const root = $('#modalRoot');
    const lastFocus = document.activeElement;
    root.innerHTML = `<div class="modal-back"><div class="modal player" role="dialog" aria-modal="true" aria-labelledby="plTitle">
      <div class="pl-head"><div><h2 id="plTitle">${esc(title)}</h2><p>${qs.length} soru · ${Math.round(seconds / 60)} dakika · Net = D − Y/4</p></div>
        <span class="timer" id="plTimer">${icon('clock')}<span>00:00</span></span>
        <button class="icon-btn" data-pl="close" aria-label="Kapat">${icon('x')}</button></div>
      <div class="progress-line"><i id="plProg"></i></div>
      <div id="plConfirm"></div>
      <div id="plMain"></div></div></div>`;
    const main = $('#plMain', root);
    const fmtT = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
    const tick = () => {
      st.left--; $('#plTimer span').textContent = fmtT(Math.max(0, st.left));
      $('#plTimer').classList.toggle('low', st.left <= 60);
      if (st.left <= 0) { finish(); toast('Süre doldu, test tamamlandı'); }
    };
    $('#plTimer span').textContent = fmtT(st.left);
    st.timer = setInterval(tick, 1000);
    // Questions are shown as text (figures as pictures); the cropped page is only a fallback when there is no text.
    const hasText = (q) => !!(q.t || q.ust || q.alt || (q.o || []).some(Boolean));
    const asImage = (q) => !!q.img && (mode === 'gorsel' || q.imgOnly || !hasText(q));
    const stem = (t) => (window.DSYaprakTest ? window.DSYaprakTest.stemHtml(t) : esc(t));
    const richOpt = (t) => (window.DSYaprakTest ? window.DSYaprakTest.rich(t) : esc(t));
    const yonText = (y) => y.replace(/^soruları/i, 'Bu soruları');   // "35. – 36. soruları …" without the numbers
    const lead = (q, img) => `${q.yon ? `<p class="pl-yon">${esc(yonText(q.yon))}</p>` : ''}${img && q.passageImg ? `<img class="pl-img pl-pimg" src="${esc(q.passageImg)}" alt="Paragraf">` : q.passage ? `<div class="pl-passage">${esc(q.passage).replace(/\((\d+)\) ----/g, (m, n) => (+n === q.no ? '<mark>----</mark>' : '----'))}</div>` : ''}`;
    const body = (q) => {
      if (asImage(q)) return lead(q, true) + `<img class="pl-img" src="${esc(q.img)}" alt="Soru ${st.cur + 1}">`;
      const figImg = (src, w) => `<img class="pl-fig" src="${esc(src)}" alt="Şekil"${w ? ` style="width:${w}px"` : ''}>`;
      if (q.parts) return lead(q) + q.parts.map((p) => (p.fig ? figImg(p.fig, p.w) : `<div class="pl-text">${stem(p.t)}</div>`)).join('');
      if (q.fig) return lead(q) + `${q.ust ? `<div class="pl-text">${stem(q.ust)}</div>` : ''}<img class="pl-fig" src="${esc(q.fig)}" alt="Şekil"${q.figW ? ` style="width:${q.figW}px"` : ''}>${q.alt ? `<div class="pl-text">${stem(q.alt)}</div>` : ''}`;
      return lead(q) + (q.t ? `<div class="pl-text">${stem(q.t)}</div>` : '<p class="pl-text muted">Paragrafta işaretli boşluğa gelecek seçeneği bul.</p>');
    };

    function draw() {
      const q = qs[st.cur], n = qs.length, answered = st.ans.filter((x) => x !== null).length, letters = asImage(q) || !(q.o || []).some(Boolean);
      $('#plProg').style.width = `${(answered / n) * 100}%`;
      main.innerHTML = `<div class="pl-body">
        <div class="pl-q"><div class="pl-q-top"><b>Soru ${st.cur + 1} / ${n}</b>${subjChip(q.s)}${q.konu ? `<span class="chip">${esc(q.konu)}</span>` : ''}${st.flag[st.cur] ? '<span class="chip warn">İşaretli</span>' : ''}</div>
          ${body(q)}
          <div class="opts${letters ? ' letters' : ''}" role="radiogroup" aria-label="Seçenekler">${L5.map((l, i) => `<button class="opt${st.ans[st.cur] === i ? ' sel' : ''}" role="radio" aria-checked="${st.ans[st.cur] === i}" data-opt="${i}" aria-label="Şık ${l}"><span class="L">${l}</span>${letters ? '' : `<span>${richOpt(q.o[i] || '')}</span>`}</button>`).join('')}</div>
          <p class="small muted" style="margin-top:14px">Klavye: A–E ile işaretle, ← → ile geç. Seçili şıkka tekrar tıklarsan boş bırakırsın.</p>
        </div>
        <aside class="pl-side"><h3>Optik form</h3>
          <div class="optik">${qs.map((_, qi) => `<div class="optik-row${qi === st.cur ? ' cur' : ''}${st.flag[qi] ? ' flag' : ''}"><button class="n" data-go="${qi}" aria-label="Soru ${qi + 1}">${qi + 1}</button>${L5.map((l, li) => `<button class="bub${st.ans[qi] === li ? ' on' : ''}" data-bub="${qi}-${li}" aria-label="Soru ${qi + 1} şık ${l}">${l}</button>`).join('')}</div>`).join('')}</div>
          <div class="optik-legend"><span><i style="--c:var(--text)"></i>Cevaplandı: ${answered}</span><span><i style="--c:var(--warn)"></i>İşaretli: ${st.flag.filter(Boolean).length}</span><span><i style="--c:var(--faint)"></i>Boş: ${n - answered}</span></div>
        </aside></div>
        <div class="pl-foot"><button class="btn ${st.flag[st.cur] ? 'flagged' : 'btn-ghost'} btn-sm" data-pl="flag" aria-label="${st.flag[st.cur] ? 'İşareti kaldır' : 'Sonra bak'}">${icon('flag')} <span class="pl-lbl">${st.flag[st.cur] ? 'İşareti kaldır' : 'Sonra bak'}</span></button><span class="spacer"></span>
          <button class="btn btn-ghost btn-sm" data-pl="prev" aria-label="Önceki" ${st.cur === 0 ? 'disabled' : ''}>${icon('back')} <span class="pl-lbl">Önceki</span></button>
          ${st.cur < n - 1 ? `<button class="btn btn-blue btn-sm" data-pl="next">Sonraki ${icon('arrow')}</button>` : ''}
          <button class="btn btn-yellow btn-sm" data-pl="finish">Testi bitir</button></div>`;
      keepRowVisible();
    }
    const keepRowVisible = () => { const row = $('.optik-row.cur', root); if (row) row.scrollIntoView({ block: 'nearest' }); };
    const pick = (qi, li) => { st.ans[qi] = st.ans[qi] === li ? null : li; draw(); };
    const confirmBar = (msg, yes, yesTxt) => {
      $('#plConfirm').innerHTML = `<div class="confirm-bar"><b>${msg}</b><button class="btn btn-ghost btn-sm" data-pl="cancel">Devam et</button><button class="btn btn-yellow btn-sm" data-pl="${yes}">${yesTxt}</button></div>`;
    };
    function finish() {
      clearInterval(st.timer); st.done = true; $('#plConfirm').innerHTML = '';
      $('#plTimer').classList.remove('low');
      let D = 0, Y = 0, B = 0, U = 0;
      const status = qs.map((q, i) => {
        if (st.ans[i] === null) { B++; return 'empty'; }
        if (q.a == null) { U++; return 'unknown'; }
        if (st.ans[i] === q.a) { D++; return 'ok'; }
        Y++; return 'no';
      });
      const net = D - Y / 4, pct = (Math.max(0, net) / qs.length) * 100;
      st.wrong = qs.map((q, i) => (status[i] === 'no' || status[i] === 'empty' ? i : null)).filter((x) => x !== null);
      $('#plProg').style.width = '100%';
      main.innerHTML = `<div class="result">
        <div class="result-top">${ringSvg(pct, fmt(net), 'net')}
          <div><h3>${net >= qs.length * 0.8 ? 'Harika iş çıkardın!' : net >= qs.length * 0.5 ? 'İyi gidiyorsun!' : 'Eksiklerini birlikte kapatalım'}</h3>
          <p>${qs.length} sorunun ${D} tanesini doğru yanıtladın. Süre: ${fmtT(seconds - Math.max(0, st.left))}</p>
          <div class="res-stats"><div class="g"><small>Doğru</small><b>${D}</b></div><div class="b"><small>Yanlış</small><b>${Y}</b></div><div><small>Boş</small><b>${B}</b></div><div><small>Net</small><b>${fmt(net)}</b></div></div>
          ${U ? `<p class="small muted" style="margin-top:8px">${U} sorunun kaynağında cevap anahtarı olmadığı için puanlanmadı.</p>` : ''}</div></div>
        <div class="review">${qs.map((q, i) => { const s = status[i]; return `<details class="rv"><summary><span class="st ${s === 'unknown' ? 'empty' : s}">${s === 'ok' ? icon('check') : s === 'no' ? icon('x') : '–'}</span><span class="q">${i + 1}. ${esc(q.t || `${q.konu || 'Paragraf'} · boşluk`)}</span><em>Sen: ${st.ans[i] === null ? 'Boş' : L5[st.ans[i]]} · Doğru: ${q.a == null ? '—' : L5[q.a]}</em></summary><div class="rv-body">${q.sol.length ? q.sol.map(esc).join('<br>') : q.img ? `<img class="rv-img" src="${esc(q.img)}" alt="Soru ${i + 1}">` : 'Bu soru için çözüm henüz eklenmedi.'}</div></details>`; }).join('')}</div>
      </div>`;
      const oldFoot = $('.pl-foot', root); if (oldFoot) oldFoot.remove();
      main.insertAdjacentHTML('afterend', `<div class="pl-foot"><span class="small muted">${opts.onFinish ? 'Sonucun kaydedildi.' : 'Sonuçlar örnek panelde kaydedilmez.'}</span><span class="spacer"></span>${st.wrong.length ? '<button class="btn btn-soft btn-sm" data-pl="to-notebook">Yanlış ve boşları deftere ekle</button>' : ''}<button class="btn btn-blue btn-sm" data-pl="close-now">Panele dön</button></div>`);
      animateIn(main);
      if (opts.onFinish) opts.onFinish({ D, Y, B, U, net, status });
    }
    function close() {
      clearInterval(st.timer);
      document.removeEventListener('keydown', onKey);
      root.innerHTML = '';
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); return st.done ? close() : confirmBar('Testten çıkmak istiyor musun? Cevapların kaydedilmeyecek.', 'close-now', 'Çık'); }
      if (st.done || /input|select|textarea/i.test(e.target.tagName)) return;
      const k = e.key.toUpperCase();
      if (L5.includes(k)) pick(st.cur, L5.indexOf(k));
      else if (e.key === 'ArrowRight' && st.cur < qs.length - 1) { st.cur++; draw(); }
      else if (e.key === 'ArrowLeft' && st.cur > 0) { st.cur--; draw(); }
    }
    document.addEventListener('keydown', onKey);
    root.onclick = (e) => {
      const opt = e.target.closest('[data-opt]'); if (opt) return pick(st.cur, +opt.dataset.opt);
      const bub = e.target.closest('[data-bub]'); if (bub) { const [qi, li] = bub.dataset.bub.split('-').map(Number); st.cur = qi; return pick(qi, li); }
      const go = e.target.closest('[data-go]'); if (go) { st.cur = +go.dataset.go; return draw(); }
      const b = e.target.closest('[data-pl]'); if (!b) return;
      switch (b.dataset.pl) {
        case 'next': st.cur++; return draw();
        case 'prev': st.cur--; return draw();
        case 'flag': st.flag[st.cur] = !st.flag[st.cur]; return draw();
        case 'finish': { const empty = st.ans.filter((x) => x === null).length; return empty ? confirmBar(`${empty} soru boş. Yine de bitirmek istiyor musun?`, 'finish-now', 'Bitir') : finish(); }
        case 'finish-now': return finish();
        case 'cancel': $('#plConfirm').innerHTML = ''; return;
        case 'close': return st.done ? close() : confirmBar('Testten çıkmak istiyor musun? Cevapların kaydedilmeyecek.', 'close-now', 'Çık');
        case 'close-now': return close();
        case 'to-notebook': {
          let added = 0;
          st.wrong.forEach((i) => {
            const q = qs[i], ref = q.ref || {};
            const exists = wrongs.some((w) => (ref.bank ? w.bank === ref.bank : !w.bank && w.q === ref.q));
            if (!exists) { wrongs.unshift({ id: uid(), ...ref, topic: q.konu || SUBJ[q.s].name, src: title, date: dShort(new Date()), kind: 'Bilgi eksiği', your: st.ans[i] === null ? '—' : L5[st.ans[i]] }); added++; }
          });
          store.set(ukey('wrongs'), wrongs); b.remove();
          return toast(added ? `${added} soru yanlış defterine eklendi` : 'Bu sorular zaten defterinde');
        }
      }
    };
    draw();
    setTimeout(() => { const o = $('.opt', root); if (o) o.focus(); }, 50);
  }

  /* ---------------- video solution (sample player) ---------------- */
  function openVideo(qi) {
    const q = QUESTIONS[qi], root = $('#modalRoot'), DUR = 12;
    let t = 0, timer = null;
    root.innerHTML = `<div class="modal-back"><div class="modal sm" role="dialog" aria-modal="true" aria-labelledby="vdTitle">
      <div class="pl-head"><div><h2 id="vdTitle">Video çözüm</h2><p>${SUBJ[q.s].name} · örnek oynatıcı</p></div><span style="margin-left:auto"></span><button class="icon-btn" data-vd="close" aria-label="Kapat">${icon('x')}</button></div>
      <div class="vid"><div class="vid-frame" id="vdFrame"><div class="vid-board">${q.sol.map((s) => `<p>${esc(s)}</p>`).join('')}</div>
        <button class="vid-play" data-vd="play" aria-label="Oynat">${icon('play')}</button>
        <div class="vid-bar"><button data-vd="toggle" aria-label="Oynat / duraklat" id="vdToggle">${icon('play')}</button><div class="vid-prog"><i id="vdProg"></i></div><span id="vdTime">0:00 / 0:${DUR}</span></div></div>
        <div class="vid-side"><h3>Soru</h3><p class="small">${esc(q.t)}</p><h3>Çözüm adımları</h3><ol>${q.sol.map((s) => `<li>${esc(s)}</li>`).join('')}</ol><p class="small muted">Doğru cevap: <b style="color:var(--good)">${L5[q.a]}) ${esc(q.o[q.a])}</b></p></div></div></div></div>`;
    const lines = $$('.vid-board p', root);
    const paint = () => {
      $('#vdProg').style.width = `${(t / DUR) * 100}%`;
      $('#vdTime').textContent = `0:${String(Math.floor(t)).padStart(2, '0')} / 0:${DUR}`;
      lines.forEach((l, i) => l.classList.toggle('on', t >= (i * DUR) / (lines.length + 0.5)));
      $('#vdToggle').innerHTML = icon(timer ? 'pause' : 'play');
      $('#vdFrame').classList.toggle('playing', !!timer || t > 0);
    };
    const play = () => { if (timer) return; if (t >= DUR) t = 0; timer = setInterval(() => { t = Math.min(DUR, t + 0.1); if (t >= DUR) { clearInterval(timer); timer = null; } paint(); }, 100); paint(); };
    const pause = () => { clearInterval(timer); timer = null; paint(); };
    const close = () => { pause(); document.removeEventListener('keydown', onKey); root.innerHTML = ''; };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    root.onclick = (e) => {
      if (e.target.classList.contains('modal-back')) return close();
      const b = e.target.closest('[data-vd]'); if (!b) return;
      if (b.dataset.vd === 'close') close();
      else if (b.dataset.vd === 'play') play();
      else (timer ? pause : play)();
    };
    paint();
  }

  /* ---------------- shell: sidebar, menus, search, theme ---------------- */
  // Sidebar groups that fold away (Test Geçmişi, Paketler); closed unless the viewer opened them.
  function setSbGroup(g, on, save = true) {
    const btn = $(`.sb-toggle[data-grup="${g}"]`), box = $(`#sbg-${g}`);
    if (!btn || !box) return;
    btn.setAttribute('aria-expanded', String(on));
    box.classList.toggle('closed', !on);
    if (save) { const all = store.get('ds-sb-groups', {}); all[g] = on; store.set('ds-sb-groups', all); }
  }
  $$('.sb-toggle').forEach((btn) => {
    setSbGroup(btn.dataset.grup, !!store.get('ds-sb-groups', {})[btn.dataset.grup], false);
    btn.addEventListener('click', () => setSbGroup(btn.dataset.grup, btn.getAttribute('aria-expanded') !== 'true'));
  });
  const sidebar = $('#sidebar'), backdrop = $('#sbBackdrop');
  const closeSidebar = () => { sidebar.classList.remove('open'); backdrop.classList.remove('open'); };
  $('#menuBtn').addEventListener('click', () => { sidebar.classList.add('open'); backdrop.classList.add('open'); });
  backdrop.addEventListener('click', closeSidebar);
  document.querySelectorAll('.sb-nav a[data-route]').forEach((a) => a.addEventListener('click', closeSidebar));
  $('[data-action="support"]').addEventListener('click', (e) => { e.preventDefault(); toast('Destek ekibine panelden mesaj gönderme özelliği yakında'); });

  function setupMenu(btnId, menuId) {
    const btn = $('#' + btnId), menu = $('#' + menuId);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = menu.hidden;
      $$('.menu').forEach((m) => { m.hidden = true; }); $$('[aria-expanded]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
      menu.hidden = !open; btn.setAttribute('aria-expanded', String(open));
    });
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) menu.hidden = true; e.stopPropagation(); });
  }
  setupMenu('bellBtn', 'notifMenu'); setupMenu('avatarBtn', 'avatarMenu');
  document.addEventListener('click', () => { $$('.menu').forEach((m) => { m.hidden = true; }); $('#searchResults').classList.remove('open'); });
  $('#notifList').innerHTML = NOTIFS.map((n) => `<li><i></i><div><b>${esc(n.t)}</b><span>${esc(n.s)} · ${n.time}</span></div></li>`).join('');
  const showNotifRead = () => { if (userData('notif-read', false)) { $$('#notifList li').forEach((li) => li.classList.add('read')); $('#bellDot').hidden = true; } };
  $('#markRead').addEventListener('click', () => { $$('#notifList li').forEach((li) => li.classList.add('read')); $('#bellDot').hidden = true; store.set(ukey('notif-read'), true); });

  // theme
  // Light is the default; dark is only used when the user turns it on.
  const effectiveDark = () => document.documentElement.dataset.dsTheme === 'dark';
  function setTheme(mode) {
    if (mode === 'dark') document.documentElement.dataset.dsTheme = 'dark'; else delete document.documentElement.dataset.dsTheme;
    try { if (mode === 'dark') localStorage.setItem('ds-theme', 'dark'); else localStorage.removeItem('ds-theme'); } catch (e) { /* ignore */ }
  }
  $('#themeBtn').addEventListener('click', () => { setTheme(effectiveDark() ? 'light' : 'dark'); if (routeKey() === 'ayarlar') render(false); });

  // search
  const INDEX = [
    ...Object.entries(ROUTES).map(([k, r]) => ({ label: r.title, sub: 'Sayfa', go: () => { location.hash = k; } })),
    ...TOPICS.map((t) => ({ label: t.n, sub: `Konu · %${t.p}`, go: () => { state.eksikFilter = t.s; location.hash = 'eksikler'; if (routeKey() === 'eksikler') render(true); } })),
    ...EXAMS.map((e) => ({ label: e.name, sub: `Deneme · ${fmt(e.net)} net`, go: () => { state.exam = e.id; if (routeKey() === 'analiz') render(true); else location.hash = 'analiz'; } })),
    ...UPCOMING.map((u) => ({ label: u.name, sub: `Yaklaşan · ${dShort(u.date)}`, go: () => { state.examTab = 'yaklasan'; if (routeKey() === 'denemeler') render(true); else location.hash = 'denemeler'; } })),
  ];
  const norm = (s) => s.toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i');
  const sInput = $('#search'), sRes = $('#searchResults');
  let sSel = 0, sHits = [];
  const drawSearch = () => {
    const q = norm(sInput.value.trim());
    if (!q) { sRes.classList.remove('open'); return; }
    sHits = INDEX.filter((x) => norm(x.label).includes(q)).slice(0, 8);
    sSel = Math.min(sSel, Math.max(0, sHits.length - 1));
    sRes.innerHTML = sHits.length ? sHits.map((h, i) => `<button role="option" class="${i === sSel ? 'sel' : ''}" data-i="${i}">${esc(h.label)}<small>${h.sub}</small></button>`).join('') : '<div class="search-empty">Sonuç bulunamadı</div>';
    sRes.classList.add('open');
  };
  const pickSearch = (i) => { const h = sHits[i]; if (!h) return; sInput.value = ''; sRes.classList.remove('open'); sInput.blur(); h.go(); };
  sInput.addEventListener('input', () => { sSel = 0; drawSearch(); });
  sInput.addEventListener('click', (e) => e.stopPropagation());
  sInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sSel = Math.min(sHits.length - 1, sSel + 1); drawSearch(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sSel = Math.max(0, sSel - 1); drawSearch(); }
    else if (e.key === 'Enter') { e.preventDefault(); pickSearch(sSel); }
    else if (e.key === 'Escape') { sInput.value = ''; sRes.classList.remove('open'); sInput.blur(); }
  });
  sRes.addEventListener('click', (e) => { e.stopPropagation(); const b = e.target.closest('[data-i]'); if (b) pickSearch(+b.dataset.i); });
  document.addEventListener('keydown', (e) => { if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName) && !$('#modalRoot').innerHTML) { e.preventDefault(); sInput.focus(); } });

  /* ---------------- user / auth ---------------- */
  function applyUser() {
    const p = profile || {};
    user.name = p.name || user.name;
    user.first = user.name.split(' ')[0];
    user.city = p.city || user.city; user.school = p.school ?? user.school;
    user.exam = p.exam || user.exam; user.alan = p.alan || user.alan;
    const ini = user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toLocaleUpperCase('tr')).join('');
    $('.avatar').textContent = ini || 'DS';
    $('.av-name').innerHTML = `${esc(user.name)}<small>${esc([user.exam, user.alan].filter((x) => x && x !== '—').join(' · '))}</small>`;
  }
  async function logout() {
    try { if (window.DSAuth) await window.DSAuth.signOut(); } catch (e) { /* ignore */ }
    location.href = window.DSAuth ? 'giris.html' : 'index.html';
  }
  async function resetPassword() {
    if (!window.DSAuth) return toast('Örnek panelde e-posta gönderilmez');
    try { await window.DSAuth.resetPassword(user.email); toast('Şifre sıfırlama bağlantısı e-postana gönderildi'); }
    catch (e) { toast(e.message || 'Bağlantı gönderilemedi'); }
  }

  async function init() {
    let u = null;
    if (window.DSAuth) { try { u = await window.DSAuth.getUser(); } catch (e) { u = null; } }
    if (!u && window.DSAuth && !window.DS_PREVIEW) {
      try { sessionStorage.setItem('ds-next', 'panel.html' + location.hash); } catch (e) { /* default: panel.html */ }
      location.replace('giris.html');
      return;
    }
    user = {
      name: (u && u.name) || 'Ece Yılmaz', email: (u && u.email) || 'ornek@denemesokagi.com',
      city: 'İstanbul', school: 'Örnek Anadolu Lisesi', exam: (u && u.exam) || 'YKS', alan: (u && u.alan) || 'Sayısal',
    };
    loadProgress();          // per-account data first: the profile can rename the user
    applyUser();
    showNotifRead();
    document.body.classList.add('ready');
    render(true);
  }
  init();
})();
