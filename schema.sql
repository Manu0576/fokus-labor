-- Fokus-Labor: Datenbank
-- Einmal komplett im Supabase SQL Editor ausführen (Schritt 3 der Anleitung).

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Familie',
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  role text not null check (role in ('parent','child')),
  display_name text not null default ''
);

-- Der gesamte App-Zustand des Kindes (Karten, Plan, Punkte, Nuggets) als ein Dokument
create table if not exists public.kid_state (
  family_id uuid primary key references public.families(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Eingangskorb: Karten und Termine, die Eltern schicken. Die Kinder-App holt sie ab.
create table if not exists public.inbox (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  kind text not null check (kind in ('card','exam')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists inbox_family_idx on public.inbox(family_id);

-- Freigaben für angemeldete Personen (nötig, wenn "Automatically expose new tables" aus ist).
-- Wer was sehen darf, regeln die Zugriffsregeln weiter unten.
grant usage on schema public to authenticated;
grant select on public.families, public.profiles to authenticated;
grant select, update on public.kid_state to authenticated;
grant select, insert, delete on public.inbox to authenticated;

-- Hilfsfunktionen: zu welcher Familie / Rolle gehört die angemeldete Person?
create or replace function public.my_family() returns uuid
language sql stable security definer set search_path = public as
$$ select family_id from public.profiles where id = auth.uid() $$;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as
$$ select role from public.profiles where id = auth.uid() $$;

-- Zugriffsregeln: jede Person sieht nur die eigene Familie
alter table public.families enable row level security;
alter table public.profiles enable row level security;
alter table public.kid_state enable row level security;
alter table public.inbox    enable row level security;

drop policy if exists fam_read on public.families;
create policy fam_read on public.families for select using (id = public.my_family());

drop policy if exists prof_read on public.profiles;
create policy prof_read on public.profiles for select using (family_id = public.my_family());

drop policy if exists state_read on public.kid_state;
create policy state_read on public.kid_state for select using (family_id = public.my_family());
drop policy if exists state_write on public.kid_state;
create policy state_write on public.kid_state for update
  using (family_id = public.my_family() and public.my_role() = 'child')
  with check (family_id = public.my_family() and public.my_role() = 'child');

drop policy if exists inbox_read on public.inbox;
create policy inbox_read on public.inbox for select using (family_id = public.my_family());
drop policy if exists inbox_add on public.inbox;
create policy inbox_add on public.inbox for insert
  with check (family_id = public.my_family() and public.my_role() = 'parent');
drop policy if exists inbox_take on public.inbox;
create policy inbox_take on public.inbox for delete using (family_id = public.my_family());

grant execute on function public.my_family() to authenticated;
grant execute on function public.my_role() to authenticated;
