// VC Tinder — discovery.
// Finds lead-capable, in-thesis VC firms that neither Happenstance nor the
// top-100 surfaced, scores them against the existing rubric, and writes them
// into the source CSV so they appear as cards in the swipe UI.
//
// Zero dependency: Node built-in fetch (Node 18+), no SDK. Run with:
//   node discover.mjs --dry-run     # Stage 1: print candidates, write NOTHING
//   node discover.mjs               # Stage 2: score candidates, write to CSV
//
// Requires: EXA_API_KEY        (discovery + evidence)
//           OPENROUTER_API_KEY (scoring; Stage 2 only)
// Optional: MODEL (default anthropic/claude-opus-4), NUM_RESULTS (per anchor, default 8)

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { parseCSV, serializeCSV } from './csv.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_CSV = path.join(HERE, 'Innovera-SeriesA-targets-from-Happenstance (1).csv');
const MODEL = process.env.MODEL || 'anthropic/claude-opus-4';
const NUM_RESULTS = Number(process.env.NUM_RESULTS || 8);

// The 13-column source schema, plus the two columns discovery adds.
const BASE_COLS = [
  'VC', 'Tier', 'Proximity', 'Fit', 'Location', 'Contact', 'Thesis Fit',
  'Network', 'Lead Capability', 'Location Score', 'Gravitas Score', 'Status', 'Intro Path',
];
const NEW_COLS = ['Evidence', 'Score Confidence'];

// Seed anchors: FOCUSED early-stage KEEP firms, not the prestige giants.
// find-similar on a16z returns more giants that can't lead a $10m round;
// find-similar on these returns the focused funds we're missing.
// Confirm/edit these before a real run — the seed is the whole ballgame.
const ANCHORS = {
  'Craft Ventures': 'https://www.craftventures.com',
  'Unusual Ventures': 'https://www.unusual.vc',
  'Wing VC': 'https://www.wing.vc',
  'Radical Ventures': 'https://radical.vc',
  'Glasswing Ventures': 'https://www.glasswing.vc',
  'Fusion Fund': 'https://www.fusionfund.com',
  // Confirmed Tier-1 leads recovered from the data: "Branch" -> Mayfield, "Charlie" -> DCVC.
  'Mayfield Fund': 'https://www.mayfield.com',
  'DCVC': 'https://www.dcvc.com',
};

// Profile-based search query: targets thesis + lead-capability directly, rather
// than the branding/page similarity that find-similar keys on. Edit to retune.
const PROFILE_QUERY =
  'early-stage venture capital firm that leads Series A rounds in AI infrastructure, ' +
  'fintech, and data tooling startups, writing $5-7 million lead checks';

// Known name aliases (canonical form on the right). Pure fuzzy/edit-distance
// will not catch these — they share almost no characters.
const ALIASES = {
  'a16z': 'andreessen horowitz',
  'gv': 'google ventures',
  'kp': 'kleiner perkins',
};

/* ------------------------------------------------------------------ */
/* Pure helpers (exported for tests)                                   */
/* ------------------------------------------------------------------ */

// Normalize a firm name for dedup: lowercase, drop punctuation and the common
// suffix words, apply the alias map. "Andreessen Horowitz" and "a16z" collapse
// to the same canonical string.
export function normalizeName(name) {
  let n = String(name || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(ventures|venture|capital|partners|partner|management|fund|funds|group|vc|the|inc|llc|lp)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (ALIASES[n]) n = ALIASES[n];
  return n;
}

// Bare registrable-ish domain from a URL: "https://www.unusual.vc/x" -> "unusual.vc".
export function normalizeDomain(url) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    return host;
  } catch {
    return '';
  }
}

