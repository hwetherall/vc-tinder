// VC Tinder — CSV importer.
// Takes any firm-per-row CSV that at minimum has a firm-name column, maps
// whatever other columns it recognizes (scores, contact, LinkedIn, website...),
// and upserts firms + contacts into Supabase. Re-running is idempotent: firms
// dedupe on normalized name, contacts on (firm, name). Unscored firms are left
// with fit = null — score.mjs picks them up from there.
//
//   node importer.mjs <file.csv> [--source happenstance] [--dry-run]
//
// Also used by the server's POST /api/upload (see server.mjs).

import fs from 'fs';
import { pathToFileURL } from 'url';
import { parseCSV } from './csv.mjs';
import { loadEnv, sbSelect, sbInsert } from './db.mjs';
import { normalizeName, normalizeDomain } from './discover.mjs';

/* ------------------------------------------------------------------ */
/* Pure helpers (exported for tests)                                   */
/* ------------------------------------------------------------------ */

// Recognized columns -> canonical keys. Matching is case/space-insensitive.
const COLUMN_ALIASES = {
  name: ['vc', 'firm', 'fund', 'company', 'firm name', 'fund name', 'current company'],
  tier_label: ['tier'],
  proximity: ['proximity'],
  fit: ['fit'],
  location: ['location', 'city', 'hq'],
  website: ['website', 'url', 'site'],
  thesis_fit: ['thesis fit'],
  network: ['network'],
  lead_capability: ['lead capability'],
  location_score: ['location score'],
  gravitas_score: ['gravitas score'],
  score_confidence: ['score confidence', 'confidence'],
  status: ['status'],
  intro_path: ['intro path', 'intro', 'mutuals'],
  evidence: ['evidence'],
  contact: ['contact', 'person', 'contact name'],
  contact_first: ['first name'],
  contact_last: ['last name'],
  contact_title: ['title', 'role', 'position', 'current title'],
  contact_email: ['email', 'work email'],
  contact_linkedin: ['linkedin', 'linkedin url', 'linkedin profile'],
  contact_notes: ['quotes', 'notes', 'bio'],
  // Happenstance trait columns (Yes/No pre-screens) — folded into contact notes.
  trait_partner: ['trait gppartnerangel'],
  trait_lead: ['trait series a lead'],
  trait_focus: ['trait aib2bsaas focus'],
  trait_geo: ['trait uswest coast'],
  trait_vc: ['trait excl nonvcniche'],
};

const TRAIT_LABELS = {
  trait_partner: 'GP/Partner',
  trait_lead: 'Series A lead',
  trait_focus: 'AI/B2B/SaaS',
  trait_geo: 'US/West Coast',
  trait_vc: 'real VC (not excluded type)',
};

export function mapHeader(header) {
  const canon = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  const map = {};   // canonical key -> column index
  const ignored = [];
  header.forEach((h, i) => {
    const c = canon(h);
    const key = Object.keys(COLUMN_ALIASES).find((k) => COLUMN_ALIASES[k].includes(c));
    if (key && map[key] == null) map[key] = i;
    else if (String(h).trim()) ignored.push(h);
  });
  return { map, ignored };
}

const int = (v) => {
  const n = parseInt(String(v == null ? '' : v).trim(), 10);
  return Number.isFinite(n) ? n : null;
};

// "Sri Pangulur - Partner (Mayfield Fund)" -> { name, title }
export function parseContactCell(cell) {
  const s = String(cell || '').trim();
  if (!s) return null;
  const i = s.indexOf(' - ');
  if (i === -1) return { name: s, title: null };
  return { name: s.slice(0, i).trim(), title: s.slice(i + 3).trim() || null };
}

