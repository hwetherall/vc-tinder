import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapHeader, parseContactCell, rowsToRecords } from './importer.mjs';

test('mapHeader recognizes aliases case-insensitively and reports ignored columns', () => {
  const { map, ignored } = mapHeader(['VC', 'Contact', 'LinkedIn URL', 'Mutuals', 'Favourite Colour']);
  assert.equal(map.name, 0);
  assert.equal(map.contact, 1);
  assert.equal(map.contact_linkedin, 2);
  assert.equal(map.intro_path, 3);
  assert.deepEqual(ignored, ['Favourite Colour']);
});

test('mapHeader accepts Firm/Fund/Company as the name column', () => {
  for (const h of ['Firm', 'fund', 'COMPANY', 'Firm Name']) {
    assert.equal(mapHeader([h]).map.name, 0, h);
  }
});

test('parseContactCell splits name - title, tolerates plain names', () => {
  assert.deepEqual(parseContactCell('Sri Pangulur - Partner (Mayfield Fund)'),
    { name: 'Sri Pangulur', title: 'Partner (Mayfield Fund)' });
  assert.deepEqual(parseContactCell('Jane Doe'), { name: 'Jane Doe', title: null });
  assert.equal(parseContactCell(''), null);
});

test('rowsToRecords groups multiple people at one firm; first contact is primary', () => {
  const rows = [
    ['VC', 'Contact', 'Title', 'LinkedIn', 'Location'],
    ['Accel', 'Matt Weigand', 'Partner', 'https://linkedin.com/in/mw', 'SF'],
    ['Accel', 'Jane Roe', 'Principal', '', ''],
    ['Craft Ventures', 'David Sacks', '', '', 'SF'],
    ['', 'Orphan Person', '', '', ''],
  ];
  const { firms, skipped } = rowsToRecords(rows, { source: 'test' });
  assert.equal(firms.size, 2);
  assert.equal(skipped, 1);
  const accel = firms.get('accel');
  assert.equal(accel.contacts.length, 2);
  assert.equal(accel.contacts[0].is_primary, true);
  assert.equal(accel.contacts[1].is_primary, false);
  assert.equal(accel.contacts[0].linkedin_url, 'https://linkedin.com/in/mw');
  assert.equal(accel.firm.fit, null);          // unscored -> score.mjs territory
  assert.equal(accel.firm.source, 'test');
});

test('rowsToRecords throws a clear error when no name column exists', () => {
  assert.throws(() => rowsToRecords([['Person', 'Email'], ['a', 'b']]), /no firm-name column/);
});

test('rowsToRecords carries scores through when the CSV has them', () => {
  const rows = [
    ['VC', 'Tier', 'Fit', 'Thesis Fit'],
    ['a16z', '1 - Open now', '97', '24'],
  ];
  const { firms } = rowsToRecords(rows);
  const f = firms.get('andreessen horowitz').firm; // alias map kicks in
  assert.equal(f.fit, 97);
  assert.equal(f.thesis_fit, 24);
  assert.equal(f.tier_label, '1 - Open now');
});
