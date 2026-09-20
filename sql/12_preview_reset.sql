-- d_CuriousMind — preview what a content reset would delete.
--
-- READ-ONLY. Run this first and check the numbers before running
-- 13_reset_content.sql.
--
-- Deleting articles cascades: every foreign key in the content chain is
-- ON DELETE CASCADE, so removing articles also removes theira scores, drafts,
-- threads and tweets. Nothing else has to be deleted by hand.
--
--   articles ──cascade──> topic_scores
--            └─cascade──> drafts ──cascade──> threads ──cascade──> thread_tweets

select
  (select count(*) from public.articles)       as articles_to_delete,
  (select count(*) from public.topic_scores)   as scores_to_delete,
  (select count(*) from public.drafts)         as drafts_to_delete,
  (select count(*) from public.threads)        as threads_to_delete,
  (select count(*) from public.thread_tweets)  as tweets_to_delete,
  -- Kept: sources and pipeline_runs are not touched by the reset.
  (select count(*) from public.sources)        as sources_kept,
  (select count(*) from public.pipeline_runs)  as pipeline_runs_kept;

-- Anything already posted to X. The reset REFUSES to run if this is not zero,
-- because deleting a published thread destroys the record of which tweets are
-- live on your account — the only link back to them.
select
  id,
  left(title, 60) as title,
  status,
  published_at,
  x_thread_id
from public.threads
where status = 'published'
   or x_thread_id is not null;

-- What you will be left discovering from after the reset.
select name, type, active from public.sources order by active desc, name;
