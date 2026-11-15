-- Add admin-only create and rename operations for Master Harga groups.
-- Group slugs stay stable on rename so existing routes and references remain valid.

create or replace function public.create_budget_catalog(p_label text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_base_slug text;
  v_slug text;
  v_suffix integer := 1;
  v_position integer;
begin
  if not (select private.is_catalog_admin()) then
    raise exception 'Catalog admin access required' using errcode = '42501';
  end if;

  if nullif(trim(p_label), '') is null then
    raise exception 'Group name is required' using errcode = '22023';
  end if;

  v_base_slug := trim(both '-' from regexp_replace(lower(trim(p_label)), '[^a-z0-9]+', '-', 'g'));
  if v_base_slug = '' then
    raise exception 'Group name must contain letters or numbers' using errcode = '22023';
  end if;

  v_slug := v_base_slug;
  while exists (select 1 from public.budget_catalogs where slug = v_slug) loop
    v_slug := v_base_slug || '-' || v_suffix::text;
    v_suffix := v_suffix + 1;
  end loop;

  select coalesce(max(position), 0) + 1 into v_position
  from public.budget_catalogs;

  insert into public.budget_catalogs (slug, label, position, active)
  values (v_slug, trim(p_label), v_position, true)
  returning id into v_id;

  insert into public.budget_variants (catalog_id, variant_key, label, source_row, position)
  values (v_id, 'base', 'Harga', 1, 1);

  return v_id;
end;
$$;

create or replace function public.rename_budget_catalog(p_catalog_id uuid, p_label text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.is_catalog_admin()) then
    raise exception 'Catalog admin access required' using errcode = '42501';
  end if;
  if nullif(trim(p_label), '') is null then
    raise exception 'Group name is required' using errcode = '22023';
  end if;

  update public.budget_catalogs
  set label = trim(p_label), updated_at = now()
  where id = p_catalog_id and active;

  if not found then
    raise exception 'Budget group not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.create_budget_catalog(text) from public, anon, authenticated;
grant execute on function public.create_budget_catalog(text) to authenticated;
revoke all on function public.rename_budget_catalog(uuid, text) from public, anon, authenticated;
grant execute on function public.rename_budget_catalog(uuid, text) to authenticated;
