alter table public.project_extra_materials
  add column if not exists model_line_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'project_extra_materials_model_line_id_fkey'
      and conrelid = 'public.project_extra_materials'::regclass
  ) then
    alter table public.project_extra_materials
      add constraint project_extra_materials_model_line_id_fkey
      foreign key (model_line_id) references public.project_model_lines(id) on delete cascade;
  end if;
end
$$;

create index if not exists project_extra_materials_model_line_idx
  on public.project_extra_materials(model_line_id, position);
