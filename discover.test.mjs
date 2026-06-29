import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeName,
  normalizeDomain,
  gateCandidate,
  deriveTier,
  existingNameKeys,
  buildRow,
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

test('gateCandidate rejects accelerators/studios, flags non-venture, keeps real funds', () => {
  assert.equal(gateCandidate('Plug and Play', 'startup accelerator program').keep, false);
  assert.equal(gateCandidate('GSD Venture Studios', 'a venture studio').keep, false);

  const fund = gateCandidate('Acme Capital', 'early-stage venture fund investing in AI');
  assert.equal(fund.keep, true);
  assert.equal(fund.flag, '');

  const pe = gateCandidate('Blackstone', 'private equity firm');
  assert.equal(pe.keep, true);
  assert.notEqual(pe.flag, '');
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
