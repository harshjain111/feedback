-- =============================================================================
-- 0010_inline_comment.sql
--
-- The comment moved onto the branch screens, so it needs a short heading that
-- sits beside chips rather than a full-screen question. "IS THERE ANYTHING ELSE
-- YOU'D LIKE US TO KNOW?" is the right question on its own page and far too
-- long as a section label.
--
-- comment.h1 stays exactly as §5 has it — it is still what the neutral branch
-- shows, where the comment genuinely is the whole screen.
-- =============================================================================

insert into app_config (outlet_id, key, section, value)
select outlet_id, 'comment.h1_short', 'comment',
       to_jsonb($q$Anything else?$q$::text)
from outlets
on conflict (outlet_id, key) do nothing;
