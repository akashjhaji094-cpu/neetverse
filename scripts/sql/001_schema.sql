-- NEETVerse: complete database schema
-- Enums -----------------------------------------------------------------
do $$ begin
  create type public.app_role as enum ('superadmin', 'content_admin', 'student');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.attempt_type as enum ('practice', 'mock');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.difficulty_level as enum ('auto_easy', 'auto_medium', 'auto_hard', 'manual');
exception when duplicate_object then null; end $$;

-- Core tables ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  referral_code text unique,
  referred_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  name text not null,
  slug text not null,
  meta jsonb,
  created_at timestamptz not null default now(),
  unique (subject_id, slug)
);

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  name text not null,
  slug text not null,
  keywords text[] not null default '{}',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (chapter_id, slug)
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  question_text text not null,
  options jsonb not null,
  correct_option_index integer,
  explanation text,
  images jsonb default '[]'::jsonb,
  difficulty public.difficulty_level default 'auto_medium',
  bloom_level integer,
  concept_tags text[],
  source_file text,
  raw_html text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.question_topics (
  question_id uuid not null references public.questions(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  confidence numeric not null default 1,
  created_at timestamptz not null default now(),
  primary key (question_id, topic_id)
);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type public.attempt_type not null,
  config jsonb,
  details jsonb,
  question_ids uuid[],
  score numeric,
  omr_image_path text,
  omr_status text not null default 'none',
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  chosen_option_index integer,
  is_correct boolean,
  time_taken_seconds integer,
  created_at timestamptz not null default now()
);

create table if not exists public.in_progress_tests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  test_type text not null default 'mock',
  config jsonb not null default '{}'::jsonb,
  question_ids uuid[] not null default '{}',
  answers jsonb not null default '{}'::jsonb,
  current_question_index integer not null default 0,
  total_questions integer not null default 0,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_streaks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_activity_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_skill_levels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  skill_level numeric not null default 50,
  questions_attempted integer not null default 0,
  questions_correct integer not null default 0,
  consecutive_correct integer not null default 0,
  consecutive_wrong integer not null default 0,
  last_attempted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, chapter_id)
);

create table if not exists public.adaptive_learning_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  chapter_id uuid references public.chapters(id) on delete set null,
  mode text not null default 'adaptive',
  status text not null default 'active',
  questions jsonb not null default '[]'::jsonb,
  answers jsonb not null default '[]'::jsonb,
  skill_snapshots jsonb not null default '[]'::jsonb,
  current_question_index integer not null default 0,
  target_skill_level numeric not null default 70,
  started_at timestamptz default now(),
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.adaptive_question_pools (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  difficulty_bucket text not null,
  question_ids uuid[] not null default '{}',
  total_count integer not null default 0,
  updated_at timestamptz default now(),
  unique (chapter_id, difficulty_bucket)
);

-- PYQs ---------------------------------------------------------------------
create table if not exists public.pyq_papers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  paper_pdf_url text,
  solution_pdf_url text,
  total_questions integer not null default 0,
  uploaded_by uuid not null,
  created_at timestamptz not null default now()
);

create table if not exists public.pyq_questions (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.pyq_papers(id) on delete cascade,
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  image_url text not null,
  page_number integer not null default 1,
  correct_option_index integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.pyq_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  paper_id uuid references public.pyq_papers(id) on delete cascade,
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  answers jsonb not null default '{}'::jsonb,
  score numeric not null default 0,
  correct_count integer not null default 0,
  wrong_count integer not null default 0,
  unattempted_count integer not null default 0,
  total_questions integer not null default 0,
  time_taken_seconds integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Notes & premium ------------------------------------------------------------
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject_id uuid references public.subjects(id) on delete set null,
  chapter_id uuid references public.chapters(id) on delete set null,
  file_url text,
  drive_link text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.premium_access_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  access_key text not null unique,
  is_active boolean not null default true,
  expires_at timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create table if not exists public.premium_tests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  file_url text not null,
  access_key text,
  uploaded_by uuid not null,
  created_at timestamptz not null default now()
);

create table if not exists public.premium_planners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  file_url text not null,
  uploaded_by uuid not null,
  created_at timestamptz not null default now()
);

