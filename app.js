// VC Tinder — front-end logic. No dependencies.
// CSV primitives (parseCSV/serializeCSV) are shared with the Node discovery
// script via csv.mjs, so the RFC-4180 logic lives in exactly one place.
// This file is loaded as a module (<script type="module"> in index.html).
import { parseCSV, serializeCSV } from './csv.mjs';

/* ------------------------------------------------------------------ */
/* Tier mapping (existing Tier label -> starting tier 1..5)            */
/* ------------------------------------------------------------------ */

function startTier(tierRaw) {
  switch ((tierRaw || '').trim()) {
    case '1 - Open now': return 1;
    case '2 - Cultivate / participant':
    case 'VERIFY (poss. Tier-1)':
    case 'Inside / sponsor': return 2;
    case '3 - Follow / participant':
    case 'TBD': return 3;
    case 'Referral / deprioritize': return 4;
    case 'Gate': return 5;
    default: return 3;
  }
}

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
  $('swipeView').hidden = false;
  $('boardView').hidden = true;
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
      ${tierRail(t)}
    </div>`;
}

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
  $('swipeView').hidden = true;
  $('boardView').hidden = false;
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
  $('exportBtn').addEventListener('click', exportCsv);
  $('resetBtn').addEventListener('click', resetAll);

  document.addEventListener('keydown', (e) => {
    if (!$('boardView').hidden) return; // ignore keys on board
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
