import { test } from 'node:test';
import assert from 'node:assert/strict';
import { htmlToText, monthToIso, coInvestorsCell } from './signal-ingest.mjs';

test('htmlToText strips scripts/styles/tags and decodes entities', () => {
  const html = '<html><head><style>.x{}</style><script>var a=1;</script></head>' +
    '<body><h1>Matt&nbsp;Weigand&#39;s Profile</h1><p>Partner &amp; friend</p></body></html>';
  const text = htmlToText(html);
  assert.equal(text, "Matt Weigand's Profile Partner & friend");
  assert.ok(!text.includes('var a'));
});

test('monthToIso parses Signal month-year dates', () => {
  assert.equal(monthToIso('Dec 2024'), '2024-12-01');
  assert.equal(monthToIso('Apr 2022'), '2022-04-01');
  assert.equal(monthToIso('March 2022'), '2022-03-01'); // full month names too
  assert.equal(monthToIso('2022'), null);
  assert.equal(monthToIso(null), null);
});

test('coInvestorsCell joins names with firms, tolerating gaps', () => {
  assert.equal(
    coInvestorsCell([{ name: 'A B', firm: 'X Cap' }, { name: 'C D', firm: null }]),
    'A B (X Cap), C D'
  );
  assert.equal(coInvestorsCell([]), '');
  assert.equal(coInvestorsCell(null), '');
});
