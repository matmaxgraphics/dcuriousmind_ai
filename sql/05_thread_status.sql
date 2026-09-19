-- d_CuriousMind — Phase 4: give threads their own editorial status.
--
-- Today, approving a thread writes drafts.status, so the two review gates in
-- the editorial flow share one field and the second overwrites the first:
--
--   draft -> review -> approve  ┐
--                               ├─ both writing drafts.status
--   thread -> review -> approve ┘
--
-- After this, drafts.status tracks the draft gate and threads.status tracks the
-- thread gate, independently.
--
-- Also adds the columns publishing will need, so X integration needs no further
-- migration. Nothing here publishes anything.
--
-- Safe to re-run.

begin;

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'thread_status' and n.nspname = 'public'
  ) then
    create type public.thread_status as enum (
      'draft',      -- generated, awaiting review
      'approved',   -- cleared for publishing
      'rejected',   -- will not be published
      'scheduled',  -- queued for a publish time
      'published'   -- live on X
    );
  end if;
end $$;

alter table public.threads
  add column if not exists status public.thread_status not null default 'draft';

alter table public.threads
  add column if not exists approved_at  timestamptz,
  add column if not exists published_at timestamptz,
  -- id of the first tweet in the posted thread, i.e. the thread's permalink
  add column if not exists x_thread_id  text;

alter table public.thread_tweets
  add column if not exists x_tweet_id text;

create index if not exists threads_status_idx
  on public.threads (status);

-- A published thread must record what it published as. Guards against a
-- half-finished publish being indistinguishable from a successful one.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'threads_published_has_x_id'
      and connamespace = 'public'::regnamespace
  ) then
    alter table public.threads
      add constraint threads_published_has_x_id
      check (status <> 'published' or x_thread_id is not null);
  end if;
end $$;

commit;

-- ── Backfill note ────────────────────────────────────────────────────────────
-- Existing threads all default to 'draft'. If a draft was already approved and
-- you want its thread to inherit that, run this once — otherwise skip it and
-- approve the threads by hand in the dashboard:
--
--   update public.threads t
--      set status = 'approved', approved_at = now()
--     from public.drafts d
--    where d.id = t.draft_id
--      and d.status = 'approved'
--      and t.status = 'draft';

-- ── Verify ───────────────────────────────────────────────────────────────────
select
  (select array_agg(e.enumlabel order by e.enumsortorder)
     from pg_type t join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'thread_status')                    as thread_statuses,
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'threads'
      and column_name in ('status','approved_at','published_at','x_thread_id'))
                                                          as new_thread_columns,
  (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
     from (select status::text, count(*) as n
             from public.threads group by 1) x)           as threads_by_status;
