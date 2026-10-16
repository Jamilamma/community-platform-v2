-- Email verification + password reset
-- Run ONCE in Supabase SQL Editor BEFORE restarting the server. Purely additive.

-- existing users (staff, owner, current students) stay verified because the default is true
alter table users add column if not exists email_verified boolean not null default true;

create table if not exists auth_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users (id) on delete cascade,
  type        text not null check (type in ('verify', 'reset')),
  token_hash  text not null unique,          -- only a SHA-256 hash is stored, never the raw token
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists auth_tokens_user_idx on auth_tokens (user_id, type);

alter table auth_tokens enable row level security;   -- same model as the other tables (API only)

notify pgrst, 'reload schema';