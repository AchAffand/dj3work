-- Extra recap materials are project-owned snapshots and never alter Master Harga.
create table if not exists public.project_extra_materials (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name_snapshot text not null,
  unit_snapshot text not null default '',
  quantity numeric(14,4) not null default 1 check (quantity > 0),
  catalog_id uuid,
  variant_id uuid,
  component_id uuid,
  unit_price numeric(18,2),
  price_version integer,
  expression_snapshot text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_extra_materials_project_position_idx
  on public.project_extra_materials(project_id, position, created_at);

alter table public.project_extra_materials enable row level security;
grant select, insert, update, delete on public.project_extra_materials to authenticated;

create policy "project owners read extra materials"
  on public.project_extra_materials for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_extra_materials.project_id and p.user_id = (select auth.uid())));

create policy "project owners create extra materials"
  on public.project_extra_materials for insert to authenticated
  with check (exists (select 1 from public.projects p where p.id = project_extra_materials.project_id and p.user_id = (select auth.uid())));

create policy "project owners update extra materials"
  on public.project_extra_materials for update to authenticated
  using (exists (select 1 from public.projects p where p.id = project_extra_materials.project_id and p.user_id = (select auth.uid())))
  with check (exists (select 1 from public.projects p where p.id = project_extra_materials.project_id and p.user_id = (select auth.uid())));

create policy "project owners delete extra materials"
  on public.project_extra_materials for delete to authenticated
  using (exists (select 1 from public.projects p where p.id = project_extra_materials.project_id and p.user_id = (select auth.uid())));
