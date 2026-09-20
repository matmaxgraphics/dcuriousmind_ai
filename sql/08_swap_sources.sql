-- d_CuriousMind — swap discovery sources toward everyday phenomena.
--
-- Measured yield through the new selection gate (3 headlines per feed):
--
--   Mental Floss          1/3   "Is It Really Illegal to Burn Money?" passed
--   Discover Magazine     1/3   "Too Much or Too Little Sun Exposure..." passed
--   Wikenigma             0/3   unsolved mysteries, everyday relevance 1-2
--   ScienceDaily S&O      0/3   pure discovery news
--   Smithsonian           0/3   pure discovery news
--   ScienceAlert          0/3   pure discovery news
--
-- The three zero-yield news wires are switched off rather than deleted. They
-- stay registered in code, so re-enabling one is a single UPDATE:
--
--   update public.sources set active = true where name = 'ScienceAlert';
--
-- Wikenigma is kept active despite scoring 0 here: it is the founding "what
-- don't we know" pillar and a judgement call that belongs to you, not to a
-- three-headline sample.
--
-- Safe to re-run.

begin;

insert into public.sources (name, base_url, type, active)
values
  ('Mental Floss', 'https://www.mentalfloss.com', 'rss', true)
on conflict (name) do update
  set active = true;

update public.sources
   set active = false
 where name in (
   'ScienceDaily Strange & Offbeat',
   'Smithsonian Magazine',
   'ScienceAlert'
 );

commit;

-- ── Verify ───────────────────────────────────────────────────────────────────
-- Expect Mental Floss, Discover Magazine and Wikenigma active; the other
-- three inactive and skipped by discovery without any code change.
select name, active from public.sources order by active desc, name;
