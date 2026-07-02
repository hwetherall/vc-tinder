# vc-tinder

Innovera's Series A raise engine: find VC targets, score them against our
rubric, enrich them, and export an Attio-ready list. Zero-dependency Node,
backed by Supabase (project `vc-tinder` on the Innovera org).

## Run

```bash
node server.mjs               # UI at http://localhost:5173 (PORT env overrides)
node importer.mjs <file.csv>  # import any target-list CSV (or use the ⬆ Upload view)
node score.mjs                # score all unscored firms (concurrent, restart-safe)
node discover.mjs --dry-run   # find new candidate firms (Exa) — print only
node discover.mjs             # score candidates, write to Supabase
node enrich.mjs --dry-run     # enrichment work list (facts, deals, contacts, emails)
node enrich.mjs               # enrich tier 1-2 firms (see --stages/--tiers/--source/--firm)
node monitor.mjs              # sweep news for watched firms + write weekly digest
node signal-ingest.mjs <url>  # ingest a Signal NFX investor profile (URL or saved .html)
node export.mjs               # Attio-ready companies + people CSVs into exports/
node import-connections.mjs   # import harrys-connections.md (research + score new firms)
node --test                   # tests
```

## New-list flow (fresh Happenstance export)

Upload the CSV in the **⬆ Upload** view (or `node importer.mjs file.csv`) →
click **Score** (or `node score.mjs`) → triage in Swipe/Board → `node enrich.mjs
--tiers 1,2` then `--stages emails --tiers 1,2` → `node export.mjs` for the
Attio-ready output. A full database backup lives in `backups/` (gitignored).

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
