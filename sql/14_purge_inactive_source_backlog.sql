-- d_CuriousMind — drop the unscored backlog from sources you switched off.
--
-- The last run discovered 108 articles, 90 of them from ScienceDaily,
-- Smithsonian and ScienceAlert. Those sources were meant to be deactivated by
-- 08_swap_sources.sql; if that migration had not been applied yet, they ran
-- anyway and filled the queue with discovery news the selection gate is
-- designed to reject.
--
-- Scoring each of those costs a paid AI call to reach a foregone conclusion,
-- so delete them BEFORE the next run rather than paying to reject them.
--
-- Only touches articles still in 'discovered' — nothing scored, extracted or
-- drafted is affected.

begin;

delete from public.articles a
 using public.sources s
 where a.source_id = s.id
   and s.active = false
   and a.status::text = 'discovered';

commit;

-- ── Verify ───────────────────────────────────────────────────────────────────
select
  s.name,
  s.active,
  count(a.id) as articles_remaining
from public.sources s
left join public.articles a on a.source_id = s.id
group by s.name, s.active
order by s.active desc, s.name;
