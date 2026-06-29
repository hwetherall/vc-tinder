// Shared CSV primitives (RFC-4180). Used by the browser front-end (app.js) and
// the Node discovery script (discover.mjs) so the parse/serialize/escape logic
// lives in exactly one place. No DOM or Node APIs here — keep it portable.

export function parseCSV(text) {
  // Normalize line endings so the state machine only deals with "\n".
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const n = text.length;
  for (let i = 0; i < n; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }   // escaped quote
        else { inQuotes = false; }
      } else {
        field += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else field += c;
    }
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  // Drop fully-empty rows (stray blank lines).
  return rows.filter((r) => r.some((v) => v !== ''));
}

export function escapeField(v) {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function serializeCSV(rows) {
  return rows.map((r) => r.map(escapeField).join(',')).join('\r\n') + '\r\n';
}
