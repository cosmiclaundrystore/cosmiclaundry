-- Supabase creates public.rls_auto_enable() (the event trigger that switches RLS on for new tables).
-- It is SECURITY DEFINER in an exposed schema, so take EXECUTE away from the API roles.
-- The event trigger keeps working: event triggers do not check EXECUTE on their function.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
