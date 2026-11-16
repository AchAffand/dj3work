-- Map both formula spellings of Canal U kaca to the Aluminium master-price component.
-- "Kanal U" is a typo in some model material names; "CANAL U LOUVER" is a separate item.
begin;

insert into public.budget_material_mappings
  (catalog_id, material_key, material_name, material_unit, component_id, active, updated_at)
select catalog.id, item.material_key, item.material_name, item.material_unit, component.id, true, now()
from public.budget_catalogs catalog
cross join (values
  ('kanal u|m''', 'kanal U', 'm'''),
  ('canal u|m''', 'canal U', 'm''')
) as item(material_key, material_name, material_unit)
join public.budget_components component
  on component.catalog_id = catalog.id
 and component.component_key = 'col_f'
 and component.source_column = 'F'
 and lower(component.label) = lower('Canal U kaca / M''')
 and component.active
where catalog.slug = 'almunium' and catalog.active
on conflict (catalog_id, material_key) do update
  set material_name = excluded.material_name,
      material_unit = excluded.material_unit,
      component_id = excluded.component_id,
      active = true,
      updated_at = now();

commit;
