-- d_CuriousMind — Phase 5 pipeline hardening: database inspection
-- Run in the Supabase SQL Editor. Read-only: creates nothing, changes nothing.
-- Returns ONE row / ONE column of JSON. Click the cell, copy the whole value back.

with

-- ── Structure ────────────────────────────────────────────────────────────────
cols as (
  select
    table_name,
    jsonb_agg(
      jsonb_build_object(
        'column',   column_name,
        'type',     data_type,
        'nullable', is_nullable,
        'default',  column_default
      ) order by ordinal_position
    ) as columns
  from information_schema.columns
  where table_schema = 'public'
  group by table_name
),

cons as (
  select
    conrelid::regclass::text as table_name,
    jsonb_agg(
      jsonb_build_object(
        'name', conname,
        'kind', case contype
                  when 'p' then 'PRIMARY KEY'
                  when 'u' then 'UNIQUE'
                  when 'f' then 'FOREIGN KEY'
                  when 'c' then 'CHECK'
                  else contype::text
                end,
        'def',  pg_get_constraintdef(oid)
      ) order by contype, conname
    ) as constraints
  from pg_constraint
  where connamespace = 'public'::regnamespace
  group by conrelid
),

idx as (
  select
    tablename as table_name,
    jsonb_agg(indexdef order by indexname) as indexes
  from pg_indexes
  where schemaname = 'public'
  group by tablename
),

rls as (
  select
    c.relname as table_name,
    c.relrowsecurity as rls_enabled,
    (select count(*) from pg_policies p
      where p.schemaname = 'public' and p.tablename = c.relname) as policy_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
),

-- ── Volume ───────────────────────────────────────────────────────────────────
counts as (
  select jsonb_build_object(
    'sources',       (select count(*) from public.sources),
    'articles',      (select count(*) from public.articles),
    'topic_scores',  (select count(*) from public.topic_scores),
    'drafts',        (select count(*) from public.drafts),
    'threads',       (select count(*) from public.threads),
    'thread_tweets', (select count(*) from public.thread_tweets)
  ) as row_counts
),

-- ── Status model ─────────────────────────────────────────────────────────────
article_status as (
  select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) as v
  from (select coalesce(status::text, '<null>') as status, count(*) as n
        from public.articles group by 1) t
),

draft_status as (
  select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) as v
  from (select coalesce(status::text, '<null>') as status, count(*) as n
        from public.drafts group by 1) t
),

-- ── Enum definitions (the real status model) ─────────────────────────────────
enums as (
  select coalesce(jsonb_object_agg(x.typname, x.vals), '{}'::jsonb) as v
  from (
    select t.typname, jsonb_agg(e.enumlabel order by e.enumsortorder) as vals
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
    group by t.typname
  ) x
),

-- ── The 1:1 invariants we are about to enforce ───────────────────────────────
dup_articles as (
  select coalesce(jsonb_agg(jsonb_build_object(
           'source_id', source_id, 'url', url, 'copies', n)), '[]'::jsonb) as v
  from (select source_id, url, count(*) as n
        from public.articles group by 1, 2 having count(*) > 1
        order by count(*) desc limit 25) t
),

dup_drafts as (
  select coalesce(jsonb_agg(jsonb_build_object(
           'article_id', article_id, 'drafts', n)), '[]'::jsonb) as v
  from (select article_id, count(*) as n
        from public.drafts group by 1 having count(*) > 1
        order by count(*) desc limit 25) t
),

dup_threads as (
  select coalesce(jsonb_agg(jsonb_build_object(
           'draft_id', draft_id, 'threads', n)), '[]'::jsonb) as v
  from (select draft_id, count(*) as n
        from public.threads group by 1 having count(*) > 1
        order by count(*) desc limit 25) t
),

dup_scores as (
  select coalesce(jsonb_agg(jsonb_build_object(
           'article_id', article_id, 'scores', n)), '[]'::jsonb) as v
  from (select article_id, count(*) as n
        from public.topic_scores group by 1 having count(*) > 1
        order by count(*) desc limit 25) t
),

dup_tweets as (
  select coalesce(jsonb_agg(jsonb_build_object(
           'thread_id', thread_id, 'position', position, 'copies', n)), '[]'::jsonb) as v
  from (select thread_id, position, count(*) as n
        from public.thread_tweets group by 1, 2 having count(*) > 1
        order by count(*) desc limit 25) t
),

-- ── Integrity / half-finished pipeline state ─────────────────────────────────
integrity as (
  select jsonb_build_object(
    'orphan_drafts_no_article',
      (select count(*) from public.drafts d
        left join public.articles a on a.id = d.article_id where a.id is null),
    'orphan_threads_no_draft',
      (select count(*) from public.threads t
        left join public.drafts d on d.id = t.draft_id where d.id is null),
    'orphan_tweets_no_thread',
      (select count(*) from public.thread_tweets tw
        left join public.threads t on t.id = tw.thread_id where t.id is null),
    'threads_with_zero_tweets',
      (select count(*) from public.threads t
        where not exists (select 1 from public.thread_tweets tw where tw.thread_id = t.id)),
    'articles_extracted_but_no_content',
      (select count(*) from public.articles
        where status::text = 'extracted' and coalesce(content, '') = ''),
    'articles_processed_but_no_draft',
      (select count(*) from public.articles a
        where a.status::text = 'processed'
          and not exists (select 1 from public.drafts d where d.article_id = a.id)),
    'articles_with_draft_but_status_not_processed',
      (select count(*) from public.articles a
        where exists (select 1 from public.drafts d where d.article_id = a.id)
          and a.status::text is distinct from 'processed'),
    'articles_scored_but_status_still_discovered',
      (select count(*) from public.articles a
        where a.status::text = 'discovered'
          and exists (select 1 from public.topic_scores s where s.article_id = a.id)),
    'articles_stuck_in_selected',
      (select count(*) from public.articles where status::text = 'selected'),
    'articles_never_scored',
      (select count(*) from public.articles a
        where not exists (select 1 from public.topic_scores s where s.article_id = a.id))
  ) as v
)

select jsonb_pretty(jsonb_build_object(
  'generated_at', now(),
  'row_counts',   (select row_counts from counts),
  'status_model', jsonb_build_object(
                    'enum_types',         (select v from enums),
                    'articles_by_status', (select v from article_status),
                    'drafts_by_status',   (select v from draft_status)
                  ),
  'duplicates',   jsonb_build_object(
                    'articles_same_source_url', (select v from dup_articles),
                    'drafts_per_article',       (select v from dup_drafts),
                    'threads_per_draft',        (select v from dup_threads),
                    'scores_per_article',       (select v from dup_scores),
                    'tweets_same_position',     (select v from dup_tweets)
                  ),
  'integrity',    (select v from integrity),
  'tables',       (select jsonb_object_agg(
                     c.table_name,
                     jsonb_build_object(
                       'columns',      c.columns,
                       'constraints',  coalesce(k.constraints, '[]'::jsonb),
                       'indexes',      coalesce(i.indexes, '[]'::jsonb),
                       'rls_enabled',  coalesce(r.rls_enabled, false),
                       'policy_count', coalesce(r.policy_count, 0)
                     ))
                   from cols c
                   left join cons k on k.table_name = c.table_name
                   left join idx  i on i.table_name = c.table_name
                   left join rls  r on r.table_name = c.table_name)
)) as inspection_report;
