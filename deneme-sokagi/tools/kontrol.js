// Deneme Sokağı — bütünlük kontrolü:  node tools/kontrol.js   (npm run kontrol)
//
// 1. Bütün JavaScript dosyaları sözdizimi hatası içermiyor.
// 2. Soru bankası tutarlı: benzersiz soru kimliği ve künye (2 harf + 5 rakam), var olan kaynak ve paragraf,
//    A–E cevap, 0 ya da 5 seçenek, diskte bulunan görseller; .js ve .json kopyaları aynı; kaynak klasörleri
//    bankadakiyle aynı sayıda soru içeriyor. Yerel (git dışı) banka varsa o da denetlenir.
// 3. PDF şablonu referans ölçülerine uyuyor (tools/sablon-kontrol.js).
// Bir sorun bulunursa ayrıntısıyla yazar ve 1 koduyla çıkar.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const problems = [];
const ok = (msg) => console.log('  ✓ ' + msg);

// ---- 1. JavaScript syntax
const jsFiles = [];
for (const dir of ['', 'sablon', 'tools', 'tests', 'icerik']) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) continue;
  for (const f of fs.readdirSync(abs)) if (f.endsWith('.js') && !(dir === '' && f === 'soru-bankasi.js')) jsFiles.push(path.join(abs, f));
}
for (const f of jsFiles) {
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); } catch (e) { problems.push(`${path.relative(ROOT, f)}: ${String(e.stderr).split('\n').slice(0, 4).join(' ')}`); }
}
console.log('JavaScript');
ok(`${jsFiles.length} dosya sözdizimi kontrolünden geçti`);

