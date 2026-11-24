const express = require('express');
const path = require('path');
const { createBarrettRouter } = require('./server/barrett');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';
const staticDir = path.join(__dirname, 'ASCEND');

app.use('/api/barrett', createBarrettRouter());

app.use(express.static(staticDir, {
  extensions: ['html'],
}));

app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return next();
  }
  res.sendFile(path.join(staticDir, 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, HOST, () => {
    console.log(`ASCEND server listening on http://${HOST}:${PORT}`);
  });
}

module.exports = app;
