const express = require('express');
const fs = require('fs');
const path = require('path');
const { createBarrettRouter, getSafeRuntimeDiagnostics } = require('./server/barrett');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';
const ascendDir = path.join(__dirname, 'ASCEND');
const publicDir = path.join(__dirname, 'public');
const staticDir = fs.existsSync(path.join(ascendDir, 'index.html')) ? ascendDir : publicDir;

if (process.env.VERCEL) {
  console.info('[barrett:boot]', JSON.stringify(getSafeRuntimeDiagnostics()));
}

app.use('/api/barrett', createBarrettRouter());

app.use(express.static(staticDir, {
  extensions: ['html'],
}));

app.use((req, res, next) => {
  if ((req.method !== 'GET' && req.method !== 'HEAD') || req.path.startsWith('/api/')) {
    return next();
  }
  res.sendFile(path.join(staticDir, 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, HOST, () => {
    console.log(`ASCEND server listening on http://${HOST}:${PORT}`);
    console.info('[barrett:boot]', JSON.stringify(getSafeRuntimeDiagnostics()));
  });
}

module.exports = app;
