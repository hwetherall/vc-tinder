import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeName,
  normalizeDomain,
  gateCandidate,
  deriveTier,
  extractJson,
  normalizeScore,
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

test('extractJson handles raw, ```json-fenced, and prose-wrapped model output', () => {
  const obj = { thesis_fit: 22, note: 'ok' };
  // raw
  assert.deepEqual(extractJson(JSON.stringify(obj)), obj);
  // ```json fenced (the case that broke the first scored run)
  assert.deepEqual(extractJson('```json\n' + JSON.stringify(obj) + '\n```'), obj);
  // bare ``` fence
  assert.deepEqual(extractJson('```\n' + JSON.stringify(obj) + '\n```'), obj);
  // leading/trailing prose
  assert.deepEqual(extractJson('Here is the score:\n' + JSON.stringify(obj) + '\nDone.'), obj);
  // malformed still throws (so the firm falls back to an unscored row)
  assert.throws(() => extractJson('not json at all'));
});

test('normalizeScore flattens nested scores/gates and clamps (the bug that zeroed the first run)', () => {
  const nested = {
    scores: { thesis_fit: 22, network: 20, lead_capability: 23, location: 15, gravitas: 8 },
    gates: { is_fund: true, is_accelerator: false, writes_500k_plus: true, does_series_a: true },
    evidence: { thesis_fit: 'AI/data thesis', lead_capability: 'leads rounds' },
    note: 'strong fit',
  };
  const s = normalizeScore(nested);
  assert.equal(s.fit, 88);
  assert.equal(s.thesis_fit, 22);
  assert.equal(s.lead_capability, 23);
  assert.equal(s.is_fund, true);
  assert.equal(s.evidence.thesis, 'AI/data thesis'); // evidence.thesis_fit -> thesis
  assert.equal(s.evidence.lead, 'leads rounds');     // evidence.lead_capability -> lead
});

test('normalizeScore handles the flat shape, maps medium->med, and clamps over-max', () => {
  const flat = {
    thesis_fit: 99, network: 10, lead_capability: 10, location: 5, gravitas: 5,
    is_fund: true, is_accelerator: false, writes_500k_plus: true, does_series_a: true,
    lead_capability_confidence: 'medium', evidence: {}, note: '',
  };
  const s = normalizeScore(flat);
  assert.equal(s.thesis_fit, 25); // clamped from 99
  assert.equal(s.fit, 25 + 10 + 10 + 5 + 5);
  assert.equal(s.lead_capability_confidence, 'med');
});

test('normalizeScore falls back to low for unknown confidence labels', () => {
  const s = normalizeScore({
    thesis_fit: 10, network: 10, lead_capability: 10, location: 5, gravitas: 5,
    lead_capability_confidence: 'pretty sure',
    evidence: {},
  });
  assert.equal(s.lead_capability_confidence, 'low');
});
