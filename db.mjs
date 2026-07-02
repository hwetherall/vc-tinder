// Shared Supabase access for the Node scripts + server. Zero-dep: loads .env
// from this folder and talks straight to the PostgREST API with fetch.
// Requires: SUPABASE_URL, SUPABASE_KEY (publishable/anon key; the key never
// leaves this machine — the browser only ever talks to our local server).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// Load KEY=value pairs from .env into process.env (already-set env wins).
export function loadEnv(file = path.join(HERE, '.env')) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] == null) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

function cfg() {
  loadEnv();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_KEY not set (add them to .env)');
  return { url: url.replace(/\/$/, ''), key };
}

// Minimal PostgREST request. `query` is e.g. 'firms?select=*&order=fit.desc'.
export async function sb(query, { method = 'GET', body, prefer } = {}) {
  const { url, key } = cfg();
  const headers = {
    apikey: key,
    authorization: `Bearer ${key}`,
    'content-type': 'application/json',
  };
  if (prefer) headers.prefer = prefer;
  const res = await fetch(`${url}/rest/v1/${query}`, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Supabase ${method} ${query.split('?')[0]} -> HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : null;
}

export const sbSelect = (query) => sb(query);

// Insert an array of rows. Pass onConflict to upsert-ignore duplicates
// (e.g. 'normalized_name'); returns the representation of inserted rows.
export function sbInsert(table, rows, { onConflict } = {}) {
  const q = onConflict ? `${table}?on_conflict=${onConflict}` : table;
  const prefer = onConflict
    ? 'resolution=ignore-duplicates,return=representation'
    : 'return=representation';
  return sb(q, { method: 'POST', body: rows, prefer });
}

// PATCH rows matching the filter query, e.g. sbUpdate('firms?id=eq.<uuid>', {...}).
export function sbUpdate(query, patch) {
  return sb(query, { method: 'PATCH', body: patch, prefer: 'return=minimal' });
}
