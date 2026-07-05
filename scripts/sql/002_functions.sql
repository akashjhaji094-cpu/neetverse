-- NEETVerse: database functions (RPCs)

-- Question counts ------------------------------------------------------------
create or replace function public.get_question_counts_per_chapter()
returns table (chapter_id uuid, total bigint)
language sql stable security definer set search_path = public
as $$
  select q.chapter_id, count(*)::bigint as total
  from public.questions q
  group by q.chapter_id;
$$;

create or replace function public.get_question_counts_per_topic()
returns table (topic_id uuid, total bigint)
language sql stable security definer set search_path = public
as $$
  select qt.topic_id, count(*)::bigint as total
  from public.question_topics qt
  group by qt.topic_id;
$$;

-- Referrals ---------------------------------------------------------------------
create or replace function public.complete_referral_for_user(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_referrer uuid;
  v_count integer;
begin
  update public.referrals
  set status = 'completed', completed_at = now()
  where referred_id = p_user_id and status = 'pending'
  returning referrer_id into v_referrer;

  if v_referrer is null then return; end if;

  select count(*) into v_count from public.referrals
  where referrer_id = v_referrer and status = 'completed';

  update public.referrals
  set reward_tier_unlocked = case
    when v_count >= 10 then 3
    when v_count >= 5 then 2
    when v_count >= 2 then 1
    else null end
  where referred_id = p_user_id;
end; $$;

-- Battle: room code ---------------------------------------------------------------
create or replace function public.generate_room_code()
returns text
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_code text;
begin
  loop
    v_code := upper(substr(md5(random()::text), 1, 6));
    exit when not exists (select 1 from public.battle_rooms where code = v_code);
  end loop;
  return v_code;
end; $$;

-- Battle: scoring -------------------------------------------------------------------
create or replace function public.calculate_battle_score(
  p_current_streak integer,
  p_is_correct boolean,
  p_time_limit_ms integer,
  p_time_taken_ms integer
) returns integer
language plpgsql immutable
as $$
declare
  v_base integer := 100;
  v_speed integer;
  v_streak_bonus integer;
begin
  if not p_is_correct then return 0; end if;
  -- up to 100 speed bonus scaled by remaining time
  v_speed := greatest(0, round(100.0 * (p_time_limit_ms - p_time_taken_ms) / nullif(p_time_limit_ms, 0)))::integer;
  v_streak_bonus := least(50, p_current_streak * 10);
  return v_base + coalesce(v_speed, 0) + v_streak_bonus;
end; $$;

-- Battle: start room (host only) -------------------------------------------------------
create or replace function public.battle_start_room(p_room_id uuid)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_room public.battle_rooms%rowtype;
  v_qid uuid;
  v_idx integer := 0;
begin
  select * into v_room from public.battle_rooms where id = p_room_id for update;
  if not found then raise exception 'Room not found'; end if;
  if v_room.host_id <> auth.uid() then raise exception 'Only the host can start the battle'; end if;
  if v_room.status not in ('waiting', 'countdown') then raise exception 'Battle already started'; end if;

  delete from public.battle_room_questions where room_id = p_room_id;
  delete from public.battle_question_states where room_id = p_room_id;

  for v_qid in
    select q.id from public.questions q
    where q.correct_option_index is not null
      and (v_room.subject_id is null or q.subject_id = v_room.subject_id)
      and (v_room.chapter_id is null or q.chapter_id = v_room.chapter_id)
    order by random()
    limit v_room.question_count
  loop
    insert into public.battle_room_questions (room_id, question_id, question_index)
    values (p_room_id, v_qid, v_idx);
    v_idx := v_idx + 1;
  end loop;

  if v_idx = 0 then raise exception 'No questions available for this selection'; end if;

  -- open the first question
  insert into public.battle_question_states (room_id, question_id, question_index, status, started_at, ends_at)
  select p_room_id, question_id, 0, 'active', now(), now() + make_interval(secs => v_room.time_per_question)
  from public.battle_room_questions where room_id = p_room_id and question_index = 0;

  update public.battle_rooms
  set status = 'active',
      question_count = v_idx,
      current_question_index = 0,
      started_at = now()
  where id = p_room_id;
end; $$;

-- Battle: get active question (never exposes the answer) -----------------------------------
create or replace function public.battle_get_question(p_index integer, p_room_id uuid)
returns table (
  ends_at timestamptz,
  options jsonb,
  question_id uuid,
  question_image text,
  question_text text,
  status text
)
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_room public.battle_rooms%rowtype;
begin
  select * into v_room from public.battle_rooms where id = p_room_id;
  if not found then raise exception 'Room not found'; end if;
  if not exists (select 1 from public.battle_players bp where bp.room_id = p_room_id and bp.user_id = auth.uid()) then
    raise exception 'Not a player in this room';
  end if;

  -- lazily open the state row for this index
  insert into public.battle_question_states (room_id, question_id, question_index, status, started_at, ends_at)
  select p_room_id, brq.question_id, p_index, 'active', now(), now() + make_interval(secs => v_room.time_per_question)
  from public.battle_room_questions brq
  where brq.room_id = p_room_id and brq.question_index = p_index
  on conflict (room_id, question_index) do nothing;

  return query
  select s.ends_at,
         q.options,
         q.id,
         coalesce(q.images ->> 0, null) as question_image,
         q.question_text,
         s.status
  from public.battle_question_states s
  join public.questions q on q.id = s.question_id
  where s.room_id = p_room_id and s.question_index = p_index;
end; $$;

-- Battle: submit answer ----------------------------------------------------------------------
create or replace function public.battle_submit_answer(
  p_option_index integer,
  p_question_index integer,
  p_room_id uuid,
  p_time_taken_ms integer
)
returns table (is_correct boolean, new_streak integer, score_gained integer)
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_room public.battle_rooms%rowtype;
  v_state public.battle_question_states%rowtype;
  v_player public.battle_players%rowtype;
  v_correct integer;
  v_is_correct boolean;
  v_streak integer;
  v_score integer;
begin
  select * into v_room from public.battle_rooms where id = p_room_id;
  if not found then raise exception 'Room not found'; end if;

  select * into v_state from public.battle_question_states
  where room_id = p_room_id and question_index = p_question_index for update;
  if not found then raise exception 'Question not active'; end if;
  if v_state.status <> 'active' or (v_state.ends_at is not null and now() > v_state.ends_at) then
    raise exception 'Time is up for this question';
  end if;

  select * into v_player from public.battle_players
  where room_id = p_room_id and user_id = auth.uid() for update;
  if not found then raise exception 'Not a player in this room'; end if;

  if v_state.player_answers ? auth.uid()::text then
    raise exception 'Already answered';
  end if;

  select q.correct_option_index into v_correct
  from public.questions q where q.id = v_state.question_id;

  v_is_correct := (p_option_index = v_correct);
  v_streak := case when v_is_correct then v_player.streak + 1 else 0 end;
  v_score := public.calculate_battle_score(v_player.streak, v_is_correct, v_room.time_per_question * 1000, p_time_taken_ms);

  update public.battle_question_states
  set player_answers = player_answers || jsonb_build_object(
    auth.uid()::text,
    jsonb_build_object('option', p_option_index, 'correct', v_is_correct, 'time_ms', p_time_taken_ms)
  )
  where id = v_state.id;

  update public.battle_players
  set score = score + v_score,
      streak = v_streak,
      max_streak = greatest(max_streak, v_streak),
      correct_count = correct_count + (case when v_is_correct then 1 else 0 end),
      wrong_count = wrong_count + (case when v_is_correct then 0 else 1 end),
      answers = answers || jsonb_build_object(p_question_index::text, p_option_index),
      last_ping_at = now()
  where id = v_player.id;

  return query select v_is_correct, v_streak, v_score;
end; $$;

-- Battle: reveal answer (after time is up or everyone answered) ---------------------------------
create or replace function public.battle_reveal_answer(p_question_index integer, p_room_id uuid)
returns table (correct_option_index integer, explanation text)
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_state public.battle_question_states%rowtype;
  v_player_count integer;
  v_answer_count integer;
begin
  if not exists (select 1 from public.battle_players bp where bp.room_id = p_room_id and bp.user_id = auth.uid()) then
    raise exception 'Not a player in this room';
  end if;

  select * into v_state from public.battle_question_states
  where room_id = p_room_id and question_index = p_question_index;
  if not found then raise exception 'Question not found'; end if;

  select count(*) into v_player_count from public.battle_players where room_id = p_room_id;
  select count(*) into v_answer_count from jsonb_object_keys(v_state.player_answers);

  if v_state.ends_at is not null and now() < v_state.ends_at and v_answer_count < v_player_count then
    raise exception 'Question still in progress';
  end if;

  update public.battle_question_states set status = 'revealed' where id = v_state.id;

  return query
  select q.correct_option_index, q.explanation
  from public.questions q where q.id = v_state.question_id;
end; $$;

-- Battle: advance to next question or finish ---------------------------------------------------
create or replace function public.battle_advance_question(p_room_id uuid)
returns integer
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_room public.battle_rooms%rowtype;
  v_next integer;
  v_rank integer := 0;
  r record;
  v_rating integer;
  v_change integer;
  v_total integer;
begin
  select * into v_room from public.battle_rooms where id = p_room_id for update;
  if not found then raise exception 'Room not found'; end if;
  if v_room.host_id <> auth.uid() then raise exception 'Only the host can advance'; end if;
  if v_room.status <> 'active' then return -1; end if;

  v_next := v_room.current_question_index + 1;

  if v_next < v_room.question_count then
    insert into public.battle_question_states (room_id, question_id, question_index, status, started_at, ends_at)
    select p_room_id, brq.question_id, v_next, 'active', now(), now() + make_interval(secs => v_room.time_per_question)
    from public.battle_room_questions brq
    where brq.room_id = p_room_id and brq.question_index = v_next
    on conflict (room_id, question_index) do nothing;

    update public.battle_rooms
    set current_question_index = v_next
    where id = p_room_id;
    return v_next;
  end if;

  -- finish: record history and update leaderboard ratings
  select count(*) into v_total from public.battle_players where room_id = p_room_id;

  for r in
    select * from public.battle_players
    where room_id = p_room_id
    order by score desc, max_streak desc, joined_at asc
  loop
    v_rank := v_rank + 1;
    v_change := greatest(-30, least(30, (v_total - v_rank * 2 + 1) * 12));

    insert into public.battle_leaderboard as bl (user_id, display_name, rating, total_battles, total_wins, total_score, avg_score, best_streak)
    values (r.user_id, r.display_name, 1000 + v_change, 1, case when v_rank = 1 then 1 else 0 end, r.score, r.score, r.max_streak)
    on conflict (user_id) do update set
      display_name = excluded.display_name,
      rating = greatest(0, bl.rating + v_change),
      total_battles = bl.total_battles + 1,
      total_wins = bl.total_wins + (case when v_rank = 1 then 1 else 0 end),
      total_score = bl.total_score + r.score,
      avg_score = round((bl.total_score + r.score)::numeric / (bl.total_battles + 1), 1),
      best_streak = greatest(bl.best_streak, r.max_streak),
      updated_at = now();

    select rating into v_rating from public.battle_leaderboard where user_id = r.user_id;

    update public.battle_leaderboard set rank_tier = case
      when v_rating >= 2000 then 'Legend'
      when v_rating >= 1600 then 'Diamond'
      when v_rating >= 1300 then 'Gold'
      when v_rating >= 1100 then 'Silver'
      else 'Bronze' end
    where user_id = r.user_id;

    insert into public.battle_history (room_id, user_id, display_name, subject_name, chapter_name, score, correct_count, wrong_count, max_streak, final_rank, rating_change, new_rating)
    values (
      p_room_id, r.user_id, r.display_name,
      (select name from public.subjects where id = v_room.subject_id),
      (select name from public.chapters where id = v_room.chapter_id),
      r.score, r.correct_count, r.wrong_count, r.max_streak, v_rank, v_change, coalesce(v_rating, 1000)
    );
  end loop;

  update public.battle_rooms set status = 'finished', finished_at = now() where id = p_room_id;
  return -1;
end; $$;

-- Battle cleanup ---------------------------------------------------------------------------------
create or replace function public.cleanup_old_battle_rooms()
returns void
language sql volatile security definer set search_path = public
as $$
  delete from public.battle_rooms
  where created_at < now() - interval '24 hours'
     or (status = 'finished' and finished_at < now() - interval '2 hours');
$$;

-- Adaptive question picker --------------------------------------------------------------------------
create or replace function public.get_adaptive_question(
  p_chapter_id uuid,
  p_subject_id uuid,
  p_user_id uuid,
  p_exclude_ids uuid[] default '{}'
)
returns table (difficulty_bucket text, question_id uuid, skill_match_score numeric)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_skill numeric := 50;
  v_bucket text;
begin
  select skill_level into v_skill from public.user_skill_levels
  where user_id = p_user_id and chapter_id = p_chapter_id;
  v_skill := coalesce(v_skill, 50);

  v_bucket := case
    when v_skill < 40 then 'auto_easy'
    when v_skill < 70 then 'auto_medium'
    else 'auto_hard' end;

  return query
  select v_bucket,
         q.id,
         (100 - abs(v_skill - case q.difficulty
            when 'auto_easy' then 25
            when 'auto_medium' then 55
            when 'auto_hard' then 85
            else 55 end))::numeric
  from public.questions q
  where q.chapter_id = p_chapter_id
    and q.subject_id = p_subject_id
    and q.correct_option_index is not null
    and not (q.id = any (coalesce(p_exclude_ids, '{}')))
  order by
    (q.difficulty::text = v_bucket) desc,
    random()
  limit 1;
end; $$;

-- Mock progress -----------------------------------------------------------------------------------
create or replace function public.get_user_mock_progress(p_limit integer default 10)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(row_data order by finished_at asc), '[]'::jsonb)
  from (
    select
      a.finished_at,
      jsonb_build_object(
        'attemptId', a.id,
        'finishedAt', a.finished_at,
        'score', coalesce(a.score, 0),
        'totalQuestions', coalesce(array_length(a.question_ids, 1), (select count(*) from public.attempt_answers aa where aa.attempt_id = a.id)),
        'maxScore', coalesce(array_length(a.question_ids, 1), (select count(*) from public.attempt_answers aa where aa.attempt_id = a.id)) * 4,
        'correct', coalesce((a.details ->> 'correctCount')::integer, (select count(*) from public.attempt_answers aa where aa.attempt_id = a.id and aa.is_correct)),
        'wrong', coalesce((a.details ->> 'wrongCount')::integer, (select count(*) from public.attempt_answers aa where aa.attempt_id = a.id and aa.is_correct = false)),
        'percentage', case
          when coalesce(array_length(a.question_ids, 1), (select count(*) from public.attempt_answers aa where aa.attempt_id = a.id)) > 0
          then round(100.0 * coalesce(a.score, 0) / (coalesce(array_length(a.question_ids, 1), (select count(*) from public.attempt_answers aa where aa.attempt_id = a.id)) * 4), 1)
          else 0 end,
        'accuracy', case
          when (select count(*) from public.attempt_answers aa where aa.attempt_id = a.id and aa.chosen_option_index is not null) > 0
          then round(100.0 * (select count(*) from public.attempt_answers aa where aa.attempt_id = a.id and aa.is_correct)
               / (select count(*) from public.attempt_answers aa where aa.attempt_id = a.id and aa.chosen_option_index is not null), 1)
          else 0 end
      ) as row_data
    from public.attempts a
    where a.user_id = auth.uid()
      and a.type = 'mock'
      and a.finished_at is not null
    order by a.finished_at desc
    limit p_limit
  ) sub;
