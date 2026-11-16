-- Connect formula materials HOLE, COAK, and POLIS to the KACA price catalog.
-- Idempotent so it also reconciles the already-applied staging data.
begin;

with kaca as (
  select id from public.budget_catalogs where slug = 'kaca' and active
),
component as (
  insert into public.budget_components
    (catalog_id, component_key, source_column, label, unit, category, position, active, group_label)
  select kaca.id, 'col_r', 'R', 'COAK/PCS', 'pcs', 'Kaca',
    coalesce((select max(position) + 1 from public.budget_components where catalog_id = kaca.id), 1),
    true, 'KACA'
  from kaca
  on conflict (catalog_id, component_key) do update
    set label = excluded.label, unit = excluded.unit, category = excluded.category,
        active = true, group_label = excluded.group_label
  returning id, catalog_id
)
insert into public.budget_prices
  (component_id, variant_id, amount, expression, source_cell, source_formula, source_value, version)
select component.id, variant.id, 65000, null, 'R4', null, '65000', 1
from component
join public.budget_variants variant
  on variant.catalog_id = component.catalog_id and variant.variant_key = 'default'
on conflict (component_id, variant_id) do update
  set amount = excluded.amount, expression = null, source_cell = excluded.source_cell,
      source_formula = excluded.source_formula, source_value = excluded.source_value;

insert into public.budget_material_mappings
  (catalog_id, material_key, material_name, material_unit, component_id, active, updated_at)
select catalog.id, item.material_key, item.material_name, item.material_unit, component.id, true, now()
from public.budget_catalogs catalog
cross join (values
  ('polis|m''', 'polis', 'm''', 'POLIS / M'''),
  ('hole|pcs', 'hole', 'pcs', 'HOLE/PCS'),
  ('coak|pcs', 'coak', 'pcs', 'COAK/PCS')
) as item(material_key, material_name, material_unit, component_label)
join public.budget_components component
  on component.catalog_id = catalog.id
 and lower(component.label) = lower(item.component_label)
 and component.active
where catalog.slug = 'kaca' and catalog.active
on conflict (catalog_id, material_key) do update
  set material_name = excluded.material_name,
      material_unit = excluded.material_unit,
      component_id = excluded.component_id,
      active = true,
      updated_at = now();

commit;
