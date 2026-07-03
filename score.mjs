// VC Tinder — scoring.
// Finds every unscored firm (fit IS NULL), resolves its website, pulls evidence
// from the site, scores it against the Innovera rubric, and writes the result
// back. Restart-safe by construction: scored firms drop out of the selection,
// so re-running after a crash or Ctrl-C just continues where it left off.
//
//   node score.mjs                  # score everything unscored (4 at a time)
//   node score.mjs --rescore        # RE-score all non-gated scored firms (deeper evidence)
//   node score.mjs --firm kleiner   # (re)score one firm by name match
//   node score.mjs --dry-run        # list what would be scored
//   node score.mjs --limit 10       # first N only
//   node score.mjs --concurrency 6  # widen the worker pool
//
// Requires: EXA_API_KEY, OPENROUTER_API_KEY, SUPABASE_URL, SUPABASE_KEY.
// Model: MODEL env (default anthropic/claude-opus-4 — same rubric model as discovery).

import { pathToFileURL } from 'url';
import { loadEnv, sbSelect, sbUpdate } from './db.mjs';
import { exaSearch, exaSearchNews, exaContents } from './exa.mjs';
import { scoreFirm, deriveTier, evidenceBlock, normalizeDomain } from './discover.mjs';
import { pickHomepage } from './enrich.mjs';
import { effectiveTier } from './tiers.mjs';

async function resolveWebsite(firm) {
  if (firm.website) return firm.website;
  const results = await exaSearch(
    `${firm.name} venture capital firm ${firm.location || ''} official website`,
    { numResults: 5 }
  );
  const home = pickHomepage(results);
  return home ? home.url : null;
}

// Homepage + general web search results: famous firms get corroboration, and
// obscure firms get more than their own marketing copy to be judged on.
async function gatherEvidence(firm, website) {
  const parts = [];
  try {
    const { text } = await exaContents(website, 3000);
    if (text.trim()) parts.push(`FIRM WEBSITE (${website}):\n${text}`);
  } catch { /* homepage may be unreachable; web results can still carry it */ }
  try {
    const results = await exaSearchNews(`"${firm.name}" venture capital firm`, { numResults: 4, category: null });
    const blob = results
      .filter((r) => normalizeDomain(r.url) !== normalizeDomain(website))
      .map((r) => `${r.title} (${r.url})\n${r.text.slice(0, 500)}`)
      .join('\n---\n');
    if (blob.trim()) parts.push(`WEB SEARCH RESULTS:\n${blob}`);
  } catch { /* search is best-effort */ }
  return parts.join('\n\n') || '(no web evidence found — rely on your own knowledge if you recognize this firm)';
}

async function scoreOne(firm) {
  const website = await resolveWebsite(firm);
  if (!website) {
    await sbUpdate(`firms?id=eq.${firm.id}`, {
      status: `${firm.status ? firm.status + ' | ' : ''}SCORING FAILED: no website found`.slice(0, 500),
    });
    return { ok: false, msg: 'no website found' };
  }
  const text = await gatherEvidence(firm, website);
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
    // Hand-written statuses (HARRY CONNECTION etc.) survive a rescore.
    status: (!firm.status || /^AI-scored/.test(firm.status)
      ? `AI-scored: ${s.note || ''}${firm.website ? '' : ' — website resolved via search, verify'}`
      : `${firm.status.split(' | rescored:')[0]} | rescored: ${s.note || ''}`
    ).trim().slice(0, 600),
  });
  return { ok: true, msg: `Fit ${s.fit} -> ${deriveTier(s)}` };
}

async function main() {
  loadEnv();
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const rescore = argv.includes('--rescore');
  const limitIdx = argv.indexOf('--limit');
  const limit = limitIdx !== -1 ? Number(argv[limitIdx + 1]) : Infinity;
  const concIdx = argv.indexOf('--concurrency');
  const concurrency = concIdx !== -1 ? Math.max(1, Number(argv[concIdx + 1])) : 4;
  const firmIdx = argv.indexOf('--firm');
  const firmMatch = firmIdx !== -1 ? argv[firmIdx + 1].toLowerCase() : null;

  const SELECT = 'firms?select=id,name,website,location,status,tier_label,current_tier,fit&order=sort_order.asc.nullslast';
  let firms = await sbSelect(SELECT);
  if (firmMatch) {
    firms = firms.filter((f) => f.name.toLowerCase().includes(firmMatch));
  } else if (rescore) {
    // Re-score everything already scored except Gate-tier: deeper evidence
    // won't rescue an accelerator, and 130+ gated rows aren't worth the spend.
    firms = firms.filter((f) => f.fit != null && effectiveTier(f) <= 4);
  } else {
    firms = firms.filter((f) => f.fit == null);
  }
  // Individuals (angels) have no firm website to score against, and existing
  // investors keep their hand-set Inside/sponsor tier — leave both alone.
  firms = firms.filter((f) => !/PRIVATE INVESTOR|EXISTING INVESTOR/i.test(f.status || ''));
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
