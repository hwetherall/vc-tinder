// VC Directory — front-end logic. No dependencies.
// CSV primitives (parseCSV/serializeCSV) are shared with the Node discovery
// script via csv.mjs, so the RFC-4180 logic lives in exactly one place.
// This file is loaded as a module (<script type="module"> in index.html).
import { parseCSV, serializeCSV } from './csv.mjs';
import { startTier, effectiveTier } from './tiers.mjs';
import { esc, httpLink, linkifyEsc, mailtoLink, mdToHtml } from './app-html.mjs';

const TIER_LABELS = {
  1: 'Open now',
  2: 'Cultivate',
  3: 'Follow',
  4: 'Referral',
  5: 'Pass',
};

// Set from /api/version. The deployed (Vercel) site is a read-only viewer:
// only the VCs and Digest tabs, no upload/scoring/export/editing.
let READONLY = false;

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

// state.cards mirror the CSV bridge (/api/csv). They exist only so the
// "Export CSV" action can round-trip the full scored sheet back to the repo.
const state = {
  headers: [],
  col: {},          // normalized header name -> index
  cards: [],        // { idx, values:[] }
  filename: '',
};

function colIndex(name) {
  return state.col[name.toLowerCase().trim()];
}
function val(card, name) {
  const i = colIndex(name);
  return i == null ? '' : (card.values[i] || '');
}

/* ------------------------------------------------------------------ */
/* DOM refs                                                            */
/* ------------------------------------------------------------------ */

const $ = (id) => document.getElementById(id);

const VIEWS = ['dirView', 'dossierView', 'digestView', 'uploadView'];
// Which nav button lights up for each view (dossier stays under "VCs").
const NAV_FOR_VIEW = {
  dirView: 'toDirectory', dossierView: 'toDirectory',
  digestView: 'toDigest', uploadView: 'toUpload',
};
function showView(id) {
  for (const v of VIEWS) $(v).hidden = v !== id;
  const active = NAV_FOR_VIEW[id];
  ['toDirectory', 'toDigest', 'toUpload'].forEach((b) => $(b).classList.toggle('active', b === active));
}

let toastTimer = null;
function toast(msg, kind = '') {
  const el = $('toast');
  el.textContent = msg;
  el.className = 'toast' + (kind ? ' ' + kind : '');
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 4000);
}

