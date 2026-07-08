import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esc, httpLink, linkifyEsc, mailtoLink, mdToHtml, safeHttpUrl } from './app-html.mjs';

test('esc escapes HTML-sensitive characters', () => {
  assert.equal(esc('<a href="x&y">'), '&lt;a href=&quot;x&amp;y&quot;&gt;');
});

test('safeHttpUrl allows only http and https URLs', () => {
  assert.equal(safeHttpUrl('https://example.com/a?b=1'), 'https://example.com/a?b=1');
  assert.equal(safeHttpUrl('http://example.com/'), 'http://example.com/');
  assert.equal(safeHttpUrl('javascript:alert(1)'), '');
  assert.equal(safeHttpUrl('not a url'), '');
});

test('httpLink renders safe URLs and escapes labels', () => {
  assert.equal(
    httpLink('https://example.com/?a=1&b=2', '<Site>'),
    '<a href="https://example.com/?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">&lt;Site&gt;</a>'
  );
  assert.equal(httpLink('javascript:alert(1)', '<Bad>'), '&lt;Bad&gt;');
});

test('mailtoLink validates and escapes email addresses', () => {
  assert.equal(mailtoLink('person@example.com'), '<a href="mailto:person@example.com">person@example.com</a>');
  assert.equal(mailtoLink('bad"@example.com'), 'bad&quot;@example.com');
});

test('linkifyEsc escapes surrounding text and links only http URLs', () => {
  const html = linkifyEsc('<b>see</b> https://example.com/?a=1&b=2 javascript:alert(1)');
  assert.match(html, /&lt;b&gt;see&lt;\/b&gt;/);
  assert.match(html, /href="https:\/\/example.com\/\?a=1&amp;b=2"/);
  assert.match(html, /javascript:alert\(1\)$/);
});

test('mdToHtml escapes markdown content while preserving safe links', () => {
  const html = mdToHtml('## <Title>\n- **Deal** [site](https://example.com/?a=1&b=2)\n- [bad](javascript:alert(1))');
  assert.match(html, /<h2>&lt;Title&gt;<\/h2>/);
  assert.match(html, /<b>Deal<\/b>/);
  assert.match(html, /href="https:\/\/example.com\/\?a=1&amp;b=2"/);
  assert.doesNotMatch(html, /href="javascript:/);
});
