-- =====================================================================
-- 川島センター シフト管理 初期スキーマ
-- =====================================================================
-- Supabase の SQL Editor にこのファイル全体を貼り付けて実行してください。
-- 既存テーブルがある場合は冒頭の DROP コメントを外して使ってください。
-- =====================================================================

-- drop table if exists day_notes cascade;
-- drop table if exists shift_assignments cascade;
-- drop table if exists driver_availability cascade;
-- drop table if exists month_courses cascade;
-- drop table if exists months cascade;
-- drop table if exists courses cascade;
-- drop table if exists drivers cascade;

-- ---------------------------------------------------------------------
-- 1. drivers (ドライバー名簿)
-- ---------------------------------------------------------------------
create table if not exists drivers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists drivers_sort_order_idx on drivers (sort_order, name);

-- ---------------------------------------------------------------------
-- 2. courses (コース名簿)
-- ---------------------------------------------------------------------
create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists courses_sort_order_idx on courses (sort_order, name);

-- ---------------------------------------------------------------------
-- 3. months (対象月)
-- ---------------------------------------------------------------------
create table if not exists months (
  id uuid primary key default gen_random_uuid(),
  year integer not null,
  month integer not null check (month between 1 and 12),
  status text not null default 'collecting'
    check (status in ('collecting','assigning','confirmed')),
  created_at timestamptz not null default now(),
  unique (year, month)
);

-- ---------------------------------------------------------------------
-- 4. month_courses (月ごとのコース構成)
-- ---------------------------------------------------------------------
create table if not exists month_courses (
  id uuid primary key default gen_random_uuid(),
  month_id uuid not null references months(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  sort_order integer not null default 0,
  unique (month_id, course_id)
);

create index if not exists month_courses_month_idx on month_courses (month_id, sort_order);

-- ---------------------------------------------------------------------
-- 5. driver_availability (ドライバーの出勤可否回答)
--   driver_name はテキスト保存（ドライバー入力画面では自由入力のため）
-- ---------------------------------------------------------------------
create table if not exists driver_availability (
  id uuid primary key default gen_random_uuid(),
  month_id uuid not null references months(id) on delete cascade,
  driver_name text not null,
  date date not null,
  status text not null check (status in ('available','maybe','off')),
  note text not null default '',
  updated_at timestamptz not null default now(),
  unique (month_id, driver_name, date)
);

create index if not exists driver_availability_month_idx
  on driver_availability (month_id, date);
create index if not exists driver_availability_name_idx
  on driver_availability (month_id, driver_name);

-- ---------------------------------------------------------------------
-- 6. shift_assignments (確定シフト = セルの値)
--   driver_id を持てば「選択モード」
--   free_text + is_free_text=true なら「自由記述モード」
-- ---------------------------------------------------------------------
create table if not exists shift_assignments (
  id uuid primary key default gen_random_uuid(),
  month_id uuid not null references months(id) on delete cascade,
  date date not null,
  course_id uuid not null references courses(id) on delete cascade,
  driver_id uuid references drivers(id) on delete set null,
  free_text text,
  is_free_text boolean not null default false,
  note text not null default '',
  updated_at timestamptz not null default now(),
  unique (month_id, date, course_id)
);

create index if not exists shift_assignments_month_idx
  on shift_assignments (month_id, date);
create index if not exists shift_assignments_driver_idx
  on shift_assignments (month_id, driver_id);

-- ---------------------------------------------------------------------
-- 7. day_notes (日付ごとの備考)
-- ---------------------------------------------------------------------
create table if not exists day_notes (
  id uuid primary key default gen_random_uuid(),
  month_id uuid not null references months(id) on delete cascade,
  date date not null,
  content text not null default '',
  updated_at timestamptz not null default now(),
  unique (month_id, date)
);

-- ---------------------------------------------------------------------
-- updated_at 自動更新トリガ
-- ---------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_driver_availability_updated on driver_availability;
create trigger trg_driver_availability_updated
  before update on driver_availability
  for each row execute function set_updated_at();

drop trigger if exists trg_shift_assignments_updated on shift_assignments;
create trigger trg_shift_assignments_updated
  before update on shift_assignments
  for each row execute function set_updated_at();

drop trigger if exists trg_day_notes_updated on day_notes;
create trigger trg_day_notes_updated
  before update on day_notes
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- RLS: 社内ツール想定のため anon key からの全権限を許可
-- 必要に応じてユーザー認証ベースの policy に置き換えてください
-- ---------------------------------------------------------------------
alter table drivers              enable row level security;
alter table courses              enable row level security;
alter table months               enable row level security;
alter table month_courses        enable row level security;
alter table driver_availability  enable row level security;
alter table shift_assignments    enable row level security;
alter table day_notes            enable row level security;

do $$
declare t text;
begin
  for t in select unnest(array[
    'drivers','courses','months','month_courses',
    'driver_availability','shift_assignments','day_notes'
  ]) loop
    execute format('drop policy if exists %I on %I', t || '_all', t);
    execute format(
      'create policy %I on %I for all to anon, authenticated using (true) with check (true)',
      t || '_all', t
    );
  end loop;
end $$;
