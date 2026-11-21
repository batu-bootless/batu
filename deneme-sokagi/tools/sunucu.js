// Deneme Sokağı — yerel geliştirme sunucusu (bağımlılıksız).
//
//   node tools/sunucu.js            → http://localhost:8080
//   node tools/sunucu.js 3000       → başka bir port
//
// Siteyi bir web sunucusundan açmak gerekir: panelin "PDF indir" özelliği şablon dosyalarını (CSS, font,
// soru görselleri) okur ve tarayıcılar bunu file:// adreslerinde engeller.
//
// Yalnızca yerel deneme içerikleri: `data/yerel/soru-bankasi.js` varsa (bkz. tools/README.md, --yerel),
// bu sunucu onu panel ve şablon sayfalarına kendisi ekler. Yayına giden sayfalar bu dosyaya hiç başvurmaz.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const YEREL = path.join(ROOT, 'data/yerel/soru-bankasi.js');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf', '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg',
};

// panel.html and sablon/yaprak-test.html get the local bank right before the template script
function withLocalBank(rel, html, yerel) {
  if (!yerel || !fs.existsSync(YEREL)) return html;
  if (rel === 'panel.html') return html.replace('<script src="sablon/yaprak-test.js"></script>', '<script src="data/yerel/soru-bankasi.js"></script>\n<script src="sablon/yaprak-test.js"></script>');
  if (rel === 'sablon/yaprak-test.html') return html.replace('<script src="yaprak-test.js"></script>', '<script src="../data/yerel/soru-bankasi.js"></script>\n  <script src="yaprak-test.js"></script>');
  return html;
}

// opts.yerel = false leaves the local bank out (e.g. for the homepage video, which must show only original content)
function start(port = 8080, opts = {}) {
  const yerel = opts.yerel !== false;
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Bulunamadı'); }
      const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
      // byte ranges: Safari plays <video> only from servers that answer them
      const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
      if (range && !type.startsWith('text/html')) {
        const a = range[1] ? Number(range[1]) : Math.max(0, buf.length - Number(range[2]));
        const b = range[1] && range[2] ? Math.min(Number(range[2]), buf.length - 1) : buf.length - 1;
        if (a > b || a >= buf.length) { res.writeHead(416, { 'Content-Range': `bytes */${buf.length}` }); return res.end(); }
        res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${a}-${b}/${buf.length}`, 'Content-Length': b - a + 1, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' });
        return res.end(buf.subarray(a, b + 1));
      }
      const body = type.startsWith('text/html') ? withLocalBank(rel.replace(/\\/g, '/'), buf.toString('utf8'), yerel) : buf;
      res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' });
      res.end(body);
    });
  });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok(server)));
}

if (require.main === module) {
  const port = Number(process.argv[2]) || 8080;
  start(port).then(() => console.log(`Deneme Sokağı: http://localhost:${port}  (durdurmak için Ctrl+C)`));
}

module.exports = { start };
