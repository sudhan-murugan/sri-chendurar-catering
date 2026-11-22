#!/usr/bin/env bash
# Restore a backup into a (new) Supabase project.
# 1. Create the project, run the app repo's supabase/migrations/*.sql in order (SQL editor or psql).
# 2. Create your login user (Authentication → Users → Add user), disable sign-ups.
# 3. Run:  TARGET_DB_URL='postgresql://…' ./restore.sh backup [NEW_USER_ID]
#    NEW_USER_ID = the "User UID" of the login created in step 2. If omitted,
#    rows keep the owner id they had in the backup (first line of users.csv).
set -euo pipefail
DIR="${1:-backup}"
NEW_ID="${2:-}"
: "${TARGET_DB_URL:?Set TARGET_DB_URL to the session pooler connection string of the new project}"
PSQL="${PSQL:-psql}"
OLD_ID="$(head -n1 "$DIR/users.csv" | cut -d, -f1)"
NEW_ID="${NEW_ID:-$OLD_ID}"

reown_sql() {
  # move every row from the old login to the new one
  cat <<SQL
do \$\$
declare t text;
begin
  for t in select table_name from information_schema.columns
           where table_schema = 'public' and column_name = 'user_id' and table_name <> 'settings' loop
    execute format('update public.%I set user_id = %L where user_id = %L', t, '$NEW_ID', '$OLD_ID');
  end loop;
  -- settings: one row per login, its id must equal user_id, so change both together
  update public.settings set id = '$NEW_ID', user_id = '$NEW_ID' where user_id = '$OLD_ID';
end
\$\$;
SQL
}

{
  echo "begin;"
  echo "set session_replication_role = replica; -- load without firing triggers"
  cat "$DIR/data.sql"
  if [ "$NEW_ID" != "$OLD_ID" ]; then reown_sql; fi
  echo "commit;"
} | "$PSQL" "$TARGET_DB_URL" -v ON_ERROR_STOP=1 -q > /dev/null

COUNT_SQL="select table_name, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', table_name), false, true, '')))[1]::text from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name"
echo "Restored. Row counts now (compare with $DIR/row-counts.csv):"
"$PSQL" "$TARGET_DB_URL" -At -F ',' -c "$COUNT_SQL"
