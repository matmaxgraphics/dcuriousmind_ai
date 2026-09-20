-- d_CuriousMind — clear all discovered content and start fresh.
--
-- RUN 12_preview_reset.sql FIRST.
--
-- Deletes every article and, by cascade, every score, draft, thread and
-- tweet. Keeps sources, pipeline run history, and all schema.
--
-- THIS CANNOT BE UNDONE. There is no soft delete and no backup taken here.
-- If you want a copy first, use the Supabase dashboard's backup/export before
-- running this.

begin;

-- Guard: never destroy the record of something already live on X.
do $$
declare
  published_count int;
begin
  select count(*) into published_count
    from public.threads
   where status = 'published' or x_thread_id is not null;

  if published_count > 0 then
    raise exception
      'Refusing to reset: % thread(s) have been published to X. Deleting them would lose the tweet IDs linking to live posts. Delete those threads deliberately first if you really mean to.',
      published_count;
  end if;
end $$;

-- One delete; the cascades do the rest.
delete from public.articles;

commit;

-- Optional: also clear pipeline run history, so the dashboard panel starts
-- empty. Leave commented to keep the record of past runs.
-- delete from public.pipeline_runs;

-- ── Verify ───────────────────────────────────────────────────────────────────
-- Expect all content counts at 0 and your sources still present and active.
select
  (select count(*) from public.articles)      as articles,
  (select count(*) from public.topic_scores)  as scores,
  (select count(*) from public.drafts)        as drafts,
  (select count(*) from public.threads)       as threads,
  (select count(*) from public.thread_tweets) as tweets,
  (select count(*) from public.sources where active) as active_sources;
