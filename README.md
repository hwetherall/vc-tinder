# vc-tinder

Innovera's Series A raise engine: find VC targets, score them against our
rubric, enrich them, and export an Attio-ready list. Zero-dependency Node,
backed by Supabase (project `vc-tinder` on the Innovera org).

## Run

```bash
node server.mjs               # swipe/board UI at http://localhost:5173
node discover.mjs --dry-run   # find new candidate firms (Exa) — print only
node discover.mjs             # score candidates, write to Supabase
node enrich.mjs --dry-run     # enrichment work list (facts, deals, contacts, emails)
node enrich.mjs               # enrich tier 1-2 firms (see --stages/--tiers/--source/--firm)
node monitor.mjs              # sweep news for watched firms + write weekly digest
node signal-ingest.mjs <url>  # ingest a Signal NFX investor profile (URL or saved .html)
node export.mjs               # Attio-ready companies + people CSVs into exports/
node import-connections.mjs   # import harrys-connections.md (research + score new firms)
node import-csv.mjs           # one-time CSV import (idempotent, safe to re-run)
node --test                   # tests
```

## Setup

`.env` (gitignored) needs:

```
EXA_API_KEY=          # discovery + evidence
OPENROUTER_API_KEY=   # scoring + enrichment extraction
SUPABASE_URL=         # https://<ref>.supabase.co
SUPABASE_KEY=         # anon key; fine while local-only (see RLS note in the schema)
NINJA_API_KEY=        # NinjaPear (nubela.co) — work-email lookup; credit-metered
```

NinjaPear API reference lives in `ninjapear/api-guide.md`; the adapter
(`ninjapear/ninjapear.mjs`) is the only file that talks to it.

## Data

Supabase is the system of record. Tables mirror Attio's shape so export is an
upsert, not a translation: `firms` (spine → Attio Company), `contacts`
(→ Attio Person), plus `deals`, `news_items`, and `digests` for the
Enrich/Monitor pipeline stages. The Happenstance CSV in this folder is the
frozen import source, not live data.
