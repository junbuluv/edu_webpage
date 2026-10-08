-- Privilege hygiene (role audit, 2026-10-07). Run after schema.sql.
--
-- Every public table must carry explicit grants, never a project's default
-- privileges (hosted projects differ, and the CI auth stub copies the legacy
-- defaults on purpose):
--   * anon holds no table privilege at all;
--   * authenticated holds no table-level write or DDL privilege (reads are
--     table- or column-level SELECT; profiles has column-level UPDATE only);
--   * service_role can read every table (server handlers read through it).
-- Retired functions stay dropped.
do $$
declare
  r record;
  v_bad text := '';
begin
  for r in
    select c.oid::regclass as tbl
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p')
     order by 1
  loop
    if pg_catalog.has_table_privilege(
      'anon', r.tbl,
      'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'
    ) then
      v_bad := v_bad || format(E'\n  anon holds a privilege on %s', r.tbl);
    end if;
    if pg_catalog.has_table_privilege(
      'authenticated', r.tbl,
      'INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'
    ) then
      v_bad := v_bad || format(
        E'\n  authenticated holds a table-level write or DDL privilege on %s',
        r.tbl
      );
    end if;
    if not pg_catalog.has_table_privilege('service_role', r.tbl, 'SELECT') then
      v_bad := v_bad || format(E'\n  service_role cannot read %s', r.tbl);
    end if;
  end loop;

  if pg_catalog.to_regprocedure(
    'public.log_disclosure(text, uuid, text, jsonb)'
  ) is not null then
    v_bad := v_bad || E'\n  public.log_disclosure still exists (the app logs through src/lib/audit.ts)';
  end if;

  if v_bad <> '' then
    raise exception 'privilege hygiene failed:%', v_bad;
  end if;
end $$;
