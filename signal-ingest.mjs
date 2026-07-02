// VC Tinder — Signal NFX ingestion.
// Turns a Signal investor profile (https://signal.nfx.com/investors/<slug>,
// or a saved copy of that page) into database records: investor facts onto the
// matching contact, fund size onto the firm, and the investments-on-record
// list into deals — including co-investors, which feed Network scoring.
//
// Signal profiles are publicly served (verified 2026-07-02), so both forms work:
//   node signal-ingest.mjs https://signal.nfx.com/investors/matt-weigand
//   node signal-ingest.mjs saved-page.html [more urls/files...] [--dry-run]
//
// Requires: OPENROUTER_API_KEY, SUPABASE_URL, SUPABASE_KEY.
// Optional: SIGNAL_MODEL (default anthropic/claude-sonnet-5).

import fs from 'fs';
import { pathToFileURL } from 'url';
import { loadEnv, sbSelect, sbInsert, sbUpdate } from './db.mjs';
import { chatJSON } from './llm.mjs';
import { normalizeName } from './discover.mjs';
import { dealKey } from './enrich.mjs';

const SIGNAL_MODEL = process.env.SIGNAL_MODEL || 'anthropic/claude-sonnet-5';

/* ------------------------------------------------------------------ */
/* Pure helpers (exported for tests)                                   */
/* ------------------------------------------------------------------ */

