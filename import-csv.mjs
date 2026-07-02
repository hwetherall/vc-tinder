// One-time (idempotent) import: source CSV -> Supabase firms + contacts.
// Duplicate firms (by normalized name) and duplicate contacts (by firm+name)
// are skipped on re-run, so this is safe to run more than once.
//
//   node import-csv.mjs --dry-run   # print what would be imported
//   node import-csv.mjs             # import

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseCSV } from './csv.mjs';
import { normalizeName, normalizeDomain } from './discover.mjs';
import { sbInsert, sbSelect, loadEnv } from './db.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_CSV = path.join(HERE, 'Innovera-SeriesA-targets-from-Happenstance (1).csv');

const int = (v) => {
  const n = parseInt(String(v == null ? '' : v).trim(), 10);
  return Number.isFinite(n) ? n : null;
};

// "Sri Pangulur - Partner (Mayfield Fund)" -> { name, title }
function parseContact(cell) {
  const s = String(cell || '').trim();
  if (!s) return null;
  const i = s.indexOf(' - ');
  if (i === -1) return { name: s, title: null };
  return { name: s.slice(0, i).trim(), title: s.slice(i + 3).trim() || null };
}

// Discovered rows carry their homepage inside the Evidence blob ("source: <url>").
function websiteFromEvidence(evidence) {
  const m = String(evidence || '').match(/source:\s*(https?:\/\/\S+)/);
  return m ? m[1] : null;
}

function firmRecord(header, row, sortOrder) {
  const get = (col) => {
    const i = header.indexOf(col);
    return i === -1 ? '' : (row[i] || '').trim();
  };
  const name = get('VC');
  if (!name) return null;
  const proximity = get('Proximity');
  const website = websiteFromEvidence(get('Evidence'));
  return {
    firm: {
      name,
      normalized_name: normalizeName(name),
      website,
      domain: website ? normalizeDomain(website) : null,
      location: get('Location') || null,
      proximity: proximity || null,
      tier_label: get('Tier') || null,
      fit: int(get('Fit')),
      thesis_fit: int(get('Thesis Fit')),
      network: int(get('Network')),
      lead_capability: int(get('Lead Capability')),
      location_score: int(get('Location Score')),
      gravitas_score: int(get('Gravitas Score')),
      score_confidence: get('Score Confidence') || null,
      status: get('Status') || null,
      intro_path: get('Intro Path') || null,
      evidence: get('Evidence') || null,
      source: proximity.startsWith('Cold (discovered)') ? 'discovered' : 'happenstance',
      sort_order: sortOrder,
    },
    contact: parseContact(get('Contact')),
  };
}

async function main() {
  loadEnv();
  const dryRun = process.argv.includes('--dry-run');
  const rows = parseCSV(fs.readFileSync(SOURCE_CSV, 'utf8'));
  const header = rows[0];

  const records = [];
  const seen = new Set();
  for (const [i, row] of rows.slice(1).entries()) {
    const rec = firmRecord(header, row, i + 1);
    if (!rec) continue;
    if (seen.has(rec.firm.normalized_name)) {
      console.log(`  ! duplicate in CSV, skipping: ${rec.firm.name}`);
      continue;
    }
    seen.add(rec.firm.normalized_name);
    records.push(rec);
  }
  console.log(`Parsed ${records.length} firms (${records.filter((r) => r.contact).length} with a contact).`);

  if (dryRun) {
    for (const r of records.slice(0, 10)) {
      console.log(`  • ${r.firm.name} [${r.firm.source}]${r.contact ? ` — ${r.contact.name}` : ''}`);
    }
    console.log(`  … and ${Math.max(0, records.length - 10)} more. DRY RUN, nothing written.`);
    return;
  }

  await sbInsert('firms', records.map((r) => r.firm), { onConflict: 'normalized_name' });

  // Re-select to get ids for ALL firms (including ones skipped as duplicates).
  const firms = await sbSelect('firms?select=id,normalized_name');
  const idByKey = new Map(firms.map((f) => [f.normalized_name, f.id]));

  const contacts = records
    .filter((r) => r.contact && idByKey.has(r.firm.normalized_name))
    .map((r) => ({
      firm_id: idByKey.get(r.firm.normalized_name),
      name: r.contact.name,
      title: r.contact.title,
      is_primary: true,
      intro_path: r.firm.intro_path,
      source: r.firm.source,
    }));
  if (contacts.length) await sbInsert('contacts', contacts, { onConflict: 'firm_id,name' });

  const count = await sbSelect('firms?select=id');
  console.log(`Done. Firms in database: ${count.length}. Contacts imported: ${contacts.length}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
