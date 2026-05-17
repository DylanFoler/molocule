-- Molocule Database Schema
-- Run this in the Supabase SQL Editor to initialize the database
-- Dev Digest has been removed; only signal intelligence tables are needed

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Users (synced from NextAuth GitHub OAuth)
create table if not exists public.users (
  id                  text primary key,
  email               text unique not null,
  name                text,
  image               text,
  github_access_token text,
  preferences         jsonb not null default '{}',
  created_at          timestamptz default now()
);

-- Companies tracked per user
create table if not exists public.companies (
  id           uuid primary key default uuid_generate_v4(),
  user_id      text not null references public.users(id) on delete cascade,
  name         text not null,
  website      text not null,
  linkedin_url text,
  github_org   text,
  blog_rss_url text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists companies_user_id_idx on public.companies(user_id);

-- Signal type enum
do $$ begin
  create type signal_type as enum ('FUNDING','KEY_HIRE','LAYOFF','PRODUCT_LAUNCH','GENERAL');
exception when duplicate_object then null; end $$;

-- Signals detected for each company
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
create index if not exists signals_type_idx        on public.signals(type);
create index if not exists signals_detected_at_idx on public.signals(detected_at desc);

-- Notifications config per user
create table if not exists public.notifications (
  id                uuid primary key default uuid_generate_v4(),
  user_id           text unique not null references public.users(id) on delete cascade,
  slack_webhook_url text,
  email             text,
  digest_frequency  text not null default 'daily',
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace trigger companies_updated_at
  before update on public.companies
  for each row execute function update_updated_at();

create or replace trigger notifications_updated_at
  before update on public.notifications
  for each row execute function update_updated_at();

-- Row Level Security
alter table public.users         enable row level security;
alter table public.companies     enable row level security;
alter table public.signals       enable row level security;
alter table public.notifications enable row level security;

-- RLS policies (service role key bypasses all of these)
do $$ begin
  create policy "users_own" on public.users
    for all using (id = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "companies_own" on public.companies
    for all using (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "signals_via_company" on public.signals
    for select using (
      company_id in (
        select id from public.companies where user_id = auth.uid()::text
      )
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "notifications_own" on public.notifications
    for all using (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;
