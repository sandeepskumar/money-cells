-- Link Cellie's question log to the parent account so account deletion
-- removes it (Privacy Policy §8). Rows from signed-out/demo use stay null.
alter table public.tutor_sessions
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists tutor_sessions_user_id_idx
  on public.tutor_sessions (user_id);
