// VC Tinder — monitor.
// The "always on" layer for watchlist firms (firms.watched = true): sweeps
// press coverage (Exa news) and the firm's own publications (NinjaPear
// company-updates), stores new items in news_items, then writes one weekly
// fund-update digest (Sonnet 5) to the digests table.
//
//   node monitor.mjs --dry-run    # show watchlist + what would be fetched
//   node monitor.mjs              # sweep, store, digest
//   node monitor.mjs --days 30    # widen the lookback (default 7)
//   node monitor.mjs --no-digest  # sweep + store only
//
// Requires: EXA_API_KEY, SUPABASE_URL, SUPABASE_KEY, OPENROUTER_API_KEY.
// Optional: NINJA_API_KEY (firm-published updates; skipped if unset),
//           MONITOR_MODEL (default anthropic/claude-sonnet-5).

import { pathToFileURL } from 'url';
import { loadEnv, sbSelect, sbInsert, sbUpdate } from './db.mjs';
import { exaSearchNews } from './exa.mjs';
import { chatText } from './llm.mjs';
import { daysAgoIso } from './enrich.mjs';
import { companyUpdates } from './ninjapear/ninjapear.mjs';

const MONITOR_MODEL = process.env.MONITOR_MODEL || 'anthropic/claude-sonnet-5';

/* ------------------------------------------------------------------ */
/* Pure helpers (exported for tests)                                   */
/* ------------------------------------------------------------------ */

