// VC Tinder — front-end logic. No dependencies.
// CSV primitives (parseCSV/serializeCSV) are shared with the Node discovery
// script via csv.mjs, so the RFC-4180 logic lives in exactly one place.
// This file is loaded as a module (<script type="module"> in index.html).
import { parseCSV, serializeCSV } from './csv.mjs';
import { startTier, effectiveTier } from './tiers.mjs';

const TIER_LABELS = {
  1: 'Open now',
  2: 'Cultivate',
  3: 'Follow',
  4: 'Referral',
  5: 'Pass',
};

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

const state = {
  headers: [],
  col: {},          // normalized header name -> index
  cards: [],        // { idx, values:[], startTier, currentTier }
  pos: 0,           // index of card currently shown
  history: [],      // [{ tierBefore }]
  filename: '',
  animating: false,
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
const deckEl = () => $('deck');

const VIEWS = ['swipeView', 'boardView', 'dirView', 'dossierView', 'digestView'];
function showView(id) {
  for (const v of VIEWS) $(v).hidden = v !== id;
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
  try {
    const res = await fetch('/api/csv');
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    state.filename = data.filename;
    loadCsv(data.csv);
  } catch (err) {
    deckEl().innerHTML = `<div class="empty">Could not load CSV.<br><small>${err}</small></div>`;
    return;
  }
  wireEvents();
  renderSwipe();
}

function loadCsv(text) {
  const rows = parseCSV(text);
  state.headers = rows[0];
  state.col = {};
  state.headers.forEach((h, i) => { state.col[h.toLowerCase().trim()] = i; });
  state.cards = rows.slice(1).map((values, idx) => {
    const st = startTier(values[colIndex('Tier')]);
    return { idx, values, startTier: st, currentTier: st };
  });
  state.pos = 0;
  state.history = [];
}

/* ------------------------------------------------------------------ */
/* Swipe view                                                          */
/* ------------------------------------------------------------------ */

function renderSwipe() {
  showView('swipeView');
  renderProgress();
  if (state.pos >= state.cards.length) {
    deckEl().innerHTML =
      `<div class="done">
         <div class="done-check">✓</div>
         <h2>All ${state.cards.length} reviewed</h2>
         <p>Open the board to see your tiers and export.</p>
         <button class="btn primary" onclick="goBoard()">View board ▦</button>
       </div>`;
    return;
  }
  const card = state.cards[state.pos];
  deckEl().innerHTML = cardMarkup(card);
}

function cardMarkup(card) {
  const name = val(card, 'VC') || '(unnamed)';
  const loc = val(card, 'Location').trim();
  const contact = val(card, 'Contact').trim();
  const t = card.currentTier;
  const locLine = loc ? `<div class="meta"><span class="ic">📍</span><span>${esc(loc)}</span></div>` : '';
  const contactLine = contact ? `<div class="meta"><span class="ic">👤</span><span>${esc(contact)}</span></div>` : '';
  return `
    <div class="card tier-${t}" id="activeCard">
      <div class="tier-badge tier-${t}">Tier ${t} · ${TIER_LABELS[t]}</div>
      <div class="card-body">
        <h2 class="fund-name">${esc(name)}</h2>
        <div class="meta-group">
          ${locLine}
          ${contactLine}
        </div>
        ${scoreMarkup(card)}
        ${extraMarkup(card)}
      </div>
      ${proximityMarkup(val(card, 'Firm ID'), val(card, 'Proximity'))}
      ${tierRail(t)}
    </div>`;
}

/* ------------------------------------------------------------------ */
/* Proximity control (shared by swipe card and dossier)                */
/* ------------------------------------------------------------------ */

const PROX_LEVELS = ['Hot', 'Warm', 'Cold'];
function proxLevel(raw) {
  const p = (raw || '').toLowerCase();
  return PROX_LEVELS.find((l) => p.startsWith(l.toLowerCase())) || '';
}

function proximityMarkup(firmId, current) {
  if (!firmId) return '';
  const active = proxLevel(current);
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
    // keep the swipe deck's in-memory copy in sync
    const card = state.cards.find((c) => val(c, 'Firm ID') === firm);
    if (card) card.values[colIndex('Proximity')] = prox;
    if (dir.firms) {
      const f = dir.firms.find((x) => x.id === firm);
      if (f) f.proximity = prox;
    }
  } catch (err) {
    alert('Could not save proximity: ' + err.message);
  }
});

