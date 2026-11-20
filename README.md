# ஸ்ரீ செந்தூரர் கேட்டரிங் · Sri Chendurar Catering Manager

A personal, mobile-first app for running a South Indian catering business:
ingredient prices, recipes, combos, cost calculator, shopping list, orders,
payments and a dashboard. The whole UI is in Tamil.

You enter **number of people**, pick the **menu**, and keep **ingredient prices**
current. Everything else is calculated automatically, on the phone, even
without internet.

---

## How it works (short)

| Part | What |
|---|---|
| App | Next.js (static export) + TypeScript + Tailwind, installable PWA |
| Data | Saved on the phone first (IndexedDB), then synced to Supabase |
| Offline | Whole app is cached. Edits made offline are queued and sent when back online |
| Server | Supabase Postgres + Auth + Row Level Security (only you can see your data) |
| Hosting | Vercel (free plan is enough) |
| Money | Stored as whole **paise** (integers), never floating point |

Calculation rules are in [lib/calc.ts](lib/calc.ts) and tested in [tests/calc.test.ts](tests/calc.test.ts):

- Recipe quantities are for a reference batch (e.g. 100 people) → scaled to your headcount.
- × portion multiplier (in a combo) × (1 + wastage %). Wastage is per dish, or the default from Settings.
- Units are converted (g ↔ kg, ml ↔ litre), the same ingredient is **combined across all dishes and sessions**, then **rounded up** to a practical size (¼ kg, 50 g, …; change in Settings).
- Ingredient cost = rounded quantity × current price.
- Other expenses: per person, per session, or fixed.
- Suggested price per plate = cost per plate × (1 + margin %), rounded up to the nearest ₹5.
- Profit = selling price (before GST) − total cost. GST is added on top for the customer.

---

## 1. Set up Supabase (one time, ~10 minutes)

1. Go to <https://supabase.com> → **New project**. Choose region **Mumbai (ap-south-1)**. Save the database password somewhere safe.
2. **SQL Editor → New query** → paste the whole file
   [supabase/migrations/20261120000000_init.sql](supabase/migrations/20261120000000_init.sql) → **Run**.
   (Or with the CLI: `npx supabase link` then `npx supabase db push`.)
3. **Authentication → Sign In / Providers → Email**: keep Email enabled, and turn
   **OFF "Allow new users to sign up"**. Nobody else can create an account.
4. **Authentication → Users → Add user → Create new user**: enter your email and a
   strong password, tick **Auto confirm user**. This is your only login.
5. **Project Settings → API**: copy the **Project URL** and the **anon public** key.

Sample data (49 ingredients, 15 recipes, 3 combos, 8 expense types) is added
**automatically** the first time you log in. You do not need to run
[supabase/seed.sql](supabase/seed.sql) — it exists only if you want to load the
sample data from the SQL editor. All sample recipes are marked
**"மாதிரி – உங்கள் அளவுக்கு மாற்றவும்"**: change them to your own quantities.

## 2. Run on your computer (optional)

```bash
npm install
cp .env.example .env.local     # paste your Project URL and anon key
npm run dev                    # http://localhost:3000
npm test                       # calculation tests
```

Without `.env.local` the app runs in **demo mode**: no login, data stays only in
that browser. Useful to try it out.

## 3. Deploy to Vercel

1. Push this folder to a GitHub repository (private is fine).
2. <https://vercel.com> → **Add New → Project** → import the repository.
3. **Environment Variables**: add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. **Deploy**. Build command and output are picked up automatically
   (`npm run build`, static output in `out/`). If Vercel asks, set
   *Output Directory* to `out`.

When you deploy a new version, the app on your phone shows
**"புதிய பதிப்பு தயார் – புதுப்பி"**. Tap it to update.

## 4. Install on your Android phone

1. Open the Vercel link in **Chrome** on your phone.
2. Log in with the email and password from step 1.4.
3. Tap **⋮ (menu) → Add to Home screen / Install app → Install**.
4. The **🪔 செந்தூரர்** icon appears on your home screen. It opens full-screen like a normal app.
5. Open it once while online so everything is saved on the phone. After that it works in airplane mode too.

Tip: long-press the icon for shortcuts: **செலவு கணக்கு**, **புதிய ஆர்டர்**, **விலை மாற்று**.

---

## தமிழில் – எப்படி அமைப்பது

