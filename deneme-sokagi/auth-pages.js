/* Behaviour for giris.html, kayit.html and sifre.html (body[data-page]). Uses window.DSAuth from auth.js. */
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const A = window.DSAuth;
  const page = document.body.dataset.page;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
  const ICON = (id) => `<svg aria-hidden="true"><use href="#i-${id}"/></svg>`;

  // Only allow redirects to our own pages, e.g. "panel.html#analiz".
  const next = (() => {
    const n = new URLSearchParams(location.search).get('next') || '';
    return /^[a-z0-9-]+\.html(#[a-z0-9-]+)?$/i.test(n) ? n : 'panel.html';
  })();

  function setErr(id, msg) {
    const input = document.getElementById(id), out = document.getElementById(id + '-err');
    if (input) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (out) out.textContent = msg || '';
    return !msg;
  }
  function alertBox(el, msg, kind = 'bad') {
    if (!el) return;
    el.innerHTML = msg ? `<div class="alert ${kind}" role="${kind === 'bad' ? 'alert' : 'status'}">${ICON(kind === 'bad' ? 'alert' : 'check')}<span>${esc(msg)}</span></div>` : '';
  }
  function loading(btn, on) {
    btn.classList.toggle('loading', on);
    btn.disabled = on;
  }
  function doneCard({ mail = false, title, text, btn }) {
    $('#authBox').innerHTML = `<div class="done-card">
      <div class="done-ic${mail ? ' mail' : ''}">${mail
        ? '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>'
        : '<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>'}</div>
      <h1>${esc(title)}</h1><p>${text}</p>${btn || ''}</div>`;
  }

  // Demo-mode notice
  const note = $('#modeNote');
  if (note && A && A.mode === 'demo') {
    note.innerHTML = `<div class="alert warn">${ICON('alert')}<span><b>Demo modu:</b> hesaplar yalnızca bu tarayıcıda saklanır. Gerçek hesaplar için Supabase bağlantısı kurulmalı.</span></div>`;
  }

  // Show / hide password
  document.querySelectorAll('[data-eye]').forEach((b) => b.addEventListener('click', () => {
    const inp = document.getElementById(b.dataset.eye), show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    b.innerHTML = ICON(show ? 'eyeoff' : 'eye');
    b.setAttribute('aria-label', show ? 'Şifreyi gizle' : 'Şifreyi göster');
  }));

  // Password strength
  const strength = (p) => {
    if (!p) return 0;
    let s = 0;
    if (p.length >= 8) s++;
    if (/[a-zçğıöşü]/.test(p) && /[A-ZÇĞİÖŞÜ]/.test(p)) s++;
    if (/\d/.test(p)) s++;
    if (/[^A-Za-z0-9çğıöşüÇĞİÖŞÜ]/.test(p)) s++;
    if (p.length < 8) s = Math.min(s, 1);
    if (p.length >= 12 && s === 3) s = 4;
    return Math.max(1, s);
  };
  const S_TXT = ['Harf, rakam ve sembol karıştırarak güçlendir.', 'Zayıf şifre', 'Orta şifre', 'İyi şifre', 'Güçlü şifre'];
  const pw = $('#password'), meter = $('#strength'), meterTxt = $('#strengthTxt');
  if (pw && meter) pw.addEventListener('input', () => { const s = strength(pw.value); meter.dataset.s = s; if (meterTxt) meterTxt.textContent = S_TXT[s]; });

  // Clear a field's error as soon as it is edited
  document.querySelectorAll('.input, .select').forEach((i) => i.addEventListener('input', () => { if (i.getAttribute('aria-invalid') === 'true') setErr(i.id, ''); }));

  // Google
  const g = $('#googleBtn');
  if (g) g.addEventListener('click', async () => {
    loading(g, true);
    try { await A.google(); } catch (e) { alertBox($('#formAlert'), e.message); loading(g, false); }
  });

  // Already signed in? Skip the form.
  if ((page === 'login' || page === 'signup') && A) {
    A.getUser().then((u) => { if (u) location.replace(next); }).catch(() => {});
  }

  /* ---------- sign in ---------- */
  if (page === 'login') {
    const f = $('#loginForm'), btn = $('#submitBtn');
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      alertBox($('#formAlert'), '');
      const email = $('#email').value, password = $('#password').value;
      const ok = [
        setErr('email', !email.trim() ? 'E-posta adresini yaz.' : !validEmail(email) ? 'Geçerli bir e-posta adresi yaz.' : ''),
        setErr('password', !password ? 'Şifreni yaz.' : ''),
      ].every(Boolean);
      if (!ok) return;
      loading(btn, true);
      try {
        await A.signIn({ email, password, remember: $('#remember').checked });
        btn.querySelector('.lbl').textContent = 'Giriş başarılı, yönlendiriliyorsun';
        location.href = next;
      } catch (err) {
        loading(btn, false);
        alertBox($('#formAlert'), err.message);
      }
    });
  }

  /* ---------- sign up ---------- */
  if (page === 'signup') {
    const f = $('#signupForm'), btn = $('#submitBtn'), exam = $('#exam'), alanWrap = $('#alanWrap');
    const syncAlan = () => alanWrap.classList.toggle('hide', exam.value !== 'YKS');
    exam.addEventListener('change', syncAlan); syncAlan();
    $('#terms').addEventListener('change', () => { $('#terms-err').textContent = ''; });
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      alertBox($('#formAlert'), '');
      const name = $('#name').value.trim(), email = $('#email').value, password = $('#password').value;
      const ok = [
        setErr('name', name.length < 2 ? 'Adını ve soyadını yaz.' : ''),
        setErr('email', !email.trim() ? 'E-posta adresini yaz.' : !validEmail(email) ? 'Geçerli bir e-posta adresi yaz.' : ''),
        setErr('password', password.length < 8 ? 'Şifre en az 8 karakter olmalı.' : strength(password) < 2 ? 'Daha güçlü bir şifre seç: büyük-küçük harf, rakam veya sembol ekle.' : ''),
      ].every(Boolean);
      const terms = $('#terms').checked;
      $('#terms-err').textContent = terms ? '' : 'Devam etmek için koşulları kabul etmelisin.';
      if (!ok || !terms) return;
      loading(btn, true);
      try {
        const alan = exam.value === 'YKS' ? (document.querySelector('input[name="alan"]:checked') || {}).value || 'Sayısal' : '—';
        const res = await A.signUp({ name, email, password, exam: exam.value, alan });
        if (res.needsConfirm) {
          doneCard({ mail: true, title: 'E-postanı doğrula', text: `<b>${esc(email.trim())}</b> adresine bir doğrulama bağlantısı gönderdik. Bağlantıya tıkladıktan sonra panele giriş yapabilirsin.`, btn: '<a class="btn btn-blue" href="giris.html">Giriş sayfasına git</a>' });
        } else {
          doneCard({ title: `Hoş geldin, ${name.split(' ')[0]}!`, text: 'Hesabın oluşturuldu. Paneline yönlendiriliyorsun…' });
          setTimeout(() => { location.href = next; }, 1300);
        }
      } catch (err) {
        loading(btn, false);
        alertBox($('#formAlert'), err.message);
      }
    });
  }

  /* ---------- password reset ---------- */
  if (page === 'reset') {
    const showNew = () => { $('#reqView').hidden = true; $('#newView').hidden = false; };
    if (A && A.mode === 'live') {
      if (/type=recovery/.test(location.hash)) showNew();
      A.onRecovery(showNew);
    }
    $('#resetForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = $('#email').value, btn = $('#submitBtn');
      if (!setErr('email', !email.trim() ? 'E-posta adresini yaz.' : !validEmail(email) ? 'Geçerli bir e-posta adresi yaz.' : '')) return;
      loading(btn, true);
      try {
        await A.resetPassword(email);
        doneCard({ mail: true, title: 'Bağlantı gönderildi', text: `Bu e-postayla kayıtlı bir hesap varsa <b>${esc(email.trim())}</b> adresine şifre yenileme bağlantısı gönderdik.${A.mode === 'demo' ? '<br><br>Demo modunda gerçek e-posta gönderilmez.' : ''}`, btn: '<a class="btn btn-blue" href="giris.html">Giriş sayfasına dön</a>' });
      } catch (err) { loading(btn, false); alertBox($('#formAlert'), err.message); }
    });
    $('#newPwForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const p1 = $('#password').value, p2 = $('#password2').value, btn = $('#submitBtn2');
      const ok = [
        setErr('password', p1.length < 8 ? 'Şifre en az 8 karakter olmalı.' : ''),
        setErr('password2', p1 !== p2 ? 'Şifreler eşleşmiyor.' : ''),
      ].every(Boolean);
      if (!ok) return;
      loading(btn, true);
      try {
        await A.updatePassword(p1);
        doneCard({ title: 'Şifren güncellendi', text: 'Paneline yönlendiriliyorsun…' });
        setTimeout(() => { location.href = 'panel.html'; }, 1300);
      } catch (err) { loading(btn, false); alertBox($('#formAlert2'), err.message); }
    });
  }
})();
