#!/usr/bin/env bash
# Sri Chendurar Catering – database backup (run daily by GitHub Actions).
# Usage:  SUPABASE_DB_URL='postgresql://…' ./backup.sh [output-dir]
# Uses the Supabase *session pooler* connection string (IPv4, port 5432).
set -euo pipefail
OUT="${1:-backup}"
: "${SUPABASE_DB_URL:?Set SUPABASE_DB_URL (Supabase → Connect → Session pooler)}"
PG_DUMP="${PG_DUMP:-pg_dump}"
PSQL="${PSQL:-psql}"
mkdir -p "$OUT"

# 1. Your data: every table in the app's schema, one INSERT per row (easy to read and diff).
"$PG_DUMP" "$SUPABASE_DB_URL" --schema=public --data-only --column-inserts --rows-per-insert=1 \
  --no-owner --no-privileges -f "$OUT/data.sql"

# 2. Schema snapshot for reference (the app repo's supabase/migrations are the source of truth).
"$PG_DUMP" "$SUPABASE_DB_URL" --schema=public --schema-only --no-owner --no-privileges -f "$OUT/schema.sql"

# 3. Login account(s): id + e-mail, needed to re-own rows after a restore. No passwords.
"$PSQL" "$SUPABASE_DB_URL" -At -F ',' -c "select id, email from auth.users order by created_at" > "$OUT/users.csv"

# 4. Row counts – a quick integrity check after a restore.
"$PSQL" "$SUPABASE_DB_URL" -At -F ',' -c "
  select table_name,
         (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', table_name), false, true, '')))[1]::text
  from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE'
  order by table_name" > "$OUT/row-counts.csv"

date -u +%Y-%m-%dT%H:%M:%SZ > "$OUT/last-run.txt"
echo "Backup written to $OUT/ ($(wc -l < "$OUT/data.sql") lines of data)"
