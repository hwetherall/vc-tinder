// VC Tinder — zero-dependency local server.
// Serves the static front-end, exposes the source CSV, and writes the scored CSV
// back into this folder. Run with:  node server.js   then open http://localhost:5173
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = 5173;
const OUTPUT_CSV = 'Innovera-SeriesA-targets-scored.csv';

const STATIC = {
  '/': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/index.html': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/styles.css': { file: 'styles.css', type: 'text/css; charset=utf-8' },
  '/app.js': { file: 'app.js', type: 'text/javascript; charset=utf-8' },
};

// Pick the source CSV: first *.csv in the folder that isn't our scored output.
function findSourceCsv() {
  const csvs = fs
    .readdirSync(ROOT)
    .filter((f) => f.toLowerCase().endsWith('.csv') && f !== OUTPUT_CSV)
    .sort();
  if (csvs.length === 0) return null;
  return path.join(ROOT, csvs[0]);
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function sendText(res, status, text, type) {
  res.writeHead(status, { 'Content-Type': type || 'text/plain; charset=utf-8' });
  res.end(text);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // --- API: read source CSV ---
  if (req.method === 'GET' && pathname === '/api/csv') {
    const src = findSourceCsv();
    if (!src) return sendJson(res, 404, { error: 'No source CSV found in folder.' });
    try {
      const text = fs.readFileSync(src, 'utf8');
      return sendJson(res, 200, { filename: path.basename(src), csv: text });
    } catch (err) {
      return sendJson(res, 500, { error: String(err) });
    }
  }

  // --- API: save scored CSV ---
  if (req.method === 'POST' && pathname === '/api/save') {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 50 * 1024 * 1024) req.destroy(); // 50MB guard
    });
    req.on('end', () => {
      let csv = body;
      // Allow either raw CSV text or a JSON envelope { csv }.
      const ct = req.headers['content-type'] || '';
      if (ct.includes('application/json')) {
        try {
          csv = JSON.parse(body).csv;
        } catch (err) {
          return sendJson(res, 400, { error: 'Bad JSON: ' + String(err) });
        }
      }
      if (typeof csv !== 'string') return sendJson(res, 400, { error: 'No CSV in request.' });
      const outPath = path.join(ROOT, OUTPUT_CSV);
      try {
        fs.writeFileSync(outPath, csv, 'utf8');
        return sendJson(res, 200, { path: outPath, bytes: Buffer.byteLength(csv, 'utf8') });
      } catch (err) {
        return sendJson(res, 500, { error: String(err) });
      }
    });
    return;
  }

  // --- API: delete scored CSV (used by Reset / start over) ---
  if (req.method === 'DELETE' && pathname === '/api/save') {
    const outPath = path.join(ROOT, OUTPUT_CSV);
    try {
      const existed = fs.existsSync(outPath);
      if (existed) fs.unlinkSync(outPath);
      return sendJson(res, 200, { deleted: existed, path: outPath });
    } catch (err) {
      return sendJson(res, 500, { error: String(err) });
    }
  }

  // --- Static files (whitelisted) ---
  if (req.method === 'GET' && STATIC[pathname]) {
    const entry = STATIC[pathname];
    try {
      const text = fs.readFileSync(path.join(ROOT, entry.file), 'utf8');
      return sendText(res, 200, text, entry.type);
    } catch (err) {
      return sendText(res, 404, 'Not found: ' + entry.file);
    }
  }

  sendText(res, 404, 'Not found');
});

server.listen(PORT, () => {
  const src = findSourceCsv();
  console.log(`\n  VC Tinder running →  http://localhost:${PORT}`);
  console.log(`  Source CSV: ${src ? path.basename(src) : '(none found!)'}`);
  console.log(`  Exports to: ${OUTPUT_CSV}\n`);
});
