-- Create the four workbook-based Master Harga groups and secure physical deletion.
insert into public.budget_catalogs (slug, label, position, active)
values
  ('almunium', 'ALMUNIUM', 1, true),
  ('kaca', 'KACA', 2, true),
  ('ass', 'ASS.', 3, true),
  ('daun-pintu', 'DAUN PINTU', 4, true)
on conflict (slug) do update set
  label = excluded.label, position = excluded.position, active = true, updated_at = now();

create or replace function public.delete_budget_catalog(p_catalog_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.is_catalog_admin()) then
    raise exception 'Catalog admin access required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.budget_catalogs where id = p_catalog_id) then
    raise exception 'Budget group not found' using errcode = 'P0002';
  end if;
  delete from public.project_line_price_snapshots where catalog_id = p_catalog_id;
  delete from public.budget_estimates where catalog_id = p_catalog_id;
  delete from public.budget_catalogs where id = p_catalog_id;
end;
$$;
revoke all on function public.delete_budget_catalog(uuid) from public, anon, authenticated;
grant execute on function public.delete_budget_catalog(uuid) to authenticated;
