-- d_CuriousMind — register the four additional content sources.
--
-- The `name` values here must match ContentSource.name in
-- lib/discovery/sources.ts exactly — that is how a discovered article is
-- attributed to the right source. A name mismatch means the source is skipped
-- with a warning, not a crash.
--
-- All four feeds were checked live before this was written:
--   ScienceDaily Strange & Offbeat  60 items
--   Discover Magazine               20 items
--   ScienceAlert                    10 items
--   Smithsonian Magazine            10 items
--
-- Safe to re-run: relies on the unique constraint on sources.name added in
-- 03_harden.sql.

begin;

insert into public.sources (name, base_url, type, active)
values
  ('ScienceDaily Strange & Offbeat', 'https://www.sciencedaily.com',    'rss', true),
  ('ScienceAlert',                   'https://www.sciencealert.com',    'rss', true),
  ('Smithsonian Magazine',           'https://www.smithsonianmag.com',  'rss', true),
  ('Discover Magazine',              'https://www.discovermagazine.com','rss', true)
on conflict (name) do nothing;

commit;

-- ── Verify ───────────────────────────────────────────────────────────────────
-- Expect 5 rows, all active. `active` is the per-source kill switch: set it to
-- false to stop discovering from a feed without touching any code.
select name, base_url, type, active
  from public.sources
 order by name;
