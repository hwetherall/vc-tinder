// VC Tinder — discovery.
// Finds lead-capable, in-thesis VC firms that neither Happenstance nor the
// top-100 surfaced, scores them against the existing rubric, and writes them
// into the Supabase `firms` table so they appear as cards in the swipe UI.
//
// Zero dependency: Node built-in fetch (Node 18+), no SDK. Run with:
//   node discover.mjs --dry-run     # Stage 1: print candidates, write NOTHING
//   node discover.mjs               # Stage 2: score candidates, write to Supabase
//
// Requires: EXA_API_KEY        (discovery + evidence)
//           OPENROUTER_API_KEY (scoring; Stage 2 only)
//           SUPABASE_URL + SUPABASE_KEY (dedup against + write to the firms table)
// Optional: MODEL (default anthropic/claude-opus-4), NUM_RESULTS (per anchor, default 8)

import { pathToFileURL } from 'url';
import { loadEnv, sbSelect, sbInsert } from './db.mjs';
import { exaFindSimilar, exaSearch, exaContents } from './exa.mjs';
import { chatJSON } from './llm.mjs';
export { extractJson } from './llm.mjs';

const NUM_RESULTS = Number(process.env.NUM_RESULTS || 8);

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

export async function scoreFirm(candidate, evidenceText) {
  const shape = '{"thesis_fit":<0-25>,"network":<0-25>,"lead_capability":<0-25>,"location":<0-15>,"gravitas":<0-10>,"is_fund":<true|false>,"is_accelerator":<true|false>,"writes_500k_plus":<true|false>,"does_series_a":<true|false>,"lead_capability_confidence":"low|med|high","evidence":{"thesis":"<claim + url>","network":"...","lead":"...","location":"...","gravitas":"..."},"note":"<one line>"}';
  const prompt = `${RUBRIC}\n\nFirm: ${candidate.name}\nWebsite: ${candidate.url}\n\nEvidence (from the firm's site):\n${evidenceText.slice(0, 4000)}\n\nReturn ONLY a JSON object with these EXACT top-level keys — flat, NOT nested under "scores"/"gates", no markdown fences:\n${shape}`;
  return normalizeScore(await chatJSON(prompt));
}

// OpenRouter's json_object mode does not enforce our schema, so models vary the
// shape (nesting under scores/gates, "medium" vs "med", thesis vs thesis_fit).
// Normalize to the flat shape the rest of the pipeline expects, and clamp the
// sub-scores to their rubric maxima.
export function normalizeScore(raw) {
  const sc = raw.scores || raw;   // scores may be nested under "scores"
  const g = raw.gates || raw;     // gates may be nested under "gates"
  const ev = raw.evidence || {};
  const clamp = (v, max) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));
  const s = {
    thesis_fit: clamp(sc.thesis_fit ?? sc.thesis, 25),
    network: clamp(sc.network, 25),
    lead_capability: clamp(sc.lead_capability ?? sc.lead, 25),
    location: clamp(sc.location, 15),
    gravitas: clamp(sc.gravitas, 10),
    is_fund: g.is_fund !== false,            // default to true unless explicitly false
    is_accelerator: g.is_accelerator === true,
    writes_500k_plus: g.writes_500k_plus !== false,
    does_series_a: g.does_series_a !== false,
    lead_capability_confidence: String(raw.lead_capability_confidence || raw.confidence || 'low')
      .toLowerCase().replace('medium', 'med'),
    evidence: {
      thesis: ev.thesis ?? ev.thesis_fit ?? '',
      network: ev.network ?? '',
      lead: ev.lead ?? ev.lead_capability ?? '',
      location: ev.location ?? '',
      gravitas: ev.gravitas ?? '',
    },
    note: raw.note || '',
  };
  s.fit = s.thesis_fit + s.network + s.lead_capability + s.location + s.gravitas;
  return s;
}