$$;

-- Full mock test analysis -----------------------------------------------------------------------------
create or replace function public.get_mock_test_analysis(p_attempt_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_attempt public.attempts%rowtype;
  v_total integer;
  v_correct integer;
  v_wrong integer;
  v_unattempted integer;
  v_score numeric;
  v_max numeric;
  v_has_time boolean;
  v_avg_time numeric;
  v_duration integer;
  v_subjects jsonb;
  v_chapters jsonb;
  v_topics jsonb;
  v_slowest jsonb;
  v_guesses jsonb;
  v_rank integer;
  v_peers integer;
  v_is_full boolean;
begin
  select * into v_attempt from public.attempts where id = p_attempt_id;
  if not found then raise exception 'Attempt not found'; end if;
  if v_attempt.user_id <> auth.uid() and not public.is_admin(auth.uid()) then
    raise exception 'Not authorized';
  end if;

  select count(*),
         count(*) filter (where is_correct),
         count(*) filter (where is_correct = false),
         count(*) filter (where chosen_option_index is null),
         bool_or(time_taken_seconds is not null),
         avg(time_taken_seconds) filter (where time_taken_seconds is not null)
  into v_total, v_correct, v_wrong, v_unattempted, v_has_time, v_avg_time
  from public.attempt_answers where attempt_id = p_attempt_id;

  v_score := v_correct * 4 - v_wrong;
  v_max := v_total * 4;
  v_duration := case when v_attempt.finished_at is not null
    then extract(epoch from v_attempt.finished_at - v_attempt.started_at)::integer else null end;

  -- peer comparison among finished mocks with same question count
  select count(*) + 1, (select count(*) from public.attempts p
      where p.type = 'mock' and p.finished_at is not null and p.id <> p_attempt_id
        and coalesce(array_length(p.question_ids,1),0) = coalesce(array_length(v_attempt.question_ids,1),0))
  into v_rank, v_peers
  from public.attempts p
  where p.type = 'mock' and p.finished_at is not null and p.id <> p_attempt_id
    and coalesce(array_length(p.question_ids,1),0) = coalesce(array_length(v_attempt.question_ids,1),0)
    and coalesce(p.score, 0) > coalesce(v_attempt.score, v_score);

  v_is_full := v_total >= 170;

  select coalesce(jsonb_agg(s order by (s ->> 'marks')::numeric desc), '[]'::jsonb) into v_subjects
  from (
    select jsonb_build_object(
      'subjectId', sub.id, 'subject', sub.name,
      'totalQuestions', count(*),
      'correct', count(*) filter (where aa.is_correct),
      'wrong', count(*) filter (where aa.is_correct = false),
      'unattempted', count(*) filter (where aa.chosen_option_index is null),
      'marks', count(*) filter (where aa.is_correct) * 4 - count(*) filter (where aa.is_correct = false),
      'maxMarks', count(*) * 4,
      'accuracy', case when count(*) filter (where aa.chosen_option_index is not null) > 0
        then round(100.0 * count(*) filter (where aa.is_correct) / count(*) filter (where aa.chosen_option_index is not null), 1) else 0 end,
      'attemptRate', round(100.0 * count(*) filter (where aa.chosen_option_index is not null) / count(*), 1),
      'avgTimeSeconds', round(avg(aa.time_taken_seconds) filter (where aa.time_taken_seconds is not null)::numeric, 1),
      'totalTimeSeconds', coalesce(sum(aa.time_taken_seconds), 0)
    ) as s
    from public.attempt_answers aa
    join public.questions q on q.id = aa.question_id
    join public.subjects sub on sub.id = q.subject_id
    where aa.attempt_id = p_attempt_id
    group by sub.id, sub.name
  ) x;

  select coalesce(jsonb_agg(c order by (c ->> 'accuracy')::numeric asc), '[]'::jsonb) into v_chapters
  from (
    select jsonb_build_object(
      'chapterId', ch.id, 'chapter', ch.name, 'subject', sub.name, 'subjectId', sub.id,
      'totalQuestions', count(*),
      'correct', count(*) filter (where aa.is_correct),
      'wrong', count(*) filter (where aa.is_correct = false),
      'unattempted', count(*) filter (where aa.chosen_option_index is null),
      'marks', count(*) filter (where aa.is_correct) * 4 - count(*) filter (where aa.is_correct = false),
      'maxMarks', count(*) * 4,
      'accuracy', case when count(*) filter (where aa.chosen_option_index is not null) > 0
        then round(100.0 * count(*) filter (where aa.is_correct) / count(*) filter (where aa.chosen_option_index is not null), 1) else 0 end,
      'avgTimeSeconds', round(avg(aa.time_taken_seconds) filter (where aa.time_taken_seconds is not null)::numeric, 1)
    ) as c
    from public.attempt_answers aa
    join public.questions q on q.id = aa.question_id
    join public.chapters ch on ch.id = q.chapter_id
    join public.subjects sub on sub.id = q.subject_id
    where aa.attempt_id = p_attempt_id
    group by ch.id, ch.name, sub.id, sub.name
  ) x;

  select coalesce(jsonb_agg(t order by (t ->> 'accuracy')::numeric asc), '[]'::jsonb) into v_topics
  from (
    select jsonb_build_object(
      'topicId', tp.id, 'topic', tp.name, 'chapter', ch.name, 'chapterId', ch.id,
      'subject', sub.name, 'subjectId', sub.id,
      'totalQuestions', count(*),
      'correct', count(*) filter (where aa.is_correct),
      'wrong', count(*) filter (where aa.is_correct = false),
      'unattempted', count(*) filter (where aa.chosen_option_index is null),
      'accuracy', case when count(*) filter (where aa.chosen_option_index is not null) > 0
        then round(100.0 * count(*) filter (where aa.is_correct) / count(*) filter (where aa.chosen_option_index is not null), 1) else 0 end
    ) as t
    from public.attempt_answers aa
    join public.questions q on q.id = aa.question_id
    join public.question_topics qt on qt.question_id = q.id
    join public.topics tp on tp.id = qt.topic_id
    join public.chapters ch on ch.id = tp.chapter_id
    join public.subjects sub on sub.id = ch.subject_id
    where aa.attempt_id = p_attempt_id
    group by tp.id, tp.name, ch.id, ch.name, sub.id, sub.name
  ) x;

  select coalesce(jsonb_agg(sq), '[]'::jsonb) into v_slowest
  from (
    select jsonb_build_object(
      'questionId', q.id,
      'questionPreview', left(regexp_replace(q.question_text, '<[^>]+>', '', 'g'), 120),
      'chapter', ch.name, 'subject', sub.name,
      'timeSeconds', aa.time_taken_seconds,
      'isCorrect', coalesce(aa.is_correct, false)
    ) as sq
    from public.attempt_answers aa
    join public.questions q on q.id = aa.question_id
    join public.chapters ch on ch.id = q.chapter_id
    join public.subjects sub on sub.id = q.subject_id
    where aa.attempt_id = p_attempt_id and aa.time_taken_seconds is not null
    order by aa.time_taken_seconds desc
    limit 5
  ) x;

  select coalesce(jsonb_agg(gq), '[]'::jsonb) into v_guesses
  from (
    select jsonb_build_object(
      'questionId', q.id,
      'questionPreview', left(regexp_replace(q.question_text, '<[^>]+>', '', 'g'), 120),
      'chapter', ch.name, 'subject', sub.name,
      'timeSeconds', aa.time_taken_seconds,
      'isCorrect', coalesce(aa.is_correct, false)
    ) as gq
    from public.attempt_answers aa
    join public.questions q on q.id = aa.question_id
    join public.chapters ch on ch.id = q.chapter_id
    join public.subjects sub on sub.id = q.subject_id
    where aa.attempt_id = p_attempt_id
      and aa.time_taken_seconds is not null and aa.time_taken_seconds <= 8
      and aa.chosen_option_index is not null
    order by aa.time_taken_seconds asc
    limit 5
  ) x;

  return jsonb_build_object(
    'attemptId', p_attempt_id,
    'overall', jsonb_build_object(
      'totalQuestions', v_total,
      'correct', v_correct,
      'wrong', v_wrong,
      'unattempted', v_unattempted,
      'score', v_score,
      'maxScore', v_max,
      'percentage', case when v_max > 0 then round(100.0 * v_score / v_max, 1) else 0 end,
      'accuracy', case when (v_correct + v_wrong) > 0 then round(100.0 * v_correct / (v_correct + v_wrong), 1) else 0 end,
      'attemptRate', case when v_total > 0 then round(100.0 * (v_correct + v_wrong) / v_total, 1) else 0 end,
      'positiveMarks', v_correct * 4,
      'negativeMarks', v_wrong,
      'startedAt', v_attempt.started_at,
      'finishedAt', v_attempt.finished_at,
      'durationSeconds', v_duration,
      'hasTimeData', coalesce(v_has_time, false),
      'avgTimePerQuestionSeconds', round(v_avg_time, 1),
      'timeEfficiencyScore', case when v_has_time and v_avg_time is not null
        then round(greatest(0, least(100, 100 - abs(v_avg_time - 60))), 0) else null end,
      'rank', case when v_peers >= 4 then v_rank else null end,
      'totalPeers', coalesce(v_peers, 0),
      'percentile', case when v_peers >= 4
        then round(100.0 * (v_peers + 1 - v_rank) / (v_peers + 1), 1) else null end,
      'hasEnoughPeerData', coalesce(v_peers, 0) >= 4,
      'isFullSyllabusMock', v_is_full,
      'neetScorePrediction', case when v_is_full and v_total > 0
        then round(720.0 * v_score / v_max) else null end
    ),
    'subjects', v_subjects,
    'chapters', v_chapters,
    'topics', v_topics,
    'weakChapters', (select coalesce(jsonb_agg(e), '[]'::jsonb) from (
      select e from jsonb_array_elements(v_chapters) e
      where (e ->> 'accuracy')::numeric < 60 and ((e ->> 'correct')::int + (e ->> 'wrong')::int) > 0
      limit 5) w),
    'strongChapters', (select coalesce(jsonb_agg(e), '[]'::jsonb) from (
      select e from jsonb_array_elements(v_chapters) e
      where (e ->> 'accuracy')::numeric >= 80 and ((e ->> 'correct')::int + (e ->> 'wrong')::int) > 0
      order by (e ->> 'accuracy')::numeric desc limit 5) s),
    'weakTopics', (select coalesce(jsonb_agg(e), '[]'::jsonb) from (
      select e from jsonb_array_elements(v_topics) e
      where (e ->> 'accuracy')::numeric < 60 and ((e ->> 'correct')::int + (e ->> 'wrong')::int) > 0
      limit 5) wt),
    'strongTopics', (select coalesce(jsonb_agg(e), '[]'::jsonb) from (
      select e from jsonb_array_elements(v_topics) e
      where (e ->> 'accuracy')::numeric >= 80 and ((e ->> 'correct')::int + (e ->> 'wrong')::int) > 0
      order by (e ->> 'accuracy')::numeric desc limit 5) st),
    'slowestQuestions', v_slowest,
    'quickGuesses', v_guesses,
    'mistakePatterns', case when v_has_time then jsonb_build_object(
      'likelyGuess', (select count(*) from public.attempt_answers aa where aa.attempt_id = p_attempt_id and aa.is_correct = false and aa.time_taken_seconds <= 8),
      'overthinking', (select count(*) from public.attempt_answers aa where aa.attempt_id = p_attempt_id and aa.is_correct = false and aa.time_taken_seconds >= 120),
      'timePressure', (select count(*) from public.attempt_answers aa where aa.attempt_id = p_attempt_id and aa.chosen_option_index is null),
      'knowledgeGap', (select count(*) from public.attempt_answers aa where aa.attempt_id = p_attempt_id and aa.is_correct = false and aa.time_taken_seconds > 8 and aa.time_taken_seconds < 120)
    ) else null end
  );
end; $$;

-- Daily study plan generator -------------------------------------------------------------------------
create or replace function public.generate_daily_plan(p_user_id uuid)
returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_plan jsonb := '[]'::jsonb;
  r record;
  v_i integer := 0;
begin
  -- weakest chapters first (from skill levels), fallback to random chapters
  for r in (
    select ch.id, ch.name, s.name as subject_name
    from public.user_skill_levels usl
    join public.chapters ch on ch.id = usl.chapter_id
    join public.subjects s on s.id = ch.subject_id
    where usl.user_id = p_user_id
    order by usl.skill_level asc
    limit 3
  ) loop
    v_i := v_i + 1;
    v_plan := v_plan || jsonb_build_object(
      'id', 'task-' || v_i,
      'type', 'practice',
      'title', 'Practice: ' || r.name,
      'subject', r.subject_name,
      'chapterId', r.id,
      'target', 15,
      'minutes', 30
    );
  end loop;

  if v_i = 0 then
    for r in (
      select ch.id, ch.name, s.name as subject_name
      from public.chapters ch
      join public.subjects s on s.id = ch.subject_id
      order by random() limit 3
    ) loop
      v_i := v_i + 1;
      v_plan := v_plan || jsonb_build_object(
        'id', 'task-' || v_i,
        'type', 'practice',
        'title', 'Practice: ' || r.name,
        'subject', r.subject_name,
        'chapterId', r.id,
        'target', 15,
        'minutes', 30
      );
    end loop;
  end if;

  v_plan := v_plan || jsonb_build_object('id', 'task-revision', 'type', 'revision', 'title', 'Review mistakes from recent tests', 'minutes', 20)
                   || jsonb_build_object('id', 'task-pyq', 'type', 'pyq', 'title', 'Solve one PYQ set', 'minutes', 25);

  insert into public.daily_study_plans (user_id, date, plan, total_tasks)
  values (p_user_id, current_date, v_plan, jsonb_array_length(v_plan))
  on conflict (user_id, date) do update set plan = excluded.plan, total_tasks = excluded.total_tasks, updated_at = now();

  return v_plan;
end; $$;
