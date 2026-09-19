-- d_CuriousMind — Phase 5: preview the duplicate threads before deleting any.
-- READ-ONLY. Run this first and eyeball the KEEP / DELETE column.
-- Rule: for each draft, keep the most recently created thread, delete the rest.

select
  t.draft_id,
  left(d.question, 70)                       as draft_question,
  t.id                                       as thread_id,
  left(t.title, 60)                          as thread_title,
  t.created_at,
  (select count(*) from public.thread_tweets tw
     where tw.thread_id = t.id)              as tweets,
  case
    when row_number() over (
           partition by t.draft_id
           order by t.created_at desc, t.id desc
         ) = 1
    then 'KEEP'
    else 'DELETE'
  end                                        as action
from public.threads t
join public.drafts d on d.id = t.draft_id
where t.draft_id in (
  select draft_id from public.threads group by draft_id having count(*) > 1
)
order by t.draft_id, t.created_at desc;
