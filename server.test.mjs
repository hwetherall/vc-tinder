import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.VC_TINDER_NO_LISTEN = '1';
const { cleanFirmPatch } = await import('./server.mjs');

test('cleanFirmPatch accepts only validated editable fields', () => {
  assert.deepEqual(cleanFirmPatch({
    proximity: 'Hot',
    current_tier: 2,
    watched: true,
    name: 'Ignored',
  }), {
    clean: { proximity: 'Hot', current_tier: 2, watched: true },
  });
});

test('cleanFirmPatch allows clearing current_tier', () => {
  assert.deepEqual(cleanFirmPatch({ current_tier: null }), {
    clean: { current_tier: null },
  });
});

test('cleanFirmPatch rejects empty or invalid patches', () => {
  assert.match(cleanFirmPatch({ name: 'Ignored' }).error, /Nothing to update/);
  assert.match(cleanFirmPatch(null).error, /JSON object/);
  assert.match(cleanFirmPatch([]).error, /JSON object/);
  assert.match(cleanFirmPatch({ proximity: 'Lukewarm' }).error, /Invalid proximity/);
  assert.match(cleanFirmPatch({ current_tier: 9 }).error, /Invalid current_tier/);
  assert.match(cleanFirmPatch({ current_tier: '2' }).error, /Invalid current_tier/);
  assert.match(cleanFirmPatch({ watched: 'true' }).error, /Invalid watched/);
});
