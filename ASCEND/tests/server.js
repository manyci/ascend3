/* Test static server: /new/* -> this project, /orig/* -> original LOOKSMAX 0.1.0 (same origin, so both
   generations share localStorage/IndexedDB exactly like a real upgrade in one browser profile). */
const http = require('http'), fs = require('fs'), path = require('path');
const ROOTS = {
  new: path.resolve(__dirname, '..'),
  orig: process.env.OLD_ROOT || '/home/claude/orig_src/looksmax'
};
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.md': 'text/plain' };

module.exports = function start(port) {
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    const m = /^\/(new|orig)(\/.*)?$/.exec(u);
    if (!m) { res.writeHead(404); return res.end('not found'); }
    let rel = m[2] || '/'; if (rel.endsWith('/')) rel += 'index.html';
    const file = path.join(ROOTS[m[1]], rel);
    if (!file.startsWith(ROOTS[m[1]])) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(buf);
    });
  });
  return new Promise(r => srv.listen(port, '127.0.0.1', () => r(srv)));
};
