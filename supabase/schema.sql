create extension if not exists pgcrypto;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  password_hash text not null,
  station_order integer[],
  created_at timestamptz not null default now()
);
alter table public.teams add column if not exists station_order integer[];

create table if not exists public.station_progress (
  team_id uuid not null references public.teams(id) on delete cascade,
  station_id integer not null,
  hints_used integer not null default 0 check (hints_used between 0 and 5),
  answer text,
  submitted_at timestamptz,
  score_percent integer check (score_percent between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (team_id, station_id)
);

create table if not exists public.quiz_answers (
  team_id uuid not null references public.teams(id) on delete cascade,
  question_id text not null,
  answer text not null default '',
  updated_at timestamptz not null default now(),
  primary key (team_id, question_id)
);

create table if not exists public.beers (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  brand text not null,
  brand_normalized text not null,
  storage_path text,
  created_at timestamptz not null default now(),
  unique (team_id, brand_normalized)
);
alter table public.beers add column if not exists storage_path text;

create table if not exists public.guinness_entries (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  street text not null,
  street_normalized text not null,
  storage_path text not null,
  created_at timestamptz not null default now(),
  unique (team_id, street_normalized)
);

create table if not exists public.architecture_entries (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  style text not null,
  building_name text not null,
  storage_path text not null,
  created_at timestamptz not null default now(),
  unique (team_id, style)
);

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.picture_round_images (
  slot integer primary key check (slot between 1 and 8),
  storage_path text not null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value)
values ('deadline', '{"deadlineAt": null}'::jsonb)
on conflict (key) do nothing;

alter table public.teams enable row level security;
alter table public.station_progress enable row level security;
alter table public.quiz_answers enable row level security;
alter table public.beers enable row level security;
alter table public.guinness_entries enable row level security;
alter table public.architecture_entries enable row level security;
alter table public.app_settings enable row level security;
alter table public.picture_round_images enable row level security;

insert into storage.buckets (id, name, public)
values ('team-uploads', 'team-uploads', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('quiz-assets', 'quiz-assets', false)
on conflict (id) do nothing;

grant all on table public.teams to service_role;
grant all on table public.station_progress to service_role;
grant all on table public.quiz_answers to service_role;
grant all on table public.beers to service_role;
grant all on table public.guinness_entries to service_role;
grant all on table public.architecture_entries to service_role;
grant all on table public.app_settings to service_role;
grant all on table public.picture_round_images to service_role;
