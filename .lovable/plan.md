Battle Arena (1539 lines) and Adaptive Learning (1080 lines) dono me multiple issues hain + battle answers ka server-side security refactor bhi chahiye. Ek turn me sab safely nahi ho sakta. Phased plan (har phase ke baad test kar sakte ho):

## ✅ Already done this turn
- MathJax delimiter bug fix (`\\(` `\\)` were double-escaped → LaTeX ab render hoga sab jagah)
- RLS enabled on `adaptive_question_pools`

## Phase 1 — Battle Arena backend (secure + fix logic)
Database migration:
- New table `battle_room_questions(room_id, question_index, question_id)` — sirf question IDs, koi answers nahi
- `battle_rooms.questions` JSONB purge (deprecated column, backfilled empty)
- RPC `battle_start_room(room_id)` — host-only, populates questions from `questions` table
- RPC `battle_submit_answer(room_id, q_index, option_index)` — server checks correctness against real `questions.correct_option_index`, computes score, updates `battle_players` + `battle_question_states`
- RPC `battle_get_question(room_id, q_index)` — returns question + options WITHOUT `correct_option_index`
- RPC `battle_reveal_answer(room_id, q_index)` — returns correct index only after round `ends_at` passed
- Realtime enable on `battle_players`, `battle_question_states`, `battle_rooms`

## Phase 2 — Battle Arena frontend rewrite
`src/pages/BattleArena.tsx` split into:
- `BattleLobby.tsx` — room list, create, join by code
- `BattleRoom.tsx` — waiting room + realtime players sync
- `BattleGame.tsx` — uses RPCs above, no client-side answer knowledge
- `BattleResults.tsx` — final scoreboard, ratings
- All answer/score checks routed through RPCs

## Phase 3 — Adaptive Learning
`src/pages/AdaptiveLearning.tsx` refactor:
- Fix question fetching (use existing `get_adaptive_question` RPC properly with `p_exclude_ids` = already-seen question IDs from session)
- Session state persisted every question (fix "progress not saved")
- Wire up `update_skill_level_after_attempt` trigger (currently missing from DB — add it in the same migration)
- Add proper submit → next-question flow with error boundaries
- Show skill level progress + weak topics

## Phase 4 — Polish
- Loading/empty/error states
- Mobile layout pass
- Sound cues re-hooked
- Rating tier animations

---

**Recommendation:** Approve karo, main **Phase 1 pehle** karta hoon (migration + RPCs) — usse security finding bhi close ho jaayega. Phir Phase 2, 3, 4 ek-ek turn me. Har phase ke baad tum test kar sakte ho.

Bolo "start phase 1" toh chalu karta hoon.