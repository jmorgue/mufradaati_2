-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Stores the Poetry tab's poems (one row per poem, the whole poem as JSON).
create table if not exists public.user_poems (
  user_id    text        not null,
  poem_id    text        not null,
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, poem_id)
);

alter table public.user_poems enable row level security;

-- Same open access the app's other tables use (the app signs in with its own username + PIN).
drop policy if exists "user_poems open access" on public.user_poems;
create policy "user_poems open access" on public.user_poems
  for all using (true) with check (true);
