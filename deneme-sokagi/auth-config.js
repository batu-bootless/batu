/* Supabase connection for sign-in / sign-up.
   Leave both empty to run in demo mode (accounts live only in this browser).
   Fill them in to use real accounts — the publishable/anon key is safe to ship to the browser.

   Supabase panel → Authentication → URL Configuration:
   add the site's address (e.g. https://denemesokagi.com) as Site URL and
   https://denemesokagi.com/panel.html and https://denemesokagi.com/sifre.html as Redirect URLs. */
window.DS_SUPABASE = {
  url: '',   // e.g. 'https://xxxxxxxx.supabase.co'
  key: '',   // publishable key: 'sb_publishable_...' (or the legacy anon key)
};