/* ------------------------------------------------------------------ */
/* Firm records (Supabase rows)                                        */
/* ------------------------------------------------------------------ */

// Per-sub-score claims as one readable block, ending with the source URL.
export function evidenceBlock(s, sourceUrl) {
  const ev = s.evidence || {};
  return [
    ['thesis', s.thesis_fit, ev.thesis],
    ['network', s.network, ev.network],
    ['lead', s.lead_capability, ev.lead],
    ['location', s.location, ev.location],
    ['gravitas', s.gravitas, ev.gravitas],
  ].map(([k, v, claim]) => `${k} (${v}): ${claim || '—'}`).join('\n') + `\nsource: ${sourceUrl}`;
}

// Newly discovered firms get sort_order NULL, which the server orders first —
// so fresh discoveries surface at the top of the swipe deck for triage.
function scoredRecord(candidate, s) {
  const evidence = evidenceBlock(s, candidate.url);
  return {
    name: candidate.name,
    normalized_name: normalizeName(candidate.name),
    website: candidate.url,
    domain: candidate.domain,
    proximity: 'Cold (discovered)',
    tier_label: deriveTier(s),
    fit: s.fit,
    thesis_fit: s.thesis_fit,
    network: s.network,
    lead_capability: s.lead_capability,
    location_score: s.location,
    gravitas_score: s.gravitas,
    score_confidence: s.lead_capability_confidence || null,
    status: `DISCOVERED (AI-scored): ${s.note || ''}`.trim(),
    intro_path: `discovered via Exa find-similar; seed ${candidate.seed}`,
    evidence,
    source: 'discovered',
  };
}

function unscoredRecord(candidate, errMsg) {
  return {
    name: candidate.name,
    normalized_name: normalizeName(candidate.name),
    website: candidate.url,
    domain: candidate.domain,
    proximity: 'Cold (discovered)',
    tier_label: 'TBD', // recognized by startTier() -> tier 3
    status: `DISCOVERED — needs scoring (scoring failed: ${errMsg})`,
    intro_path: `discovered via Exa find-similar; seed ${candidate.seed}`,
    evidence: candidate.url,
    source: 'discovered',
  };
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
  if (existingKeys.has(normalizeName(name))) return; // already in the DB (by name)
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
      const results = await exaFindSimilar(anchorUrl, NUM_RESULTS);
      for (const r of results) tryAddCandidate(r, seed, existingKeys, seenDomains, candidates);
    } catch (err) {
      console.error(`  ! find-similar failed for ${seed}: ${err.message}`);
    }
  }

  // 2) profile-based search: targets thesis + lead-capability, not branding.
  try {
    const results = await exaSearch(PROFILE_QUERY, { numResults: Math.max(NUM_RESULTS * 2, 16) });
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
  loadEnv();
  const dryRun = process.argv.includes('--dry-run');

  const firms = await sbSelect('firms?select=normalized_name');
  const existingKeys = new Set(firms.map((f) => f.normalized_name).filter(Boolean));

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

  // Stage 2: score each candidate; failures fall back to an unscored record.
  const records = [];
  for (const c of candidates) {
    process.stdout.write(`  scoring ${c.name} ... `);
    try {
      const { text } = await exaContents(c.url);
      const s = await scoreFirm(c, text);
      records.push(scoredRecord(c, s));
      console.log(`Fit ${s.fit} -> ${deriveTier(s)}`);
    } catch (err) {
      records.push(unscoredRecord(c, err.message));
      console.log(`unscored (${err.message})`);
    }
  }

  // Upsert-ignore on normalized_name: a name collision with an existing firm
  // (or between two candidates) skips the duplicate instead of failing the batch.
  const inserted = await sbInsert('firms', records, { onConflict: 'normalized_name' });
  console.log(`\nWrote ${(inserted || []).length} discovered firms to Supabase.`);
  console.log('Reload the swipe UI to triage them (new firms sort to the top).');
}

// Run only when invoked directly (not when imported by tests).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