// ---- 2. question bank
function checkBank(label, jsonFile, jsFile, varName, srcDir, takenCodes) {
  console.log(label);
  if (!fs.existsSync(jsonFile)) { ok('yok (atlandı)'); return; }
  const bank = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  const js = fs.readFileSync(jsFile, 'utf8');
  const m = js.match(new RegExp(`window\\.${varName} = ([\\s\\S]*);\\s*$`));
  if (!m) problems.push(`${path.relative(ROOT, jsFile)}: window.${varName} bulunamadı`);
  else if (JSON.stringify(JSON.parse(m[1])) !== JSON.stringify(bank)) problems.push(`${path.relative(ROOT, jsFile)}: .json ile aynı değil — bankayı yeniden birleştirin (tools/soru_cikar.py ya da tools/soru_ekle.py)`);

  const src = new Set(bank.kaynaklar.map((k) => k.id));
  const ids = new Set(), seenCodes = new Set();
  const fileOk = (rel) => !rel || fs.existsSync(path.join(ROOT, rel));
  for (const q of bank.sorular) {
    const where = `${q.id || '?'}`;
    if (ids.has(q.id)) problems.push(`${where}: soru kimliği iki kez geçiyor`);
    ids.add(q.id);
    if (!/^[A-Z]{2}\d{5}$/.test(q.kod || '')) problems.push(`${where}: künye biçimi hatalı (${q.kod})`);
    if (seenCodes.has(q.kod) || takenCodes.has(q.kod)) problems.push(`${where}: künye ${q.kod} başka bir soruda da var`);
    seenCodes.add(q.kod);
    if (!src.has(q.kaynak)) problems.push(`${where}: kaynak "${q.kaynak}" kaynaklar listesinde yok`);
    if (q.cevap != null && !/^[A-E]$/.test(q.cevap)) problems.push(`${where}: cevap A–E değil (${q.cevap})`);
    if (q.secenekler && ![0, 5].includes(q.secenekler.length)) problems.push(`${where}: ${q.secenekler.length} seçenek (0 ya da 5 olmalı)`);
    if (q.grup && !(bank.gruplar || {})[q.grup]) problems.push(`${where}: paragraf "${q.grup}" yok`);
    for (const rel of [q.gorsel, q.sekil, ...((q.parcalar || []).map((p) => p.sekil))]) if (!fileOk(rel)) problems.push(`${where}: görsel yok: ${rel}`);
    if (q.ses) {   // anlatım videosu kaydı: the file, and one start time per step, in order
      if (!fileOk(q.ses)) problems.push(`${where}: ses kaydı yok: ${q.ses}`);
      const a = q.ses_adimlar;
      if (!Array.isArray(a) || !a.length || a.some((x, i) => typeof x !== 'number' || (i && x <= a[i - 1])) || !(q.ses_sure > a[a.length - 1]))
        problems.push(`${where}: ses adımları hatalı`);
    }
  }
  for (const [gid, g] of Object.entries(bank.gruplar || {})) if (!fileOk(g.gorsel)) problems.push(`${gid}: paragraf görseli yok: ${g.gorsel}`);
  // the per-source folders hold exactly what the bank holds
  if (fs.existsSync(srcDir)) {
    const n = fs.readdirSync(srcDir).filter((d) => fs.existsSync(path.join(srcDir, d, 'sorular.json')))
      .reduce((a, d) => a + JSON.parse(fs.readFileSync(path.join(srcDir, d, 'sorular.json'), 'utf8')).length, 0);
    if (n !== bank.sorular.length) problems.push(`${path.relative(ROOT, srcDir)}: kaynak klasörlerinde ${n} soru, bankada ${bank.sorular.length} — bankayı yeniden birleştirin`);
    for (const d of fs.readdirSync(srcDir)) {   // açıklamalı çözümler: no entry for a question that does not exist
      const f = path.join(srcDir, d, 'cozumler.json');
      if (!fs.existsSync(f)) continue;
      for (const id of Object.keys(JSON.parse(fs.readFileSync(f, 'utf8')))) if (!ids.has(id)) problems.push(`${path.relative(ROOT, f)}: "${id}" diye bir soru yok`);
    }
    for (const d of fs.readdirSync(srcDir)) {   // no leftover recordings of deleted questions
      const sd = path.join(srcDir, d, 'ses');
      if (!fs.existsSync(sd)) continue;
      for (const f of fs.readdirSync(sd)) if (/\.mp3$/.test(f) && !ids.has(f.slice(0, -4))) problems.push(`${path.relative(ROOT, path.join(sd, f))}: soru yok, kayıt silinebilir`);
    }
  }
  for (const c of seenCodes) takenCodes.add(c);
  ok(`${bank.kaynaklar.length} kaynak, ${bank.sorular.length} soru, ${Object.keys(bank.gruplar || {}).length} paragraf, `
    + `${bank.sorular.filter((q) => q.cozum).length} açıklamalı çözüm, ${bank.sorular.filter((q) => q.ses).length} seslendirilmiş video`);
}
const codes = new Set();
checkBank('Soru bankası', path.join(ROOT, 'data/soru-bankasi.json'), path.join(ROOT, 'data/soru-bankasi.js'), 'DS_SORU_BANKASI', path.join(ROOT, 'data/sorular'), codes);
checkBank('Yerel banka (git dışı)', path.join(ROOT, 'data/yerel/soru-bankasi.json'), path.join(ROOT, 'data/yerel/soru-bankasi.js'), 'DS_SORU_BANKASI_YEREL', path.join(ROOT, 'data/yerel/kaynaklar'), codes);

// ---- 3. PDF template
console.log('PDF şablonu');
try {
  const out = execFileSync(process.execPath, [path.join(__dirname, 'sablon-kontrol.js')], { encoding: 'utf8', stdio: 'pipe' });
  ok(out.trim().split('\n').pop());
} catch (e) {
  problems.push('sablon-kontrol: ' + String(e.stdout || e.message).trim().split('\n').slice(-3).join(' '));
}

if (problems.length) {
  console.log(`\n${problems.length} sorun bulundu:`);
  problems.slice(0, 50).forEach((p) => console.log('  ✗ ' + p));
  process.exit(1);
}
console.log('\nHer şey tutarlı.');
