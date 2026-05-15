-- Molocule Database Schema
-- Run this in your Supabase SQL editor to initialize the database

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Users table (synced from NextAuth GitHub OAuth)
create table if not exists public.users (
  id                  text primary key,
  email               text unique not null,
  name                text,
  image               text,
  github_access_token text,
  created_at          timestamptz default now()
);

-- Companies table
create table if not exists public.companies (
  id            uuid primary key default uuid_generate_v4(),
  user_id       text not null references public.users(id) on delete cascade,
  name          text not null,
  website       text not null,
  linkedin_url  text,
  github_org    text,
  blog_rss_url  text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists companies_user_id_idx on public.companies(user_id);

-- Signal type enum
do $$ begin
  create type signal_type as enum ('FUNDING', 'KEY_HIRE', 'LAYOFF', 'PRODUCT_LAUNCH', 'GENERAL');
exception when duplicate_object then null; end $$;

-- Signals table
create table if not exists public.signals (
  id          uuid primary key default uuid_generate_v4(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  type        signal_type not null,
  title       text not null,
  url         text,
  summary     text,
  llm_insight text,
  is_new      boolean not null default true,
  detected_at timestamptz default now(),
  created_at  timestamptz default now()
);

create index if not exists signals_company_id_idx on public.signals(company_id);
create index if not exists signals_type_idx on public.signals(type);
create index if not exists signals_detected_at_idx on public.signals(detected_at desc);

-- Repos table
create table if not exists public.repos (
  id             uuid primary key default uuid_generate_v4(),
  user_id        text not null references public.users(id) on delete cascade,
  github_repo_id text unique not null,
  owner          text not null,
  name           text not null,
  full_name      text not null,
  connected_at   timestamptz default now()
);

create index if not exists repos_user_id_idx on public.repos(user_id);

-- Digests table
create table if not exists public.digests (
  id           uuid primary key default uuid_generate_v4(),
  repo_id      uuid not null references public.repos(id) on delete cascade,
  period_start timestamptz not null,
  period_end   timestamptz not null,
  summary      text not null,
  pr_count     int not null default 0,
  merged_count int not null default 0,
  open_count   int not null default 0,
  raw_data     jsonb not null default '{}',
  created_at   timestamptz default now()
);

create index if not exists digests_repo_id_idx on public.digests(repo_id);
create index if not exists digests_created_at_idx on public.digests(created_at desc);

-- Notifications table
create table if not exists public.notifications (
  id                uuid primary key default uuid_generate_v4(),
  user_id           text unique not null references public.users(id) on delete cascade,
  slack_webhook_url text,
  email             text,
  digest_frequency  text not null default 'daily',
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- Auto-update updated_at columns
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger companies_updated_at
  before update on public.companies
  for each row execute function update_updated_at();

create trigger notifications_updated_at
  before update on public.notifications
  for each row execute function update_updated_at();

-- Row Level Security
alter table public.users enable row level security;
alter table public.companies enable row level security;
alter table public.signals enable row level security;
alter table public.repos enable row level security;
alter table public.digests enable row level security;
alter table public.notifications enable row level security;

-- RLS policies (service role bypasses these — workers use service role)
create policy "users_own" on public.users for all using (id = auth.uid()::text);
create policy "companies_own" on public.companies for all using (user_id = auth.uid()::text);
create policy "signals_via_company" on public.signals for select using (
  company_id in (select id from public.companies where user_id = auth.uid()::text)
);
create policy "repos_own" on public.repos for all using (user_id = auth.uid()::text);
create policy "digests_via_repo" on public.digests for select using (
  repo_id in (select id from public.repos where user_id = auth.uid()::text)
);
create policy "notifications_own" on public.notifications for all using (user_id = auth.uid()::text);
