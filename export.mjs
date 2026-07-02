// VC Tinder — Attio export.
// Flattens the database into two Attio-importable CSVs (Companies + People),
// written to exports/ with today's date. Gate-tier firms are excluded unless
// --all is passed; everything else, including enrichment columns and the
// latest deals, goes along for the ride.
//
//   node export.mjs           # exports/attio-companies-YYYY-MM-DD.csv + attio-people-...
//   node export.mjs --all     # include Gate (tier 5) firms too

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { serializeCSV } from './csv.mjs';
import { loadEnv, sbSelect } from './db.mjs';
import { effectiveTier, TIER_LABEL } from './tiers.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(HERE, 'exports');

const COMPANY_COLS = [
  'Name', 'Website', 'Location', 'Tier', 'Tier Label', 'Proximity',
  'Fit', 'Thesis Fit', 'Network', 'Lead Capability', 'Location Score', 'Gravitas Score',
  'Score Confidence', 'Fund Size', 'Founded', 'Stage Focus', 'Thesis Tags',
  'Deal Pattern', 'Recent Deals', 'Primary Contact', 'Primary Contact Email',
  'Intro Path', 'Status', 'Source', 'Firm ID',
];

const PEOPLE_COLS = [
  'Name', 'Title', 'Company', 'Email', 'Email Status', 'LinkedIn',
  'Primary', 'Intro Path', 'Source', 'Contact ID', 'Firm ID',
];

// Latest deals as one compact cell: "Acme (Series A, lead, 2026-06-25); ..."
export function dealsCell(deals, max = 3) {
  return (deals || [])
    .slice()
    .sort((a, b) => String(b.announced_on || '').localeCompare(String(a.announced_on || '')))
    .slice(0, max)
    .map((d) => {
      const bits = [d.round, d.role, d.announced_on].filter((v) => v && v !== 'unknown');
      return bits.length ? `${d.company} (${bits.join(', ')})` : d.company;
    })
    .join('; ');
}

export function companyRow(f) {
  const tier = effectiveTier(f);
  const primary = (f.contacts || []).find((c) => c.is_primary) || (f.contacts || [])[0];
  const v = {
    Name: f.name,
    Website: f.website,
    Location: f.location,
    Tier: tier,
    'Tier Label': f.tier_label || TIER_LABEL[tier],
    Proximity: f.proximity,
    Fit: f.fit,
    'Thesis Fit': f.thesis_fit,
    Network: f.network,
    'Lead Capability': f.lead_capability,
    'Location Score': f.location_score,
    'Gravitas Score': f.gravitas_score,
    'Score Confidence': f.score_confidence,
    'Fund Size': f.fund_size,
    Founded: f.founded_year,
    'Stage Focus': f.stage_focus,
    'Thesis Tags': (f.thesis_tags || []).join(', '),
    'Deal Pattern': f.fund_summary,
    'Recent Deals': dealsCell(f.deals),
    'Primary Contact': primary ? primary.name : '',
    'Primary Contact Email': primary ? primary.email : '',
    'Intro Path': f.intro_path,
    Status: f.status,
    Source: f.source,
    'Firm ID': f.id,
  };
  return COMPANY_COLS.map((c) => (v[c] == null ? '' : String(v[c])));
}

export function peopleRows(f) {
  return (f.contacts || []).map((c) => {
    const v = {
      Name: c.name,
      Title: c.title,
      Company: f.name,
      Email: c.email,
      'Email Status': c.email ? c.email_status : '',
      LinkedIn: c.linkedin_url,
      Primary: c.is_primary ? 'yes' : '',
      'Intro Path': c.intro_path,
      Source: c.source,
      'Contact ID': c.id,
      'Firm ID': f.id,
    };
    return PEOPLE_COLS.map((col) => (v[col] == null ? '' : String(v[col])));
  });
}

async function main() {
  loadEnv();
  const all = process.argv.includes('--all');
  const firms = await sbSelect(
    'firms?select=*,contacts(*),deals(company,round,role,announced_on)&order=fit.desc.nullslast'
  );
  const included = firms.filter((f) => all || effectiveTier(f) < 5);

  const date = new Date().toISOString().slice(0, 10);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const companiesPath = path.join(OUT_DIR, `attio-companies-${date}.csv`);
  const peoplePath = path.join(OUT_DIR, `attio-people-${date}.csv`);

  fs.writeFileSync(companiesPath, serializeCSV([COMPANY_COLS, ...included.map(companyRow)]), 'utf8');
  const people = included.flatMap(peopleRows);
  fs.writeFileSync(peoplePath, serializeCSV([PEOPLE_COLS, ...people]), 'utf8');

  console.log(`Exported ${included.length} firms (${firms.length - included.length} Gate-tier excluded${all ? '' : '; --all to include'}).`);
  console.log(`  ${companiesPath}`);
  console.log(`  ${peoplePath} (${people.length} people)`);
}

// Run only when invoked directly (not when imported by tests).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
