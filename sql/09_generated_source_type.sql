-- d_CuriousMind — allow a non-RSS source type.
--
-- RUN THIS FIRST, ON ITS OWN, THEN RUN 10_seed_generated_source.sql.
--
-- Postgres will not let a newly added enum value be used by a statement in
-- the same transaction, and the Supabase SQL editor runs a script as one
-- transaction. So adding the value and using it are split across two files.

alter type public.source_type add value if not exists 'generated';

-- ── Verify ───────────────────────────────────────────────────────────────────
select array_agg(e.enumlabel order by e.enumsortorder) as source_types
  from pg_type t
  join pg_enum e on e.enumtypid = t.oid
 where t.typname = 'source_type';
