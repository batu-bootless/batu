/* Deneme Sokağı — account layer.
   window.DSAuth exposes one API with two back ends:
   - live: Supabase Auth (when auth-config.js has url + key)
   - demo: accounts in this browser's localStorage, passwords salted + SHA-256 hashed.
     Demo mode is for trying the flow only; it is not a secure account system. */
(() => {
  'use strict';
  const cfg = window.DS_SUPABASE || {};
  const live = !!(cfg.url && cfg.key);
  const SDK = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
  const baseUrl = () => location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '');

  function trErr(e) {
    const m = String((e && e.message) || '').toLowerCase();
    if (m.includes('invalid login')) return 'E-posta veya şifre hatalı.';
    if (m.includes('email not confirmed')) return 'E-posta adresini henüz doğrulamadın. Gelen kutunu kontrol et.';
    if (m.includes('already registered') || m.includes('already been registered')) return 'Bu e-posta ile zaten bir hesap var. Giriş yapmayı dene.';
    if (m.includes('password should be') || m.includes('weak password')) return 'Şifre en az 8 karakter olmalı ve tahmin edilmesi zor olmalı.';
    if (m.includes('rate limit') || m.includes('too many')) return 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.';
    if (m.includes('provider is not enabled')) return 'Google ile giriş henüz etkinleştirilmedi.';
    if (m.includes('failed to fetch') || m.includes('network')) return 'Sunucuya ulaşılamadı. İnternet bağlantını kontrol et.';
    return (e && e.message) || 'Bir hata oluştu. Lütfen tekrar dene.';
  }
  const fail = (e) => { throw new Error(trErr(e)); };

  /* ---------- live: Supabase ---------- */
  let clientP = null;
  const loadScript = (src) => new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res;
    s.onerror = () => rej(new Error('Giriş servisine ulaşılamadı. İnternet bağlantını kontrol et.'));
    document.head.appendChild(s);
  });
  const client = () => clientP || (clientP = (window.supabase ? Promise.resolve() : loadScript(SDK))
    .then(() => window.supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })));
  const mapUser = (u) => u && {
    id: u.id, email: u.email,
    name: (u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) || String(u.email || '').split('@')[0],
    exam: (u.user_metadata && u.user_metadata.exam) || 'YKS',
    alan: (u.user_metadata && u.user_metadata.alan) || 'Sayısal',
  };

  const supa = {
    mode: 'live',
    async getUser() { const c = await client(); const { data } = await c.auth.getSession(); return mapUser(data.session && data.session.user); },
    async signIn({ email, password }) {
      const c = await client();
      const { data, error } = await c.auth.signInWithPassword({ email: email.trim(), password });
      if (error) fail(error);
      return mapUser(data.user);
    },
    async signUp({ name, email, password, exam, alan }) {
      const c = await client();
      const { data, error } = await c.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name, exam, alan }, emailRedirectTo: baseUrl() + 'panel.html' } });
      if (error) fail(error);
      // With e-mail confirmation on, an existing address comes back with no identities.
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) fail({ message: 'already registered' });
      return { user: mapUser(data.user), needsConfirm: !data.session };
    },
    async signOut() { const c = await client(); await c.auth.signOut(); },
    async resetPassword(email) { const c = await client(); const { error } = await c.auth.resetPasswordForEmail(email.trim(), { redirectTo: baseUrl() + 'sifre.html' }); if (error) fail(error); },
    async updatePassword(password) { const c = await client(); const { error } = await c.auth.updateUser({ password }); if (error) fail(error); },
    async updateProfile({ name, exam, alan }) { const c = await client(); const { error } = await c.auth.updateUser({ data: { full_name: name, exam, alan } }); if (error) fail(error); },
    async google() { const c = await client(); const { error } = await c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: baseUrl() + 'panel.html' } }); if (error) fail(error); },
    async onRecovery(cb) { const c = await client(); c.auth.onAuthStateChange((ev) => { if (ev === 'PASSWORD_RECOVERY') cb(); }); },
  };

  /* ---------- demo: this browser only ---------- */
  const LS = {
    get(k, f, s = localStorage) { try { const v = s.getItem(k); return v ? JSON.parse(v) : f; } catch (e) { return f; } },
    set(k, v, s = localStorage) { try { s.setItem(k, JSON.stringify(v)); } catch (e) { throw new Error('Tarayıcı depolaması kapalı olduğu için hesap kaydedilemedi.'); } },
    del(k) { try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };
  async function hash(pw, salt) {
    const data = new TextEncoder().encode(salt + ':' + pw);
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', data);
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    let h = 2166136261; for (const b of data) { h ^= b; h = Math.imul(h, 16777619) >>> 0; } return 'f' + h.toString(16);
  }
  const users = () => LS.get('ds-demo-users', {});
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const session = () => LS.get('ds-demo-session', null) || LS.get('ds-demo-session', null, sessionStorage);

  const demo = {
    mode: 'demo',
    async getUser() {
      const s = session(); if (!s) return null;
      const u = users()[s.email];
      return u ? { id: s.email, email: s.email, name: u.name, exam: u.exam, alan: u.alan } : null;
    },
    async signIn({ email, password, remember = true }) {
      await wait(450);
      const e = email.trim().toLowerCase(), u = users()[e];
      if (!u || (await hash(password, u.salt)) !== u.hash) throw new Error('E-posta veya şifre hatalı.');
      LS.del('ds-demo-session');
      LS.set('ds-demo-session', { email: e, at: Date.now() }, remember ? localStorage : sessionStorage);
      return demo.getUser();
    },
    async signUp({ name, email, password, exam, alan }) {
      await wait(550);
      const e = email.trim().toLowerCase(), all = users();
      if (all[e]) throw new Error('Bu e-posta ile zaten bir hesap var. Giriş yapmayı dene.');
      const salt = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');
      all[e] = { name, exam, alan, salt, hash: await hash(password, salt), created: Date.now() };
      LS.set('ds-demo-users', all);
      LS.set('ds-demo-session', { email: e, at: Date.now() });
      return { user: await demo.getUser(), needsConfirm: false };
    },
    async signOut() { LS.del('ds-demo-session'); },
    async resetPassword() { await wait(450); },
    async updatePassword(password) {
      const s = session(); if (!s) throw new Error('Şifre yenilemek için önce giriş yapmalısın.');
      const all = users(), u = all[s.email]; u.salt = Math.random().toString(36).slice(2); u.hash = await hash(password, u.salt); LS.set('ds-demo-users', all);
    },
    async updateProfile({ name, exam, alan }) {
      const s = session(); if (!s) return;
      const all = users(); Object.assign(all[s.email], { name, exam, alan }); LS.set('ds-demo-users', all);
    },
    async google() { throw new Error('Google ile giriş, Supabase bağlandıktan sonra çalışır.'); },
    async onRecovery() { /* no e-mail in demo mode */ },
  };

  window.DSAuth = live ? supa : demo;
})();
