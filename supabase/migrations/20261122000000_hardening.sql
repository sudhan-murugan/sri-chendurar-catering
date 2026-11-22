-- Sri Chendurar Catering – security hardening (production review, 22-11-2026)
-- Additive only: no table/column is removed or renamed; app code unchanged.

-- 1. Trigger functions: empty search_path (every reference is schema-qualified)
--    and not callable through the API by the anon/authenticated roles.
--    Triggers still fire – EXECUTE is only checked when a trigger is created.
alter function public.assert_same_owner() set search_path = '';
alter function public.touch_updated_at() set search_path = '';
revoke execute on function public.assert_same_owner() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;

-- 2. The one reference without an owner check.
create trigger own_etype before insert or update on public.order_expenses
  for each row execute function public.assert_same_owner('expense_types', 'expense_type_id');

-- 3. Size limits on free text / json, so nobody can fill the free 500 MB database.
--    (Names were already limited to 120 characters; the app enforces the same.)
alter table public.ingredients
  add constraint ingredients_text_len check (length(coalesce(name_en, '')) <= 200 and length(coalesce(shop, '')) <= 200);
alter table public.dishes
  add constraint dishes_text_len check (length(coalesce(name_en, '')) <= 200 and length(coalesce(serving_note, '')) <= 200);
alter table public.expense_types
  add constraint expense_types_text_len check (length(name) <= 120);
alter table public.orders
  add constraint orders_text_len check (
    length(customer_name) <= 200 and length(coalesce(phone, '')) <= 40 and length(coalesce(venue, '')) <= 500
    and length(coalesce(venue_map_url, '')) <= 1000 and length(coalesce(event_time, '')) <= 40
    and length(coalesce(notes, '')) <= 2000);
alter table public.order_sessions
  add constraint order_sessions_text_len check (length(coalesce(label, '')) <= 120 and length(coalesce(session_time, '')) <= 40);
alter table public.order_expenses
  add constraint order_expenses_text_len check (length(name) <= 200);
alter table public.payments
  add constraint payments_text_len check (length(coalesce(note, '')) <= 500);
alter table public.shopping_list_checks
  add constraint shopping_list_checks_key_len check (length(list_key) <= 100);
alter table public.order_cost_snapshot
  add constraint order_cost_snapshot_size check (octet_length(lines::text) <= 500000 and octet_length(totals::text) <= 10000);
alter table public.settings
  add constraint settings_text_len check (
    length(business_name) <= 120 and length(coalesce(phone, '')) <= 40
    and length(coalesce(address, '')) <= 500 and octet_length(rounding::text) <= 2000);
