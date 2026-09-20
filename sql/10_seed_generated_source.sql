-- d_CuriousMind — register the question generator as a content source.
--
-- RUN 09_generated_source_type.sql FIRST.
--
-- Questions are proposed by AI and grounded in a real Wikipedia article
-- before entering the pipeline, so articles.url points at the grounding
-- article with a per-question fragment appended. The fragment keeps each
-- question distinct under the existing unique (source_id, url) constraint
-- while still citing the article the explanation comes from.
--
-- `active` is the kill switch, same as any other source:
--   update public.sources set active = false where name = 'Generated Questions';

begin;

insert into public.sources (name, base_url, type, active)
values
  ('Generated Questions', 'https://en.wikipedia.org', 'generated', true)
on conflict (name) do update
  set active = true,
      type = 'generated',
      base_url = excluded.base_url;

commit;

-- ── Verify ───────────────────────────────────────────────────────────────────
select name, base_url, type, active from public.sources order by active desc, name;