// Keyword gate. Returns { keep, reason, flag } from the firm name, a blob of
// text (Exa title + snippet), and the URL. Rejects accelerators/studios, non-VC
// entities (consulting/financial/sector-mismatch), social/aggregator URLs, and
// degenerate names; flags (keeps) non-lead vehicles (PE/growth/family office).
const REJECT_RE = /\b(accelerator|incubator|studio|syndicate|angel network|bootcamp|hackathon|consult(ing|ant)?|advisor[sy]?|financial services|wealth|holdings?|bank|bancorp|insurance|real estate|recruit(ing|ment)?|patent|biotech|bioscience|life ?science|therapeutic|management (co|company|ltd|llc))\b/i;
const FLAG_RE = /\b(private equity|growth equity|hedge fund|fund of funds|family office|broker)\b/i;
const BAD_HOST_RE = /(?:^|\.)(?:linkedin|crunchbase|twitter|facebook|instagram|wikipedia|medium|youtube|x)\.com$/i;
export function gateCandidate(name, text, url) {
  if (String(name || '').replace(/[^a-z0-9]/gi, '').length < 2) {
    return { keep: false, reason: 'degenerate/blank name', flag: '' };
  }
  let host = '';
  try { host = new URL(url).hostname; } catch { /* url is optional */ }
  if (BAD_HOST_RE.test(host)) return { keep: false, reason: 'not a firm homepage (social/aggregator)', flag: '' };
  const blob = `${name} ${text || ''}`;
  if (REJECT_RE.test(blob)) return { keep: false, reason: 'non-VC entity (consulting/financial/sector-mismatch)', flag: '' };
  if (FLAG_RE.test(blob)) return { keep: true, reason: '', flag: 'non-lead vehicle? verify' };
  return { keep: true, reason: '', flag: '' };
}

// Deterministic tier from the composite + gate flags — never asked of the model.
// Returns a label that app.js startTier() recognizes.
export function deriveTier(s) {
  if (!s.is_fund || s.is_accelerator || s.writes_500k_plus === false || s.does_series_a === false) {
    return 'Gate';
  }
  if (s.lead_capability_confidence === 'low' && s.fit >= 75) return 'VERIFY (poss. Tier-1)';
  if (s.fit >= 90) return '1 - Open now';
  if (s.fit >= 75) return '2 - Cultivate / participant';
  if (s.fit >= 55) return '3 - Follow / participant';
  return 'Referral / deprioritize';
}

// Build an existing-firm key set from parsed CSV rows (header + data rows).
export function existingNameKeys(rows) {
  const header = rows[0] || [];
  const vcIdx = header.findIndex((h) => h.toLowerCase().trim() === 'vc');
  const keys = new Set();
  for (const r of rows.slice(1)) {
    const name = vcIdx >= 0 ? r[vcIdx] : r[0];
    const k = normalizeName(name);
    if (k) keys.add(k);
  }
  return keys;
}

// Assemble a CSV row aligned to `header` from a {column: value} map.
export function buildRow(header, fields) {
  return header.map((col) => (fields[col] == null ? '' : String(fields[col])));
}

/* ------------------------------------------------------------------ */
/* Network (hand-rolled fetch, retries + timeout)                      */
/* ------------------------------------------------------------------ */