-- Referrals -------------------------------------------------------------------
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid not null unique references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  reward_tier_unlocked integer,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Broadcasts & email -----------------------------------------------------------
create table if not exists public.admin_broadcasts (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  body text not null,
  is_active boolean not null default true,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_broadcast_reads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  broadcast_id uuid not null references public.admin_broadcasts(id) on delete cascade,
  read_at timestamptz not null default now(),
  unique (user_id, broadcast_id)
);

create table if not exists public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text not null,
  blocks jsonb not null default '[]'::jsonb,
  audience_type text not null default 'all',
  audience_filter jsonb,
  trigger_type text not null default 'manual',
  status text not null default 'draft',
  scheduled_at timestamptz,
  sent_at timestamptz,
  sent_by uuid references public.profiles(id) on delete set null,
  provider_used text,
  total_recipients integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.email_campaigns(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  email text not null,
  status text not null default 'pending',
  sent_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  blocks jsonb not null default '[]'::jsonb,
  is_builtin boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_uploads (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete cascade,
  filename text not null,
  status text not null default 'pending',
  parsed_data jsonb,
  errors jsonb,
  created_at timestamptz not null default now()
);

-- Learning paths & planner -------------------------------------------------------
create table if not exists public.learning_paths (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  subject_id uuid references public.subjects(id) on delete set null,
  difficulty_level text not null default 'medium',
  duration_days integer not null default 30,
  chapters_order uuid[] not null default '{}',
  daily_targets jsonb not null default '{}'::jsonb,
  is_premium boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.user_learning_paths (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  path_id uuid not null references public.learning_paths(id) on delete cascade,
  status text not null default 'active',
  current_day integer not null default 1,
  progress_percent numeric not null default 0,
  completed_chapters uuid[] not null default '{}',
  started_at timestamptz default now(),
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, path_id)
);

create table if not exists public.daily_study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null default current_date,
  plan jsonb not null default '[]'::jsonb,
  completed_tasks jsonb not null default '[]'::jsonb,
  completed_count integer not null default 0,
  total_tasks integer not null default 0,
  study_time_minutes integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, date)
);

-- Battle arena ----------------------------------------------------------------
create table if not exists public.battle_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null default 'Battle Room',
  host_id uuid not null,
  subject_id uuid references public.subjects(id) on delete set null,
  chapter_id uuid references public.chapters(id) on delete set null,
  status text not null default 'waiting',
  max_players integer not null default 8,
  current_players integer not null default 0,
  question_count integer not null default 10,
  time_per_question integer not null default 30,
  current_question_index integer not null default 0,
  questions jsonb not null default '[]'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.battle_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.battle_rooms(id) on delete cascade,
  user_id uuid not null,
  display_name text not null,
  avatar_emoji text,
  is_host boolean not null default false,
  is_ready boolean not null default false,
  is_connected boolean not null default true,
  score integer not null default 0,
  streak integer not null default 0,
  max_streak integer not null default 0,
  correct_count integer not null default 0,
  wrong_count integer not null default 0,
  answers jsonb not null default '{}'::jsonb,
  joined_at timestamptz default now(),
  last_ping_at timestamptz default now(),
  unique (room_id, user_id)
);

create table if not exists public.battle_room_questions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.battle_rooms(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  question_index integer not null,
  created_at timestamptz not null default now(),
  unique (room_id, question_index)
);

create table if not exists public.battle_question_states (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.battle_rooms(id) on delete cascade,
  question_id uuid not null,
  question_index integer not null,
  status text not null default 'active',
  player_answers jsonb not null default '{}'::jsonb,
  started_at timestamptz default now(),
  ends_at timestamptz,
  created_at timestamptz default now(),
  unique (room_id, question_index)
);

