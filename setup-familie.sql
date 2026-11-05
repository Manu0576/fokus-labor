-- Fokus-Labor: Familie verknüpfen
-- Erst die zwei Personen unter Authentication → Users anlegen (Schritt 4 der Anleitung).
-- Dann die drei Stellen in GROSSBUCHSTABEN ersetzen und dieses Skript einmal ausführen.

with f as (
  insert into public.families(name) values ('Familie') returning id
), p as (
  insert into public.profiles(id, family_id, role, display_name)
  select u.id, f.id, 'parent', 'Mama' from auth.users u, f where u.email = 'ELTERN-EMAIL'
  union all
  select u.id, f.id, 'child', 'VORNAME-KIND' from auth.users u, f where u.email = 'KIND-EMAIL'
  returning family_id
)
insert into public.kid_state(family_id)
select distinct family_id from p;

-- Kontrolle: Hier sollten genau 2 Zeilen erscheinen (parent und child)
select pr.role, pr.display_name, u.email
from public.profiles pr join auth.users u on u.id = pr.id;
