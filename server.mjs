// VC Tinder — zero-dependency local server, Supabase-backed.
// Serves the static front-end, synthesizes the CSV the swipe UI consumes from
// the Supabase `firms` table, and persists tier decisions back to the DB.
// Run with:  node server.mjs   then open http://localhost:5173
// Requires SUPABASE_URL + SUPABASE_KEY in .env (see db.mjs).

import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { parseCSV, serializeCSV } from './csv.mjs';
import { sbSelect, sbUpdate } from './db.mjs';
import { startTier, TIER_LABEL } from './tiers.mjs';
import { importCsvText } from './importer.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 5173);
// On Vercel the deployment filesystem is read-only except for the OS tmp dir,
// so any runtime file writes (scoring log, exported CSV) must land there.
const WRITABLE = process.env.VERCEL ? os.tmpdir() : ROOT;
// Bump when server/UI behavior changes — shown in the topbar so a stale
// server or cached front-end is immediately visible.
const VERSION = 'v7 directory';
const OUTPUT_CSV = 'Innovera-SeriesA-targets-scored.csv';

const STATIC = {
  '/': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/index.html': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/styles.css': { file: 'styles.css', type: 'text/css; charset=utf-8' },
  '/app.js': { file: 'app.js', type: 'text/javascript; charset=utf-8' },
  '/csv.mjs': { file: 'csv.mjs', type: 'text/javascript; charset=utf-8' },
  '/tiers.mjs': { file: 'tiers.mjs', type: 'text/javascript; charset=utf-8' },
};

// Columns the swipe UI expects, plus Firm ID (ignored by the UI, round-trips
// through its export) so saves can be keyed back to database rows.
const COLS = [
  'Firm ID', 'VC', 'Tier', 'Proximity', 'Fit', 'Location', 'Contact',
  'Thesis Fit', 'Network', 'Lead Capability', 'Location Score', 'Gravitas Score',
  'Status', 'Intro Path', 'Evidence', 'Score Confidence',
];

function firmToRow(f) {
  // Emit the original label (it carries nuance like "VERIFY (poss. Tier-1)")
  // unless the user has moved the firm — then emit the canonical label for the
  // saved tier so the UI starts the card where they left it.
  let tier = f.tier_label || 'TBD';
  if (f.current_tier != null && f.current_tier !== startTier(f.tier_label)) {
    tier = TIER_LABEL[f.current_tier] || tier;
  }
  const primary = (f.contacts || []).find((c) => c.is_primary) || (f.contacts || [])[0];
  const contact = primary ? [primary.name, primary.title].filter(Boolean).join(' - ') : '';
  const v = {
    'Firm ID': f.id,
    VC: f.name,
    Tier: tier,
    Proximity: f.proximity,
    Fit: f.fit,
    Location: f.location,
    Contact: contact,
    'Thesis Fit': f.thesis_fit,
    Network: f.network,
    'Lead Capability': f.lead_capability,
    'Location Score': f.location_score,
    'Gravitas Score': f.gravitas_score,
    Status: f.status,
    'Intro Path': f.intro_path,
    Evidence: f.evidence,
    'Score Confidence': f.score_confidence,
  };
  return COLS.map((c) => (v[c] == null ? '' : String(v[c])));
}

/* ---- JSON API (directory / dossier / digest views) ---- */

const DIR_SELECT =
  'firms?select=id,name,website,location,proximity,tier_label,current_tier,fit,' +
  'stage_focus,fund_size,thesis_tags,watched,source,score_confidence,' +
  'contacts(id,name,email),deals(id)&order=fit.desc.nullslast';

async function handleFirms(res) {
  sendJson(res, 200, { firms: await sbSelect(DIR_SELECT) });
}

async function handleFirm(res, id) {
  const rows = await sbSelect(
    `firms?id=eq.${encodeURIComponent(id)}&select=*,contacts(*),deals(*),news_items(*)`
  );
  if (rows.length === 0) return sendJson(res, 404, { error: 'firm not found' });
  sendJson(res, 200, { firm: rows[0] });
}