// Parsed CSV rows -> { firms: Map(normalizedName -> {firm, contacts[]}), ignored, skipped }.
// Rows sharing a firm collapse into one firm with multiple contacts.
export function rowsToRecords(rows, { source = 'happenstance' } = {}) {
  const header = rows[0] || [];
  const { map, ignored } = mapHeader(header);
  if (map.name == null) throw new Error(`no firm-name column found (looked for: ${COLUMN_ALIASES.name.join(', ')})`);
  const get = (row, key) => (map[key] == null ? '' : String(row[map[key]] || '').trim());

  const firms = new Map();
  let skipped = 0;
  for (const [i, row] of rows.slice(1).entries()) {
    const name = get(row, 'name');
    if (!name) { skipped++; continue; }
    const key = normalizeName(name);
    if (!key) { skipped++; continue; }

    if (!firms.has(key)) {
      const website = get(row, 'website') || null;
      firms.set(key, {
        firm: {
          name,
          normalized_name: key,
          website,
          domain: website ? normalizeDomain(website) : null,
          location: get(row, 'location') || null,
          proximity: get(row, 'proximity') || null,
          tier_label: get(row, 'tier_label') || null,
          fit: int(get(row, 'fit')),
          thesis_fit: int(get(row, 'thesis_fit')),
          network: int(get(row, 'network')),
          lead_capability: int(get(row, 'lead_capability')),
          location_score: int(get(row, 'location_score')),
          gravitas_score: int(get(row, 'gravitas_score')),
          score_confidence: get(row, 'score_confidence') || null,
          status: get(row, 'status') || null,
          intro_path: get(row, 'intro_path') || null,
          evidence: get(row, 'evidence') || null,
          source,
          sort_order: i + 1,
        },
        contacts: [],
      });
    }
    const rec = firms.get(key);
    // Contact: single "Name - Title" cell, or split First/Last Name columns
    // (Happenstance's person-keyed exports). Trailing ", MBA"-style suffixes drop.
    let parsed = parseContactCell(get(row, 'contact'));
    if (!parsed && (get(row, 'contact_first') || get(row, 'contact_last'))) {
      const name = [get(row, 'contact_first'), get(row, 'contact_last').split(',')[0].trim()]
        .filter(Boolean).join(' ');
      if (name) parsed = { name, title: null };
    }
    if (parsed) {
      const already = rec.contacts.find((c) => c.name.toLowerCase() === parsed.name.toLowerCase());
      if (!already) {
        const traits = Object.keys(TRAIT_LABELS)
          .filter((k) => map[k] != null)
          .map((k) => `${TRAIT_LABELS[k]}: ${get(row, k) || '?'}`)
          .join(', ');
        const notes = [get(row, 'contact_notes'), traits ? `Happenstance traits — ${traits}` : '']
          .filter(Boolean).join('\n').slice(0, 2000) || null;
        rec.contacts.push({
          name: parsed.name,
          title: get(row, 'contact_title') || parsed.title || null,
          email: get(row, 'contact_email') || null,
          email_status: get(row, 'contact_email') ? 'unknown' : undefined,
          linkedin_url: get(row, 'contact_linkedin') || null,
          notes,
          is_primary: rec.contacts.length === 0,
          intro_path: get(row, 'intro_path') || null,
          source,
        });
      }
    }
  }
  return { firms, ignored, skipped };
}

/* ------------------------------------------------------------------ */
/* Import                                                              */
/* ------------------------------------------------------------------ */

// Push records into Supabase. Returns counts for reporting.
export async function importRecords(firms) {
  const records = [...firms.values()];
  const inserted = records.length
    ? await sbInsert('firms', records.map((r) => r.firm), { onConflict: 'normalized_name' })
    : [];

  const all = await sbSelect('firms?select=id,normalized_name,fit');
  const idByKey = new Map(all.map((f) => [f.normalized_name, f.id]));

  const contacts = records.flatMap((r) =>
    r.contacts
      .filter(() => idByKey.has(r.firm.normalized_name))
      .map((c) => ({ ...c, firm_id: idByKey.get(r.firm.normalized_name) }))
  );
  const insertedContacts = contacts.length
    ? await sbInsert('contacts', contacts, { onConflict: 'firm_id,name' })
    : [];

  const unscored = all.filter((f) => f.fit == null).length;
  return {
    firmsImported: (inserted || []).length,
    firmsDuplicate: records.length - (inserted || []).length,
    contactsImported: (insertedContacts || []).length,
    totalFirms: all.length,
    unscored,
  };
}

// Full pipeline for one CSV string (used by the server upload endpoint).
export async function importCsvText(csvText, { source } = {}) {
  const rows = parseCSV(csvText);
  if (rows.length < 2) throw new Error('CSV has no data rows');
  const { firms, ignored, skipped } = rowsToRecords(rows, { source });
  const counts = await importRecords(firms);
  return { ...counts, ignoredColumns: ignored, rowsSkipped: skipped };
}

/* ------------------------------------------------------------------ */
/* CLI                                                                 */
/* ------------------------------------------------------------------ */

async function main() {
  loadEnv();
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const srcIdx = argv.indexOf('--source');
  const source = srcIdx !== -1 ? argv[srcIdx + 1] : 'happenstance';
  const file = argv.find((a) => !a.startsWith('--') && a !== source);
  if (!file) {
    console.error('Usage: node importer.mjs <file.csv> [--source happenstance] [--dry-run]');
    process.exit(1);
  }

  const rows = parseCSV(fs.readFileSync(file, 'utf8'));
  const { firms, ignored, skipped } = rowsToRecords(rows, { source });
  console.log(`Parsed ${firms.size} firms (${[...firms.values()].reduce((n, r) => n + r.contacts.length, 0)} contacts) from ${rows.length - 1} rows.`);
  if (ignored.length) console.log(`Ignored columns: ${ignored.join(', ')}`);
  if (skipped) console.log(`Skipped ${skipped} rows with no firm name.`);

  if (dryRun) {
    for (const r of [...firms.values()].slice(0, 8)) {
      console.log(`  • ${r.firm.name}${r.contacts.length ? ` — ${r.contacts.map((c) => c.name).join(', ')}` : ''}`);
    }
    console.log(`  … DRY RUN, nothing written.`);
    return;
  }

  const counts = await importRecords(firms);
  console.log(`Imported ${counts.firmsImported} new firms (${counts.firmsDuplicate} already present), ${counts.contactsImported} contacts.`);
  console.log(`Database now: ${counts.totalFirms} firms, ${counts.unscored} unscored -> run: node score.mjs`);
}

// Run only when invoked directly (not when imported by tests/server).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
