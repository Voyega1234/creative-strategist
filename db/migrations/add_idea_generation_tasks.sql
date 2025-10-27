create table if not exists public.idea_generation_tasks (
  id uuid primary key default gen_random_uuid(),
  task_id text not null unique,
  status text not null default 'processing',
  client_name text,
  product_focus text,
  payload jsonb,
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idea_generation_tasks_status_idx on public.idea_generation_tasks(status);
create index if not exists idea_generation_tasks_created_at_idx on public.idea_generation_tasks(created_at desc);
