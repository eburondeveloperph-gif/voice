-- Run this in Supabase SQL editor.
-- It creates CRM tables expected by the Eburon Voice CRM module.

create table if not exists public.crm_projects (
  id text primary key,
  org_id text not null,
  created_by_id text,
  name text not null,
  slug text not null unique,
  custom_domain text unique,
  description text,
  allowed_emails text,
  logo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists public.crm_leads (
  id text primary key,
  org_id text not null,
  project_id text not null,
  full_name text not null,
  email text,
  phone text,
  company text,
  stage text not null,
  source text,
  owner_email text,
  notes text,
  metadata jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists public.crm_activities (
  id text primary key,
  org_id text not null,
  project_id text not null,
  lead_id text,
  type text not null,
  summary text not null,
  metadata jsonb,
  created_by_email text,
  created_at timestamptz not null
);

create table if not exists public.crm_files (
  id text primary key,
  org_id text not null,
  project_id text not null,
  lead_id text,
  file_name text not null,
  content_type text,
  size_bytes integer not null,
  storage_path text not null,
  public_url text,
  uploaded_by_email text,
  created_at timestamptz not null
);

create index if not exists crm_projects_org_updated_idx on public.crm_projects(org_id, updated_at desc);
create index if not exists crm_leads_org_project_updated_idx on public.crm_leads(org_id, project_id, updated_at desc);
create index if not exists crm_leads_project_stage_idx on public.crm_leads(project_id, stage);
create index if not exists crm_activities_org_project_created_idx on public.crm_activities(org_id, project_id, created_at desc);
create index if not exists crm_files_org_project_created_idx on public.crm_files(org_id, project_id, created_at desc);
