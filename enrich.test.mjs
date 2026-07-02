import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dealKey, pickHomepage, daysAgoIso } from './enrich.mjs';
import { parseConnectionsTsv } from './import-connections.mjs';
import { startTier, TIER_LABEL, effectiveTier } from './tiers.mjs';
import { splitName } from './ninjapear/ninjapear.mjs';
import { dealsCell, companyRow, peopleRows } from './export.mjs';

test('dealsCell sorts newest first, caps at max, drops unknown bits', () => {
  const deals = [
    { company: 'Old', round: 'Seed', role: 'lead', announced_on: '2025-01-01' },
    { company: 'New', round: 'Series A', role: 'unknown', announced_on: '2026-06-01' },
    { company: 'Mid', round: null, role: null, announced_on: '2026-01-01' },
  ];
  assert.equal(dealsCell(deals, 2), 'New (Series A, 2026-06-01); Mid (2026-01-01)');
  assert.equal(dealsCell([]), '');
});

test('companyRow/peopleRows flatten a firm with contacts and enrichment', () => {
  const firm = {
    id: 'f1', name: 'Acme Capital', website: 'https://acme.vc', tier_label: '1 - Open now',
    current_tier: null, fit: 92, thesis_tags: ['ai', 'fintech'], fund_summary: 'Leads early AI rounds.',
    contacts: [
      { id: 'c1', name: 'Jane Doe', title: 'GP', email: 'jane@acme.vc', email_status: 'pattern', is_primary: true, source: 'happenstance' },
      { id: 'c2', name: 'Bob Roe', title: null, email: null, is_primary: false, source: 'enrich' },
    ],
    deals: [{ company: 'X', round: 'Seed', role: 'lead', announced_on: '2026-05-01' }],
  };
  const row = companyRow(firm);
  assert.equal(row[0], 'Acme Capital');
  assert.ok(row.includes('jane@acme.vc'));       // primary contact email present
  assert.ok(row.includes('ai, fintech'));        // tags joined
  const people = peopleRows(firm);
  assert.equal(people.length, 2);
  assert.equal(people[0][0], 'Jane Doe');
  assert.equal(people[1][3], '');                // Bob has no email -> blank, not 'null'
});

test('splitName handles middle initials, single names, and apostrophes', () => {
  assert.deepEqual(splitName('David O. Sacks'), { first: 'David', last: 'Sacks' });
  assert.deepEqual(splitName("Niamh O'Donnell"), { first: 'Niamh', last: "O'Donnell" });
  assert.deepEqual(splitName('Madonna'), { first: 'Madonna', last: '' });
  assert.deepEqual(splitName(''), { first: '', last: '' });
});

test('dealKey collapses phrasing variants of the same deal', () => {
  assert.equal(dealKey({ company: 'Acme AI', round: 'Series A' }), dealKey({ company: 'acme a.i.', round: 'series-a' }));
  assert.notEqual(dealKey({ company: 'Acme AI', round: 'Seed' }), dealKey({ company: 'Acme AI', round: 'Series A' }));
  assert.equal(dealKey({ company: 'Acme' }), dealKey({ company: 'Acme', round: 'unknown' }));
});

test('pickHomepage skips social/aggregator/news hosts and picks the firm site', () => {
  const picked = pickHomepage([
    { url: 'https://www.linkedin.com/company/8vc' },
    { url: 'https://www.crunchbase.com/organization/8vc' },
    { url: 'https://techcrunch.com/2026/01/01/8vc-raises' },
    { url: 'https://www.8vc.com/team' },
  ]);
  assert.equal(picked.domain, '8vc.com');
  assert.equal(pickHomepage([{ url: 'https://pitchbook.com/profiles/x' }]), null);
  assert.equal(pickHomepage([]), null);
});

test('daysAgoIso returns YYYY-MM-DD the right distance back', () => {
  assert.equal(daysAgoIso(1, new Date('2026-07-02T12:00:00Z')), '2026-07-01');
  assert.equal(daysAgoIso(365, new Date('2026-07-02T12:00:00Z')), '2025-07-02');
});

test('parseConnectionsTsv skips the header, trims, and nulls blanks', () => {
  const rows = parseConnectionsTsv(
    'Name\tFirm\tURL\tLocation\n' +
    'Tom McQuillen\tRegen\thttps://www.regen.vc/\tByron Bay, Australia\n' +
    'Bohan Lou\tChemistry.ai\t\tSF\n' +
    '\n' +
    'No Firm Person\t\t\t\n'
  );
  assert.equal(rows.length, 2); // blank line + missing-firm row dropped
  assert.deepEqual(rows[0], { person: 'Tom McQuillen', firm: 'Regen', url: 'https://www.regen.vc/', location: 'Byron Bay, Australia' });
  assert.deepEqual(rows[1], { person: 'Bohan Lou', firm: 'Chemistry.ai', url: null, location: 'SF' });
});

test('TIER_LABEL round-trips through startTier; effectiveTier prefers the swipe decision', () => {
  for (const [n, label] of Object.entries(TIER_LABEL)) {
    assert.equal(startTier(label), Number(n));
  }
  assert.equal(effectiveTier({ current_tier: 4, tier_label: '1 - Open now' }), 4);
  assert.equal(effectiveTier({ current_tier: null, tier_label: 'VERIFY (poss. Tier-1)' }), 2);
});
