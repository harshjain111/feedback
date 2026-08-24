-- =============================================================================
-- 0015_memory_uptake_function.sql — the narrow write, done properly
--
-- 0014 gave `anon` a column-level UPDATE grant on the three memory columns and
-- an UPDATE policy, on the reasoning that Postgres would then refuse anything
-- wider. It does. What it ALSO refuses is the intended write, and the test
-- caught it:
--
--     update feedback set memory_offered = true where submission_id = $1
--     -> permission denied for table feedback
--
-- because an UPDATE needs SELECT privilege on every column its WHERE clause
-- reads, and `anon` has none on `feedback` by design (§7: "no anon read. Ever.").
--
-- The obvious patch — `grant select (submission_id) on feedback to anon` — is
-- the wrong one. It opens exactly the surface the capability model depends on
-- being closed: submission_id works as a capability because it cannot be
-- enumerated, and a SELECT grant makes enumeration a matter of RLS policy
-- rather than of privilege. One future policy change away from a leak.
--
-- So: a SECURITY DEFINER function instead. It is strictly narrower than the
-- grant it replaces —
--
--   * no SELECT surface on feedback for anon at all, not even one column;
--   * the three columns are named in the function body, so "which columns" is
--     not a privilege that can drift, it is code;
--   * COALESCE means a partial update cannot blank the fields it omits;
--   * it returns whether a row matched, without revealing anything about it.
--
-- search_path is pinned, because a SECURITY DEFINER function that resolves
-- table names through the caller's search_path is a privilege-escalation bug.
-- =============================================================================

-- Undo 0014's approach. Leaving it would be redundant surface, and redundant
-- surface is what gets forgotten in the next audit.
drop policy if exists feedback_memory_update_kiosk on feedback;
revoke update (memory_offered, memory_printed, memory_retries) on feedback from anon;

create or replace function aic_record_memory(
  p_submission_id uuid,
  p_offered  boolean  default null,
  p_printed  boolean  default null,
  p_retries  smallint default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_matched integer;
begin
  -- COALESCE, not assignment: the kiosk reports `offered` when the screen is
  -- shown and `printed` later, and the second call must not blank the first.
  update feedback
     set memory_offered = coalesce(p_offered, memory_offered),
         memory_printed = coalesce(p_printed, memory_printed),
         memory_retries = coalesce(p_retries, memory_retries)
   where submission_id = p_submission_id;

  get diagnostics v_matched = row_count;
  return v_matched > 0;
end;
$$;

comment on function aic_record_memory is
  'Kiosk photo-uptake write (PHOTO_MODULE.md §8, CLAUDE.md §12). The ONLY way anon touches feedback. Definer because an UPDATE needs SELECT on its WHERE columns and anon must never have that; keyed by the unguessable submission_id the guest''s own session holds.';

-- EXECUTE only, and only for the kiosk's role. authenticated has no business
-- here — the admin never records uptake, the kiosk does.
revoke all on function aic_record_memory(uuid, boolean, boolean, smallint) from public;
grant execute on function aic_record_memory(uuid, boolean, boolean, smallint) to anon;
