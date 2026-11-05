# Fokus-Labor einrichten

Dauer: etwa 45–60 Minuten, einmalig. Du brauchst einen Laptop. Danach läuft die App auf iPad, iPhone und Laptop.

**Was wo liegt**

| Teil | Dienst | Kosten |
|---|---|---|
| Die App selbst (Webseite) | GitHub Pages | gratis |
| Login und Daten (EU-Server) | Supabase | gratis im Free-Tarif |
| KI-Vorschläge im Elternbereich | Anthropic API | nach Verbrauch, mit Limit |

---

## 1. Konten anlegen

1. **GitHub:** github.com → Sign up.
2. **Supabase:** supabase.com → Start your project → mit GitHub anmelden geht am schnellsten.
3. **Anthropic Console:** console.anthropic.com → Konto anlegen. Guthaben kaufen: **5 $ reichen**. **Automatisches Aufladen ausgeschaltet lassen**, dann kann nie mehr als das Guthaben verbraucht werden. Steuernummer leer lassen.
   Optional danach: unten links auf den Organisationsnamen → **Organization settings** → **Billing** → Abschnitt **Spend limits** → **Set limit** (z. B. 5 $ pro Monat). Mit **Add notification** kommt eine Warn-Mail vorher.

## 2. Supabase-Projekt anlegen

1. In Supabase: **New project**.
2. Name: `fokus-labor`. Datenbank-Passwort vergeben und aufheben.
3. **Region: Central EU (Frankfurt)**. Wichtig für den Datenschutz.
4. **Create new project**, dann 1–2 Minuten warten.

## 3. Datenbank einrichten

1. Links **SQL Editor** → **New query**.
2. Den gesamten Inhalt der Datei `supabase/schema.sql` hineinkopieren.
3. **Run**. Unten sollte „Success“ stehen.

## 4. Zwei Konten anlegen (du und deine Tochter)

1. Links **Authentication** → **Users** → **Add user** → **Create new user**.
2. Deine E-Mail und ein Passwort eintragen, **Auto Confirm User** anhaken, **Create user**.
3. Dasselbe für deine Tochter. Am besten eine echte E-Mail-Adresse. Das Passwort sollte sie sich leicht merken können.

## 5. Familie verknüpfen

1. **SQL Editor** → **New query**.
2. Inhalt von `supabase/setup-familie.sql` hineinkopieren.
3. Ersetzen: `ELTERN-EMAIL` (deine Adresse aus Schritt 4), `KIND-EMAIL` (ihre Adresse), `VORNAME-KIND` (so wird sie in der App begrüßt). Die Anführungszeichen bleiben stehen.
4. **Run**. Unten müssen genau 2 Zeilen erscheinen: `parent` und `child`.

## 6. App mit Supabase verbinden

1. In Supabase links **Project Settings** (Zahnrad) → **API** bzw. **API Keys**.
2. Kopiere die **Project URL** und den **anon** bzw. **publishable** Key.
3. Öffne die Datei `config.js` mit einem Texteditor und trag beides zwischen die Anführungszeichen ein:
   ```js
   url: "https://deinprojekt.supabase.co",
   key: "eyJ..."
   ```
4. Speichern. Diesen Schlüssel darf man sehen, die Datenbank-Regeln aus Schritt 3 schützen die Daten. Den **service_role**-Schlüssel dagegen nie verwenden oder weitergeben.

## 7. KI-Funktion einrichten (Elternbereich)

1. In der Anthropic Console: **API Keys** → **Create Key** → kopieren.
2. In Supabase links **Edge Functions** → **Secrets** → **Add new secret**: Name `ANTHROPIC_API_KEY`, Wert = der kopierte Schlüssel → **Save**.
3. **Edge Functions** → **Deploy a new function** → **Via Editor**.
4. Name **genau** `suggest-cards`.
5. Den Beispielcode löschen und den Inhalt von `supabase/functions/suggest-cards/index.ts` einfügen → **Deploy**.

Die Funktion prüft selbst, dass nur das Eltern-Konto sie nutzen kann.

## 8. App online stellen (GitHub Pages)

1. Auf github.com: **New repository**. Name `fokus-labor`, **Public**, **Create repository**.
2. **uploading an existing file** anklicken. Alle Dateien und Ordner aus dem entpackten Projekt hineinziehen (auch den Ordner `icons`). **Commit changes**.
3. Im Repository: **Settings** → **Pages** → Source **Deploy from a branch** → Branch `main`, Ordner `/ (root)` → **Save**.
4. Nach 1–2 Minuten steht oben die Adresse, z. B. `https://deinname.github.io/fokus-labor/`.

Hinweis: Bei „Public“ ist der Programmcode öffentlich sichtbar, die Daten deiner Tochter nicht. Die liegen geschützt bei Supabase.

## 9. Auf den Geräten installieren

**iPad oder iPhone:** Die Adresse in **Safari** öffnen → Teilen-Symbol → **Zum Home-Bildschirm**. Dann das neue Symbol öffnen und anmelden.

**Laptop:** Die Adresse in Chrome oder Edge öffnen. In der Adresszeile auf das Installieren-Symbol klicken oder ein Lesezeichen setzen.

Deine Tochter meldet sich mit ihrem Konto an und sieht die Lern-App. Du meldest dich mit deinem Konto an und siehst den Elternbereich.

---

## Gut zu wissen

- **Pausierung:** Supabase pausiert kostenlose Projekte, die eine Woche lang nicht genutzt werden. Bei täglicher Nutzung passiert das nicht. Falls doch: im Supabase-Dashboard auf **Restore** klicken.
- **Offline:** Die App funktioniert auch ohne Internet und speichert, sobald wieder Verbindung da ist. Unten in der App steht, ob alles gespeichert ist.
- **Zwei Geräte gleichzeitig:** Die App führt die Stände zusammen. Am zuverlässigsten ist es trotzdem, nicht gleichzeitig auf iPad und Laptop zu lernen.
- **KI-Kosten:** Eine Heftseite kostet typischerweise nur Cent-Beträge. Die aktuellen Preise stehen auf anthropic.com/pricing, das Limit aus Schritt 1 schützt vor Überraschungen.
- **Fotos:** Nur die Heftseite fotografieren, keine Gesichter oder Namen.
- **Passwort vergessen:** In Supabase unter **Authentication → Users** beim Konto auf die drei Punkte → neues Passwort setzen.
- **Updates:** Wenn du neue Dateien bekommst, im GitHub-Repository die alten durch die neuen ersetzen. `config.js` dabei nicht überschreiben.

## Wenn etwas nicht klappt

| Meldung | Lösung |
|---|---|
| „Noch nicht verbunden“ | `config.js` ist leer oder wurde nicht hochgeladen (Schritt 6 und 8). |
| „Dieses Konto ist noch keiner Familie zugeordnet“ | Schritt 5 wiederholen, E-Mail-Adressen genau prüfen. |
| „API-Schlüssel fehlt oder ist falsch“ | Secret `ANTHROPIC_API_KEY` prüfen (Schritt 7.2). |
| KI-Knopf: „Das hat nicht geklappt“ | Funktion muss exakt `suggest-cards` heißen. Unter Edge Functions → suggest-cards → Logs steht der genaue Grund. |
| Alte Version wird angezeigt | App schließen und neu öffnen, ggf. Seite neu laden. |
