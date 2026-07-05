create table if not exists public.text_to_image_brand_ci_assets (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public."Clients"(id) on delete cascade,
  title text not null default 'Brand CI',
  body text not null default '',
  file_name text,
  file_type text,
  file_url text,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists text_to_image_brand_ci_assets_client_id_idx
  on public.text_to_image_brand_ci_assets(client_id, updated_at desc);