async function fetchJSON(url, opts, { tries = 3, timeoutMs = 30000 } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(timeoutMs) });
      if (res.status === 429 || res.status >= 500) {
        throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      }
      if (!res.ok) {
        // 4xx other than 429: not retryable.
        throw Object.assign(new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`), { fatal: true });
      }
      try {
        return await res.json();
      } catch (e) {
        // A malformed 200 body won't get better on retry — and retrying the
        // Anthropic call would re-charge tokens. Treat as fatal.
        throw Object.assign(new Error(`bad JSON in response: ${e.message}`), { fatal: true });
      }
    } catch (err) {
      lastErr = err;
      if (err.fatal || attempt === tries) break;
      await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1) + Math.floor(attempt * 137)));
    }
  }
  throw lastErr;
}

async function exaFindSimilar(anchorUrl) {
  if (!process.env.EXA_API_KEY) throw new Error('EXA_API_KEY not set');
  const data = await fetchJSON('https://api.exa.ai/findSimilar', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.EXA_API_KEY },
    body: JSON.stringify({
      url: anchorUrl,
      numResults: NUM_RESULTS,
      excludeSourceDomain: true,
      category: 'company',
    }),
  });
  return (data.results || []).map((r) => ({ url: r.url, title: r.title || '' }));
}

async function exaSearch(query) {
  if (!process.env.EXA_API_KEY) throw new Error('EXA_API_KEY not set');
  const data = await fetchJSON('https://api.exa.ai/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.EXA_API_KEY },
    body: JSON.stringify({
      query,
      numResults: Math.max(NUM_RESULTS * 2, 16),
      category: 'company',
      type: 'auto',
    }),
  });
  return (data.results || []).map((r) => ({ url: r.url, title: r.title || '' }));
}

async function exaContents(url) {
  if (!process.env.EXA_API_KEY) throw new Error('EXA_API_KEY not set');
  const data = await fetchJSON('https://api.exa.ai/contents', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.EXA_API_KEY },
    body: JSON.stringify({ urls: [url], text: { maxCharacters: 4000 } }),
  });
  const r = (data.results || [])[0] || {};
  return { title: r.title || '', text: r.text || '' };
}

/* ------------------------------------------------------------------ */
/* Scoring (Claude Messages API, structured output)                    */
/* ------------------------------------------------------------------ */

const RUBRIC = `Score this VC firm for Innovera's $10m Series A at a $100m valuation.
Innovera sells AI tooling to VCs and corporate innovation teams; the ideal lead
is a focused early-stage AI/fintech/data-infra fund that writes $5-7m lead checks,
can price a $100m round, and opens customer doors. Fill each sub-score from the
evidence only — do NOT invent facts. If the evidence is thin, score conservatively
and set lead_capability_confidence to "low".

Sub-scores (max): thesis_fit /25, network /25, lead_capability /25, location /15, gravitas /10.
Gates: is_fund (a real venture fund, not an accelerator/PE/family office),
is_accelerator, writes_500k_plus (min check >= $500k), does_series_a (leads or
participates in Series A at this size). Provide one supporting claim + source URL
per sub-score.`;

const SCORE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    thesis_fit: { type: 'integer' },
    network: { type: 'integer' },
    lead_capability: { type: 'integer' },
    location: { type: 'integer' },
    gravitas: { type: 'integer' },
    is_fund: { type: 'boolean' },
    is_accelerator: { type: 'boolean' },
    writes_500k_plus: { type: 'boolean' },
    does_series_a: { type: 'boolean' },
    lead_capability_confidence: { type: 'string', enum: ['low', 'med', 'high'] },
    evidence: {
      type: 'object',
      additionalProperties: false,
      properties: {
        thesis: { type: 'string' },
        network: { type: 'string' },
        lead: { type: 'string' },
        location: { type: 'string' },
        gravitas: { type: 'string' },
      },
      required: ['thesis', 'network', 'lead', 'location', 'gravitas'],
    },
    note: { type: 'string' },
  },
  required: [
    'thesis_fit', 'network', 'lead_capability', 'location', 'gravitas',
    'is_fund', 'is_accelerator', 'writes_500k_plus', 'does_series_a',
    'lead_capability_confidence', 'evidence', 'note',
  ],
};

async function scoreFirm(candidate, evidenceText) {
  if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY not set');
  const prompt = `${RUBRIC}\n\nFirm: ${candidate.name}\nWebsite: ${candidate.url}\n\nEvidence (from the firm's site):\n${evidenceText.slice(0, 4000)}\n\nRespond with a JSON object matching the schema exactly. No prose, no markdown fences.`;
  const data = await fetchJSON('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    }),
  }, { timeoutMs: 60000 });

  const choice = (data.choices || [])[0];
  if (!choice) throw new Error('no choices in response');
  if (choice.finish_reason === 'content_filter') throw new Error('model refused');
  const s = JSON.parse(choice.message.content);

  // Clamp sub-scores to their rubric maxima; the schema can't enforce numeric ranges.
  const clamp = (v, max) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));
  s.thesis_fit = clamp(s.thesis_fit, 25);
  s.network = clamp(s.network, 25);
  s.lead_capability = clamp(s.lead_capability, 25);
  s.location = clamp(s.location, 15);
  s.gravitas = clamp(s.gravitas, 10);
  s.fit = s.thesis_fit + s.network + s.lead_capability + s.location + s.gravitas;
  return s;
}

