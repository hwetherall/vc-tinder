// VC Tinder — scoring.
// Finds every unscored firm (fit IS NULL), resolves its website, pulls evidence
// from the site, scores it against the Innovera rubric, and writes the result
// back. Restart-safe by construction: scored firms drop out of the selection,
// so re-running after a crash or Ctrl-C just continues where it left off.
//
//   node score.mjs                  # score everything unscored (4 at a time)
//   node score.mjs --dry-run        # list what would be scored
//   node score.mjs --limit 10       # first N only
//   node score.mjs --concurrency 6  # widen the worker pool
//
// Requires: EXA_API_KEY, OPENROUTER_API_KEY, SUPABASE_URL, SUPABASE_KEY.
// Model: MODEL env (default anthropic/claude-opus-4 — same rubric model as discovery).

import { pathToFileURL } from 'url';
import { loadEnv, sbSelect, sbUpdate } from './db.mjs';
import { exaSearch, exaContents } from './exa.mjs';
import { scoreFirm, deriveTier, evidenceBlock, normalizeDomain } from './discover.mjs';
import { pickHomepage } from './enrich.mjs';

async function resolveWebsite(firm) {
  if (firm.website) return firm.website;
  const results = await exaSearch(
    `${firm.name} venture capital firm ${firm.location || ''} official website`,
    { numResults: 5 }
  );
  const home = pickHomepage(results);
  return home ? home.url : null;
}

async function scoreOne(firm) {
  const website = await resolveWebsite(firm);
  if (!website) {
    await sbUpdate(`firms?id=eq.${firm.id}`, {
      status: `${firm.status ? firm.status + ' | ' : ''}SCORING FAILED: no website found`.slice(0, 500),
    });
    return { ok: false, msg: 'no website found' };
  }
  const { text } = await exaContents(website, 4000);
  const s = await scoreFirm({ name: firm.name, url: website }, text);
  await sbUpdate(`firms?id=eq.${firm.id}`, {
    website,
    domain: normalizeDomain(website),
    fit: s.fit,
    thesis_fit: s.thesis_fit,
    network: s.network,
    lead_capability: s.lead_capability,
    location_score: s.location,
    gravitas_score: s.gravitas,
    score_confidence: s.lead_capability_confidence || null,
    tier_label: deriveTier(s),
    evidence: evidenceBlock(s, website),
    status: `AI-scored: ${s.note || ''}${firm.website ? '' : ' — website resolved via search, verify'}`.trim(),
  });
  return { ok: true, msg: `Fit ${s.fit} -> ${deriveTier(s)}` };
}

async function main() {
  loadEnv();
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const limitIdx = argv.indexOf('--limit');
  const limit = limitIdx !== -1 ? Number(argv[limitIdx + 1]) : Infinity;
  const concIdx = argv.indexOf('--concurrency');
  const concurrency = concIdx !== -1 ? Math.max(1, Number(argv[concIdx + 1])) : 4;

  let firms = await sbSelect('firms?fit=is.null&select=id,name,website,location,status&order=sort_order.asc.nullslast');
  firms = firms.slice(0, limit);
  console.log(`${firms.length} unscored firm(s).${dryRun ? ' DRY RUN.' : ` Scoring with ${concurrency} workers...`}`);
  if (dryRun) {
    for (const f of firms.slice(0, 15)) console.log(`  • ${f.name}${f.website ? '' : ' (website: will resolve)'}`);
    if (firms.length > 15) console.log(`  … and ${firms.length - 15} more`);
    return;
  }
  if (firms.length === 0) return;

  let next = 0;
  let done = 0;
  let failed = 0;
  const started = Date.now();
  async function worker() {
    while (next < firms.length) {
      const firm = firms[next++];
      let result;
      try {
        result = await scoreOne(firm);
      } catch (err) {
        result = { ok: false, msg: err.message.slice(0, 120) };
      }
      done++;
      if (!result.ok) failed++;
      const mins = ((Date.now() - started) / 60000).toFixed(1);
      console.log(`  [${done}/${firms.length}] ${firm.name} — ${result.ok ? result.msg : '! ' + result.msg} (${mins}m)`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, firms.length) }, worker));
  console.log(`\nDone: ${done - failed} scored, ${failed} failed (re-run to retry failures).`);
}

// Run only when invoked directly (not when imported by tests).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