create table if not exists public.battle_leaderboard (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  display_name text not null,
  rating integer not null default 1000,
  rank_tier text not null default 'Bronze',
  total_battles integer not null default 0,
  total_wins integer not null default 0,
  total_score integer not null default 0,
  avg_score numeric not null default 0,
  best_streak integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.battle_history (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null,
  user_id uuid not null,
  display_name text not null,
  subject_name text,
  chapter_name text,
  score integer not null,
  correct_count integer not null,
  wrong_count integer not null,
  max_streak integer not null,
  final_rank integer not null,
  rating_change integer not null default 0,
  new_rating integer not null default 1000,
  played_at timestamptz default now()
);

-- Indexes -----------------------------------------------------------------------
create index if not exists idx_chapters_subject on public.chapters(subject_id);
create index if not exists idx_topics_chapter on public.topics(chapter_id);
create index if not exists idx_questions_chapter on public.questions(chapter_id);
create index if not exists idx_questions_subject on public.questions(subject_id);
create index if not exists idx_questions_difficulty on public.questions(difficulty);
create index if not exists idx_question_topics_topic on public.question_topics(topic_id);
create index if not exists idx_attempts_user on public.attempts(user_id, started_at desc);
create index if not exists idx_attempt_answers_attempt on public.attempt_answers(attempt_id);
create index if not exists idx_attempt_answers_question on public.attempt_answers(question_id);
create index if not exists idx_pyq_questions_paper on public.pyq_questions(paper_id);
create index if not exists idx_pyq_attempts_user on public.pyq_attempts(user_id);
create index if not exists idx_battle_players_room on public.battle_players(room_id);
create index if not exists idx_battle_history_user on public.battle_history(user_id, played_at desc);
create index if not exists idx_user_skill_levels_user on public.user_skill_levels(user_id);
create index if not exists idx_referrals_referrer on public.referrals(referrer_id);
create index if not exists idx_user_roles_user on public.user_roles(user_id);

-- Role helper (security definer avoids RLS recursion) -----------------------------
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles where user_id = _user_id and role = _role
  );
$$;

create or replace function public.is_admin(_user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role in ('superadmin', 'content_admin')
  );
$$;

-- updated_at trigger ---------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','questions','user_streaks','user_skill_levels','adaptive_learning_sessions',
    'pyq_attempts','email_campaigns','admin_broadcasts','learning_paths','user_learning_paths',
    'daily_study_plans','battle_rooms','battle_leaderboard','in_progress_tests'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- New-user trigger --------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, referral_code)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    upper(substr(md5(new.id::text || random()::text), 1, 8))
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'student')
  on conflict (user_id, role) do nothing;

  insert into public.user_streaks (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Maintain battle_rooms.current_players --------------------------------------------------
create or replace function public.sync_battle_player_count()
returns trigger language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  rid := coalesce(new.room_id, old.room_id);
  update public.battle_rooms
  set current_players = (select count(*) from public.battle_players where room_id = rid)
  where id = rid;
  return coalesce(new, old);
end; $$;

drop trigger if exists battle_player_count on public.battle_players;
create trigger battle_player_count
  after insert or delete on public.battle_players
  for each row execute function public.sync_battle_player_count();

-- Row Level Security ------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','user_roles','subjects','chapters','topics','questions','question_topics',
    'attempts','attempt_answers','in_progress_tests','user_streaks','user_skill_levels',
    'adaptive_learning_sessions','adaptive_question_pools','pyq_papers','pyq_questions',
    'pyq_attempts','notes','premium_access_keys','premium_tests','premium_planners',
    'referrals','admin_broadcasts','user_broadcast_reads','email_campaigns',
    'email_campaign_recipients','email_templates','admin_uploads','learning_paths',
    'user_learning_paths','daily_study_plans','battle_rooms','battle_players',
    'battle_room_questions','battle_question_states','battle_leaderboard','battle_history'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- profiles
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select to authenticated using (true);
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin(auth.uid()))
  with check (id = auth.uid() or public.is_admin(auth.uid()));

-- user_roles
drop policy if exists "user_roles_select" on public.user_roles;
create policy "user_roles_select" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()));
drop policy if exists "user_roles_admin_write" on public.user_roles;
create policy "user_roles_admin_write" on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(), 'superadmin'))
  with check (public.has_role(auth.uid(), 'superadmin'));

-- Public content: readable by everyone, writable by admins
do $$
declare t text;
begin
  foreach t in array array['subjects','chapters','topics','questions','question_topics','pyq_papers','pyq_questions','notes','learning_paths','adaptive_question_pools'] loop
    execute format('drop policy if exists "%s_public_read" on public.%I', t, t);
    execute format('create policy "%s_public_read" on public.%I for select using (true)', t, t);
    execute format('drop policy if exists "%s_admin_write" on public.%I', t, t);
    execute format('create policy "%s_admin_write" on public.%I for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()))', t, t);
  end loop;
end $$;