// Monday of the week containing `d`, as YYYY-MM-DD (digest key).
export function weekStartIso(d = new Date()) {
  const day = (d.getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
  const monday = new Date(d.getTime() - day * 86400e3);
  return monday.toISOString().slice(0, 10);
}

// Normalize a fetched item (Exa or NinjaPear shape) to a news_items row.
export function toNewsItem(firmId, item, source) {
  const dateRaw = item.publishedDate || item.timestamp || null;
  const published = dateRaw && /^\d{4}-\d{2}-\d{2}/.test(dateRaw) ? dateRaw.slice(0, 10) : null;
  return {
    firm_id: firmId,
    url: item.url,
    title: (item.title || '').slice(0, 500),
    published_on: published,
    snippet: (item.text || item.description || '').slice(0, 1200),
    source,
  };
}

// Items -> the prompt block the digest model reads.
export function itemsBlock(items) {
  return items
    .map((n, i) => `[${i + 1}] (${n.source}, ${n.published_on || 'undated'}) ${n.title}\n${n.url}\n${(n.snippet || '').slice(0, 600)}`)
    .join('\n\n');
}

/* ------------------------------------------------------------------ */
/* Sweep                                                               */
/* ------------------------------------------------------------------ */

async function sweepFirm(firm, days) {
  const fetched = [];

  // Press coverage (Exa news, date-bounded).
  try {
    const news = await exaSearchNews(`"${firm.name}" venture capital`, {
      numResults: 10,
      startPublishedDate: daysAgoIso(days),
    });
    for (const n of news) fetched.push(toNewsItem(firm.id, n, 'exa'));
  } catch (err) {
    console.log(`  ! exa news: ${err.message}`);
  }

  // Firm-published updates (NinjaPear). Timeline isn't date-filtered by the
  // API, so filter to the lookback window here (undated items are kept).
  if (process.env.NINJA_API_KEY && firm.website) {
    try {
      const cutoff = daysAgoIso(days);
      const updates = await companyUpdates(firm.website);
      for (const u of updates) {
        const item = toNewsItem(firm.id, u, u.source);
        if (!item.published_on || item.published_on >= cutoff) fetched.push(item);
      }
    } catch (err) {
      console.log(`  ! ninjapear updates: ${err.message}`);
    }
  }

  // Store; the (firm_id, url) unique index makes re-runs idempotent.
  const valid = fetched.filter((f) => f.url);
  const inserted = valid.length
    ? await sbInsert('news_items', valid, { onConflict: 'firm_id,url' })
    : [];
  return { fetched: valid.length, fresh: (inserted || []).length };
}

/* ------------------------------------------------------------------ */
/* Digest                                                              */
/* ------------------------------------------------------------------ */

async function digestFirm(firm, items) {
  const prompt =
    `You are writing the weekly fund-update on the VC firm "${firm.name}" for Innovera's ` +
    `Series A fundraise team ($10m raise at $100m valuation; AI tooling for VCs and corporate ` +
    `innovation teams; this firm is a priority target${firm.fund_summary ? `; known deal pattern: ${firm.fund_summary}` : ''}).\n\n` +
    `Below are this week's collected items — press coverage and the firm's own posts. ` +
    `Some may be irrelevant or about similarly-named entities; ignore those.\n\n` +
    `${itemsBlock(items).slice(0, 12000)}\n\n` +
    `Write a tight markdown update with EXACTLY these sections:\n` +
    `### ${firm.name}\n` +
    `**TL;DR** — one or two sentences: what mattered this week.\n` +
    `**New investments & fund news** — bullet list; include round, amount, and the [source](url) link. Say "Nothing found this week." if so.\n` +
    `**People & thesis signals** — hires, departures, essays/posts revealing what they want to invest in. Skip section if nothing.\n` +
    `**Angle for Innovera** — one or two bullets: how this week's news changes or sharpens our outreach (who to talk to, what hook to use).\n` +
    `Cite only from the items above — do not invent news. Keep it under 250 words.`;
  return chatText(prompt, { model: MONITOR_MODEL, maxTokens: 1500 });
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

async function main() {
  loadEnv();
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const noDigest = argv.includes('--no-digest');
  const daysIdx = argv.indexOf('--days');
  const days = daysIdx !== -1 ? Number(argv[daysIdx + 1]) : 7;

  const watchlist = await sbSelect('firms?watched=is.true&select=id,name,website,fund_summary&order=name.asc');
  console.log(`Watchlist: ${watchlist.length} firm(s) — ${watchlist.map((f) => f.name).join(', ') || '(none)'}`);
  if (watchlist.length === 0) {
    console.log('Nothing to monitor. Toggle "watch" on a firm in the directory UI.');
    return;
  }
  if (dryRun) {
    console.log(`DRY RUN — would sweep ${days} days of press (Exa) + firm posts (NinjaPear), then digest with ${MONITOR_MODEL}.`);
    return;
  }

  // 1) Sweep every watched firm.
  for (const firm of watchlist) {
    process.stdout.write(`  sweeping ${firm.name} ... `);
    const { fetched, fresh } = await sweepFirm(firm, days);
    console.log(`${fetched} items found, ${fresh} new`);
  }
  if (noDigest) return;

  // 2) Digest everything not yet digested (this run's fresh items + any backlog).
  const sections = [];
  const digestedIds = [];
  for (const firm of watchlist) {
    const items = await sbSelect(
      `news_items?firm_id=eq.${firm.id}&digest_id=is.null&select=*&order=published_on.desc.nullslast`
    );
    if (items.length === 0) continue;
    process.stdout.write(`  digesting ${firm.name} (${items.length} items) ... `);
    sections.push(await digestFirm(firm, items));
    digestedIds.push(...items.map((i) => i.id));
    console.log('done');
  }
  if (sections.length === 0) {
    console.log('No undigested news — no digest written.');
    return;
  }

  const week = weekStartIso();
  const content = `## Fund update — week of ${week}\n\n${sections.join('\n\n---\n\n')}`;
  const [digest] = await sbInsert('digests', [{ week_start: week, content_md: content }]);
  // Link the digested items to this digest so they're not re-summarized next run.
  for (const id of digestedIds) {
    await sbUpdate(`news_items?id=eq.${id}`, { digest_id: digest.id });
  }

  console.log(`\nDigest written (${sections.length} firm section(s), ${digestedIds.length} items).`);
  console.log('View it in the UI under "Digest".\n');
  console.log(content);
}

// Run only when invoked directly (not when imported by tests).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
