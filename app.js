// VC Tinder — front-end logic. No dependencies.
'use strict';

/* ------------------------------------------------------------------ */
/* CSV parse / serialize (RFC-4180)                                    */
/* ------------------------------------------------------------------ */

function parseCSV(text) {
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

function escapeField(v) {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function serializeCSV(rows) {
  return rows.map((r) => r.map(escapeField).join(',')).join('\r\n') + '\r\n';
}

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
      </div>
      ${tierRail(t)}
    </div>`;
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
