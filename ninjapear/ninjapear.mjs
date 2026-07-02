// LinkedIn/email enrichment adapter, backed by NinjaPear (Nubela).
// The enrich pipeline depends only on the enrichContact() interface, so the
// provider can be swapped or supplemented (Hunter/Apollo) without touching
// enrich.mjs. Full API reference: ninjapear/api-guide.md.
//
// Notes from the guide that shape this implementation:
// - Auth: Bearer NINJA_API_KEY. Paid endpoints: 50 req/min, ~30-60s latency,
//   recommended timeout 100s. 429 => retry with backoff (fetchJSON does this).
// - Work Email (GET /api/v1/employee/work-email): 2 credits on a hit, 0.5 on a
//   miss. Best-effort — may be public or pattern-inferred, no flag saying
//   which, so we store email_status='pattern' (unverified best-effort).
// - NinjaPear is first-party data: it does NOT return LinkedIn URLs. LinkedIn
//   stays sourced from team pages; NinjaPear owns email lookup.

import { fetchJSON } from '../exa.mjs';

export const PROVIDER = 'ninjapear';
const HOST = 'https://nubela.co';

function headers() {
  if (!process.env.NINJA_API_KEY) throw new Error('NINJA_API_KEY not set');
  return { authorization: `Bearer ${process.env.NINJA_API_KEY}` };
}

// "David O. Sacks" -> { first: 'David', last: 'Sacks' }
export function splitName(full) {
  const parts = String(full || '').trim().replace(/\./g, '').split(/\s+/).filter(Boolean);
  return {
    first: parts[0] || '',
    last: parts.length > 1 ? parts[parts.length - 1] : '',
  };
}

// { email, email_status, title, linkedin_url } — fields null when unknown.
export async function enrichContact({ name, firmDomain }) {
  const none = { email: null, email_status: null, title: null, linkedin_url: null };
  const { first, last } = splitName(name);
  if (!first || !firmDomain) return none;
  const qs = new URLSearchParams({ first_name: first, domain: firmDomain });
  if (last) qs.set('last_name', last);
  const data = await fetchJSON(
    `${HOST}/api/v1/employee/work-email?${qs}`,
    { headers: headers() },
    { timeoutMs: 100000 }
  );
  if (!data.work_email) return none;
  return { ...none, email: data.work_email, email_status: 'pattern' };
}

// Resolve a company name to its canonical website (1 credit; 404 = no match).
export async function lookupWebsite(companyName, { countryCode, hint } = {}) {
  const qs = new URLSearchParams({ company_name: companyName });
  if (countryCode) qs.set('country_code', countryCode);
  if (hint) qs.set('hint', hint);
  try {
    const data = await fetchJSON(
      `${HOST}/api/v1/company/website?${qs}`,
      { headers: headers() },
      { timeoutMs: 100000 }
    );
    return data.website || null;
  } catch (err) {
    if (/HTTP 404/.test(err.message)) return null;
    throw err;
  }
}

export async function creditBalance() {
  const data = await fetchJSON(`${HOST}/api/v1/meta/credit-balance`, { headers: headers() });
  return data.credit_balance;
}

// Latest blog posts / X posts / YouTube videos published BY the company
// (2 credits). Returns [{url, title, description, timestamp, source}].
export async function companyUpdates(website) {
  const qs = new URLSearchParams({ website });
  const data = await fetchJSON(
    `${HOST}/api/v1/company/updates?${qs}`,
    { headers: headers() },
    { timeoutMs: 100000 }
  );
  return (data.updates || []).map((u) => ({
    url: u.url,
    title: u.title || '',
    description: u.description || '',
    timestamp: u.timestamp || null,
    source: `ninjapear-${u.source || 'update'}`,
  }));
}
