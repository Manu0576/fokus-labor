-- Fokus-Labor Update: Texte an Mama schicken und Feedback freigeben
-- Einmal im Supabase SQL Editor ausführen. Enthält KEINE geheimen Schlüssel.

create table if not exists public.texts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  fach text not null default 'Englisch',
  art text,
  angabe text,
  text text not null,
  words int,
  status text not null default 'eingereicht' check (status in ('eingereicht','freigegeben')),
  review jsonb,          -- freigegebenes Feedback (sieht das Kind)
  note text,             -- Nachricht von Mama
  show_scores boolean not null default false,
  created_at timestamptz not null default now(),
  released_at timestamptz
);
create index if not exists texts_family_idx on public.texts(family_id, created_at desc);

-- Entwürfe der Kontrolle: nur Eltern sehen sie, bis sie freigegeben werden
create table if not exists public.text_drafts (
  text_id uuid primary key references public.texts(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  draft jsonb not null,
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.texts to authenticated;
grant select, insert, update, delete on public.text_drafts to authenticated;
alter table public.texts enable row level security;
alter table public.text_drafts enable row level security;

drop policy if exists txt_read on public.texts;
create policy txt_read on public.texts for select using (family_id = public.my_family());
drop policy if exists txt_add on public.texts;
create policy txt_add on public.texts for insert
  with check (family_id = public.my_family() and public.my_role() = 'child' and status = 'eingereicht' and review is null);
drop policy if exists txt_change on public.texts;
create policy txt_change on public.texts for update
  using (family_id = public.my_family() and public.my_role() = 'parent')
  with check (family_id = public.my_family() and public.my_role() = 'parent');
drop policy if exists txt_remove on public.texts;
create policy txt_remove on public.texts for delete using (family_id = public.my_family());

drop policy if exists drf_all on public.text_drafts;
create policy drf_all on public.text_drafts for all
  using (family_id = public.my_family() and public.my_role() = 'parent')
  with check (family_id = public.my_family() and public.my_role() = 'parent');
