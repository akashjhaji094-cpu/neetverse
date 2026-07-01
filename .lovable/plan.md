## Goal
Har chapter ke andar ek naya **Topic** layer add karna. Existing questions ko topics me auto-assign karo keyword matching se. Ek question multiple topics me ho sakta hai. Practice, Admin, Revision, PYQs, Mock — sab jagah topic filter.

## 1. Database schema (migration)

New tables:
- `topics(id, chapter_id, name, slug, position, created_at)` — ek chapter me kayi topics
- `question_topics(question_id, topic_id, PRIMARY KEY(question_id, topic_id))` — junction table (ek question multiple topics me)

Grants + RLS: public read (jaise `chapters`), admin write only.

Index on `question_topics(topic_id)` for fast fetch.

## 2. Seed data
Ek migration me saare chapters ke topics insert karo (jo user ne diye hain). "Question Practice" / "Question practice session" wale entries ko **skip** karna hai — jo chapter me koi question topic-match na ho, un questions ko ek default **"General"** topic me daal denge (auto-created per chapter).

## 3. Auto-classification script (edge function: `classify-questions`)
Admin-only trigger. Ye function:
1. Har chapter ke topics + keywords load karega (topic name se derived: e.g. "Kössel-Lewis Approach" → ["kössel", "lewis"]; "VSEPR Theory" → ["vsepr"]).
2. Har question ka `question_text` (lowercased) scan karega, match hone wale saare topics ke `question_topics` me link banayega.
3. Jinka koi match nahi → chapter ke "General" topic me daal do.

Keyword dictionary hardcoded per chapter (topic name + curated synonyms). User ne bola "atoms + semiconductor" waise cross-chapter cases bhi possible — hum question ke chapter tak limited nahi, **saare chapters** ke topics ke against match karenge. Multi-match = multiple rows in `question_topics`.

Idempotent: pehle `DELETE FROM question_topics WHERE question_id = ...` phir insert.

## 4. UI changes

**Practice page** (`src/pages/Practice.tsx`)
- Chapter click → naya Topic-list view (chapter ke topics + counts). Topic click → TestConfig.
- Question count RPC ko upgrade: `get_question_counts_per_topic()`.

**Admin upload** (`src/components/admin/HtmlUpload.tsx`, `PyqsUpload.tsx`)
- Chapter dropdown ke baad **Topic dropdown** (optional). Agar select kiya to un questions ko us topic pe force-tag karo (`question_topics` insert).
- "Re-run auto-classification" button (calls edge function).

**Revision** (`src/pages/Revision.tsx`)
- Filter: Subject → Chapter → Topic (optional) → Wrong/Unattempted.

**PYQs** (`src/pages/Pyqs.tsx`)
- Chapter view me topic sub-filter add.

**Mock config** (`src/components/mock/MockTestConfig.tsx`)
- Chapter row expand karke topics checkbox. Agar sirf chapter tick hai to poore chapter se. Agar specific topics tick hain to sirf un topics se.

## 5. Fetch logic
Har jagah jaha `questions.chapter_id = X` filter tha, agar topic bhi select hai to:
```sql
SELECT q.* FROM questions q
JOIN question_topics qt ON qt.question_id = q.id
WHERE qt.topic_id IN (...)
```
Duplicate rows possible when question 2 topics me hai + dono topics selected — jaisa user ne bola, count 2 hoga. Practice me distinct rakhenge (ek hi user ke saamne 2 baar same Q na aaye per session), lekin topic-wise total count me duplicate.

## 6. Rollout order
1. Migration: tables + grants + seed topics.
2. Edge function: classify-questions (admin-only).
3. Admin panel: "Run classification" button — user click karega, ~thousands of questions classify honge.
4. Practice UI update.
5. Revision, PYQs, Mock updates.
6. Admin upload topic dropdown.

## Notes
- "Question Practice" topic entries ignored (per user).
- Chapters not on the list stay chapter-only (no topics), same as before.
- Existing chapter-wise APIs preserved for backward compat.

Ready ho to bolo, migration se start karta hu.