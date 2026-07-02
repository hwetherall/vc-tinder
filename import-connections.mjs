// Import Harry's personal VC connections (harrys-connections.md, tab-separated:
// Name / Firm / URL / Location) into Supabase: research each new firm, score it
// against the rubric, and attach the person as a contact with a warm-via-Harry
// proximity. Firms already in the database just gain the contact (and a
// proximity upgrade if they were sitting at Cold).
//
//   node import-connections.mjs --dry-run   # print the plan, write nothing
//   node import-connections.mjs             # research, score, import
//
// Requires: EXA_API_KEY, OPENROUTER_API_KEY, SUPABASE_URL, SUPABASE_KEY.

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { loadEnv, sbSelect, sbInsert, sbUpdate } from './db.mjs';
import { exaSearch, exaContents } from './exa.mjs';
import { normalizeName, normalizeDomain, scoreFirm, deriveTier, evidenceBlock } from './discover.mjs';
import { pickHomepage } from './enrich.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = path.join(HERE, 'harrys-connections.md');
const PROXIMITY = 'Warm (Harry)';

// Parse the tab-separated connections file -> [{ person, firm, url, location }].
export function parseConnectionsTsv(text) {
  const lines = String(text || '').split('\n').map((l) => l.trimEnd()).filter(Boolean);
  const out = [];
  for (const line of lines.slice(1)) { // skip header
    const [person, firm, url, location] = line.split('\t').map((s) => (s || '').trim());
    if (!person || !firm) continue;
    out.push({ person, firm, url: url || null, location: location || null });
  }
  return out;
}

async function addContact(firmId, conn, hasPrimary) {
  await sbInsert('contacts', [{
    firm_id: firmId,
    name: conn.person,
    is_primary: !hasPrimary,
    intro_path: 'Harry direct',
    source: 'harry',
  }], { onConflict: 'firm_id,name' });
}

async function importConnection(conn, existingByKey) {
  const key = normalizeName(conn.firm);
  const existing = existingByKey.get(key);

  if (existing) {
    const contacts = await sbSelect(`contacts?firm_id=eq.${existing.id}&select=id,is_primary`);
    await addContact(existing.id, conn, contacts.some((c) => c.is_primary));
    const patch = {};
    if ((existing.proximity || '').startsWith('Cold')) patch.proximity = PROXIMITY;
    if (Object.keys(patch).length) await sbUpdate(`firms?id=eq.${existing.id}`, patch);
    return `linked ${conn.person} -> ${existing.name}${patch.proximity ? ' (proximity upgraded)' : ''}`;
  }

  // New firm: resolve the website, pull evidence, score against the rubric.
  let url = conn.url;
  let resolved = false;
  if (!url) {
    const results = await exaSearch(
      `${conn.firm} venture capital firm ${conn.location || ''} official website`,
      { numResults: 5 }
    );
    const home = pickHomepage(results);
    if (home) { url = home.url; resolved = true; }
  }

  let record;
  if (url) {
    const { text } = await exaContents(url, 4000);
    const s = await scoreFirm({ name: conn.firm, url }, text);
    record = {
      name: conn.firm,
      normalized_name: key,
      website: url,
      domain: normalizeDomain(url),
      location: conn.location,
      proximity: PROXIMITY,
      tier_label: deriveTier(s),
      fit: s.fit,
      thesis_fit: s.thesis_fit,
      network: s.network,
      lead_capability: s.lead_capability,
      location_score: s.location,
      gravitas_score: s.gravitas,
      score_confidence: s.lead_capability_confidence || null,
      status: `HARRY CONNECTION (AI-scored): ${s.note || ''}${resolved ? ' — website resolved via search, verify' : ''}`.trim(),
      intro_path: `Harry direct — ${conn.person}`,
      evidence: evidenceBlock(s, url),
      source: 'manual',
    };
  } else {
    record = {
      name: conn.firm,
      normalized_name: key,
      location: conn.location,
      proximity: PROXIMITY,
      tier_label: 'TBD',
      status: 'HARRY CONNECTION — needs research (no website found)',
      intro_path: `Harry direct — ${conn.person}`,
      source: 'manual',
    };
  }

  const [inserted] = await sbInsert('firms', [record], { onConflict: 'normalized_name' });
  if (!inserted) return `skipped ${conn.firm} (name collision)`;
  await addContact(inserted.id, conn, false);
  return `added ${conn.firm}: fit ${record.fit ?? '—'} -> ${record.tier_label} (${conn.person})`;
}

async function main() {
  loadEnv();
  const dryRun = process.argv.includes('--dry-run');
  const conns = parseConnectionsTsv(fs.readFileSync(SOURCE, 'utf8'));

  const firms = await sbSelect('firms?select=id,name,normalized_name,proximity');
  const existingByKey = new Map(firms.map((f) => [f.normalized_name, f]));

  console.log(`${conns.length} connections in ${path.basename(SOURCE)}.`);
  if (dryRun) {
    for (const c of conns) {
      const hit = existingByKey.get(normalizeName(c.firm));
      console.log(`  • ${c.firm.padEnd(24)} ${hit ? `EXISTS -> link ${c.person}` : `NEW -> research + score (${c.person})`}`);
    }
    console.log('DRY RUN, nothing written.');
    return;
  }

  for (const conn of conns) {
    process.stdout.write(`  ${conn.firm} ... `);
    try {
      console.log(await importConnection(conn, existingByKey));
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
    }
  }
  const total = await sbSelect('firms?select=id');
  console.log(`\nDone. Firms in database: ${total.length}.`);
}

// Run only when invoked directly (not when imported by tests).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
