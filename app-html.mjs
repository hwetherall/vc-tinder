export function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function safeHttpUrl(url) {
  try {
    const parsed = new URL(String(url || ''));
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
  } catch {
    return '';
  }
}

export function httpLink(url, label = url) {
  const safe = safeHttpUrl(url);
  if (!safe) return esc(label || url || '');
  return `<a href="${esc(safe)}" target="_blank" rel="noopener noreferrer">${esc(label || url)}</a>`;
}

export function mailtoLink(email) {
  const value = String(email || '').trim();
  if (!/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(value)) return esc(value);
  return `<a href="mailto:${esc(value)}">${esc(value)}</a>`;
}

// Escape text, then linkify only http(s) URLs. Never produces an anchor for
// javascript:/data: schemes because they do not match the http(s) pattern.
export function linkifyEsc(text) {
  const raw = String(text || '');
  let html = '';
  let last = 0;
  for (const match of raw.matchAll(/https?:\/\/[^\s<>"]+/g)) {
    const url = match[0];
    html += esc(raw.slice(last, match.index)) + httpLink(url, url);
    last = match.index + url.length;
  }
  return html + esc(raw.slice(last));
}

// Tiny markdown renderer for digest content: escape first, then transform.
export function mdToHtml(md) {
  const lines = esc(md).split('\n');
  let html = '';
  let inList = false;
  for (const line of lines) {
    let l = line
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, label, url) => {
        const safe = safeHttpUrl(url.replace(/&amp;/g, '&'));
        return safe
          ? `<a href="${esc(safe)}" target="_blank" rel="noopener noreferrer">${label}</a>`
          : label;
      });
    if (/^\s*[-*] /.test(l)) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${l.replace(/^\s*[-*] /, '')}</li>`;
      continue;
    }
    if (inList) { html += '</ul>'; inList = false; }
    if (/^### /.test(l)) html += `<h3>${l.slice(4)}</h3>`;
    else if (/^## /.test(l)) html += `<h2>${l.slice(3)}</h2>`;
    else if (/^---+$/.test(l.trim())) html += '<hr/>';
    else if (l.trim()) html += `<p>${l}</p>`;
  }
  if (inList) html += '</ul>';
  return html;
}
