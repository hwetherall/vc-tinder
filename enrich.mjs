// VC Tinder — enrichment.
// Fills in what Find doesn't know about a firm: fund facts (size, age, stage
// focus), recent deals + a deal-pattern summary, the best-fit partner to know,
// and (via the ninjapear adapter) contact email/LinkedIn data.
//
//   node enrich.mjs --dry-run             # print the work list, do nothing
//   node enrich.mjs                       # facts,deals,contacts for tier 1-2 firms
//   node enrich.mjs --stages facts,deals  # run a subset of stages
//   node enrich.mjs --tiers 1,2,3         # widen/narrow firm selection
//   node enrich.mjs --source manual       # select by source instead of tier
//   node enrich.mjs --firm accel          # one firm, matched on normalized name
//   node enrich.mjs --limit 5             # cap the number of firms
//   node enrich.mjs --force               # re-run even if enriched_at is set
//
// Requires: EXA_API_KEY, OPENROUTER_API_KEY, SUPABASE_URL, SUPABASE_KEY.
// The emails stage additionally needs the NinjaPear adapter wired up.

import { pathToFileURL } from 'url';
import { loadEnv, sbSelect, sbInsert, sbUpdate } from './db.mjs';
import { exaSearch, exaSearchNews, exaContents } from './exa.mjs';
import { chatJSON } from './llm.mjs';
import { effectiveTier } from './tiers.mjs';
import { normalizeDomain } from './discover.mjs';
import { enrichContact, PROVIDER } from './ninjapear/ninjapear.mjs';

const ALL_STAGES = ['facts', 'deals', 'contacts', 'emails', 'location'];

// Location fill is cheap and high-volume, so it runs on a lighter model.
const LOCATION_MODEL = process.env.LOCATION_MODEL || 'anthropic/claude-sonnet-5';

/* ------------------------------------------------------------------ */
/* Pure helpers (exported for tests)                                   */
/* ------------------------------------------------------------------ */

