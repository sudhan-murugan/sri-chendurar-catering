# Sri Chendurar Catering – Infrastructure Research & Production Plan

*Research date: 22-11-2026. Five independent research agents (frontend hosting, backend,
database, security & reliability, migration & lock-in) checked official pricing/docs pages.
Every external number links to its source. Items marked **(unverified)** could not be confirmed
on an official page. Free tiers change – re-check before relying on any single number.*

**Status (22-11-2026): Architecture A approved – Cloudflare Pages + Supabase Free + private GitHub
backup job, free `*.pages.dev` address. Preparation (section 9 A) is done in the code; account setup
(sections 9 B–E) follows the README.**

---

## 1. Existing project – what we are actually hosting

| Item | Finding (from the code) |
|---|---|
| Frontend | Next.js 16.4.6, React 19.3, TypeScript, Tailwind 4. `output: "export"` → **fully static site** (`out/`, ~1.9 MB, ~75 files) + generated service worker (`scripts/build-sw.mjs`). Installable PWA. |
| Backend | **None.** No API routes, no SSR, no server functions. The browser talks directly to the database service. |
| Database | Supabase Postgres via `@supabase/supabase-js` 2.119 (PostgREST over HTTPS). |
| Auth | Supabase Auth, email + password, single user (sign-ups must be disabled in the dashboard). |
| Data protection | Row Level Security on all 15 tables (`user_id = auth.uid()`), FORCE RLS, `anon` revoked, ownership triggers (`supabase/migrations/20261120000000_init.sql`). |
| Offline model | All data kept in IndexedDB on the phone (`lib/db.ts`); outbox pushed / changes pulled every 60 s while open (`lib/offline-sync.ts`). |
| Tables in use | `settings`, `ingredients`, `ingredient_price_history`, `dishes`, `recipe_items`. The other 10 tables (orders, combos …) are unused leftovers – harmless while empty. |
| File storage | **None needed.** The logo is a small (~4–50 KB) data URL in the `settings` row. |
| Device-only data | Saved menus + current calculation in `localStorage` (not synced). |
| Env vars | Only 2, both **public by design**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` – read in exactly one file (`lib/supabase.ts:3-4`), inlined at build time. |
| Provider-specific code | 5 call sites in 3 files: `lib/supabase.ts`, `lib/auth.ts` (signIn/signOut), `lib/offline-sync.ts` (getSession, upsert, select-since). |
| Build | `npm run build` → `out/`. Headers today in `vercel.json` (sw.js `no-cache`, `/_next/static/*` immutable). |
| Repo | `github.com/sudhan-murugan/sri-chendurar-catering` – **public**. No secrets in the tree or git history (checked). |

---

## 2. Research findings (summary of the five agents)

### 2.1 Frontend hosting

| | Vercel Hobby | Netlify Free (credit plan) | **Cloudflare Pages Free** | GitHub Pages | Firebase Hosting Spark |
|---|---|---|---|---|---|
| Type | Permanently free | Permanently free, 300 credits/mo | Permanently free | Permanently free | Permanently free, no card ([pricing](https://firebase.google.com/pricing)) |
| Commercial use | **Not allowed** – "personal or non-commercial use" ([terms §4](https://vercel.com/legal/terms)) | No restriction found (unverified) | No restriction found (unverified) | "Not intended" for businesses ([limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)) | None found (unverified) |
| Bandwidth | 100 GB ([hobby](https://vercel.com/docs/plans/hobby)) | 20 credits / GB | Static requests "free and unlimited" ([docs](https://developers.cloudflare.com/pages/functions/pricing/)) | 100 GB soft | 10 GB/mo vs 360 MB/day – Google's pages disagree |
| Builds | 100 deploys/day | **15 credits per production deploy** ([docs](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/)) | 500 builds/mo ([limits](https://developers.cloudflare.com/pages/platform/limits/)) | Via Actions | Via Actions |
| Custom headers (needed for sw.js) | `vercel.json` | `_headers` | `_headers` ([docs](https://developers.cloudflare.com/pages/configuration/headers/)) | **Not supported** | `firebase.json` |
| Custom domain + SSL | Yes | Yes | Yes (100 domains) | Yes (HTTPS unverified) | Yes (SSL unverified) |
| GitHub auto-deploy + previews | Yes | Yes | Yes | Public repo only | Via GitHub Action |
| Over the limit | Feature paused, no bill | **All sites paused**, never billed | Static traffic uncapped | Soft limit | Site disabled till next month |

**Our usage**: ~50–100 MB/month, ~2–3k requests, ~20 builds. Every host fits easily *except Netlify*
(20 deploys × 15 credits = the whole 300-credit allowance → sites paused).
Note: Cloudflare now steers *new* projects to Workers static assets; Pages is supported but in
maintenance mode – the same `_headers` file works on both ([docs](https://developers.cloudflare.com/workers/static-assets/headers/)).

### 2.2 Backend

**Verdict: no backend is needed.** RLS + the public key is Supabase's intended model
([api-keys](https://supabase.com/docs/guides/api/api-keys)). The only server-side needs are two
**scheduled jobs** (keep-alive and backup), which need a scheduler, not a server:

- **GitHub Actions** scheduled workflow – free; private repos on GitHub Free get included minutes
  (~2,000 Linux min/month; a daily job uses ~60); with no payment method usage is blocked, not billed
  ([billing](https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-github-actions/about-billing-for-github-actions)).
  Scheduled workflows are auto-disabled after 60 days without activity **in public repos**
  ([docs](https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-workflow-runs/disabling-and-enabling-a-workflow))
  → put the job in a **private** repo that it commits to daily.
- Alternatives considered: Cloudflare Workers cron (free, but can't run `pg_dump`), Supabase pg_cron
  (can't move backups off-site), Render/Railway/Fly.io (sleep, trial-only or need a card).

### 2.3 Database

**Supabase Free** ([pricing](https://supabase.com/pricing)) – permanently free, not a trial:
500 MB database, 5 GB egress, 50k MAU, unlimited API requests, 2 active projects, **no backups**,
1-day logs. Over the quota → restricted (read-only / paused), **never billed** on Free
([billing FAQ](https://supabase.com/docs/guides/platform/billing-faq)).

Key facts:
- **Pausing**: paused after low activity over **7 days**; app API calls and dashboard visits count;
  warning e-mail first; one-click **Resume** keeps all data; restorable for 90 days – 1 year (docs disagree)
  ([pausing](https://supabase.com/docs/guides/platform/free-project-pausing)).
- **Backups**: Free plan has **no daily backups and no PITR**; Supabase tells Free users to export
  regularly with `supabase db dump` ([backups](https://supabase.com/docs/guides/platform/backups),
  [CI guide](https://supabase.com/docs/guides/deployment/ci/backups)).
- **⚠ API keys**: legacy `anon` / `service_role` keys are being retired **"by the end of 2026"**
  (≈ 5 weeks away; exact date TBC). Projects *resumed after a pause* already come back without
  legacy keys ([api-keys](https://supabase.com/docs/guides/api/api-keys),
  [migration guide](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys)).
  Fix = put the new **`sb_publishable_…`** key in the env var. Same privileges, RLS unchanged,
  **no code change**.

Alternatives (if we ever must leave Supabase):

| Option | Free tier | Inactivity policy | Backups | Effort to switch |
|---|---|---|---|---|
| **Neon** ([pricing](https://neon.com/pricing)) | 1 GB/project, 5 GB egress, Neon Auth, Data API, no card | Compute sleeps after 5 min, wakes on query; no deletion | 6-h restore window | **Medium, 1–2 days** – PostgREST-style Data API + `auth.uid()`; auth swap |
| Firestore Spark | 1 GiB, 50k reads/day | unverified | unverified | High, 4–7 days (NoSQL rewrite) |
| Cloudflare D1 | 5 GB | unverified | 7-day Time Travel | High (needs Worker + own auth) |
| MongoDB Atlas M0 | 0.5 GB | paused after 30 days idle | preview only | Very high (Data API retired 2025) |
| Turso | 5 GB | unverified | 1-day PITR | High (no auth/RLS) |

### 2.4 Security & reliability

Security is sound: the public key is safe **because** every table has forced RLS; no secrets in the
repo or history; HTTPS everywhere. Findings (none critical):

| Severity | Finding | Fix |
|---|---|---|
| Medium | Sign-ups are **enabled by default** in new Supabase projects. If left on, a stranger can create an account; RLS keeps your data private, but they could fill the 500 MB database. | Disable sign-ups; verify with a test sign-up call. Add length limits on free-text/jsonb columns. |
| Low | `assert_same_owner` uses `search_path = public` (should be `''`); one FK (`order_expenses.expense_type_id`) lacks an owner check. | Small SQL migration (unused table, hygiene only). |
| Low | No security headers (CSP, `X-Content-Type-Options`). | Add via the host headers file. |
| Low | PIN lock is a screen lock only (4 digits, local). | Documented; no change. |

### 2.5 Migration & lock-in

| Dependency | Lock-in |
|---|---|
| Static export, service worker | Portable to any static host |
| Headers (`vercel.json`) | Format differs per host (`_headers` for Cloudflare/Netlify) – generate both |
| supabase-js calls (5 sites, 3 files) | Needs adapter only if leaving Supabase |
| SQL `auth.uid()`, `auth.users` FK, `authenticated` role | Supabase-specific (Neon Data API also supports `auth.uid()`) |
| Triggers, tables, types | Plain Postgres – portable |

A full "adapter layer" is **not worth building now**: provider code is already confined to 3 files,
and the real lock-in is in SQL, which an adapter wouldn't remove.

---

## 3. Usage estimate vs free limits (with safety margin)

Assumptions: 1 user, ~1 hour/day of app use, ~150 ingredients, ~60 dishes, ~600 recipe lines,
~5,000 new price-history rows per year, ~20 deploys/month.

| Resource | Our estimate / month | ×10 safety | Free limit | Headroom |
|---|---|---|---|---|
| Hosting bandwidth (Cloudflare) | ~0.1 GB | 1 GB | unlimited static | ✅ |
| Builds (Cloudflare) | ~20 | 200 | 500 | ✅ |
| DB size (Supabase) | ~3 MB (+1.5 MB/yr) | 30 MB | 500 MB | ✅ 94 % free |
| DB egress (Supabase) | ~120 MB* | 1.2 GB | 5 GB | ✅ |
| API requests | ~27,000 | 270,000 | unlimited | ✅ |
| Auth MAU | 1 | 10 | 50,000 | ✅ |
| GitHub Actions (backup job) | ~60 min | 600 min | ~2,000 min (private) | ✅ |

\* The sync pull re-downloads the newest row of each table every minute (it uses `>=` instead of `>`),
including the logo row. Fine at 1 h/day; if a tab were left open 24 h/day it could reach ~2.5 GB.
A one-line fix (`gt` instead of `gte`) removes this.

---

## 4. Top three architectures

| | **A. Cloudflare Pages + Supabase + GitHub Actions** | B. Vercel Hobby + Supabase + GitHub Actions | C. Firebase Hosting + Supabase + GitHub Actions |
|---|---|---|---|
| Hosting | Cloudflare Pages Free | Vercel Hobby | Firebase Hosting Spark (deployed by an Action) |
| DB/Auth | Supabase Free | Supabase Free | Supabase Free |
| Backup + keep-alive | Daily Action in a private repo | same | same |
| Monthly cost | ₹0 | ₹0 | ₹0 |
| Commercial use OK | ✅ no restriction found | ❌ **forbidden on Hobby** | ✅ none found |
| Bandwidth | unlimited static | 100 GB | ~10 GB (docs conflict) |
| Setup effort | Low (Git integration, `_headers`) | Lowest (already configured) | Medium (deploy via Action, service account secret) |
| Weak points | Pages in "maintenance mode" (Workers assets is the successor, same `_headers`) | ToS risk → account could be disabled | Conflicting quota docs, more moving parts |
| Hidden costs | None on Free (no card needed for Pages, unverified) | Must upgrade to Pro ($20/mo) to be compliant | None (Spark has no billing) |
| Migration away | 1–2 h | 1–2 h | 1–2 h |

### ✅ Winner: **A – Cloudflare Pages + Supabase Free + one private GitHub Actions job**

- No commercial-use restriction (Vercel Hobby forbids it – the main reason Vercel is not chosen).
- Unlimited static bandwidth and 25× our build needs; native GitHub deploys and `_headers`.
- Supabase stays: the app is built on it, usage is < 3 % of every limit, and it is never billed on Free.
- No backend to run; the only "server" piece is one daily scheduled job that both **keeps the database
  awake** and **backs it up off-site** – the two biggest Free-plan risks.

---

## 5. Architecture diagram

```
                ┌──────────────── GitHub (public repo: app code) ────────────────┐
                │  push to main ──► Cloudflare Pages build (npm run build → out/) │
                └────────────────────────────────────────────────────────────────┘
                                          │  deploys static files + _headers
                                          ▼
 ┌───────────── Phone / browser (PWA) ─────────────┐        HTTPS         ┌──────────── Supabase Free ────────────┐
 │  Static app from Cloudflare CDN (cached by SW)  │ ───────────────────► │  Auth (email+password, sign-ups OFF)  │
 │  IndexedDB local copy + outbox (works offline)  │   public key only    │  PostgREST API → Postgres + RLS       │
 │  Excel export (human-readable backup)           │ ◄─────────────────── │  (no backups on Free)                 │
 └─────────────────────────────────────────────────┘                      └───────────────────┬───────────────────┘
          ▲                                                                                   │ session pooler
          │ build-time public vars                                                            │ (DB password = secret)
 ┌────────┴─────────────────────────┐                     ┌─────────────────────────────────────┴──────────────┐
 │ Cloudflare Pages → Env variables │                     │ GitHub (PRIVATE repo: catering-backups)         │
 │  NEXT_PUBLIC_SUPABASE_URL        │                     │  Daily scheduled Action:                        │
 │  NEXT_PUBLIC_SUPABASE_PUBLISHABLE│                     │   1. pg_dump roles+schema+data → commit         │
 │  _KEY                            │                     │   2. this daily query also keeps the DB awake   │
 └──────────────────────────────────┘                     │  Secret: SUPABASE_DB_URL (never in the app)     │
                                                          └─────────────────────────────────────────────────┘
 Monitoring: Supabase dashboard + pause-warning e-mail; GitHub e-mails if the backup job fails;
             in-app sync status (cloud icon / pending count / offline banner).
```

---

## 6. Environment variables

| Variable | Where it lives | Secret? | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Cloudflare Pages → Settings → Variables (Production); `.env.local` for development | No (public) | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | same | No (public, protected by RLS) | New `sb_publishable_…` key (replaces the anon key) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | – | No | Old name – still read as a fallback so nothing breaks during the switch |
| `NEXT_PUBLIC_DEMO_MODE` | development only | No | Must be set to `1` to run without Supabase (prevents an accidental phone-only production build) |
| `SUPABASE_DB_URL` | GitHub **private** backup repo → Settings → Secrets → Actions | **Yes** | Session-pooler connection string used only by the backup job |

Rules:
- Only `NEXT_PUBLIC_*` values reach the browser, and they are safe to be public. The DB password/
  connection string exists **only** as a GitHub secret – never in the app or the public repo.
- `NEXT_PUBLIC_*` values are baked in at build time: **change in the dashboard → redeploy** (no code
  change). The phone gets the new build after tapping "புதுப்பி" (update).
- Development uses `.env.local` (git-ignored); production uses the host dashboard – separate by design.

**Planned code change (small, no business logic):** one `lib/config.ts` that reads these variables,
and a check that **fails the production build** if they are missing. Today a missing variable silently
turns the app into demo mode, storing data only on the phone – the most dangerous finding of the review.

**Updating a key later (e.g. new Supabase key):**
1. Supabase → Project Settings → API Keys → copy the new publishable key.
2. Cloudflare dashboard → Workers & Pages → the project → Settings → Variables and Secrets →
   edit `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Production) → Save.
3. Deployments → Retry/“Create deployment” of the latest commit (rebuild is required).
4. Open the app on the phone → tap **புதுப்பி**. Done – no code change.

---

## 7. Backup & recovery plan

Supabase Free has **no automatic backups**, so we create our own:

| Layer | What | Frequency | Where | Effort |
|---|---|---|---|---|
| 1. Off-site DB dump | `pg_dump` (roles, schema, data) via GitHub Action | **Daily** (git history = every day's version) | Private GitHub repo | Automatic |
| 2. Phone copy | Full IndexedDB copy, works offline | Continuous | The phone | Automatic |
| 3. Human-readable | Excel export (⚙ → காப்பு) to WhatsApp/Drive | Monthly (suggested) | Your Drive | 1 tap |

Size: a few MB per dump; git stores daily changes compactly – years of history fit far below limits.

**Restore (Supabase project lost or deleted):**
1. Create a new Supabase project; disable sign-ups; create your login user.
2. In the backup repo: `psql "<new session-pooler URL>" -f roles.sql -f schema.sql` then
   `psql … -c "SET session_replication_role = replica" -f data.sql`
   ([official guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)).
3. If the new login has a different user id, re-own the rows (one SQL script, documented in the
   migration guide below).
4. Put the new URL + key in Cloudflare → redeploy → on the phone: log out, update, log in.

**Paused project (most likely incident):** Supabase e-mails a warning → open the dashboard →
**Resume project**. Data is kept. (The daily job should prevent this.)

---

## 8. One-year risk assessment

| # | Risk | Likelihood | Impact | Mitigation in the plan |
|---|---|---|---|---|
| 1 | Legacy anon key retired (end of 2026) | **High** | Sync + login stop | Switch to `sb_publishable_…` at deployment |
| 2 | Production build without env vars → silent phone-only data | Medium | Data never reaches the DB | Build fails if vars are missing |
| 3 | Supabase project paused after 7 idle days | Medium | Sync stops (phone data safe) | Daily job activity; warning e-mail; 1-click resume |
| 4 | Supabase data loss (no Free backups) | Low | Severe | Daily off-site dump + phone copy + Excel |
| 5 | One invalid row blocks all later sync | Medium | Edits stay on the phone | Make sync skip/report a failing row (small fix) |
| 6 | Browser clears IndexedDB under storage pressure | Low–Med | Unsynced edits lost | Request persistent storage after login |
| 7 | Sign-ups left enabled → DB filled by a stranger | Low | Sync breaks | Disable sign-ups + verify; column length limits |
| 8 | Vercel commercial-use violation | Medium (if we stayed) | Account disabled | Avoided by choosing Cloudflare |
| 9 | Provider changes free tier | Low–Med | Varies | Provider-neutral static build; documented 1–2 h host switch |
| 10 | Phone lost with unsynced edits | Low | Recent edits lost | Sync is automatic every minute when online |
| 11 | Saved menus only on the phone | Medium | Saved menus lost with phone | Accepted for now (optional: sync them later) |
| 12 | Old app version on phone after a schema change | Low | Sync errors | Additive-only DB changes; update prompt |

No free plan offers an uptime guarantee. Downtime is still possible; with the phone-first design the
calculator keeps working offline even when a provider is down.

---

## 9. Deployment checklist (after approval)

**A. Prepare (code, no business-logic changes)**
- [x] `lib/config.ts` + build fails without required vars or with a secret key; explicit `NEXT_PUBLIC_DEMO_MODE` (demo banner stays removed as requested)
- [x] Publishable-key variable (with anon-key fallback); update `.env.example` with descriptions
- [x] Generate `out/_headers` (sw.js no-cache, static immutable, `X-Content-Type-Options`, `Referrer-Policy`); keep `vercel.json`
- [x] Sync: `gt` instead of `gte`; a failing row must not block the others
- [x] Request persistent storage after login
- [x] SQL hardening migration (search_path, owner check, text/jsonb length limits)
- [x] README: remove stale JSON-restore line; deployment + update-key steps

**B. Supabase**
- [ ] Create project (region: Mumbai), run migrations
- [ ] Auth: disable sign-ups, keep e-mail confirmation, create the owner user, min password length 12
- [ ] API Keys: create publishable key; after verification, disable legacy keys
- [ ] Verify a sign-up attempt with the public key is rejected

**C. Backups (private repo)**
- [ ] Create private repo `sri-chendurar-backups` and copy `ops/backup-repo/` into it (workflow, `backup.sh`, `restore.sh` – tested locally against Postgres)
- [ ] Add secret `SUPABASE_DB_URL` (session pooler, port 5432)
- [ ] Run once manually; confirm dump files committed

**D. Hosting**
- [ ] Cloudflare Pages: connect GitHub repo; build `npm run build`, output `out`, Node 20+
- [ ] Production variables: URL + publishable key → deploy
- [ ] Optional custom domain (free SSL automatic)

**E. Verify**
- [ ] Login; add/edit/delete dish and ingredient; calculator scenarios; prices
- [ ] Reload + second device → data persists from the server
- [ ] Airplane mode works; edits sync after reconnect
- [ ] Install to Android home screen
- [ ] Restore test: load the latest dump into a scratch database and compare row counts

---

## 10. Future provider migration guide (short)

| Move | Steps | Effort |
|---|---|---|
| Change a key / credential | Dashboard → edit variable → redeploy → tap update on phone | 5 min |
| Cloudflare → Netlify / Vercel / Workers | Connect repo, same build + output, copy variables, move domain | 1–2 h |
| New Supabase project (same provider) | Sync phone (pending = 0) → restore dump into new project → update URL + key → redeploy → phone: log out, update, log in | 2–4 h |
| Supabase → Neon | Neon Data API (PostgREST-style) + Neon Auth; change `lib/supabase.ts`, `lib/auth.ts`, sync calls; adjust `auth.users` FKs | 1–2 days |
| Supabase → own server/DB | Write a small API for login, upsert, pull | 3–5 days |

**Before any switch that changes the app's web address:** make sure the phone shows no pending
changes, because the local copy belongs to the old address. A custom domain avoids this – switching
hosts then only changes DNS.
