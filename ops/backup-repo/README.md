# Sri Chendurar Catering – database backups (PRIVATE repository)

Copy the contents of this folder into a new **private** GitHub repository
(e.g. `sri-chendurar-backups`). A GitHub Action then backs up the Supabase
database every day at 02:00 India time and commits it to `backup/`. Git history
keeps every day's version. The same daily request keeps the free Supabase
project from pausing.

## One-time setup
1. GitHub → New repository → name `sri-chendurar-backups` → **Private** → Create.
2. Upload these files (keep the `.github/workflows` folder).
3. Repository → Settings → Secrets and variables → Actions:
   - **Secrets** → New secret `SUPABASE_DB_URL` = Supabase → **Connect** → *Session pooler*
     connection string (port 5432), with your database password filled in.
   - **Variables** → `SUPABASE_URL` = `https://<ref>.supabase.co`,
     `SUPABASE_PUBLISHABLE_KEY` = `sb_publishable_…`
4. Actions tab → *Daily database backup* → **Run workflow** → check that a `backup/` folder appears.

GitHub e-mails you if a scheduled backup fails.

## What is in `backup/`
| File | Contents |
|---|---|
| `data.sql` | All rows of all app tables (one INSERT per row) |
| `schema.sql` | Table definitions snapshot (reference) |
| `users.csv` | Login id + e-mail (no passwords) |
| `row-counts.csv` | Rows per table, to verify a restore |
| `last-run.txt` | Time of the last backup |

## Restore (new Supabase project)
1. Create the project; run the app repo's `supabase/migrations/*.sql` in order.
2. Authentication → disable sign-ups → Users → **Add user** (your e-mail) → copy its **User UID**.
3. Copy the new project's *Session pooler* connection string, then on any computer with `psql`:
   ```bash
   TARGET_DB_URL='postgresql://…' ./restore.sh backup <new-user-uid>
   ```
   Compare the printed row counts with `backup/row-counts.csv`.
4. In Cloudflare Pages update `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   → redeploy. On the phone: ⚙ → Log out → tap **புதுப்பி** if shown → log in.
5. Update `SUPABASE_DB_URL` (secret) and the two variables here for the new project.