// Dedup key for a deal: same company + round = same deal, however phrased.
export function dealKey(d) {
  const co = String(d.company || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const round = String(d.round || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${co}|${round}`;
}

// Pick the firm's homepage from search results: first hit that isn't a
// social/aggregator/news page. Returns null if nothing qualifies.
const NOT_HOMEPAGE_RE = /(?:^|\.)(?:linkedin|crunchbase|twitter|x|facebook|instagram|wikipedia|medium|youtube|pitchbook|signal\.nfx|techcrunch|forbes|bloomberg)\.(?:com|co|org)$/i;
export function pickHomepage(results) {
  for (const r of results || []) {
    const domain = normalizeDomain(r.url);
    if (domain && !NOT_HOMEPAGE_RE.test(domain)) return { url: r.url, domain };
  }
  return null;
}

// ISO date N days ago (news lookback window).
export function daysAgoIso(days, from = new Date()) {
  return new Date(from.getTime() - days * 86400e3).toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* Stages                                                              */
/* ------------------------------------------------------------------ */

// Resolve a missing website by searching, then update the row. Facts and
// contacts both need it; happenstance-imported firms start without one.
async function ensureWebsite(firm) {
  if (firm.website) return firm;
  const results = await exaSearch(`${firm.name} venture capital firm official website`, { numResults: 5 });
  const home = pickHomepage(results);
  if (!home) throw new Error('could not resolve website');
  await sbUpdate(`firms?id=eq.${firm.id}`, { website: home.url, domain: home.domain });
  return { ...firm, website: home.url, domain: home.domain, websiteResolved: true };
}

async function inferStageFocus(firm) {
  let blob = '';
  try {
    const results = await exaSearch(`"${firm.name}" venture capital investment stage focus`, { numResults: 3 });
    blob = results.map((r) => `${r.title}\n${r.text.slice(0, 400)}`).join('\n---\n');
  } catch { /* search is best-effort */ }
  const raw = await chatJSON(
    `What investment stages does the venture capital firm "${firm.name}"${firm.website ? ` (${firm.website})` : ''} typically focus on?\n` +
    `Use the search results below AND your own knowledge of the firm. Return a concise phrase ` +
    `(e.g. "Seed to Series B"). If you genuinely cannot tell, return null.\n\n${blob.slice(0, 3000)}\n\n` +
    `Return ONLY this JSON, no markdown fences: {"stage_focus":"<phrase>"|null}`
  );
  return raw.stage_focus || null;
}

async function stageFacts(firm) {
  const { text } = await exaContents(firm.website, 4000);
  if (!text.trim()) throw new Error('no page content');
  const raw = await chatJSON(
    `From this VC firm website content, extract facts about the firm "${firm.name}".\n` +
    `Use null for anything the content does not state — do NOT guess.\n\n` +
    `${text.slice(0, 4000)}\n\n` +
    `Return ONLY this JSON, no markdown fences:\n` +
    `{"fund_size":"<latest or total fund size as stated, e.g. '$500M Fund IV'>"|null,` +
    `"founded_year":<int>|null,"stage_focus":"<e.g. 'Pre-seed to Series A'>"|null,` +
    `"thesis_tags":["<up to 6 lowercase sector/thesis tags>"],` +
    `"hq_location":"<city, region>"|null}\n` +
    `If the content states none of these, STILL return that JSON with null values — ` +
    `never reply in prose.`
  );
  const year = parseInt(raw.founded_year, 10); // parseInt(null/'') -> NaN, unlike Number()
  let stage_focus = raw.stage_focus || null;
  if (!stage_focus) stage_focus = await inferStageFocus(firm);
  const patch = {
    fund_size: raw.fund_size || firm.fund_size || null,
    founded_year: Number.isFinite(year) && year > 1800 ? year : (firm.founded_year || null),
    stage_focus,
    thesis_tags: Array.isArray(raw.thesis_tags) && raw.thesis_tags.length
      ? raw.thesis_tags.slice(0, 6).map(String)
      : (firm.thesis_tags || null),
    enriched_at: new Date().toISOString(),
  };
  if (!firm.location && raw.hq_location) patch.location = raw.hq_location;
  await sbUpdate(`firms?id=eq.${firm.id}`, patch);
  return `facts: size=${patch.fund_size || '?'} founded=${patch.founded_year || '?'} stage=${patch.stage_focus || '?'}`;
}

async function stageDeals(firm) {
  const news = await exaSearchNews(
    `"${firm.name}" investment led funding round startup`,
    { numResults: 8, startPublishedDate: daysAgoIso(548) } // ~18 months
  );
  if (news.length === 0) return 'deals: no recent news found';
  const blob = news
    .map((n, i) => `[${i + 1}] ${n.title} (${n.publishedDate || 'undated'}) ${n.url}\n${n.text.slice(0, 600)}`)
    .join('\n\n');
  const raw = await chatJSON(
    `Below are news snippets mentioning the VC firm "${firm.name}".\n` +
    `Extract distinct startup investments MADE BY ${firm.name}. Ignore fundraises of ` +
    `${firm.name}'s own funds, and deals done only by other firms. Use null when unstated.\n\n` +
    `${blob.slice(0, 8000)}\n\n` +
    `Return ONLY this JSON, no markdown fences:\n` +
    `{"deals":[{"company":"...","round":"Pre-seed|Seed|Series A|Series B|later|unknown",` +
    `"amount":"$12M"|null,"role":"lead|participant|unknown","announced_on":"YYYY-MM-DD"|null,` +
    `"source_url":"<url of snippet>"}],` +
    `"deal_pattern":"<1-2 sentences: stages, sectors, and lead behavior this firm has shown lately>"}`,
    { maxTokens: 2000 }
  );
  const existing = await sbSelect(`deals?firm_id=eq.${firm.id}&select=company,round`);
  const seen = new Set(existing.map(dealKey));
  const fresh = (raw.deals || []).filter((d) => d.company && !seen.has(dealKey(d)));
  if (fresh.length) {
    await sbInsert('deals', fresh.map((d) => ({
      firm_id: firm.id,
      company: String(d.company),
      round: d.round || 'unknown',
      amount: d.amount || null,
      role: d.role || 'unknown',
      announced_on: /^\d{4}-\d{2}-\d{2}$/.test(d.announced_on || '') ? d.announced_on : null,
      source_url: d.source_url || null,
      source: 'exa',
    })));
  }
  if (raw.deal_pattern) {
    await sbUpdate(`firms?id=eq.${firm.id}`, { fund_summary: raw.deal_pattern });
  }
  return `deals: +${fresh.length} new (${(raw.deals || []).length} extracted)`;
}

async function stageContacts(firm) {
  const have = await sbSelect(`contacts?firm_id=eq.${firm.id}&select=id`);
  if (have.length > 0) return 'contacts: already has one, skipped';
  let text = '';
  if (firm.domain) {
    const team = await exaSearch(`team partners people`, { numResults: 2, includeDomains: [firm.domain] });
    if (team[0]) text = (await exaContents(team[0].url, 4000)).text;
  }
  if (!text.trim()) text = (await exaContents(firm.website, 4000)).text;
  if (!text.trim()) throw new Error('no team-page content');
  const raw = await chatJSON(
    `From this content about the VC firm "${firm.name}", identify the ONE partner best ` +
    `suited to champion a $10m Series A investment in Innovera (AI tooling for VCs and ` +
    `corporate innovation teams; AI/fintech/data-infra thesis). Prefer GPs/Partners who ` +
    `lead early-stage AI or enterprise software deals. Only name a person who appears in ` +
    `the content — do NOT invent anyone.\n\n${text.slice(0, 4000)}\n\n` +
    `Return ONLY this JSON, no markdown fences:\n` +
    `{"name":"<person>"|null,"title":"..."|null,"linkedin_url":"..."|null,"why":"<one line>"}`
  );
  if (!raw.name) return 'contacts: none identifiable';
  await sbInsert('contacts', [{
    firm_id: firm.id,
    name: String(raw.name),
    title: raw.title || null,
    linkedin_url: raw.linkedin_url || null,
    is_primary: true,
    intro_path: raw.why ? `enrich pick: ${raw.why}` : 'enrich pick',
    source: 'enrich',
  }], { onConflict: 'firm_id,name' });
  return `contacts: + ${raw.name} (${raw.title || '?'})`;
}

// HQ location via one web search + Sonnet (with model knowledge for the famous
// firms). Only fills blanks — existing locations are never overwritten.
async function stageLocation(firm) {
  if (firm.location) return `location: already set (${firm.location})`;
  let blob = '';
  try {
    const results = await exaSearchNews(`"${firm.name}" venture capital firm headquarters`, { numResults: 3, category: null });
    blob = results.map((r) => `${r.title} (${r.url})\n${r.text.slice(0, 400)}`).join('\n---\n');
  } catch { /* search is best-effort; the model may know anyway */ }
  const raw = await chatJSON(
    `Where is the venture capital firm "${firm.name}"${firm.website ? ` (${firm.website})` : ''} headquartered?\n` +
    `Use the search results below AND your own knowledge of the firm. If you genuinely ` +
    `cannot tell, return null — do not guess.\n\n${blob.slice(0, 4000)}\n\n` +
    `Return ONLY this JSON, no markdown fences: {"location":"<City, State or Country>"} or {"location":null}`,
    { model: LOCATION_MODEL, maxTokens: 200 }
  );
  if (!raw.location) return 'location: not found';
  await sbUpdate(`firms?id=eq.${firm.id}`, { location: String(raw.location).slice(0, 120) });
  return `location: ${raw.location}`;
}

async function stageEmails(firm) {
  const targets = await sbSelect(
    `contacts?firm_id=eq.${firm.id}&email=is.null&select=id,name,title,linkedin_url`
  );
  if (targets.length === 0) return 'emails: nothing to fill';
  let filled = 0;
  for (const c of targets) {
    const r = await enrichContact({
      name: c.name,
      linkedinUrl: c.linkedin_url,
      firmName: firm.name,
      firmDomain: firm.domain,
    });
    const patch = {};
    if (r.email) { patch.email = r.email; patch.email_status = r.email_status || 'unknown'; }
    if (r.title && !c.title) patch.title = r.title;
    if (r.linkedin_url && !c.linkedin_url) patch.linkedin_url = r.linkedin_url;
    if (Object.keys(patch).length) { await sbUpdate(`contacts?id=eq.${c.id}`, patch); filled++; }
  }
  return `emails: filled ${filled}/${targets.length} via ${PROVIDER}`;
}

/* ------------------------------------------------------------------ */
/* CLI                                                                 */
/* ------------------------------------------------------------------ */

function parseArgs(argv) {
  const args = { stages: ['facts', 'deals', 'contacts'], tiers: [1, 2], limit: Infinity };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--force') args.force = true;
    else if (a === '--stages') args.stages = argv[++i].split(',').map((s) => s.trim());
    else if (a === '--tiers') args.tiers = argv[++i].split(',').map(Number);
    else if (a === '--limit') args.limit = Number(argv[++i]);
    else if (a === '--source') args.source = argv[++i];
    else if (a === '--firm') args.firm = argv[++i].toLowerCase();
  }
  const bad = args.stages.filter((s) => !ALL_STAGES.includes(s));
  if (bad.length) throw new Error(`unknown stage(s): ${bad.join(', ')} (valid: ${ALL_STAGES.join(', ')})`);
  return args;
}

