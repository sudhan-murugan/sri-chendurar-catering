-- Sri Chendurar Catering – initial schema
-- Money: integer paise (bigint). Quantities: numeric. Never float.
-- Every table: id, user_id, created_at, updated_at, archived (soft delete).
-- Row Level Security: only the owner (auth.uid()) can read/write.
-- IDs are generated on the phone (uuid) so records can be created offline.

create extension if not exists pgcrypto;

-- updated_at is always set by the server so the app can pull "what changed since X".
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;

-- ---------------------------------------------------------------- ingredients
create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name_ta text not null check (length(name_ta) between 1 and 120),
  name_en text,
  category text not null default 'other'
    check (category in ('grains','vegetables','spices','oil','dairy','grocery','other')),
  unit text not null check (unit in ('kg','g','l','ml','count','bundle','packet')),
  price_paise bigint not null default 0 check (price_paise >= 0),
  shop text,
  price_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived boolean not null default false
);

create table public.ingredient_price_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  price_paise bigint not null check (price_paise >= 0),
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived boolean not null default false
);

-- ---------------------------------------------------------------- dishes
create table public.dishes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name_ta text not null check (length(name_ta) between 1 and 120),
  name_en text,
  batch_size integer not null default 100 check (batch_size > 0),
  serving_note text,            -- e.g. "3 இட்லி / நபர்"
  wastage_pct numeric(5,2) check (wastage_pct between 0 and 100), -- null = settings default
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived boolean not null default false
);

create table public.recipe_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  dish_id uuid not null references public.dishes(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id),
  qty numeric(12,3) not null check (qty >= 0),
  unit text not null check (unit in ('kg','g','l','ml','count','bundle','packet')),
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived boolean not null default false
);

-- ---------------------------------------------------------------- combos
create table public.combos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  meal text not null default 'lunch' check (meal in ('breakfast','lunch','dinner','other')),
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived boolean not null default false
);

create table public.combo_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  combo_id uuid not null references public.combos(id) on delete cascade,
  dish_id uuid not null references public.dishes(id),
  multiplier numeric(6,3) not null default 1 check (multiplier > 0),
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived boolean not null default false
);

-- ---------------------------------------------------------------- expenses
create table public.expense_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  mode text not null check (mode in ('per_person','per_session','fixed')),
  rate_paise bigint not null default 0 check (rate_paise >= 0),
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived boolean not null default false
);

-- ---------------------------------------------------------------- orders
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  customer_name text not null,
  phone text,
  event_type text not null default 'other'
    check (event_type in ('wedding','birthday','home','office','other')),
  venue text,
  venue_map_url text,
  order_date date not null default current_date,
  event_date date not null,
  event_time text,
  status text not null default 'enquiry'
    check (status in ('enquiry','confirmed','completed','cancelled')),
  margin_pct numeric(6,2) not null default 30,
  gst_pct numeric(5,2) not null default 0,
  price_per_plate_paise bigint not null default 0,
  order_amount_paise bigint not null default 0,      -- selling price before GST
  gst_paise bigint not null default 0,
  ingredient_cost_paise bigint not null default 0,   -- snapshot
  expense_cost_paise bigint not null default 0,
  expected_profit_paise bigint not null default 0,
  actual_cost_paise bigint,                          -- entered after the event
  final_headcount integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived boolean not null default false
);

create table public.order_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  meal text not null default 'lunch' check (meal in ('breakfast','lunch','dinner','other')),
  label text,
  session_time text,
  headcount integer not null default 0 check (headcount >= 0),
  combo_id uuid references public.combos(id),
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived boolean not null default false
);

create table public.order_session_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  session_id uuid not null references public.order_sessions(id) on delete cascade,
  dish_id uuid not null references public.dishes(id),
  multiplier numeric(6,3) not null default 1 check (multiplier > 0),
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived boolean not null default false
);

create table public.order_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  expense_type_id uuid references public.expense_types(id),
  name text not null,
  mode text not null check (mode in ('per_person','per_session','fixed')),
  rate_paise bigint not null default 0,
  amount_paise bigint not null default 0,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived boolean not null default false
);

