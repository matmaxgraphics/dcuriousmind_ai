-- d_CuriousMind — migration doctor.
--
-- READ-ONLY. ONE statement, so the SQL editor cannot drop the result.
-- Every row should read APPLIED. Anything MISSING names the file to run.

select
  migration,
  case when ok then 'APPLIED' else '>>> MISSING - RUN THIS FILE' end as status,
  what
from (

  select 1 as ord, '03_harden' as migration,
    (select count(*) from pg_constraint
      where conname in ('threads_draft_id_unique','drafts_article_id_unique','sources_name_unique')
        and connamespace = 'public'::regnamespace) = 3 as ok,
    'unique constraints on threads.draft_id, drafts.article_id, sources.name' as what

  union all
  select 2, '04_pipeline_runs',
    to_regclass('public.pipeline_runs') is not null
    and exists (select 1 from pg_indexes
                 where schemaname = 'public'
                   and indexname = 'pipeline_runs_single_active'),
    'pipeline_runs table + the concurrency lock index'

  union all
  select 3, '05_thread_status',
    exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'threads'
               and column_name = 'status'),
    'threads.status, approved_at, published_at, x_thread_id'

  union all
  select 4, '06_seed_sources',
    (select count(*) from public.sources
      where name in ('ScienceDaily Strange & Offbeat','ScienceAlert',
                     'Smithsonian Magazine','Discover Magazine')) = 4,
    'the four additional RSS sources'

  union all
  select 5, '07_phenomenon_type',
    exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'topic_scores'
               and column_name = 'phenomenon_type'),
    'topic_scores.phenomenon_type - WITHOUT THIS EVERY SCORE SAVE FAILS'

  union all
  select 6, '08_swap_sources',
    exists (select 1 from public.sources where name = 'Mental Floss')
    and not exists (select 1 from public.sources
                     where name in ('ScienceDaily Strange & Offbeat',
                                    'ScienceAlert','Smithsonian Magazine')
                       and active),
    'Mental Floss added AND the three news wires deactivated'

  union all
  select 7, '09_generated_source_type',
    exists (select 1 from pg_type t join pg_enum e on e.enumtypid = t.oid
             where t.typname = 'source_type' and e.enumlabel = 'generated'),
    'source_type enum includes generated'

  union all
  select 8, '10_seed_generated_source',
    exists (select 1 from public.sources where name = 'Generated Questions'),
    'the Generated Questions source row'

  union all
  select 9, '11_draft_checks',
    exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'drafts'
               and column_name = 'checks'),
    'drafts.checks - WITHOUT THIS EVERY DRAFT SAVE FAILS'

) as checks
order by ord;
