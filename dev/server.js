#!/usr/bin/env node
'use strict';
/**
 * Local preview: serves client/ and mimics the Catalyst function routes at
 * /server/zcql_api/* using the SQLite simulator. No Catalyst account needed.
 *   node dev/server.js   ->  http://localhost:3000
 */
process.removeAllListeners('warning');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { run } = require('./sim');
const { TABLES, SYSTEM_COLUMNS } = require('../functions/zcql_api/lib/schema');
const { validateQuery } = require('../functions/zcql_api/lib/guard');
const { checkAnswer } = require('../functions/zcql_api/lib/game');

const PORT = Number(process.env.PORT) || 3000;
const CLIENT = path.join(__dirname, '..', 'client');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 20000) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); } });
  });
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const route = url.pathname.replace(/^\/server\/zcql_api/, '');
  if (url.pathname.startsWith('/server/zcql_api')) {
    if (req.method === 'GET' && route === '/schema') return send(res, 200, { tables: TABLES, systemColumns: SYSTEM_COLUMNS, mode: 'local' });
    if (req.method === 'POST' && route === '/query') {
      const v = validateQuery((await readBody(req)).query);
      if (!v.ok) return send(res, 400, { error: v.error });
      const t = Date.now();
      try { return send(res, 200, { ...run(v.query), ms: Date.now() - t }); } catch (e) { return send(res, 400, { error: e.message }); }
    }
    if (req.method === 'POST' && route === '/check') {
      const { stage, name } = await readBody(req);
      const r = checkAnswer(stage, name);
      return send(res, r.ok ? 200 : 400, r);
    }
    return send(res, 404, { error: 'Not found' });
  }
  const file = path.normalize(path.join(CLIENT, url.pathname === '/' ? 'index.html' : url.pathname));
  if (!file.startsWith(CLIENT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`Memo Mystery (local simulator) → http://localhost:${PORT}`));