// PATCH an editable firm field (proximity / current_tier / watched).
async function patchFirm(id, patch) {
  const res = await fetch(`/api/firm?id=${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

/* ------------------------------------------------------------------ */
/* Init                                                                */
/* ------------------------------------------------------------------ */

async function init() {
  wireEvents();
  // Learn the server mode before rendering so read-only chrome is applied
  // without a flash of the operator-only tools.
  try {
    const v = await (await fetch('/api/version')).json();
    READONLY = !!v.readonly;
    $('ver').textContent = v.version || '';
  } catch { $('ver').textContent = 'server outdated!'; }
  if (READONLY) applyReadonlyUi();
  goDirectory();
  // The CSV bridge backs "Export CSV" only; skip it on the read-only site.
  if (!READONLY) {
    try {
      const res = await fetch('/api/csv');
      const data = await res.json();
      if (!data.error) { state.filename = data.filename; loadCsv(data.csv); }
    } catch { /* export just won't have data until reload */ }
  }
}

// Hide operator-only chrome: the Upload tab and the Export/Reset actions.
function applyReadonlyUi() {
  ['toUpload', 'exportBtn', 'resetBtn'].forEach((id) => {
    const el = $(id);
    if (el) el.hidden = true;
  });
}

function loadCsv(text) {
  const rows = parseCSV(text);
  state.headers = rows[0];
  state.col = {};
  state.headers.forEach((h, i) => { state.col[h.toLowerCase().trim()] = i; });
  state.cards = rows.slice(1).map((values, idx) => ({ idx, values }));
}

/* ------------------------------------------------------------------ */
/* Proximity control (shared by table and dossier)                     */
/* ------------------------------------------------------------------ */

const PROX_LEVELS = ['Hot', 'Warm', 'Cold'];
function proxLevel(raw) {
  const p = (raw || '').toLowerCase();
  return PROX_LEVELS.find((l) => p.startsWith(l.toLowerCase())) || '';
}

function proximityMarkup(firmId, current) {
  if (!firmId) return '';
  const active = proxLevel(current);
  if (READONLY) {
    if (!active && !current) return '';
    const pill = active
      ? `<span class="px px-${active.toLowerCase()}">${active}</span>`
      : esc(current);
    return `<div class="prox-row" title="Proximity — who knows them?">${pill}</div>`;
  }
  const btns = PROX_LEVELS.map((l) =>
    `<button class="prox-btn prox-${l.toLowerCase()} ${l === active ? 'on' : ''}"
             data-firm="${esc(firmId)}" data-prox="${l}">${l}</button>`
  ).join('');
  const note = current && !PROX_LEVELS.includes(current)
    ? `<span class="prox-note" title="${esc(current)}">${esc(current)}</span>` : '';
  return `<div class="prox-row" title="Proximity — who knows them?">${btns}${note}</div>`;
}

// One delegated listener: proximity buttons work in every view they render in.
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.prox-btn');
  if (!btn) return;
  const { firm, prox } = btn.dataset;
  try {
    await patchFirm(firm, { proximity: prox });
    btn.parentElement.querySelectorAll('.prox-btn').forEach((b) => b.classList.toggle('on', b === btn));
    const note = btn.parentElement.querySelector('.prox-note');
    if (note) note.remove();
    // keep the export CSV's in-memory copy in sync
    const card = state.cards.find((c) => val(c, 'Firm ID') === firm);
    if (card) card.values[colIndex('Proximity')] = prox;
    if (dir.firms) {
      const f = dir.firms.find((x) => x.id === firm);
      if (f) { f.proximity = prox; if (!$('dirView').hidden) renderDirectory(); }
    }
  } catch (err) {
    alert('Could not save proximity: ' + err.message);
  }
});

/* ------------------------------------------------------------------ */
/* Directory view (the big searchable table)                           */
/* ------------------------------------------------------------------ */

const dir = { firms: null, q: '', tier: 0, prox: '', watched: false, sortKey: 'fit', sortDir: 'desc' };

const PROX_RANK = { hot: 3, warm: 2, cold: 1 };

// Value extracted from a firm for a given sort column.
const SORT_VALUE = {
  tier: (f) => effectiveTier(f),
  name: (f) => (f.name || '').toLowerCase(),
  fit: (f) => (f.fit == null ? -1 : f.fit),
  stage: (f) => (f.stage_focus || '').toLowerCase(),
  location: (f) => (f.location || '').toLowerCase(),
  prox: (f) => PROX_RANK[proxLevel(f.proximity).toLowerCase()] || 0,
  deals: (f) => (f.deals || []).length,
  contact: (f) => (primaryContact(f)?.name || '').toLowerCase(),
};

const COLUMNS = [
  { key: 'tier', label: 'Tier' },
  { key: 'name', label: 'Firm' },
  { key: 'fit', label: 'Fit', num: true },
  { key: 'stage', label: 'Stage' },
  { key: 'location', label: 'Location' },
  { key: 'prox', label: 'Proximity' },
  { key: 'deals', label: 'Deals', num: true },
  { key: 'contact', label: 'Contact' },
];

function primaryContact(f) {
  return (f.contacts || []).find((c) => c.email) || (f.contacts || [])[0] || null;
}

async function goDirectory() {
  showView('dirView');
  if (!dir.firms) {
    $('dirTable').innerHTML = '<div class="dim pad">Loading…</div>';
    try {
      const res = await fetch('/api/firms');
      const data = await res.json();
      if (data.error) { $('dirTable').innerHTML = `<div class="dim pad">${esc(data.error)}</div>`; return; }
      dir.firms = data.firms;
    } catch (err) {
      $('dirTable').innerHTML = `<div class="dim pad">Could not load VCs.<br><small>${esc(String(err))}</small></div>`;
      return;
    }
  }
  renderDirectory();
}

function dirFiltered() {
  const q = dir.q.toLowerCase();
  let firms = (dir.firms || []).filter((f) => {
    if (dir.tier && effectiveTier(f) !== dir.tier) return false;
    if (dir.prox && proxLevel(f.proximity) !== dir.prox) return false;
    if (dir.watched && !f.watched) return false;
    if (!q) return true;
    const blob = `${f.name} ${f.location || ''} ${(f.thesis_tags || []).join(' ')} ${f.stage_focus || ''}`.toLowerCase();
    return blob.includes(q);
  });
  const get = SORT_VALUE[dir.sortKey] || SORT_VALUE.fit;
  const sign = dir.sortDir === 'asc' ? 1 : -1;
  firms = firms.slice().sort((a, b) => {
    const va = get(a), vb = get(b);
    if (va < vb) return -1 * sign;
    if (va > vb) return 1 * sign;
    return (a.name || '').localeCompare(b.name || '');
  });
  return firms;
}

function renderDirectory() {
  const firms = dirFiltered();
  $('dirCount').textContent = `${firms.length} of ${dir.firms.length}`;

  const head = COLUMNS.map((c) => {
    const active = dir.sortKey === c.key;
    const arrow = active ? (dir.sortDir === 'asc' ? ' ▲' : ' ▼') : '';
    return `<th class="${c.num ? 'num ' : ''}sortable${active ? ' active' : ''}" data-sort="${c.key}">${c.label}${arrow}</th>`;
  }).join('');

  const rows = firms.map((f) => {
    const t = effectiveTier(f);
    const contact = primaryContact(f);
    const tags = (f.thesis_tags || []).slice(0, 3).map((tg) => `<span class="tag">${esc(tg)}</span>`).join('');
    const px = proxLevel(f.proximity);
    return `<tr data-id="${esc(f.id)}">
      <td><span class="tier-dot tier-${t}" title="Tier ${t} · ${TIER_LABELS[t]}">${t}</span></td>
      <td class="dir-name">
        <div class="name-line">${esc(f.name)}${f.watched ? ' <span title="On the Monitor watchlist">👁</span>' : ''}</div>
        ${tags ? `<div class="tags">${tags}</div>` : ''}
      </td>
      <td class="num">${fitCell(f.fit)}</td>
      <td class="dim">${esc(f.stage_focus || '—')}</td>
      <td class="dim">${esc(f.location || '—')}</td>
      <td>${px ? `<span class="px px-${px.toLowerCase()}">${px}</span>` : (f.proximity ? esc(f.proximity) : '<span class="dim">—</span>')}</td>
      <td class="num dim" title="deals on record">${(f.deals || []).length || '—'}</td>
      <td>${contact ? esc(contact.name) + (contact.email ? ' <span class="dim">✉</span>' : '') : '<span class="dim">—</span>'}</td>
    </tr>`;
  }).join('');

  $('dirTable').innerHTML = `
    <table>
      <thead><tr>${head}</tr></thead>
      <tbody>${rows || `<tr><td colspan="${COLUMNS.length}" class="dim pad">No VCs match your filters.</td></tr>`}</tbody>
    </table>`;

  $('dirTable').querySelectorAll('thead th.sortable').forEach((th) => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (dir.sortKey === key) {
        dir.sortDir = dir.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        dir.sortKey = key;
        // Sensible default direction: text ascending, numbers/tiers descending.
        dir.sortDir = (key === 'name' || key === 'stage' || key === 'location' || key === 'contact') ? 'asc' : 'desc';
      }
      renderDirectory();
    });
  });
  $('dirTable').querySelectorAll('tbody tr[data-id]').forEach((tr) => {
    tr.addEventListener('click', () => openDossier(tr.dataset.id));
  });
}

function fitCell(fit) {
  if (fit == null) return '<span class="dim">—</span>';
  const pct = Math.max(0, Math.min(100, Number(fit)));
  return `<span class="fit"><span class="fit-bar"><span style="width:${pct}%"></span></span><b>${esc(String(fit))}</b></span>`;
}

/* ------------------------------------------------------------------ */
/* Dossier view (single firm deep dive)                                */
/* ------------------------------------------------------------------ */

async function openDossier(id) {
  showView('dossierView');
  $('dossier').innerHTML = '<div class="dim">Loading…</div>';
  const res = await fetch(`/api/firm?id=${encodeURIComponent(id)}`);
  const data = await res.json();
  if (data.error) { $('dossier').innerHTML = `<div class="dim">${esc(data.error)}</div>`; return; }
  renderDossier(data.firm);
}

function renderDossier(f) {
  const t = effectiveTier(f);
  const scores = f.fit == null ? '' : `
    <div class="d-scores">
      <div class="d-fit">Fit <b>${esc(String(f.fit))}</b>/100${f.score_confidence ? ` <span class="dim">· ${esc(f.score_confidence)} confidence</span>` : ''}</div>
      ${[['Thesis', f.thesis_fit, 25], ['Network', f.network, 25], ['Lead', f.lead_capability, 25], ['Location', f.location_score, 15], ['Gravitas', f.gravitas_score, 10]]
        .filter(([, v]) => v != null)
        .map(([l, v, m]) => `<span class="d-pip"><b>${v}</b>/${m} ${l}</span>`).join('')}
    </div>`;

  const facts = [
    ['Fund size', f.fund_size], ['Founded', f.founded_year], ['Stage', f.stage_focus],
    ['Tags', (f.thesis_tags || []).join(', ') || null], ['Source', f.source],
  ].filter(([, v]) => v).map(([l, v]) => `<div class="d-fact"><span class="dim">${l}</span> ${esc(String(v))}</div>`).join('');

  const deals = (f.deals || [])
    .slice()
    .sort((a, b) => String(b.announced_on || '').localeCompare(String(a.announced_on || '')))
    .map((d) => {
      const hover = [
        d.via_contact ? `via ${d.via_contact}` : '',
        d.co_investors ? `Co-investors: ${d.co_investors}` : '',
      ].filter(Boolean).join(' · ');
      return `<tr${hover ? ` title="${esc(hover)}"` : ''}>
      <td>${esc(d.company)}${d.co_investors ? ' <span class="dim">👥</span>' : ''}</td>
      <td>${esc(d.round || '')}</td><td>${esc(d.amount || '')}</td>
      <td>${esc(d.role || '')}</td><td class="dim">${esc(d.announced_on || '')}</td>
      <td>${d.source_url ? httpLink(d.source_url, '↗') : `<span class="dim">${esc(d.source || '')}</span>`}</td>
    </tr>`;
    }).join('');

  const contacts = (f.contacts || []).map((c) => {
    const links = [
      c.linkedin_url ? httpLink(c.linkedin_url, 'LinkedIn') : '',
      c.signal_url ? httpLink(c.signal_url, 'Signal') : '',
    ].filter(Boolean).join(' · ');
    return `<tr>
    <td>${esc(c.name)}${c.is_primary ? ' ★' : ''}</td>
    <td>${esc(c.title || '')}${c.notes ? `<div class="dim c-notes">${esc(c.notes)}</div>` : ''}</td>
    <td>${c.email ? mailtoLink(c.email) : '—'}</td>
    <td>${links}</td>
  </tr>`;
  }).join('');

  const news = (f.news_items || [])
    .slice()
    .sort((a, b) => String(b.published_on || '').localeCompare(String(a.published_on || '')))
    .slice(0, 20)
    .map((n) => `<li>${httpLink(n.url, n.title || n.url)}
      <span class="dim">${esc(n.published_on || '')} · ${esc(n.source || '')}</span></li>`).join('');

  $('dossier').innerHTML = `
    <div class="d-head">
      <button class="btn small" id="backToDir">‹ All VCs</button>
      <h2>${esc(f.name)}</h2>
      <span class="tier-dot tier-${t}" title="Tier ${t} · ${TIER_LABELS[t]}">${t}</span>
      ${READONLY
        ? (f.watched ? '<span class="watch on" title="On the Monitor watchlist">👁 watched</span>' : '')
        : `<label class="watch ${f.watched ? 'on' : ''}" title="Monitor watchlist">
        <input type="checkbox" id="watchToggle" ${f.watched ? 'checked' : ''}/> 👁 watch
      </label>`}
    </div>
    <div class="d-meta dim">
      ${f.website ? `${httpLink(f.website, f.website)} · ` : ''}
      ${esc(f.location || '')} ${f.tier_label ? `· ${esc(f.tier_label)}` : ''}
    </div>
    ${proximityMarkup(f.id, f.proximity)}
    ${scores}
    ${facts ? `<div class="d-facts">${facts}</div>` : ''}
    ${f.fund_summary ? `<p class="d-summary">${esc(f.fund_summary)}</p>` : ''}
    ${f.status ? `<p class="dim d-status">${esc(f.status)}</p>` : ''}
    ${f.intro_path ? `<p class="dim d-status">Intro: ${esc(f.intro_path)}</p>` : ''}
    <h3>Contacts</h3>
    ${contacts ? `<table class="d-table"><thead><tr><th>Name</th><th>Title</th><th>Email</th><th></th></tr></thead><tbody>${contacts}</tbody></table>` : '<p class="dim">None yet.</p>'}
    <h3>Recent deals</h3>
    ${deals ? `<table class="d-table"><thead><tr><th>Company</th><th>Round</th><th>Amount</th><th>Role</th><th>Date</th><th></th></tr></thead><tbody>${deals}</tbody></table>` : '<p class="dim">None on record — run enrich.</p>'}
    ${news ? `<h3>News</h3><ul class="d-news">${news}</ul>` : ''}
    ${f.evidence ? `<details class="d-evidence"><summary>Scoring evidence</summary><div>${linkifyEsc(f.evidence)}</div></details>` : ''}
  `;
  $('backToDir').addEventListener('click', goDirectory);
  const watchToggle = $('watchToggle');
  if (watchToggle) watchToggle.addEventListener('change', async (e) => {
    try {
      await patchFirm(f.id, { watched: e.target.checked });
      e.target.closest('.watch').classList.toggle('on', e.target.checked);
      if (dir.firms) {
        const df = dir.firms.find((x) => x.id === f.id);
        if (df) df.watched = e.target.checked;
      }
    } catch (err) { alert('Could not save: ' + err.message); }
  });
}

/* ------------------------------------------------------------------ */
/* Digest view                                                         */
/* ------------------------------------------------------------------ */

async function goDigest() {
  showView('digestView');
  $('digests').innerHTML = '<div class="dim">Loading…</div>';
  const res = await fetch('/api/digests');
  const data = await res.json();
  if (data.error) { $('digests').innerHTML = `<div class="dim">${esc(data.error)}</div>`; return; }
  if (!data.digests.length) {
    $('digests').innerHTML = '<div class="dim">No digests yet — run <code>node monitor.mjs</code>.</div>';
    return;
  }
  $('digests').innerHTML = data.digests
    .map((d) => `<article class="digest">${mdToHtml(d.content_md)}
      <div class="dim digest-date">generated ${esc((d.created_at || '').slice(0, 16).replace('T', ' '))}</div>
    </article>`)
    .join('<hr/>');
}

/* ------------------------------------------------------------------ */
/* Upload view                                                         */
/* ------------------------------------------------------------------ */

let statusTimer = null;

function goUpload() {
  showView('uploadView');
  refreshScoreStatus();
}

async function doUpload() {
  const input = $('uploadFile');
  const out = $('uploadResult');
  if (!input.files || !input.files[0]) { out.textContent = 'Pick a CSV file first.'; return; }
  out.textContent = 'Importing…';
  try {
    const csv = await input.files[0].text();
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv }),
    });
    const r = await res.json();
    if (r.error) throw new Error(r.error);
    out.innerHTML =
      `✓ Imported <b>${r.firmsImported}</b> new firms (${r.firmsDuplicate} already present), ` +
      `<b>${r.contactsImported}</b> contacts.` +
      (r.rowsSkipped ? ` ${r.rowsSkipped} rows had no firm name.` : '') +
      (r.ignoredColumns.length ? `<br><span class="dim">Ignored columns: ${esc(r.ignoredColumns.join(', '))}</span>` : '') +
      `<br>Database: ${r.totalFirms} firms, <b>${r.unscored}</b> unscored.`;
    dir.firms = null; // directory cache is stale now
    refreshScoreStatus();
  } catch (err) {
    out.textContent = '✗ ' + err.message;
  }
}

async function refreshScoreStatus() {
  const res = await fetch('/api/score-status');
  const s = await res.json();
  $('scoreBtn').hidden = !(s.unscored > 0 && !s.running);
  $('scoreBtn').textContent = `▶ Score ${s.unscored} unscored firms`;
  const box = $('scoreStatus');
  if (s.running || s.tail) {
    box.hidden = false;
    box.textContent = `${s.running ? '⏳ scoring running' : 'scorer idle'} — ${s.total - s.unscored}/${s.total} scored\n${s.tail || ''}`;
  } else {
    box.hidden = true;
  }
  clearTimeout(statusTimer);
  if (s.running && !$('uploadView').hidden) {
    statusTimer = setTimeout(refreshScoreStatus, 5000);
  }
}

async function startScoring() {
  await fetch('/api/score', { method: 'POST' });
  refreshScoreStatus();
}

/* ------------------------------------------------------------------ */
/* Export / Reset                                                      */
/* ------------------------------------------------------------------ */

async function exportCsv() {
  if (!state.cards.length) { toast('Nothing to export yet — try reloading.', 'err'); return; }
  const headers = state.headers.concat(['New Tier']);
  const rows = [headers];
  state.cards.forEach((c) => {
    const t = effectiveTier({ tier_label: val(c, 'Tier'), current_tier: null });
    rows.push(c.values.concat([String(t)]));
  });
  const csv = serializeCSV(rows);

  toast('Saving…');
  try {
    const res = await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    toast(`✓ Saved → ${data.path}`, 'ok');
  } catch (err) {
    toast(`✗ ${err}`, 'err');
  }
}

// Start over: clear saved tier changes and delete the exported CSV.
async function resetAll() {
  if (!confirm('Start over?\n\nThis clears all saved tier changes and deletes the exported scored CSV from the folder.')) return;
  try { await fetch('/api/save', { method: 'DELETE' }); } catch { /* ignore */ }
  try {
    const res = await fetch('/api/csv');
    const data = await res.json();
    if (!data.error) { state.filename = data.filename; loadCsv(data.csv); }
  } catch { /* ignore */ }
  dir.firms = null;
  toast('✓ Reset complete', 'ok');
  goDirectory();
}

/* ------------------------------------------------------------------ */
/* Events                                                              */
/* ------------------------------------------------------------------ */

function wireEvents() {
  $('toDirectory').addEventListener('click', goDirectory);
  $('toDigest').addEventListener('click', goDigest);
  $('toUpload').addEventListener('click', goUpload);
  $('uploadBtn').addEventListener('click', doUpload);
  $('scoreBtn').addEventListener('click', startScoring);
  $('exportBtn').addEventListener('click', exportCsv);
  $('resetBtn').addEventListener('click', resetAll);
  $('dirSearch').addEventListener('input', (e) => { dir.q = e.target.value; if (dir.firms) renderDirectory(); });
  $('dirTier').addEventListener('change', (e) => { dir.tier = Number(e.target.value); if (dir.firms) renderDirectory(); });
  $('dirProx').addEventListener('change', (e) => { dir.prox = e.target.value; if (dir.firms) renderDirectory(); });
  $('dirWatched').addEventListener('change', (e) => { dir.watched = e.target.checked; if (dir.firms) renderDirectory(); });
}

document.addEventListener('DOMContentLoaded', init);