async function main() {
  loadEnv();
  const args = parseArgs(process.argv.slice(2));

  let firms = await sbSelect('firms?select=*&order=fit.desc.nullslast');
  if (args.firm) {
    firms = firms.filter((f) => f.normalized_name.includes(args.firm) || f.name.toLowerCase().includes(args.firm));
  } else if (args.source) {
    firms = firms.filter((f) => f.source === args.source);
  } else {
    firms = firms.filter((f) => args.tiers.includes(effectiveTier(f)));
  }
  firms = firms.slice(0, args.limit);

  console.log(`Enriching ${firms.length} firms — stages: ${args.stages.join(', ')}${args.dryRun ? ' (DRY RUN)' : ''}`);
  if (args.dryRun) {
    for (const f of firms) {
      console.log(`  • ${f.name.padEnd(30)} tier ${effectiveTier(f)}  fit ${f.fit ?? '—'}  ${f.website || '(no website: will resolve)'}${f.enriched_at ? '  [enriched before]' : ''}`);
    }
    return;
  }

  // Only stages that read the firm's site need a resolved website; location and
  // deals search by name, so a website-less (e.g. gated) firm still gets them.
  const needsWebsite = args.stages.some((s) => ['facts', 'contacts', 'emails'].includes(s));
  const totals = { ok: 0, failed: 0 };
  for (const f of firms) {
    console.log(`\n${f.name} (tier ${effectiveTier(f)})`);
    let firm = f;
    if (needsWebsite) {
      try {
        firm = await ensureWebsite(firm);
        if (firm.websiteResolved) console.log(`  resolved website: ${firm.website}`);
      } catch (err) {
        console.log(`  ! website: ${err.message} — skipping firm`);
        totals.failed++;
        continue;
      }
    }
    for (const stage of args.stages) {
      if (stage === 'facts' && firm.enriched_at && firm.stage_focus && !args.force) {
        console.log('  facts: already enriched, skipped (--force to redo)'); continue;
      }
      try {
        const summary = await ({ facts: stageFacts, deals: stageDeals, contacts: stageContacts, emails: stageEmails, location: stageLocation })[stage](firm);
        console.log(`  ${summary}`);
        totals.ok++;
      } catch (err) {
        console.log(`  ! ${stage}: ${err.message}`);
        totals.failed++;
      }
    }
  }
  console.log(`\nDone. ${totals.ok} stage-runs ok, ${totals.failed} failed.`);
}

// Run only when invoked directly (not when imported by tests).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