/* ------------------------------------------------------------------ */
/* Row construction                                                    */
/* ------------------------------------------------------------------ */

function scoredRow(header, candidate, s) {
  const ev = s.evidence || {};
  const evidence = [
    ['thesis', s.thesis_fit, ev.thesis],
    ['network', s.network, ev.network],
    ['lead', s.lead_capability, ev.lead],
    ['location', s.location, ev.location],
    ['gravitas', s.gravitas, ev.gravitas],
  ].map(([k, v, claim]) => `${k} (${v}): ${claim || '—'}`).join('\n') + `\nsource: ${candidate.url}`;
  return buildRow(header, {
    VC: candidate.name,
    Tier: deriveTier(s),
    Proximity: 'Cold (discovered)',
    Fit: s.fit,
    Location: candidate.location || '',
    Contact: '',
    'Thesis Fit': s.thesis_fit,
    Network: s.network,
    'Lead Capability': s.lead_capability,
    'Location Score': s.location,
    'Gravitas Score': s.gravitas,
    Status: `DISCOVERED (AI-scored): ${s.note || ''}`.trim(),
    'Intro Path': `discovered via Exa find-similar; seed ${candidate.seed}`,
    Evidence: evidence,
    'Score Confidence': s.lead_capability_confidence || '',
  });
}

function unscoredRow(header, candidate, errMsg) {
  return buildRow(header, {
    VC: candidate.name,
    Tier: 'TBD', // recognized by startTier() -> tier 3
    Proximity: 'Cold (discovered)',
    Location: candidate.location || '',
    Status: `DISCOVERED — needs scoring (scoring failed: ${errMsg})`,
    'Intro Path': `discovered via Exa find-similar; seed ${candidate.seed}`,
    Evidence: candidate.url,
    'Score Confidence': '',
  });
}

/* ------------------------------------------------------------------ */
/* Transactional CSV write                                             */
/* ------------------------------------------------------------------ */

export function writeCsvTransactional(filePath, headerRow, existingDataRows, newRows) {
  // New rows go FIRST so discovered cards are reachable without re-swiping the
  // existing list. Existing rows are padded to the (extended) header width.
  const width = headerRow.length;
  const pad = (r) => (r.length >= width ? r.slice(0, width) : r.concat(Array(width - r.length).fill('')));
  const all = [headerRow, ...newRows.map(pad), ...existingDataRows.map(pad)];
  const csv = serializeCSV(all);

  // Validate the serialized output round-trips to a rectangular table before
  // touching the real file. parseCSV drops fully-blank rows, so compare against
  // the count of NON-blank rows (correct whether or not `all` contains blanks).
  const expected = all.filter((r) => r.some((v) => v !== '')).length;
  const check = parseCSV(csv);
  if (check.length !== expected) throw new Error('validation failed: row count changed after serialize');
  if (!check.every((r) => r.length === width)) throw new Error('validation failed: ragged rows');

  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, csv, 'utf8');
  if (fs.existsSync(filePath)) fs.copyFileSync(filePath, filePath + '.bak');
  fs.renameSync(tmp, filePath);
}

/* ------------------------------------------------------------------ */
/* Pipeline                                                            */
/* ------------------------------------------------------------------ */

