# ஸ்ரீ செந்தூரர் கேட்டரிங் · Sri Chendurar Catering – Cost Calculator

A simple, personal catering cost calculator for your phone (Tamil UI).

1. **Dishes (உணவுகள்)** – for each dish, save the ingredients, quantities and prices
   needed for a reference number of people (normally 100). The dish shows its total cost.
2. **Calculator (கணக்கு)** – for each meal (breakfast / lunch / dinner) enter the number
   of people and tick the dishes. Quantities and costs scale automatically:
   **400 people = exactly 4 × your 100-person recipe.** One page shows the total cost,
   cost per plate, cost of each dish, the combined buying list (the same ingredient
   from several dishes/meals is added once) and each dish's ingredients. Share on WhatsApp.
   Save a menu to compare it with others later – saved menus are re-priced with
   today's prices (saved menus are kept on that phone).
3. **Prices (விலைகள்)** – one list of all ingredient prices. Change the price of rice or
   urad dal once and every dish uses the new price. You can also change a price inside a dish.

Only three tabs at the bottom. Settings (business name, backup, logout) are behind the ⚙ icon.

| Part | What |
|---|---|
| App | Next.js (static export) + TypeScript + Tailwind, installable PWA |
| Data | Saved on the phone first (IndexedDB), then synced to Supabase; works offline |
| Server | Supabase Postgres + Auth + Row Level Security (only you can see your data) |
| Hosting | Vercel (free plan is enough) |
| Money | Stored as whole **paise** (integers) |

Scaling rule ([lib/simple.ts](lib/simple.ts), tested in [tests/calc.test.ts](tests/calc.test.ts)):
`needed quantity = recipe quantity × (people ÷ recipe people)`, with g↔kg and ml↔litre
converted to the unit you buy in. The same ingredient used in several dishes is added
together in the combined list. No hidden wastage or rounding.

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

The app starts **empty** – no sample data. Add your own dishes and prices
(the home screen shows how to start).

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
- **உணவுகள்**: ஒவ்வொரு உணவுக்கும் 100 நபர்களுக்கான பொருட்கள், அளவு, விலை சேமிக்கவும். மொத்த செலவு தானாக வரும்.
- **கணக்கு**: ஒவ்வொரு வேளைக்கும் (காலை / மதியம் / இரவு) நபர்கள் எண்ணிக்கை கொடுத்து உணவுகளைத் தொடவும் – எல்லா அளவுகளும் செலவும் தானாக (100 → 400 = 4 மடங்கு). மெனுவை சேமித்து மற்ற மெனுவுடன் ஒப்பிடலாம்.
- **விலைகள்**: அரிசி, உளுந்து விலை மாறினால் இங்கே ஒருமுறை மாற்றினால் எல்லா உணவுகளிலும் மாறும்.
- **⚙ அமைப்புகள்**: காப்பு (Backup) – வாரம் ஒருமுறை WhatsApp/Drive க்கு அனுப்பவும்.

---

## Backup & restore

**⚙ → காப்பு (Backup)**:
- **காப்பை பகிர்** sends a full JSON backup to WhatsApp / Google Drive (via the phone's share sheet).
- **Excel** download: one sheet per table (prices in rupees).
- **JSON இலிருந்து மீட்டெடு** restores a JSON backup into the same account (rows are merged; nothing is deleted).

## Security

- Single user. Sign-ups are disabled in Supabase; there is no sign-up screen.
- Every table has Row Level Security: `user_id = auth.uid()`. Database triggers
  also stop a row from pointing at another user's data.
- You stay logged in on your phone.
- Deletes are "archive" (soft delete), so nothing is lost by accident.

## Project layout

```
app/            / (dishes), dishes/edit, calculator, ingredients (prices), settings, login
components/     ui, mobile (BottomNav, BottomSheet, StickyActionBar, NumberStepper), Pickers
lib/            simple.ts (scaling), calc.ts + units.ts (engine), db.ts (local store),
                offline-sync.ts, supabase.ts, backup.ts
locales/ta.json all UI text – change wording here
supabase/       migrations (schema + RLS)
tests/          calc.test.ts
```

The database schema still contains tables for orders/combos/payments from the first
version; the app no longer uses them, and they cost nothing while empty.

## Notes

- Page URLs use `?id=` (e.g. `/dishes/edit/?id=…`) so the app can be a fully static, offline-cached site.
- Sync is last-write-wins (fine for one person). Unsynced phone edits are never overwritten by a sync.
- A JSON backup can only be restored into the account that made it.
