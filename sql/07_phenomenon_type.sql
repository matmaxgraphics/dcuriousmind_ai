-- d_CuriousMind — record WHY a topic was selected or rejected.
--
-- Scoring now classifies each topic as an everyday phenomenon, discovery
-- news, or general interest, and rejects discovery news outright. Persisting
-- the classification makes selection auditable, and gives the future
-- analytics loop something to correlate engagement against.
--
-- Safe to re-run.

begin;

alter table public.topic_scores
  add column if not exists phenomenon_type text;

create index if not exists topic_scores_phenomenon_type_idx
  on public.topic_scores (phenomenon_type);

commit;

-- ── Verify ───────────────────────────────────────────────────────────────────
select
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'topic_scores'
      and column_name = 'phenomenon_type')            as column_added,
  (select count(*) from public.topic_scores
    where phenomenon_type is null)                    as unclassified_existing_scores;
