create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email_hash text not null unique,
  email_encrypted bytea not null,
  display_name_encrypted bytea not null,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists room_events (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  game_kind text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  payload_encrypted bytea,
  created_at timestamptz not null default now()
);

alter table room_events add column if not exists payload_encrypted bytea;
create index if not exists idx_room_events_room_created on room_events(room_id, created_at desc);

create table if not exists match_summaries (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  game_kind text not null,
  winner_player_id text,
  player_count integer not null default 0,
  summary jsonb not null default '{}'::jsonb,
  summary_encrypted bytea,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

alter table match_summaries add column if not exists summary_encrypted bytea;
create index if not exists idx_match_summaries_game_created on match_summaries(game_kind, created_at desc);
