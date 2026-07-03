// Exa API access + the shared retrying fetch. Split out of discover.mjs so the
// enrich pipeline and importers use the same plumbing. Zero-dep, built-in fetch.

export async function fetchJSON(url, opts, { tries = 3, timeoutMs = 30000 } = {}) {
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
        // A malformed 200 body won't get better on retry — and retrying a paid
        // model call would re-charge tokens. Treat as fatal.
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

function exaHeaders() {
  if (!process.env.EXA_API_KEY) throw new Error('EXA_API_KEY not set');
  return { 'content-type': 'application/json', 'x-api-key': process.env.EXA_API_KEY };
}

export async function exaFindSimilar(anchorUrl, numResults = 8) {
  const data = await fetchJSON('https://api.exa.ai/findSimilar', {
    method: 'POST',
    headers: exaHeaders(),
    body: JSON.stringify({
      url: anchorUrl,
      numResults,
      excludeSourceDomain: true,
      category: 'company',
    }),
  });
  return (data.results || []).map((r) => ({ url: r.url, title: r.title || '' }));
}

export async function exaSearch(query, { numResults = 8, category = 'company', includeDomains } = {}) {
  const body = { query, numResults, category, type: 'auto' };
  if (includeDomains) body.includeDomains = includeDomains;
  const data = await fetchJSON('https://api.exa.ai/search', {
    method: 'POST',
    headers: exaHeaders(),
    body: JSON.stringify(body),
  });
  return (data.results || []).map((r) => ({ url: r.url, title: r.title || '' }));
}

// Search with snippets in one call — used by the deals/monitor/scoring stages.
// Defaults to news; pass category: null for a general web search with contents.
// Returns [{url, title, publishedDate, text}].
export async function exaSearchNews(query, { numResults = 10, startPublishedDate, category = 'news' } = {}) {
  const body = {
    query,
    numResults,
    type: 'auto',
    contents: { text: { maxCharacters: 1500 } },
  };
  if (category) body.category = category;
  if (startPublishedDate) body.startPublishedDate = startPublishedDate;
  const data = await fetchJSON('https://api.exa.ai/search', {
    method: 'POST',
    headers: exaHeaders(),
    body: JSON.stringify(body),
  });
  return (data.results || []).map((r) => ({
    url: r.url,
    title: r.title || '',
    publishedDate: r.publishedDate || null,
    text: r.text || '',
  }));
}

export async function exaContents(url, maxCharacters = 4000) {
  const data = await fetchJSON('https://api.exa.ai/contents', {
    method: 'POST',
    headers: exaHeaders(),
    body: JSON.stringify({ urls: [url], text: { maxCharacters } }),
  });
  const r = (data.results || [])[0] || {};
  return { title: r.title || '', text: r.text || '' };
}