**Supabase (ஒரு முறை மட்டும்)**
1. supabase.com இல் புதிய project உருவாக்கவும் (Region: Mumbai).
2. SQL Editor இல் `supabase/migrations/...init.sql` கோப்பை முழுவதும் ஒட்டி **Run** செய்யவும்.
3. Authentication → Email: **"Allow new users to sign up"** ஐ அணைக்கவும் (வேறு யாரும் கணக்கு தொடங்க முடியாது).
4. Authentication → Users → **Add user**: உங்கள் மின்னஞ்சல், கடவுச்சொல் கொடுத்து **Auto confirm** தேர்வு செய்யவும்.
5. Project Settings → API இலிருந்து **Project URL**, **anon key** நகலெடுக்கவும்.

**Vercel**
1. இந்த project ஐ GitHub இல் போடவும்.
2. vercel.com → New Project → அந்த repository ஐ தேர்வு செய்யவும்.
3. Environment Variables இல் `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` சேர்க்கவும்.
4. **Deploy** அழுத்தவும்.

**போனில் நிறுவுதல் (Android)**
1. Vercel இணைப்பை **Chrome** இல் திறக்கவும்.
2. மின்னஞ்சல், கடவுச்சொல் கொடுத்து உள்நுழையவும்.
3. **⋮ → Add to Home screen / Install app** அழுத்தவும்.
4. முகப்புத் திரையில் **🪔 செந்தூரர்** ஐகான் வரும். அதைத் தொட்டால் app போல முழுத் திரையில் திறக்கும்.
5. ஒருமுறை இணையத்துடன் திறந்தால் போதும் – பிறகு இணையம் இல்லாமலும் கணக்கு, பட்டியல் வேலை செய்யும்.

**தினசரி பயன்பாடு**
- **கணக்கு**: நபர்கள் எண்ணிக்கை → காம்போ தட்டவும் → உடனே அளவு, செலவு, விலை, லாபம்.
- **பொருட்கள் → ₹ விலை மாற்று**: சந்தையில் விலையைத் தட்டி மாற்றவும். உடனே சேமிக்கப்படும்.
- **பட்டியல்**: வாங்கியதைத் தட்டவும் அல்லது வலது பக்கம் தள்ளவும். ₹ பொத்தானில் கொடுத்த தொகை.
- **ஆர்டர்**: 5 படிகளில் புதிய ஆர்டர். "+ பணம் வந்தது" மூலம் பணம் சேர்க்கவும்.
- **மேலும் → காப்பு (Backup)**: வாரம் ஒருமுறை காப்பை WhatsApp/Drive க்கு அனுப்பவும்.

---

## Backup & restore

**மேலும் → காப்பு (Backup)**:
- **காப்பை பகிர்** sends a full JSON backup to WhatsApp / Google Drive (via the phone's share sheet).
- **Excel** download: one sheet per table (prices in rupees). **CSV**: orders only.
- **JSON இலிருந்து மீட்டெடு** restores a JSON backup into the same account (rows are merged; nothing is deleted).

## Security

- Single user. Sign-ups are disabled in Supabase; there is no sign-up screen.
- Every table has Row Level Security: `user_id = auth.uid()`. Database triggers
  also stop a row from pointing at another user's data.
- You stay logged in on your phone. Optional 4-digit **PIN lock**
  (Settings → பாதுகாப்பு) asks for the PIN when the app opens or after 2 minutes in the background.
  The PIN is stored only on that phone (hashed). Forgot it? Tap the link on the lock
  screen. It logs you out, and you log back in with your password.
- Deletes are "archive" (soft delete), so old orders never break.

## Project layout

```
app/            screens: / (dashboard), calculator, orders (list, new wizard, view),
                ingredients, dishes (+edit), combos (+edit), shopping-list, settings, more, login
components/     ui (buttons, fields, chips…), mobile (BottomNav, BottomSheet,
                StickyActionBar, NumberStepper, FAB, SortableList), CalcPanels, Pickers, charts
lib/            calc.ts (engine), units.ts, db.ts (local store), offline-sync.ts,
                supabase.ts, orders.ts, seed.ts, backup.ts, share.ts, bill-image.ts
locales/ta.json all UI text – change wording here
supabase/       migrations (schema + RLS), seed.sql (generated: npm run seed:sql)
tests/          calc.test.ts
scripts/        build-sw.mjs (service worker), gen-seed-sql.ts
```

## Notes

- Page URLs use `?id=` (e.g. `/orders/view/?id=…`) so the app can be a fully static, offline-cached site.
- Sync is last-write-wins (fine for one person). Unsynced phone edits are never overwritten by a sync.
- A JSON backup can only be restored into the account that made it.
