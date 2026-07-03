
-- ============ 1. New table: battle_room_questions (IDs only) ============
CREATE TABLE IF NOT EXISTS public.battle_room_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.battle_rooms(id) ON DELETE CASCADE,
  question_index int NOT NULL,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(room_id, question_index)
);

GRANT SELECT ON public.battle_room_questions TO authenticated;
GRANT ALL ON public.battle_room_questions TO service_role;
ALTER TABLE public.battle_room_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth users read room questions" ON public.battle_room_questions;
CREATE POLICY "Auth users read room questions"
ON public.battle_room_questions FOR SELECT TO authenticated USING (true);

-- ============ 2. Strip answers from existing battle_rooms.questions JSONB ============
UPDATE public.battle_rooms SET questions = '[]'::jsonb WHERE questions IS NOT NULL;

-- ============ 3. Lock down battle_rooms SELECT (was USING true) ============
DROP POLICY IF EXISTS "Anyone can view battle rooms" ON public.battle_rooms;
DROP POLICY IF EXISTS "Anyone can view active rooms" ON public.battle_rooms;
DROP POLICY IF EXISTS "Anyone can view waiting rooms" ON public.battle_rooms;

CREATE POLICY "Auth users view rooms"
ON public.battle_rooms FOR SELECT TO authenticated USING (true);