// Only these fields are editable from the UI.
const PATCHABLE = ['proximity', 'current_tier', 'watched'];
async function handlePatchFirm(res, id, body) {
  let patch;
  try {
    patch = JSON.parse(body);
  } catch (err) {
    return sendJson(res, 400, { error: 'Bad JSON: ' + String(err) });
  }
  const clean = {};
  for (const k of PATCHABLE) if (k in patch) clean[k] = patch[k];
  if (Object.keys(clean).length === 0) {
    return sendJson(res, 400, { error: `Nothing to update (allowed: ${PATCHABLE.join(', ')})` });
  }
  await sbUpdate(`firms?id=eq.${encodeURIComponent(id)}`, clean);
  sendJson(res, 200, { updated: clean });
}

async function handleDigests(res) {
  sendJson(res, 200, { digests: await sbSelect('digests?select=*&order=created_at.desc&limit=10') });
}

/* ---- CSV upload + scoring runner ---- */

async function handleUpload(res, body) {
  let payload;
  try {
    payload = JSON.parse(body);
  } catch (err) {
    return sendJson(res, 400, { error: 'Bad JSON: ' + String(err) });
  }
  if (typeof payload.csv !== 'string' || !payload.csv.trim()) {
    return sendJson(res, 400, { error: 'No CSV in request.' });
  }
  const result = await importCsvText(payload.csv, { source: payload.source || 'happenstance' });
  sendJson(res, 200, result);
}

// Scoring runs as a detached child so a long run survives page reloads.
// One at a time; progress goes to scoring.log and the DB itself.
let scoreChild = null;
const SCORE_LOG = path.join(WRITABLE, 'scoring.log');

function scoreRunning() {
  return scoreChild !== null && scoreChild.exitCode === null;
}

function handleStartScore(res) {
  if (scoreRunning()) return sendJson(res, 200, { started: false, running: true });
  const log = fs.openSync(SCORE_LOG, 'w');
  scoreChild = spawn(process.execPath, [path.join(ROOT, 'score.mjs')], {
    cwd: ROOT,
    stdio: ['ignore', log, log],
  });
  scoreChild.on('exit', () => fs.closeSync(log));
  sendJson(res, 200, { started: true, running: true, log: SCORE_LOG });
}

async function handleScoreStatus(res) {
  const unscored = await sbSelect('firms?fit=is.null&select=id');
  const total = await sbSelect('firms?select=id');
  let tail = '';
  try {
    const logText = fs.readFileSync(SCORE_LOG, 'utf8');
    tail = logText.split('\n').filter(Boolean).slice(-5).join('\n');
  } catch { /* no log yet */ }
  sendJson(res, 200, { unscored: unscored.length, total: total.length, running: scoreRunning(), tail });
}

function readBody(req, cb) {
  // On Vercel the Node runtime has already consumed and parsed the request
  // stream into req.body, so listening for 'data'/'end' would hang. Reuse it,
  // re-stringifying objects so downstream JSON.parse still works.
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') return cb(req.body);
    if (Buffer.isBuffer(req.body)) return cb(req.body.toString('utf8'));
    return cb(JSON.stringify(req.body));
  }
  let body = '';
  req.setEncoding('utf8');
  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > 50 * 1024 * 1024) req.destroy();
  });
  req.on('end', () => cb(body));
}

/* ---- CSV bridge (swipe/board views) ---- */

async function handleGetCsv(res) {
  const firms = await sbSelect(
    'firms?select=*,contacts(name,title,is_primary)&order=sort_order.asc.nullsfirst,created_at.desc'
  );
  const csv = serializeCSV([COLS, ...firms.map(firmToRow)]);
  sendJson(res, 200, { filename: `supabase: firms (${firms.length})`, csv });
}

// The UI posts back its full CSV with a 'New Tier' column appended. Persist
// tier changes to the DB (only rows whose tier actually moved), and write the
// CSV to disk as the Attio-ready export, same as before.
async function handleSave(res, csv) {
  const rows = parseCSV(csv);
  const header = rows[0] || [];
  const idI = header.indexOf('Firm ID');
  const tierI = header.indexOf('Tier');
  const newTierI = header.indexOf('New Tier');
  if (idI === -1 || newTierI === -1) {
    return sendJson(res, 400, { error: "CSV missing 'Firm ID' or 'New Tier' column." });
  }
  let updated = 0;
  for (const r of rows.slice(1)) {
    const id = r[idI];
    const newTier = parseInt(r[newTierI], 10);
    if (!id || !Number.isFinite(newTier)) continue;
    if (newTier !== startTier(r[tierI])) {
      await sbUpdate(`firms?id=eq.${encodeURIComponent(id)}`, { current_tier: newTier });
      updated++;
    }
  }
  const outPath = path.join(WRITABLE, OUTPUT_CSV);
  fs.writeFileSync(outPath, csv, 'utf8');
  sendJson(res, 200, { path: outPath, updated, bytes: Buffer.byteLength(csv, 'utf8') });
}

