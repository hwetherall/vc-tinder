import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseCSV } from './csv.mjs';
import {
  normalizeName,
  normalizeDomain,
  gateCandidate,
  deriveTier,
  existingNameKeys,
  buildRow,
  writeCsvTransactional,
} from './discover.mjs';

// Tier labels that app.js startTier() recognizes. deriveTier must only emit these.
const KNOWN_TIERS = new Set([
  '1 - Open now',
  '2 - Cultivate / participant',
  'VERIFY (poss. Tier-1)',
  'Inside / sponsor',
  '3 - Follow / participant',
  'TBD',
  'Referral / deprioritize',
  'Gate',
]);

test('normalizeName strips suffixes so name variants collapse', () => {
  assert.equal(normalizeName('Unusual Ventures'), normalizeName('Unusual'));
  assert.equal(normalizeName('Craft Ventures'), 'craft');
});

test('normalizeName resolves known aliases (the case fuzzy matching misses)', () => {
  assert.equal(normalizeName('a16z'), normalizeName('Andreessen Horowitz'));
  assert.equal(normalizeName('a16z'), 'andreessen horowitz');
});

test('normalizeDomain extracts the bare host', () => {
  assert.equal(normalizeDomain('https://www.unusual.vc/team'), 'unusual.vc');
  assert.equal(normalizeDomain('http://radical.vc'), 'radical.vc');
  assert.equal(normalizeDomain('not a url'), '');
});

test('gateCandidate rejects accelerators/studios, flags non-lead vehicles, keeps real funds', () => {
  assert.equal(gateCandidate('Plug and Play', 'startup accelerator program').keep, false);
  assert.equal(gateCandidate('GSD Venture Studios', 'a venture studio').keep, false);

  const fund = gateCandidate('Acme Capital', 'early-stage venture fund investing in AI', 'https://acme.vc');
  assert.equal(fund.keep, true);
  assert.equal(fund.flag, '');

  const pe = gateCandidate('Blackstone', 'private equity firm');
  assert.equal(pe.keep, true);
  assert.notEqual(pe.flag, '');
});

test('gateCandidate (tightened) rejects non-VC entities, social URLs, and degenerate names', () => {
  assert.equal(gateCandidate('Mayfield Consulting Ltd', '').keep, false);     // consulting
  assert.equal(gateCandidate('Acme Financial Services', '').keep, false);     // financial services
  assert.equal(gateCandidate('Helix Bioscience Fund', '').keep, false);       // sector mismatch
  assert.equal(gateCandidate('Mayfield Management Co', '').keep, false);      // management co
  assert.equal(gateCandidate('DCVC Bio', '', 'https://linkedin.com/company/dcvcbio').keep, false); // social URL
  assert.equal(gateCandidate('_____', '', 'https://dh.vc').keep, false);      // degenerate name
  assert.equal(gateCandidate('Root Ventures', 'seed deep-tech fund', 'https://root.vc').keep, true); // real fund survives
});

test('deriveTier maps composite + gates to recognized labels', () => {
  const base = { is_fund: true, is_accelerator: false, writes_500k_plus: true, does_series_a: true, lead_capability_confidence: 'high' };
  assert.equal(deriveTier({ ...base, fit: 95 }), '1 - Open now');
  assert.equal(deriveTier({ ...base, fit: 80 }), '2 - Cultivate / participant');
  assert.equal(deriveTier({ ...base, fit: 60 }), '3 - Follow / participant');
  assert.equal(deriveTier({ ...base, fit: 40 }), 'Referral / deprioritize');
  assert.equal(deriveTier({ ...base, fit: 80, lead_capability_confidence: 'low' }), 'VERIFY (poss. Tier-1)');
  assert.equal(deriveTier({ ...base, fit: 95, is_accelerator: true }), 'Gate');
  assert.equal(deriveTier({ ...base, fit: 95, is_fund: false }), 'Gate');
  assert.equal(deriveTier({ ...base, fit: 95, writes_500k_plus: false }), 'Gate');
});

test('deriveTier only ever emits labels startTier() recognizes', () => {
  for (const fit of [0, 50, 60, 80, 95]) {
    for (const conf of ['low', 'med', 'high']) {
      const label = deriveTier({ fit, is_fund: true, is_accelerator: false, writes_500k_plus: true, does_series_a: true, lead_capability_confidence: conf });
      assert.ok(KNOWN_TIERS.has(label), `unexpected tier label: ${label}`);
    }
  }
});

test('existingNameKeys builds a normalized set; aliases match', () => {
  const rows = [
    ['VC', 'Tier'],
    ['Andreessen Horowitz', '1 - Open now'],
    ['Unusual Ventures', '2 - Cultivate / participant'],
  ];
  const keys = existingNameKeys(rows);
  assert.ok(keys.has('andreessen horowitz'));
  assert.ok(keys.has('unusual'));
  // A new candidate named "a16z" should be detected as already present.
  assert.ok(keys.has(normalizeName('a16z')));
});

test('buildRow aligns fields to the header and fills blanks', () => {
  const header = ['VC', 'Fit', 'Evidence', 'Score Confidence'];
  assert.deepEqual(buildRow(header, { VC: 'X', Fit: 90 }), ['X', '90', '', '']);
});

test('writeCsvTransactional puts new rows on top, pads existing, tolerates a blank row, writes a .bak', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vct-'));
  const file = path.join(dir, 'src.csv');
  try {
    fs.writeFileSync(file, 'pre-existing', 'utf8'); // so the .bak path is exercised
    const header = ['VC', 'Fit', 'Evidence', 'Score Confidence'];
    const existing = [['Accel', '96'], ['', '', '', '']]; // 13-col-style short row + a fully-blank row
    const fresh = [['NewFund', '88', 'thesis: strong', 'high']];

    assert.doesNotThrow(() => writeCsvTransactional(file, header, existing, fresh));

    const out = parseCSV(fs.readFileSync(file, 'utf8'));
    assert.deepEqual(out[0], header);              // header preserved
    assert.equal(out[1][0], 'NewFund');            // new rows written first (reachable)
    assert.ok(out.some((r) => r[0] === 'Accel'));  // existing row kept
    assert.ok(out.every((r) => r.length === header.length)); // padded rectangular
    assert.ok(!out.some((r) => r.every((v) => v === ''))); // blank row dropped, not corrupting
    assert.ok(fs.existsSync(file + '.bak'));        // backup written
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