// Dedup (by domain + existing name) and gate a single Exa result, pushing it
// onto `candidates` if it survives. Shared by find-similar and profile search.
function tryAddCandidate(r, seed, existingKeys, seenDomains, candidates) {
  const domain = normalizeDomain(r.url);
  if (!domain || seenDomains.has(domain)) return;
  const name = cleanName(r.title, domain);
  if (existingKeys.has(normalizeName(name))) return; // already in the CSV (by name)
  const gate = gateCandidate(name, r.title, r.url);
  if (!gate.keep) return;
  seenDomains.add(domain);
  candidates.push({ name, url: r.url, domain, seed, flag: gate.flag });
}

async function discoverCandidates(existingKeys) {
  const seenDomains = new Set();
  const candidates = [];

  // 1) find-similar off the focused-KEEP anchors (useful but branding-biased).
  for (const [seed, anchorUrl] of Object.entries(ANCHORS)) {
    try {
      const results = await exaFindSimilar(anchorUrl);
      for (const r of results) tryAddCandidate(r, seed, existingKeys, seenDomains, candidates);
    } catch (err) {
      console.error(`  ! find-similar failed for ${seed}: ${err.message}`);
    }
  }

  // 2) profile-based search: targets thesis + lead-capability, not branding.
  try {
    const results = await exaSearch(PROFILE_QUERY);
    for (const r of results) tryAddCandidate(r, 'profile', existingKeys, seenDomains, candidates);
  } catch (err) {
    console.error(`  ! profile search failed: ${err.message}`);
  }

  return candidates;
}

// Best-effort firm name from an Exa page title, falling back to the domain.
function cleanName(title, domain) {
  if (title) {
    const t = title.split(/[|\-–—:·]/)[0].trim();
    if (t && t.length <= 40) return t;
  }
  const base = domain.split('.')[0];
  return base.charAt(0).toUpperCase() + base.slice(1);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (!fs.existsSync(SOURCE_CSV)) {
    console.error(`Source CSV not found: ${SOURCE_CSV}`);
    process.exit(1);
  }
  const rows = parseCSV(fs.readFileSync(SOURCE_CSV, 'utf8'));
  const existingKeys = existingNameKeys(rows);

  console.log(`Seeds: ${Object.keys(ANCHORS).join(', ')} + ideal-lead profile search`);
  console.log(`Existing firms: ${existingKeys.size}. Discovering...`);
  const candidates = await discoverCandidates(existingKeys);
  console.log(`Found ${candidates.length} new, gated, deduped candidates.\n`);

  if (candidates.length === 0) {
    console.log('Nothing new. Adjust the anchors or NUM_RESULTS and re-run.');
    return;
  }

  if (dryRun) {
    console.log('DRY RUN — nothing written. Candidates:\n');
    for (const c of candidates) {
      console.log(`  • ${c.name.padEnd(28)} ${c.url}${c.flag ? `   [${c.flag}]` : ''}`);
    }
    console.log('\nIf these look right, run without --dry-run to score and write them.');
    return;
  }

  // Stage 2: score each candidate; failures fall back to an unscored row.
  const header = mergeHeader(rows[0]);
  const newRows = [];
  for (const c of candidates) {
    process.stdout.write(`  scoring ${c.name} ... `);
    try {
      const { text } = await exaContents(c.url);
      const s = await scoreFirm(c, text);
      newRows.push(scoredRow(header, c, s));
      console.log(`Fit ${s.fit} -> ${deriveTier(s)}`);
    } catch (err) {
      newRows.push(unscoredRow(header, c, err.message));
      console.log(`unscored (${err.message})`);
    }
  }

  writeCsvTransactional(SOURCE_CSV, header, rows.slice(1), newRows);
  console.log(`\nWrote ${newRows.length} discovered firms to the top of the CSV (backup: .bak).`);
  console.log('Reload the swipe UI to triage them.');
}

// Ensure the header carries the two discovery columns.
function mergeHeader(existingHeader) {
  const h = (existingHeader || BASE_COLS).slice();
  for (const col of NEW_COLS) if (!h.includes(col)) h.push(col);
  return h;
}

// Run only when invoked directly (not when imported by tests).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
