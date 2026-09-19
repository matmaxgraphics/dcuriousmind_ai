-- d_CuriousMind — Phase 6 prerequisite: run tracking, locking and observability.
--
-- Two jobs in one table:
--   1. A lock, so two overlapping runs can never both pay to score the same
--      articles. Vercel Cron retries on failure, so this is not hypothetical.
--   2. The record behind the "last pipeline run" panel: status, counts, errors.
--
-- Safe to re-run.

begin;

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'pipeline_run_status' and n.nspname = 'public'
  ) then
    create type public.pipeline_run_status as enum (
      'running',    -- in flight right now
      'succeeded',  -- every stage completed
      'partial',    -- ran, but at least one stage failed
      'failed',     -- blew up entirely, or was reclaimed as stale
      'skipped'     -- another run held the lock
    );
  end if;
end $$;

create table if not exists public.pipeline_runs (
  id uuid primary key default gen_random_uuid(),

  status  public.pipeline_run_status not null default 'running',
  trigger text not null default 'manual',   -- 'cron' | 'manual' | 'api'

  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer,

  -- Headline counters for the dashboard panel.
  articles_discovered integer not null default 0,
  articles_saved      integer not null default 0,
  topics_scored       integer not null default 0,
  topics_selected     integer not null default 0,
  articles_extracted  integer not null default 0,
  drafts_generated    integer not null default 0,

  failed_stages text[] not null default '{}',
  error         text,
  stages        jsonb,   -- the full per-stage result, for digging in

  created_at timestamptz not null default now()
);

-- THE LOCK. Every row matching the predicate has status = 'running', so a
-- unique index on that column permits at most one in-flight run at a time.
-- A second concurrent insert fails with 23505 instead of double-spending.
create unique index if not exists pipeline_runs_single_active
  on public.pipeline_runs (status)
  where status = 'running';

create index if not exists pipeline_runs_started_at_idx
  on public.pipeline_runs (started_at desc);

commit;

-- ── Verify ───────────────────────────────────────────────────────────────────
select
  (select count(*) from public.pipeline_runs)                   as runs,
  (select count(*) from pg_indexes
     where schemaname = 'public'
       and indexname = 'pipeline_runs_single_active')           as lock_index,
  (select array_agg(e.enumlabel order by e.enumsortorder)
     from pg_type t join pg_enum e on e.enumtypid = t.oid
     where t.typname = 'pipeline_run_status')                   as statuses;
