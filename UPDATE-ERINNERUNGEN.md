# Fokus-Labor Update: Erinnerungen, Werkstätten, Übungen, Texte

Dauer: etwa 20 Minuten. Zusätzlich brauchst du die zwei Dateien, die NICHT im ZIP liegen:
`secrets-erinnerungen.txt` und `zeitplan-erinnerungen.sql`. Diese zwei niemals auf GitHub hochladen.

## A. Supabase

1. **Datenbank erweitern:** SQL Editor → **+** → Inhalt von `supabase/update-erinnerungen.sql` einfügen → **Run**. Bei der Warnung **Run this query**.
   Danach dasselbe mit `supabase/update-texte.sql` (neue Abfrage mit **+**).
2. **Drei Secrets anlegen:** Edge Functions → **Secrets**. Für jeden der drei Einträge aus `secrets-erinnerungen.txt` Name und Value eintragen → **Save**. Mit **Add another** gehen alle drei auf einmal.
3. **KI-Funktion aktualisieren:** Edge Functions → **Functions** → **suggest-cards** → Reiter **Code** → alles markieren, löschen → Inhalt von `supabase/functions/suggest-cards/index.ts` einfügen → **Deploy**.
4. **Erinnerungs-Funktion anlegen:** Edge Functions → **Deploy a new function** → **Via Editor** → Name **`send-reminders`** → Beispielcode löschen → Inhalt von `supabase/functions/send-reminders/index.ts` einfügen → **Deploy function**. Danach Reiter **Settings** → **Verify JWT** ausschalten → **Save changes**.
5. **Zeitplan starten:** SQL Editor → **+** → Inhalt von `zeitplan-erinnerungen.sql` einfügen → **Run**. Unten muss eine Zeile `fokuslabor-erinnerungen` stehen.
   Falls eine Fehlermeldung zu `pg_cron` oder `pg_net` kommt: links **Integrations** → **Cron** → aktivieren. Dann **Database** → **Extensions** → `pg_net` einschalten. Danach Schritt 5 wiederholen.

## B. GitHub

6. Neues ZIP entpacken, im Repository **fokus-labor** auf **main** → **+** → **Upload files** → **alle Inhalte** des Ordners hineinziehen (auch den neuen Ordner `werkstatt`) → **Commit changes**. Gleichnamige Dateien werden ersetzt.

## C. Am iPhone

7. 2 Minuten warten. Fokus-Labor am iPhone ganz schließen und neu öffnen.
8. **Juni:** Unter **Heute** ganz unten → **Erinnerungen auf diesem Gerät einschalten** → **Erlauben**.
9. **Du:** Elternbereich → **Erinnern** → Tage anhaken, Zeiten wählen, Tagesziel prüfen → **Speichern** → **Test-Erinnerung schicken**.

Kommt die Test-Erinnerung ohne Ton: am iPhone **Einstellungen → Mitteilungen → Fokus-Labor** → Töne an. Ist ein Fokus wie „Schule“ oder „Nicht stören“ aktiv, erscheint die Erinnerung ohne Ton.

## D. Texte kontrollieren

- **Juni:** In der Englisch-Baustelle beim Writing auf **An Mama schicken**, oder im Fokus-Labor unter **Werkstatt → Meine Texte → Neuen Text schicken**.
- **Du:** Elternbereich → **Texte** → Text antippen → **Von Claude kontrollieren lassen** → Häkchen weg bei allem, was nicht passt, Nachricht schreiben → **An Juni freigeben**.
- Juni sieht das Feedback unter **Werkstatt → Meine Texte** („Feedback da!“). Punkte sieht sie nur, wenn du „Punkte anzeigen“ anhakst.
