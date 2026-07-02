import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weekStartIso, toNewsItem, itemsBlock } from './monitor.mjs';

test('weekStartIso returns the Monday of the containing week', () => {
  assert.equal(weekStartIso(new Date('2026-07-02T10:00:00Z')), '2026-06-29'); // Thu -> Mon
  assert.equal(weekStartIso(new Date('2026-06-29T00:00:00Z')), '2026-06-29'); // Mon -> itself
  assert.equal(weekStartIso(new Date('2026-07-05T23:00:00Z')), '2026-06-29'); // Sun -> prior Mon
});

test('toNewsItem normalizes Exa and NinjaPear shapes', () => {
  const exa = toNewsItem('f1', { url: 'https://x.co/a', title: 'T', publishedDate: '2026-06-30T12:00:00.000Z', text: 'body' }, 'exa');
  assert.equal(exa.published_on, '2026-06-30');
  assert.equal(exa.snippet, 'body');
  assert.equal(exa.source, 'exa');

  const np = toNewsItem('f1', { url: 'https://x.co/b', title: 'U', timestamp: '2026-07-01T09:00:00+00:00', description: 'desc' }, 'ninjapear-blog');
  assert.equal(np.published_on, '2026-07-01');
  assert.equal(np.snippet, 'desc');

  const undated = toNewsItem('f1', { url: 'https://x.co/c', title: 'V' }, 'exa');
  assert.equal(undated.published_on, null);
});

test('itemsBlock numbers items and carries source + date', () => {
  const block = itemsBlock([
    { source: 'exa', published_on: '2026-06-30', title: 'Big round', url: 'https://n.ws/1', snippet: 's1' },
    { source: 'ninjapear-x', published_on: null, title: 'Tweet', url: 'https://x.com/2', snippet: 's2' },
  ]);
  assert.ok(block.includes('[1] (exa, 2026-06-30) Big round'));
  assert.ok(block.includes('[2] (ninjapear-x, undated) Tweet'));
});