// Rubric scores. Shown for any card that has a Fit value (existing scored rows
// and AI-scored discovered rows alike).
function scoreMarkup(card) {
  const fit = val(card, 'Fit').trim();
  if (!fit) return '';
  const conf = val(card, 'Score Confidence').trim();
  const pips = [
    ['Thesis', val(card, 'Thesis Fit'), 25],
    ['Network', val(card, 'Network'), 25],
    ['Lead', val(card, 'Lead Capability'), 25],
    ['Location', val(card, 'Location Score'), 15],
    ['Gravitas', val(card, 'Gravitas Score'), 10],
  ]
    .filter(([, v]) => String(v).trim() !== '')
    .map(([label, v, max]) =>
      `<span style="font-size:.78rem;opacity:.85;white-space:nowrap"><b>${esc(String(v))}</b>/${max} ${esc(label)}</span>`)
    .join('');
  const confLine = conf ? ` · confidence ${esc(conf)}` : '';
  return `<div style="margin-top:.8rem">
      <div style="font-weight:600;font-size:.9rem">Fit ${esc(fit)}/100${confLine}</div>
      <div style="display:flex;flex-wrap:wrap;gap:.45rem;margin-top:.35rem">${pips}</div>
    </div>`;
}

// Status + evidence (discovered cards). Evidence URLs are rendered as links,
// XSS-safe: only http(s) URLs become anchors, all text is HTML-escaped first.
function extraMarkup(card) {
  const status = val(card, 'Status').trim();
  const evidence = val(card, 'Evidence').trim();
  if (!status && !evidence) return '';
  const statusLine = status
    ? `<div style="font-size:.78rem;opacity:.75;margin-top:.7rem">${esc(status)}</div>`
    : '';
  const ev = evidence
    ? `<details style="margin-top:.4rem;font-size:.78rem;opacity:.9">
         <summary style="cursor:pointer">Evidence</summary>
         <div style="white-space:pre-wrap;margin-top:.3rem">${linkifyEsc(evidence)}</div>
       </details>`
    : '';
  return statusLine + ev;
}

