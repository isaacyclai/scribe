# Parliament Summarizer - Architecture Analysis & Improvement Plan

## Current Architecture Overview

### The 4-Step Pipeline (Confirmed)

Your friend's codebase indeed follows the 4-step pattern you identified:

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. DATA FETCHING (python/hansard_api.py)                        │
│    Source: https://sprs.parl.gov.sg/search/getHansardReport/    │
│    Method: HTTP POST with sittingDate=DD-MM-YYYY               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│ 2. LLM SUMMARIES (python/generate_summaries.py)                 │
│    Provider: Groq API (Llama 3.1 8B)                           │
│    Rate limited: 30 RPM, 2.5s cooldown                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│ 3. PROCESSING (python/parliament_session.py, batch_process.py)  │
│    - Parse attendance (present/absent MPs)                      │
│    - Extract sections (OA, WA, BI, BP, OS, WS)                 │
│    - Match speakers to members via regex                        │
│    - Link bills across readings                                 │
│    - Detect ministries from content/speaker designation        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│ 4. INTERFACE (Next.js 16 + Supabase)                           │
│    - Hybrid SSR/CSR rendering                                  │
│    - PostgreSQL on Supabase (remote)                           │
│    - API routes for detail pages                               │
└─────────────────────────────────────────────────────────────────┘
```

### Key Data Entities

| Entity | Description |
|--------|-------------|
| Sessions | Parliament sitting dates with metadata |
| Members | MP identities (name-based, immutable) |
| Sections | Questions, bills, motions with HTML content |
| Bills | Unified bill tracking across first/second readings |
| Ministries | 17 Singapore ministries (pre-seeded) |
| Section Speakers | Junction: sections ↔ members (with snapshot data) |
| Session Attendance | Presence tracking with constituency/designation |

### Current Performance Bottlenecks

The 3s RTT you mentioned is caused by:

1. **Client-side detail pages** - waterfall requests after component mount
2. **5 sequential DB queries** per session detail page
3. **Complex nested subqueries** for member pages (4+ levels deep)
4. **Network latency** - every page view hits Supabase over the internet
5. **Client-side pagination** - loads LIMIT 1000 rows, then slices in JS

---

## Proposed Architecture: Static Site with Astro + SQLite

### Can Astro Generate Static HTML from SQLite?

**Yes, absolutely.** Astro is ideal for this use case:

- **Build-time data fetching**: Query SQLite during `astro build`, generate static HTML
- **Zero JS by default**: Pages ship as pure HTML/CSS unless you add interactivity
- **Content Collections**: First-class support for structured content
- **Islands Architecture**: Add React/Vue components only where needed
- **File-based routing**: Similar to Next.js App Router

### 100x Improvement: 3000ms → 30ms

| Current | Proposed | Improvement |
|---------|----------|-------------|
| 3000ms Supabase RTT | 0ms (static HTML) | ∞ |
| 5 DB round-trips | Build-time queries | 5x fewer connections |
| Client JS hydration | Zero JS pages | Smaller bundle |
| Edge → Supabase → Edge | Edge CDN direct | ~30ms global |

**Result**: Pre-built HTML served from CDN edge = ~30ms TTFB globally

### Proposed New Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. DATA FETCHING (python/hansard_api.py) - LOCAL               │
│    Same Hansard API, run locally                               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│ 2. PROCESSING (python/) - LOCAL                                 │
│    Same parsing logic, output to SQLite instead of Supabase    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│ 3. LOCAL SQLITE DATABASE                                        │
│    - No network latency                                        │
│    - Single file, easy to version/backup                       │
│    - better-sqlite3 for sync queries in Astro                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│ 4. ASTRO BUILD (Static Site Generation)                        │
│    - Query SQLite at build time                                │
│    - Generate HTML for every session, member, bill, question   │
│    - Search via client-side JSON index (Pagefind/Fuse.js)     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│ 5. DEPLOY (Cloudflare Pages / Vercel / Netlify)                │
│    - Static files served from CDN edge                         │
│    - ~30ms TTFB globally                                       │
└─────────────────────────────────────────────────────────────────┘
```

### LLM Summaries: Placeholder Strategy

For local development without summaries:

```python
# In batch_process.py or generate_summaries.py
summary = "[Summary pending]"  # Placeholder instead of Groq API call
```

Later, summaries can be generated in batch and stored in SQLite.

---

## Key Files to Modify/Create

### Python Layer (Data Fetching + Processing)
- `python/db_sqlite.py` (NEW) - SQLite version of db_async.py
- `python/batch_process.py` - Modify to support SQLite output
- `python/schema.sql` (NEW) - SQLite-compatible schema

### Astro Layer (Interface)
- `astro/src/pages/` - Static pages for sessions, members, bills, questions
- `astro/src/lib/db.ts` - better-sqlite3 wrapper
- `astro/src/content/` - Optional: content collections for static data

### Search Strategy
Options for client-side search on static sites:
1. **Pagefind** - Built for static sites, generates search index at build
2. **Fuse.js** - Client-side fuzzy search on JSON
3. **Pre-built filter pages** - Generate `/bills?ministry=MOE` as static pages

---

## Decisions Made

- **Scope**: Full rewrite to Astro (replace Next.js entirely)
- **Search**: Essential - will use Pagefind for client-side full-text search
- **Updates**: Monthly or less - manual rebuilds are fine

---

## Implementation Roadmap

We'll tackle this incrementally, one issue at a time:

### Phase 1: Local Data Pipeline (No LLM)
1. Create SQLite schema mirroring current PostgreSQL structure
2. Modify Python scripts to output to SQLite instead of Supabase
3. Add placeholder summaries (skip Groq API calls)
4. Test: Fetch a few sessions locally, verify data in SQLite

### Phase 2: Astro Static Site Foundation
1. Initialize Astro project with TypeScript
2. Set up better-sqlite3 for build-time queries
3. Create base layout and components (Navbar, cards, etc.)
4. Build core pages: `/`, `/sessions`, `/sessions/[id]`

### Phase 3: Complete Page Migration
1. Members pages: `/members`, `/members/[id]`
2. Bills pages: `/bills`, `/bills/[id]`
3. Questions pages: `/questions`, `/questions/[id]`
4. Motions pages: `/motions`
5. Ministries and about pages

### Phase 4: Search with Pagefind
1. Install and configure Pagefind
2. Add search indexing at build time
3. Implement search UI component
4. Test full-text search across all content types

### Phase 5: Polish and Deploy
1. Styling refinements (Tailwind)
2. Performance audit (Lighthouse)
3. Deploy to Cloudflare Pages/Vercel
4. Document rebuild process

---

## Verification

After each phase:
- **Phase 1**: Run `sqlite3 data.db "SELECT COUNT(*) FROM sessions"` to verify data
- **Phase 2**: Run `npm run build && npm run preview` to test static site
- **Phase 3**: Navigate all pages, check data renders correctly
- **Phase 4**: Test search for MP names, bill titles, question content
- **Phase 5**: Lighthouse score >90, TTFB <100ms from CDN
