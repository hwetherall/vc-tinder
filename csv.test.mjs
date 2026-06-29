import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV, serializeCSV, escapeField } from './csv.mjs';

test('escapeField quotes commas, quotes, and newlines', () => {
  assert.equal(escapeField('plain'), 'plain');
  assert.equal(escapeField('a,b'), '"a,b"');
  assert.equal(escapeField('he said "hi"'), '"he said ""hi"""');
  assert.equal(escapeField('line1\nline2'), '"line1\nline2"');
});

test('parse/serialize round-trips fields with commas, quotes, newlines', () => {
  const rows = [
    ['VC', 'Status'],
    ['Acme, Inc', 'note with "quotes" and, comma'],
    ['Beta', 'multi\nline\nevidence'],
  ];
  const back = parseCSV(serializeCSV(rows));
  assert.deepEqual(back, rows);
});

test('parseCSV handles quoted field with embedded comma (matches source CSV shape)', () => {
  const csv = 'VC,Location\nAccel,"Palo Alto, CA"\n';
  assert.deepEqual(parseCSV(csv), [['VC', 'Location'], ['Accel', 'Palo Alto, CA']]);
});

test('parseCSV drops fully-empty rows', () => {
  assert.deepEqual(parseCSV('a,b\n\n\nc,d\n'), [['a', 'b'], ['c', 'd']]);
});