// Escape text, then linkify only http(s) URLs. Never produces an anchor for
// javascript:/data: schemes — they don't match the http(s) pattern.
function linkifyEsc(text) {
  return esc(text).replace(
    /(https?:\/\/[^\s<>"]+)/g,
    (u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`
  );
}

function tierRail(active) {
  let pips = '';
  for (let i = 1; i <= 5; i++) {
    pips += `<span class="pip tier-${i} ${i === active ? 'on' : ''}">${i}</span>`;
  }
  return `<div class="tier-rail" title="Current tier">${pips}</div>`;
}

function renderProgress() {
  const total = state.cards.length;
  const p = Math.min(state.pos + 1, total);
  $('progress').textContent =
    state.pos >= total ? `Done · ${total}/${total}` : `Card ${p} of ${total}`;
}

/* ------------------------------------------------------------------ */
/* Decisions                                                           */
/* ------------------------------------------------------------------ */

const DIR_CLASS = {
  left: 'exit-left',
  right: 'exit-right',
  up: 'exit-up',
  down: 'exit-down',
  jump: 'exit-jump',
};

function decide(kind, value) {
  if (state.animating || state.pos >= state.cards.length) return;
  const card = state.cards[state.pos];
  state.history.push({ tierBefore: card.currentTier });

  let dir = 'up';
  switch (kind) {
    case 'promote': card.currentTier = Math.max(1, card.currentTier - 1); dir = 'right'; break;
    case 'demote':  card.currentTier = Math.min(5, card.currentTier + 1); dir = 'left'; break;
    case 'keep':    dir = 'up'; break;
    case 'reject':  card.currentTier = 5; dir = 'down'; break;
    case 'set':     card.currentTier = value; dir = 'jump'; break;
  }

  const el = $('activeCard');
  if (el) {
    state.animating = true;
    el.classList.add(DIR_CLASS[dir]);
    setTimeout(() => {
      state.animating = false;
      state.pos++;
      renderSwipe();
    }, 280);
  } else {
    state.pos++;
    renderSwipe();
  }
}

function undo() {
  if (state.animating || state.history.length === 0) return;
  const h = state.history.pop();
  state.pos = Math.max(0, state.pos - 1);
  state.cards[state.pos].currentTier = h.tierBefore;
  renderSwipe();
}

/* ------------------------------------------------------------------ */
/* Board view                                                          */
/* ------------------------------------------------------------------ */

function goBoard() {
  showView('boardView');
  $('exportMsg').textContent = '';
  renderBoard();
}

function goSwipe() {
  renderSwipe();
}

function renderBoard() {
  const board = $('board');
  board.innerHTML = '';
  for (let t = 1; t <= 5; t++) {
    const inTier = state.cards.filter((c) => c.currentTier === t);
    const col = document.createElement('div');
    col.className = `column tier-${t}`;
    col.dataset.tier = String(t);
    col.innerHTML =
      `<div class="col-head tier-${t}">
         <span class="col-title">Tier ${t}</span>
         <span class="col-sub">${TIER_LABELS[t]}</span>
         <span class="col-count">${inTier.length}</span>
       </div>`;
    const list = document.createElement('div');
    list.className = 'col-list';
    inTier.forEach((c) => list.appendChild(miniCard(c)));
    col.appendChild(list);

    // Drag & drop target
    col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('drop'); });
    col.addEventListener('dragleave', () => col.classList.remove('drop'));
    col.addEventListener('drop', (e) => {
      e.preventDefault();
      col.classList.remove('drop');
      const idx = Number(e.dataTransfer.getData('text/plain'));
      const card = state.cards.find((c) => c.idx === idx);
      if (card) { card.currentTier = t; renderBoard(); }
    });

    board.appendChild(col);
  }
}

function miniCard(card) {
  const el = document.createElement('div');
  el.className = 'mini tier-' + card.currentTier;
  el.draggable = true;
  const name = val(card, 'VC') || '(unnamed)';
  const loc = val(card, 'Location').trim();
  el.innerHTML =
    `<button class="nudge up" title="Promote">‹</button>
     <div class="mini-body">
       <div class="mini-name">${esc(name)}</div>
       ${loc ? `<div class="mini-loc">${esc(loc)}</div>` : ''}
     </div>
     <button class="nudge down" title="Demote">›</button>`;
  el.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', String(card.idx));
    e.dataTransfer.effectAllowed = 'move';
    el.classList.add('dragging');
  });
  el.addEventListener('dragend', () => el.classList.remove('dragging'));
  el.querySelector('.nudge.up').addEventListener('click', () => {
    card.currentTier = Math.max(1, card.currentTier - 1); renderBoard();
  });
  el.querySelector('.nudge.down').addEventListener('click', () => {
    card.currentTier = Math.min(5, card.currentTier + 1); renderBoard();
  });
  return el;
}

/* ------------------------------------------------------------------ */
/* Directory view                                                      */
/* ------------------------------------------------------------------ */

const dir = { firms: null, q: '', tier: 0 };

async function goDirectory() {
  showView('dirView');
  if (!dir.firms) {
    $('dirTable').innerHTML = '<div class="dim">Loading…</div>';
    const res = await fetch('/api/firms');
    const data = await res.json();
    if (data.error) { $('dirTable').innerHTML = `<div class="dim">${esc(data.error)}</div>`; return; }
    dir.firms = data.firms;
  }
  renderDirectory();
}

function dirFiltered() {
  const q = dir.q.toLowerCase();
  return (dir.firms || []).filter((f) => {
    if (dir.tier && effectiveTier(f) !== dir.tier) return false;
    if (!q) return true;
    const blob = `${f.name} ${f.location || ''} ${(f.thesis_tags || []).join(' ')} ${f.stage_focus || ''}`.toLowerCase();
    return blob.includes(q);
  });
}

function renderDirectory() {
  const firms = dirFiltered();
  $('dirCount').textContent = `${firms.length} of ${dir.firms.length}`;
  const rows = firms.map((f) => {
    const t = effectiveTier(f);
    const contact = (f.contacts || []).find((c) => c.email) || (f.contacts || [])[0];
    return `<tr data-id="${esc(f.id)}">
      <td><span class="tier-dot tier-${t}" title="Tier ${t}">${t}</span></td>
      <td class="dir-name">${esc(f.name)}${f.watched ? ' <span title="On the Monitor watchlist">👁</span>' : ''}</td>
      <td class="num">${f.fit ?? '—'}</td>
      <td>${esc(proxLevel(f.proximity) || f.proximity || '—')}</td>
      <td class="dim">${esc(f.location || '—')}</td>
      <td class="dim">${esc(f.stage_focus || '—')}</td>
      <td class="num" title="deals on record">${(f.deals || []).length || '—'}</td>
      <td>${contact ? esc(contact.name) + (contact.email ? ' ✉️' : '') : '—'}</td>
    </tr>`;
  }).join('');
  $('dirTable').innerHTML = `
    <table>
      <thead><tr>
        <th>T</th><th>Firm</th><th class="num">Fit</th><th>Proximity</th>
        <th>Location</th><th>Stage</th><th class="num">Deals</th><th>Contact</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  $('dirTable').querySelectorAll('tbody tr').forEach((tr) => {
    tr.addEventListener('click', () => openDossier(tr.dataset.id));
  });
}

/* ------------------------------------------------------------------ */
/* Dossier view (single firm)                                          */
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
      <td>${d.source_url ? `<a href="${esc(d.source_url)}" target="_blank" rel="noopener noreferrer">↗</a>` : `<span class="dim">${esc(d.source || '')}</span>`}</td>
    </tr>`;
    }).join('');

  const contacts = (f.contacts || []).map((c) => {
    const links = [
      c.linkedin_url ? `<a href="${esc(c.linkedin_url)}" target="_blank" rel="noopener noreferrer">LinkedIn</a>` : '',
      c.signal_url ? `<a href="${esc(c.signal_url)}" target="_blank" rel="noopener noreferrer">Signal</a>` : '',
    ].filter(Boolean).join(' · ');
    return `<tr>
    <td>${esc(c.name)}${c.is_primary ? ' ★' : ''}</td>
    <td>${esc(c.title || '')}${c.notes ? `<div class="dim c-notes">${esc(c.notes)}</div>` : ''}</td>
    <td>${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : '—'}</td>
    <td>${links}</td>
    <td class="dim">${esc(c.source || '')}</td>
  </tr>`;
  }).join('');

  const news = (f.news_items || [])
    .slice()
    .sort((a, b) => String(b.published_on || '').localeCompare(String(a.published_on || '')))
    .slice(0, 20)
    .map((n) => `<li><a href="${esc(n.url)}" target="_blank" rel="noopener noreferrer">${esc(n.title || n.url)}</a>
      <span class="dim">${esc(n.published_on || '')} · ${esc(n.source || '')}</span></li>`).join('');

  $('dossier').innerHTML = `
    <div class="d-head">
      <button class="btn small" id="backToDir">‹ All VCs</button>
      <h2>${esc(f.name)}</h2>
      <span class="tier-dot tier-${t}">${t}</span>
      <label class="watch ${f.watched ? 'on' : ''}" title="Monitor watchlist">
        <input type="checkbox" id="watchToggle" ${f.watched ? 'checked' : ''}/> 👁 watch
      </label>
    </div>
    <div class="d-meta dim">
      ${f.website ? `<a href="${esc(f.website)}" target="_blank" rel="noopener noreferrer">${esc(f.website)}</a> · ` : ''}
      ${esc(f.location || '')} ${f.tier_label ? `· ${esc(f.tier_label)}` : ''}
    </div>
    ${proximityMarkup(f.id, f.proximity)}
    ${scores}
    ${facts ? `<div class="d-facts">${facts}</div>` : ''}
    ${f.fund_summary ? `<p class="d-summary">${esc(f.fund_summary)}</p>` : ''}
    ${f.status ? `<p class="dim d-status">${esc(f.status)}</p>` : ''}
    ${f.intro_path ? `<p class="dim d-status">Intro: ${esc(f.intro_path)}</p>` : ''}
    <h3>Contacts</h3>
    ${contacts ? `<table class="d-table"><thead><tr><th>Name</th><th>Title</th><th>Email</th><th></th><th></th></tr></thead><tbody>${contacts}</tbody></table>` : '<p class="dim">None yet.</p>'}
    <h3>Recent deals</h3>
    ${deals ? `<table class="d-table"><thead><tr><th>Company</th><th>Round</th><th>Amount</th><th>Role</th><th>Date</th><th></th></tr></thead><tbody>${deals}</tbody></table>` : '<p class="dim">None on record — run enrich.</p>'}
    ${news ? `<h3>News</h3><ul class="d-news">${news}</ul>` : ''}
    ${f.evidence ? `<details class="d-evidence"><summary>Scoring evidence</summary><div>${linkifyEsc(f.evidence)}</div></details>` : ''}
  `;
  $('backToDir').addEventListener('click', goDirectory);
  $('watchToggle').addEventListener('change', async (e) => {
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

// Tiny markdown renderer for digest content: escape first, then transform.
function mdToHtml(md) {
  const lines = esc(md).split('\n');
  let html = '';
  let inList = false;
  for (const line of lines) {
    let l = line
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
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
/* Export                                                              */
/* ------------------------------------------------------------------ */

async function exportCsv() {
  const headers = state.headers.concat(['New Tier']);
  const rows = [headers];
  // Original row order preserved; append the new tier column.
  state.cards.forEach((c) => rows.push(c.values.concat([String(c.currentTier)])));
  const csv = serializeCSV(rows);

  const msg = $('exportMsg');
  msg.textContent = 'Saving…';
  msg.className = 'msg';
  try {
    const res = await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    msg.textContent = `✓ Saved → ${data.path}`;
    msg.className = 'msg ok';
  } catch (err) {
    msg.textContent = `✗ ${err}`;
    msg.className = 'msg err';
  }
}

/* ------------------------------------------------------------------ */
/* Events                                                              */
/* ------------------------------------------------------------------ */

// Start over: clear all tier changes, delete the exported CSV, reload fresh.
async function resetAll() {
  if (!confirm('Start over?\n\nThis clears all your tier changes and deletes the exported scored CSV from the folder.')) return;
  try { await fetch('/api/save', { method: 'DELETE' }); } catch (e) { /* ignore */ }
  try {
    const res = await fetch('/api/csv');
    const data = await res.json();
    if (!data.error) { state.filename = data.filename; loadCsv(data.csv); }
    else throw new Error(data.error);
  } catch (e) {
    // Fallback: reset in-memory state without a reload.
    state.cards.forEach((c) => { c.currentTier = c.startTier; });
    state.pos = 0;
    state.history = [];
  }
  $('exportMsg').textContent = '';
  renderSwipe();
}

function wireEvents() {
  $('toBoard').addEventListener('click', goBoard);
  $('toSwipe').addEventListener('click', goSwipe);
  $('toDirectory').addEventListener('click', goDirectory);
  $('toDigest').addEventListener('click', goDigest);
  $('exportBtn').addEventListener('click', exportCsv);
  $('resetBtn').addEventListener('click', resetAll);
  $('dirSearch').addEventListener('input', (e) => { dir.q = e.target.value; if (dir.firms) renderDirectory(); });
  $('dirTier').addEventListener('change', (e) => { dir.tier = Number(e.target.value); if (dir.firms) renderDirectory(); });

  document.addEventListener('keydown', (e) => {
    if ($('swipeView').hidden) return;      // swipe keys only in swipe view
    if (e.target.closest('input, select')) return; // never hijack typing
    switch (e.key) {
      case 'ArrowRight': e.preventDefault(); decide('promote'); break;
      case 'ArrowLeft':  e.preventDefault(); decide('demote'); break;
      case 'ArrowUp':    e.preventDefault(); decide('keep'); break;
      case 'ArrowDown':  e.preventDefault(); decide('reject'); break;
      case 'Backspace':  e.preventDefault(); undo(); break;
      case '1': case '2': case '3': case '4': case '5':
        e.preventDefault(); decide('set', Number(e.key)); break;
    }
  });
}

/* ------------------------------------------------------------------ */
/* util                                                                */
/* ------------------------------------------------------------------ */

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// expose handlers used from inline onclick
window.goBoard = goBoard;

document.addEventListener('DOMContentLoaded', init);