-- Own-row user data
do $$
declare t text;
begin
  foreach t in array array['attempts','in_progress_tests','user_streaks','user_skill_levels','adaptive_learning_sessions','pyq_attempts','user_broadcast_reads','daily_study_plans','user_learning_paths'] loop
    execute format('drop policy if exists "%s_own" on public.%I', t, t);
    execute format('create policy "%s_own" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t, t);
    execute format('drop policy if exists "%s_admin_read" on public.%I', t, t);
    execute format('create policy "%s_admin_read" on public.%I for select to authenticated using (public.is_admin(auth.uid()))', t, t);
  end loop;
end $$;

-- attempt_answers via parent attempt
drop policy if exists "attempt_answers_own" on public.attempt_answers;
create policy "attempt_answers_own" on public.attempt_answers for all to authenticated
  using (exists (select 1 from public.attempts a where a.id = attempt_id and a.user_id = auth.uid()))
  with check (exists (select 1 from public.attempts a where a.id = attempt_id and a.user_id = auth.uid()));

-- premium
drop policy if exists "premium_keys_select_own" on public.premium_access_keys;
create policy "premium_keys_select_own" on public.premium_access_keys for select to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()));
drop policy if exists "premium_keys_admin_write" on public.premium_access_keys;
create policy "premium_keys_admin_write" on public.premium_access_keys for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['premium_tests','premium_planners'] loop
    execute format('drop policy if exists "%s_read" on public.%I', t, t);
    execute format('create policy "%s_read" on public.%I for select to authenticated using (true)', t, t);
    execute format('drop policy if exists "%s_admin_write" on public.%I', t, t);
    execute format('create policy "%s_admin_write" on public.%I for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()))', t, t);
  end loop;
end $$;

-- referrals
drop policy if exists "referrals_select" on public.referrals;
create policy "referrals_select" on public.referrals for select to authenticated
  using (referrer_id = auth.uid() or referred_id = auth.uid() or public.is_admin(auth.uid()));
drop policy if exists "referrals_insert" on public.referrals;
create policy "referrals_insert" on public.referrals for insert to authenticated
  with check (referred_id = auth.uid());

-- broadcasts
drop policy if exists "broadcasts_read" on public.admin_broadcasts;
create policy "broadcasts_read" on public.admin_broadcasts for select to authenticated using (true);
drop policy if exists "broadcasts_admin_write" on public.admin_broadcasts;
create policy "broadcasts_admin_write" on public.admin_broadcasts for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- admin-only tables
do $$
declare t text;
begin
  foreach t in array array['email_campaigns','email_campaign_recipients','email_templates','admin_uploads'] loop
    execute format('drop policy if exists "%s_admin_only" on public.%I', t, t);
    execute format('create policy "%s_admin_only" on public.%I for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()))', t, t);
  end loop;
end $$;

-- battle rooms
drop policy if exists "battle_rooms_read" on public.battle_rooms;
create policy "battle_rooms_read" on public.battle_rooms for select to authenticated using (true);
drop policy if exists "battle_rooms_insert" on public.battle_rooms;
create policy "battle_rooms_insert" on public.battle_rooms for insert to authenticated with check (host_id = auth.uid());
drop policy if exists "battle_rooms_update_host" on public.battle_rooms;
create policy "battle_rooms_update_host" on public.battle_rooms for update to authenticated
  using (host_id = auth.uid()) with check (host_id = auth.uid());
drop policy if exists "battle_rooms_delete_host" on public.battle_rooms;
create policy "battle_rooms_delete_host" on public.battle_rooms for delete to authenticated using (host_id = auth.uid());

-- battle players
drop policy if exists "battle_players_read" on public.battle_players;
create policy "battle_players_read" on public.battle_players for select to authenticated using (true);
drop policy if exists "battle_players_insert_own" on public.battle_players;
create policy "battle_players_insert_own" on public.battle_players for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "battle_players_update_own" on public.battle_players;
create policy "battle_players_update_own" on public.battle_players for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "battle_players_delete" on public.battle_players;
create policy "battle_players_delete" on public.battle_players for delete to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.battle_rooms r where r.id = room_id and r.host_id = auth.uid()));

-- battle internals: no direct client access (server functions only)
-- battle_room_questions / battle_question_states have RLS enabled with no policies.

-- battle leaderboard & history: read-only for clients
drop policy if exists "battle_leaderboard_read" on public.battle_leaderboard;
create policy "battle_leaderboard_read" on public.battle_leaderboard for select to authenticated using (true);
drop policy if exists "battle_history_read" on public.battle_history;
create policy "battle_history_read" on public.battle_history for select to authenticated using (true);
