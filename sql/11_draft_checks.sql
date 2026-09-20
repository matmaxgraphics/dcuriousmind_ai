-- d_CuriousMind — store automated review results alongside each draft.
--
-- Two checks run right after a draft is generated:
--   fact check    — is every claim supported by the source it was written from?
--   quality check — does it open with the question, name the assumption, and
--                   sound like a person rather than an AI?
--
-- Neither gates anything. Every draft still reaches the human reviewer; the
-- checks tell that reviewer where to look. This matters most for generated
-- questions, where the topic was proposed by AI and grounded afterwards.
--
-- Safe to re-run.

begin;

alter table public.drafts
  add column if not exists checks jsonb;

-- Lets the dashboard find drafts needing closer attention:
--   select * from drafts where checks->'factCheck'->>'verdict' = 'fail';
create index if not exists drafts_fact_verdict_idx
  on public.drafts ((checks -> 'factCheck' ->> 'verdict'));

commit;

-- ── Verify ───────────────────────────────────────────────────────────────────
select
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'drafts'
      and column_name = 'checks')          as checks_column_added,
  (select count(*) from public.drafts)     as existing_drafts,
  (select count(*) from public.drafts
    where checks is null)                  as drafts_without_checks;
