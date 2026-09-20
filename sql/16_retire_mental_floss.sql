-- d_CuriousMind — retire Mental Floss and clear its backlog.
--
-- Measured over two runs:
--
--   Generated Questions   8 scored ->  8 selected  (100%)
--   Mental Floss         10 scored ->  1 selected  (~10%)
--
-- In the live run it scored 7 and produced nothing — the rejects were
-- "The Countries With the Most Documented Serial Killers, Ranked",
-- "30 Magical Facts About 'Practical Magic'" and similar listicles. Those are
-- exactly what the everyday-relevance floor exists to stop, but each one
-- still costs a paid AI call to reject, and 73 more are queued.
--
-- Discover Magazine and Wikenigma stay ACTIVE: neither has been scored yet,
-- so switching them off would be a guess rather than a decision. Their 28
-- articles will be scored over the next two runs and then we will know.
--
-- Reversible:
--   update public.sources set active = true where name = 'Mental Floss';
--
-- Safe to re-run.

begin;

update public.sources
   set active = false
 where name = 'Mental Floss';

-- Drop unscored articles from every inactive source. Anything already scored,
-- extracted or drafted is untouched.
delete from public.articles a
 using public.sources s
 where a.source_id = s.id
   and s.active = false
   and a.status::text = 'discovered';

commit;

-- ── Verify ───────────────────────────────────────────────────────────────────
select
  s.name   as source,
  s.active,
  count(a.id) filter (where a.status::text = 'discovered') as awaiting_scoring,
  count(a.id)                                              as total_articles
from public.sources s
left join public.articles a on a.source_id = s.id
group by s.name, s.active
order by s.active desc, s.name;
