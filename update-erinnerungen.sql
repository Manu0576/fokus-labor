-- Fokus-Labor Update: Einstellungen, Erinnerungen
-- Einmal im Supabase SQL Editor ausführen. Enthält KEINE geheimen Schlüssel.

-- Einstellungen der Familie (Tagesziel, Erinnerungszeiten)
create table if not exists public.family_settings (
  family_id uuid primary key references public.families(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Geräte, auf denen Erinnerungen eingeschaltet sind
create table if not exists public.push_subs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique,
  sub jsonb not null,
  ua text,
  created_at timestamptz not null default now()
);

-- Welche Erinnerung wurde an welchem Tag schon geschickt (damit keine doppelt kommt)
create table if not exists public.reminder_log (
  family_id uuid not null references public.families(id) on delete cascade,
  day date not null,
  slot text not null,
  sent_at timestamptz not null default now(),
  primary key (family_id, day, slot)
);

grant select, insert, update on public.family_settings to authenticated;
grant select, insert, delete on public.push_subs to authenticated;

alter table public.family_settings enable row level security;
alter table public.push_subs enable row level security;
alter table public.reminder_log enable row level security;   -- nur die Erinnerungs-Funktion darf hier rein

drop policy if exists set_read on public.family_settings;
create policy set_read on public.family_settings for select using (family_id = public.my_family());
drop policy if exists set_add on public.family_settings;
create policy set_add on public.family_settings for insert
  with check (family_id = public.my_family() and public.my_role() = 'parent');
drop policy if exists set_change on public.family_settings;
create policy set_change on public.family_settings for update
  using (family_id = public.my_family() and public.my_role() = 'parent')
  with check (family_id = public.my_family() and public.my_role() = 'parent');

drop policy if exists sub_read on public.push_subs;
create policy sub_read on public.push_subs for select using (family_id = public.my_family());
drop policy if exists sub_add on public.push_subs;
create policy sub_add on public.push_subs for insert
  with check (family_id = public.my_family() and user_id = auth.uid());
drop policy if exists sub_remove on public.push_subs;
create policy sub_remove on public.push_subs for delete using (user_id = auth.uid());

-- Standard-Einstellungen anlegen: Tagesziel 1 Sprint oder 25 Karten, Erinnerungen noch aus
insert into public.family_settings(family_id, data)
select id, '{"goal":{"spr":1,"cards":25},"rem":{"days":{}}}'::jsonb from public.families
on conflict (family_id) do nothing;