-- ============ 4. RPC: start room (host only) ============
CREATE OR REPLACE FUNCTION public.battle_start_room(p_room_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room RECORD;
  v_qid uuid;
  v_idx int := 0;
BEGIN
  SELECT * INTO v_room FROM public.battle_rooms WHERE id = p_room_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;
  IF v_room.host_id <> auth.uid() THEN RAISE EXCEPTION 'Only host can start'; END IF;
  IF v_room.status NOT IN ('waiting', 'countdown') THEN RAISE EXCEPTION 'Room already started'; END IF;

  DELETE FROM public.battle_room_questions WHERE room_id = p_room_id;

  FOR v_qid IN
    SELECT id FROM public.questions
    WHERE (v_room.chapter_id IS NULL OR chapter_id = v_room.chapter_id)
      AND (v_room.subject_id IS NULL OR subject_id = v_room.subject_id)
    ORDER BY random()
    LIMIT v_room.question_count
  LOOP
    INSERT INTO public.battle_room_questions(room_id, question_index, question_id)
    VALUES (p_room_id, v_idx, v_qid);
    v_idx := v_idx + 1;
  END LOOP;

  UPDATE public.battle_rooms
  SET status = 'active',
      started_at = now(),
      current_question_index = 0
  WHERE id = p_room_id;

  INSERT INTO public.battle_question_states(room_id, question_index, question_id, started_at, ends_at, status)
  SELECT p_room_id, 0, question_id, now(), now() + (v_room.time_per_question || ' seconds')::interval, 'active'
  FROM public.battle_room_questions WHERE room_id = p_room_id AND question_index = 0;
END;
$$;

REVOKE ALL ON FUNCTION public.battle_start_room(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.battle_start_room(uuid) TO authenticated;

-- ============ 5. RPC: get question WITHOUT correct answer ============
CREATE OR REPLACE FUNCTION public.battle_get_question(p_room_id uuid, p_index int)
RETURNS TABLE(
  question_id uuid,
  question_text text,
  options jsonb,
  question_image text,
  ends_at timestamptz,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.battle_players WHERE room_id = p_room_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not in room';
  END IF;

  RETURN QUERY
  SELECT q.id, q.question_text, q.options, q.question_image, s.ends_at, s.status
  FROM public.battle_room_questions rq
  JOIN public.questions q ON q.id = rq.question_id
  LEFT JOIN public.battle_question_states s ON s.room_id = rq.room_id AND s.question_index = rq.question_index
  WHERE rq.room_id = p_room_id AND rq.question_index = p_index;
END;
$$;

REVOKE ALL ON FUNCTION public.battle_get_question(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.battle_get_question(uuid, int) TO authenticated;

-- ============ 6. RPC: submit answer (server checks correctness) ============
CREATE OR REPLACE FUNCTION public.battle_submit_answer(
  p_room_id uuid,
  p_question_index int,
  p_option_index int,
  p_time_taken_ms int
)
RETURNS TABLE(is_correct boolean, score_gained int, new_streak int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qid uuid;
  v_correct int;
  v_is_correct boolean;
  v_time_limit_ms int;
  v_score int := 0;
  v_current_streak int := 0;
  v_state RECORD;
  v_answers jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.battle_players WHERE room_id = p_room_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not in room';
  END IF;

  SELECT * INTO v_state FROM public.battle_question_states
   WHERE room_id = p_room_id AND question_index = p_question_index;
  IF NOT FOUND THEN RAISE EXCEPTION 'Question state missing'; END IF;
  IF now() > v_state.ends_at THEN
    -- Late submit: mark as incorrect
    v_is_correct := false;
  END IF;

  SELECT q.id, q.correct_option_index INTO v_qid, v_correct
  FROM public.battle_room_questions rq
  JOIN public.questions q ON q.id = rq.question_id
  WHERE rq.room_id = p_room_id AND rq.question_index = p_question_index;

  IF v_is_correct IS NULL THEN
    v_is_correct := (p_option_index = v_correct);
  END IF;

  SELECT streak INTO v_current_streak FROM public.battle_players WHERE room_id = p_room_id AND user_id = auth.uid();
  v_current_streak := COALESCE(v_current_streak, 0);

  SELECT time_per_question * 1000 INTO v_time_limit_ms FROM public.battle_rooms WHERE id = p_room_id;
  v_score := public.calculate_battle_score(v_is_correct, p_time_taken_ms, v_time_limit_ms, v_current_streak);

  -- Update player
  UPDATE public.battle_players
  SET score = score + v_score,
      correct_count = correct_count + CASE WHEN v_is_correct THEN 1 ELSE 0 END,
      wrong_count   = wrong_count   + CASE WHEN v_is_correct THEN 0 ELSE 1 END,
      streak = CASE WHEN v_is_correct THEN streak + 1 ELSE 0 END,
      max_streak = GREATEST(max_streak, CASE WHEN v_is_correct THEN streak + 1 ELSE streak END)
  WHERE room_id = p_room_id AND user_id = auth.uid();

  -- Record in question_states.player_answers (no correct answer stored client-visible until reveal)
  v_answers := COALESCE(v_state.player_answers, '{}'::jsonb);
  v_answers := v_answers || jsonb_build_object(
    auth.uid()::text,
    jsonb_build_object(
      'option_index', p_option_index,
      'time_taken_ms', p_time_taken_ms,
      'is_correct', v_is_correct
    )
  );
  UPDATE public.battle_question_states
  SET player_answers = v_answers
  WHERE room_id = p_room_id AND question_index = p_question_index;

  RETURN QUERY SELECT v_is_correct, v_score, (CASE WHEN v_is_correct THEN v_current_streak + 1 ELSE 0 END);
END;
$$;

REVOKE ALL ON FUNCTION public.battle_submit_answer(uuid, int, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.battle_submit_answer(uuid, int, int, int) TO authenticated;

-- ============ 7. RPC: reveal correct answer (only after ends_at) ============
CREATE OR REPLACE FUNCTION public.battle_reveal_answer(p_room_id uuid, p_question_index int)
RETURNS TABLE(correct_option_index int, explanation text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_state RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.battle_players WHERE room_id = p_room_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not in room';
  END IF;
  SELECT * INTO v_state FROM public.battle_question_states WHERE room_id = p_room_id AND question_index = p_question_index;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not found'; END IF;
  IF now() < v_state.ends_at THEN RAISE EXCEPTION 'Round not finished'; END IF;

  RETURN QUERY
  SELECT q.correct_option_index, q.explanation
  FROM public.battle_room_questions rq
  JOIN public.questions q ON q.id = rq.question_id
  WHERE rq.room_id = p_room_id AND rq.question_index = p_question_index;
END;
$$;

REVOKE ALL ON FUNCTION public.battle_reveal_answer(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.battle_reveal_answer(uuid, int) TO authenticated;

-- ============ 8. RPC: advance to next question (host only) ============
CREATE OR REPLACE FUNCTION public.battle_advance_question(p_room_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room RECORD;
  v_next int;
  v_next_qid uuid;
BEGIN
  SELECT * INTO v_room FROM public.battle_rooms WHERE id = p_room_id;
  IF v_room.host_id <> auth.uid() THEN RAISE EXCEPTION 'Only host'; END IF;

  v_next := v_room.current_question_index + 1;

  SELECT question_id INTO v_next_qid FROM public.battle_room_questions
   WHERE room_id = p_room_id AND question_index = v_next;

  IF NOT FOUND THEN
    -- No more questions => finish
    UPDATE public.battle_rooms SET status = 'finished', finished_at = now() WHERE id = p_room_id;
    RETURN -1;
  END IF;

  UPDATE public.battle_rooms SET current_question_index = v_next WHERE id = p_room_id;
  INSERT INTO public.battle_question_states(room_id, question_index, question_id, started_at, ends_at, status)
  VALUES (p_room_id, v_next, v_next_qid, now(), now() + (v_room.time_per_question || ' seconds')::interval, 'active')
  ON CONFLICT DO NOTHING;

  RETURN v_next;
END;
$$;

REVOKE ALL ON FUNCTION public.battle_advance_question(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.battle_advance_question(uuid) TO authenticated;

-- ============ 9. Realtime for battle tables ============
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.battle_rooms; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.battle_players; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.battle_question_states; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- ============ 10. Adaptive Learning: wire skill update trigger ============
DROP TRIGGER IF EXISTS trg_update_skill_on_answer ON public.attempt_answers;
CREATE TRIGGER trg_update_skill_on_answer
AFTER INSERT ON public.attempt_answers
FOR EACH ROW EXECUTE FUNCTION public.update_skill_level_after_attempt();