// Reset: clear saved tiers in the DB and delete the exported CSV.
async function handleReset(res) {
  await sbUpdate('firms?id=not.is.null', { current_tier: null });
  const outPath = path.join(WRITABLE, OUTPUT_CSV);
  const existed = fs.existsSync(outPath);
  if (existed) fs.unlinkSync(outPath);
  sendJson(res, 200, { deleted: existed, path: outPath });
}

// no-store: this is a live internal tool — a stale cached app.js after an
// update is worse than re-downloading a few KB per load.
function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function sendText(res, status, text, type) {
  res.writeHead(status, { 'Content-Type': type || 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(text);
}

// Exported so a Vercel serverless function (api/[...path].mjs) can delegate to
// the exact same routing used by the local `node server.mjs` dev server.
export function handler(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  const fail = (err) => sendJson(res, 500, { error: String(err) });

  // The Vercel deployment is a read-only viewer (VCs + Digest). Mutation and
  // tooling endpoints exist only for the local operator tool; block them there.
  if (process.env.VERCEL) {
    const isFirmPatch = pathname === '/api/firm' && req.method === 'PATCH';
    const isWriteRoute = ['/api/upload', '/api/score', '/api/score-status', '/api/save'].includes(pathname);
    if (isFirmPatch || isWriteRoute) {
      return sendJson(res, 403, { error: 'Read-only deployment.' });
    }
  }

  if (req.method === 'GET' && pathname === '/api/version') {
    return sendJson(res, 200, { version: VERSION, readonly: !!process.env.VERCEL });
  }
  if (req.method === 'GET' && pathname === '/api/firms') {
    handleFirms(res).catch(fail);
    return;
  }
  if (pathname === '/api/firm' && url.searchParams.get('id')) {
    const id = url.searchParams.get('id');
    if (req.method === 'GET') {
      handleFirm(res, id).catch(fail);
      return;
    }
    if (req.method === 'PATCH') {
      readBody(req, (body) => handlePatchFirm(res, id, body).catch(fail));
      return;
    }
  }
  if (req.method === 'GET' && pathname === '/api/digests') {
    handleDigests(res).catch(fail);
    return;
  }
  if (req.method === 'POST' && pathname === '/api/upload') {
    readBody(req, (body) => handleUpload(res, body).catch(fail));
    return;
  }
  if (req.method === 'POST' && pathname === '/api/score') {
    try { handleStartScore(res); } catch (err) { fail(err); }
    return;
  }
  if (req.method === 'GET' && pathname === '/api/score-status') {
    handleScoreStatus(res).catch(fail);
    return;
  }

  if (req.method === 'GET' && pathname === '/api/csv') {
    handleGetCsv(res).catch(fail);
    return;
  }

  if (req.method === 'POST' && pathname === '/api/save') {
    readBody(req, (body) => {
      let csv = body;
      const ct = req.headers['content-type'] || '';
      if (ct.includes('application/json')) {
        try {
          csv = JSON.parse(body).csv;
        } catch (err) {
          return sendJson(res, 400, { error: 'Bad JSON: ' + String(err) });
        }
      }
      if (typeof csv !== 'string') return sendJson(res, 400, { error: 'No CSV in request.' });
      handleSave(res, csv).catch(fail);
    });
    return;
  }

  if (req.method === 'DELETE' && pathname === '/api/save') {
    handleReset(res).catch((err) => sendJson(res, 500, { error: String(err) }));
    return;
  }

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
}

// Local dev only. On Vercel the platform invokes `handler` per-request, so we
// must not bind a port there.
if (!process.env.VERCEL) {
  http.createServer(handler).listen(PORT, () => {
    console.log(`\n  VC Tinder running →  http://localhost:${PORT}`);
    console.log(`  Source: Supabase (${process.env.SUPABASE_URL || 'set SUPABASE_URL in .env'})`);
    console.log(`  Exports to: ${OUTPUT_CSV}\n`);
  });
}