// Strip a full HTML page down to readable text (no DOM parser needed).
export function htmlToText(raw) {
  let s = String(raw || '')
    .replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

// "Dec 2024" -> "2024-12-01" (Signal only gives month granularity).
const MONTHS = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
export function monthToIso(s) {
  const m = String(s || '').trim().match(/^([A-Za-z]{3})[a-z]*\s+(\d{4})$/);
  if (!m) return null;
  const mm = MONTHS[m[1].toLowerCase()];
  return mm ? `${m[2]}-${mm}-01` : null;
}

// Co-investor objects -> one storable string: "Jane Doe (Firm), ...".
export function coInvestorsCell(list) {
  return (list || [])
    .map((c) => (c.firm ? `${c.name} (${c.firm})` : c.name))
    .filter(Boolean)
    .join(', ');
}

/* ------------------------------------------------------------------ */
/* Extraction                                                          */
/* ------------------------------------------------------------------ */

async function extractProfile(text) {
  const start = text.indexOf('Investing Profile');
  const focused = (start > -1 ? text.slice(start) : text).slice(0, 14000);
  return chatJSON(
    `Below is the text of a Signal (signal.nfx.com) investor profile page. ` +
    `Extract the investor's data. Use null for anything not stated. No markdown fences.\n\n` +
    `${focused}\n\n` +
    `Return ONLY this JSON:\n` +
    `{"investor":{"name":"...","title":"<e.g. Partner>","firm":"<firm name>",` +
    `"location":"..."|null,"profile_url":"<their page on the firm site>"|null,` +
    `"investment_range":"<e.g. $15.0M - $70.0M>"|null,"sweet_spot":"<e.g. $25.0M>"|null,` +
    `"fund_size":"<current fund size, e.g. $18.3B>"|null,` +
    `"rankings":["<sector (stage)>", ...]},` +
    `"deals":[{"company":"...","stage":"<e.g. Series C>","date":"<e.g. Apr 2022>"|null,` +
    `"round_size":"<e.g. $110M>"|null,"total_raised":"<e.g. $220M>"|null,` +
    `"co_investors":[{"name":"...","firm":"..."}]}]}\n` +
    `List each funding round a company appears with as its own deal entry.`,
    { model: SIGNAL_MODEL, maxTokens: 8000 }
  );
}

// One retry: a truncated/malformed JSON response is usually fixed by re-asking.
async function extractProfileWithRetry(text) {
  try {
    return await extractProfile(text);
  } catch (err) {
    console.log(`    (extraction retry: ${err.message.slice(0, 80)})`);
    return extractProfile(text);
  }
}

/* ------------------------------------------------------------------ */
/* Ingestion                                                           */
/* ------------------------------------------------------------------ */

async function readSource(src) {
  if (/^https?:\/\//.test(src)) {
    const res = await fetch(src, {
      headers: { 'user-agent': 'Mozilla/5.0 (Macintosh) vc-tinder/1.0' },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${src}`);
    return { raw: await res.text(), url: src };
  }
  return { raw: fs.readFileSync(src, 'utf8'), url: null };
}

function investorNotes(inv) {
  const bits = [];
  if (inv.investment_range) bits.push(`invests ${inv.investment_range}`);
  if (inv.sweet_spot) bits.push(`sweet spot ${inv.sweet_spot}`);
  if (inv.rankings && inv.rankings.length) bits.push(`ranked: ${inv.rankings.join(', ')}`);
  return bits.length ? `Signal: ${bits.join('; ')}` : null;
}

async function ingest(src, dryRun) {
  const { raw, url } = await readSource(src);
  const text = htmlToText(raw);
  if (!text.includes('Investing Profile')) {
    throw new Error('page does not look like a Signal investor profile');
  }
  const { investor, deals } = await extractProfileWithRetry(text);
  if (!investor || !investor.name || !investor.firm) throw new Error('extraction returned no investor/firm');

  console.log(`  ${investor.name} — ${investor.title || '?'} @ ${investor.firm}`);
  console.log(`    range ${investor.investment_range || '?'} · sweet spot ${investor.sweet_spot || '?'} · fund ${investor.fund_size || '?'} · ${(deals || []).length} deals`);
  if (dryRun) return;

  // Firm: match by normalized name; create a minimal row if it's new to us.
  const key = normalizeName(investor.firm);
  let [firm] = await sbSelect(`firms?normalized_name=eq.${encodeURIComponent(key)}&select=id,name,fund_size`);
  if (!firm) {
    [firm] = await sbInsert('firms', [{
      name: investor.firm,
      normalized_name: key,
      proximity: 'Cold (signal)',
      tier_label: 'TBD',
      status: `Added via Signal ingest (${investor.name}) — needs scoring`,
      source: 'signal',
    }], { onConflict: 'normalized_name' });
    console.log(`    created new firm: ${investor.firm}`);
  }
  if (!firm.fund_size && investor.fund_size) {
    await sbUpdate(`firms?id=eq.${firm.id}`, { fund_size: investor.fund_size });
  }

  // Contact: upsert, then fill investor-level facts.
  await sbInsert('contacts', [{ firm_id: firm.id, name: investor.name, source: 'signal' }], { onConflict: 'firm_id,name' });
  const [contact] = await sbSelect(`contacts?firm_id=eq.${firm.id}&name=eq.${encodeURIComponent(investor.name)}&select=id,title`);
  const patch = { notes: investorNotes(investor), signal_url: url };
  if (!contact.title && investor.title) patch.title = investor.title;
  await sbUpdate(`contacts?id=eq.${contact.id}`, patch);

  // Deals: dedupe against what we already hold (stage doubles as round key).
  const existing = await sbSelect(`deals?firm_id=eq.${firm.id}&select=company,round`);
  const seen = new Set(existing.map(dealKey));
  const fresh = (deals || [])
    .filter((d) => d.company)
    .map((d) => ({
      firm_id: firm.id,
      company: String(d.company),
      round: d.stage || 'unknown',
      amount: d.round_size || null,
      role: 'unknown',
      announced_on: monthToIso(d.date),
      source: 'signal',
      via_contact: investor.name,
      co_investors: coInvestorsCell(d.co_investors) || null,
    }))
    .filter((d) => !seen.has(dealKey(d)));
  if (fresh.length) await sbInsert('deals', fresh);
  console.log(`    stored: contact updated, ${fresh.length} new deal(s)`);
}

async function main() {
  loadEnv();
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const sources = argv.filter((a) => !a.startsWith('--'));
  if (sources.length === 0) {
    console.error('Usage: node signal-ingest.mjs <signal-url-or-saved-html> [...] [--dry-run]');
    process.exit(1);
  }
  for (const src of sources) {
    console.log(`Ingesting ${src} ...`);
    try {
      await ingest(src, dryRun);
    } catch (err) {
      console.error(`  ! failed: ${err.message}`);
    }
  }
}

// Run only when invoked directly (not when imported by tests).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