-- One snapshot per order: ingredient lines + prices at the time it was saved,
-- so later price changes never change an old order unless you recalculate.
create table public.order_cost_snapshot (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  order_id uuid not null unique references public.orders(id) on delete cascade,
  lines jsonb not null default '[]'::jsonb,
  totals jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived boolean not null default false
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  paid_on date not null default current_date,
  amount_paise bigint not null check (amount_paise > 0),
  method text not null default 'cash' check (method in ('cash','upi','bank')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived boolean not null default false
);

-- list_key: 'order:<uuid>' | 'date:YYYY-MM-DD' | 'calc'
create table public.shopping_list_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  list_key text not null,
  ingredient_id uuid not null references public.ingredients(id),
  checked boolean not null default false,
  paid_paise bigint check (paid_paise >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived boolean not null default false
);

-- One row per user. id = the user's id.
create table public.settings (
  id uuid primary key,
  user_id uuid not null unique default auth.uid() references auth.users(id) on delete cascade,
  business_name text not null default 'ஸ்ரீ செந்தூரர் கேட்டரிங்',
  phone text,
  address text,
  logo_data_url text check (logo_data_url is null or length(logo_data_url) < 300000),
  default_margin_pct numeric(6,2) not null default 30,
  default_wastage_pct numeric(5,2) not null default 5,
  price_round_rupees integer not null default 5,
  rounding jsonb not null default '{}'::jsonb,
  gst_enabled boolean not null default false,
  gst_pct numeric(5,2) not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived boolean not null default false,
  check (id = user_id)
);

-- ---------------------------------------------------------------- indexes, triggers, RLS
do $$
declare t text;
begin
  foreach t in array array[
    'ingredients','ingredient_price_history','dishes','recipe_items','combos','combo_items',
    'expense_types','orders','order_sessions','order_session_items','order_expenses',
    'order_cost_snapshot','payments','shopping_list_checks','settings'
  ] loop
    execute format('create index %I on public.%I (user_id, updated_at)', t || '_sync_idx', t);
    execute format('create trigger touch before insert or update on public.%I
                    for each row execute function public.touch_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format($p$create policy owner_all on public.%I for all to authenticated
                    using (user_id = (select auth.uid()))
                    with check (user_id = (select auth.uid()))$p$, t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

create index recipe_items_dish_idx on public.recipe_items (dish_id);
create index combo_items_combo_idx on public.combo_items (combo_id);
create index order_sessions_order_idx on public.order_sessions (order_id);
create index order_session_items_session_idx on public.order_session_items (session_id);
create index order_expenses_order_idx on public.order_expenses (order_id);
create index payments_order_idx on public.payments (order_id);
create index orders_event_date_idx on public.orders (user_id, event_date);
create index price_history_ing_idx on public.ingredient_price_history (ingredient_id, recorded_at);
create index shopping_checks_key_idx on public.shopping_list_checks (user_id, list_key);

-- Child rows must belong to the same user as their parent (RLS alone checks
-- only the row's own user_id). These checks stop cross-user references.
create or replace function public.assert_same_owner() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  parent_table text := tg_argv[0];
  parent_col text := tg_argv[1];
  parent_id uuid;
  owner uuid;
begin
  execute format('select ($1).%I', parent_col) into parent_id using new;
  if parent_id is null then return new; end if;
  execute format('select user_id from public.%I where id = $1', parent_table) into owner using parent_id;
  if owner is distinct from new.user_id then
    raise exception 'parent % % not owned by user', parent_table, parent_id using errcode = '42501';
  end if;
  return new;
end $$;

create trigger own_ing before insert or update on public.ingredient_price_history for each row execute function public.assert_same_owner('ingredients','ingredient_id');
create trigger own_dish before insert or update on public.recipe_items for each row execute function public.assert_same_owner('dishes','dish_id');
create trigger own_ing before insert or update on public.recipe_items for each row execute function public.assert_same_owner('ingredients','ingredient_id');
create trigger own_combo before insert or update on public.combo_items for each row execute function public.assert_same_owner('combos','combo_id');
create trigger own_dish before insert or update on public.combo_items for each row execute function public.assert_same_owner('dishes','dish_id');
create trigger own_order before insert or update on public.order_sessions for each row execute function public.assert_same_owner('orders','order_id');
create trigger own_combo before insert or update on public.order_sessions for each row execute function public.assert_same_owner('combos','combo_id');
create trigger own_order before insert or update on public.order_session_items for each row execute function public.assert_same_owner('orders','order_id');
create trigger own_session before insert or update on public.order_session_items for each row execute function public.assert_same_owner('order_sessions','session_id');
create trigger own_dish before insert or update on public.order_session_items for each row execute function public.assert_same_owner('dishes','dish_id');
create trigger own_order before insert or update on public.order_expenses for each row execute function public.assert_same_owner('orders','order_id');
create trigger own_order before insert or update on public.order_cost_snapshot for each row execute function public.assert_same_owner('orders','order_id');
create trigger own_order before insert or update on public.payments for each row execute function public.assert_same_owner('orders','order_id');
create trigger own_ing before insert or update on public.shopping_list_checks for each row execute function public.assert_same_owner('ingredients','ingredient_id');
