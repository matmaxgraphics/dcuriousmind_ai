-- d_CuriousMind — Phase 5: enforce the pipeline invariants in the database.
--
--   1 article -> at most 1 draft
--   1 draft   -> at most 1 thread
--   1 source name -> 1 source row
--
-- Run 02_preview_duplicate_threads.sql FIRST and check the DELETE rows.
-- This script DELETES the 3 surplus threads it lists (their tweets cascade).
-- Everything runs in one transaction and is safe to re-run.

begin;

-- ── 1. Dedupe threads: keep the newest per draft ─────────────────────────────
with ranked as (
  select
    id,
    row_number() over (
      partition by draft_id
      order by created_at desc, id desc
    ) as rn
  from public.threads
)
delete from public.threads t
using ranked r
where t.id = r.id
  and r.rn > 1;

-- ── 2. The invariants ────────────────────────────────────────────────────────
-- Postgres has no ADD CONSTRAINT IF NOT EXISTS, hence the guards.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'threads_draft_id_unique'
      and connamespace = 'public'::regnamespace
  ) then
    alter table public.threads
      add constraint threads_draft_id_unique unique (draft_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'drafts_article_id_unique'
      and connamespace = 'public'::regnamespace
  ) then
    alter table public.drafts
      add constraint drafts_article_id_unique unique (article_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'sources_name_unique'
      and connamespace = 'public'::regnamespace
  ) then
    alter table public.sources
      add constraint sources_name_unique unique (name);
  end if;
end $$;

-- ── 3. Drop now-redundant indexes ────────────────────────────────────────────
-- The unique constraints above create btree indexes on exactly these columns.

drop index if exists public.threads_draft_id_idx;
drop index if exists public.drafts_article_id_idx;

commit;

-- ── Verify ───────────────────────────────────────────────────────────────────
select
  (select count(*) from public.threads)                                as threads,
  (select count(*) from public.drafts)                                 as drafts,
  (select count(*) from public.thread_tweets)                          as tweets,
  (select count(*) from (
     select draft_id from public.threads group by draft_id having count(*) > 1
   ) t)                                                                as dup_threads,
  (select count(*) from (
     select article_id from public.drafts group by article_id having count(*) > 1
   ) t)                                                                as dup_drafts;
