# Wien Rätselrallye – Setup

## 1. Supabase

Im Supabase-Projekt **SQL Editor** öffnen und den kompletten Inhalt von `supabase/schema.sql` ausführen.

Das gilt auch, wenn du die erste Version schon eingerichtet hast. Die Datei erweitert bestehende Tabellen sicher mit:
- Deadline
- Stations-Reihenfolge pro Team
- Wegbier-Fotos
- Picture-Round-Bildern

Danach brauchst du unter **Settings → API Keys**:
- Project URL
- Publishable Key (`sb_publishable_...`)
- Secret Key (`sb_secret_...`)

## 2. `.env.local`

Im Hauptordner neben `package.json`:

```env
NEXT_PUBLIC_APP_NAME=Wien Rätselrallye
NEXT_PUBLIC_SUPABASE_URL=https://DEIN-PROJEKT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_DEIN_KEY
SUPABASE_URL=https://DEIN-PROJEKT.supabase.co
SUPABASE_SECRET_KEY=sb_secret_DEIN_KEY
ADMIN_PASSWORD=DEIN_ADMIN_PASSWORT
SESSION_SECRET=DEIN_ZUFAELLIGER_SECRET
```

Session Secret erzeugen:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## 3. Lokal starten

PowerShell, falls `npm` blockiert wird:

```powershell
npm.cmd install
npm.cmd run dev
```

- Website: `http://localhost:3000`
- Admin: `http://localhost:3000/admin`

## 4. Stationen

Datei: `config/stations.json`

Wichtig:
- `stationCount` = Anzahl der Stationen
- `finish.title` = Name des Endpunkts, aktuell Johnny's Pub
- Johnny's Pub ist kein Teil der Stations-Reihenfolge

Stationsbilder liegen unter `public/stations/...`.

Beispiel:

```json
{
  "id": 4,
  "title": "Station 4",
  "text": "Findet das Schild. Welche Jahreszahl steht darauf?",
  "answerLabel": "Jahreszahl",
  "images": [
    "/stations/4/4_1.jpg",
    "/stations/4/4_2.jpg",
    "/stations/4/4_3.jpg",
    "/stations/4/4_4.jpg",
    "/stations/4/4_5.jpg",
    "/stations/4/4_6.jpg"
  ]
}
```

6 Bilder entsprechen 5 → 0 Hinweispunkten.

## 5. Quiz und Kategorien

Datei: `config/questions.json`

Jeder Block hat ein Feld `categories`. Genau diese Namen werden auf dem Rallye-Weg angezeigt:

```json
{
  "id": "block-2",
  "categories": ["Geschichte", "Politik"],
  "questions": []
}
```

Anzeige: `Fragen · Geschichte / Politik`

Die Blöcke bleiben zusammen und werden automatisch möglichst gleichmäßig zwischen den Stationen verteilt.

### Picture Round

Die 8 Picture-Round-Bilder liegen in GitHub unter `public/picture-round/1.png` bis `8.png`. Ersetze diese Dateien durch deine eigenen Picture-Round-Bilder.

### Music Round

Die beiden Audiodateien liegen unter `public/music-round/1.mp3` und `2.mp3`. Ersetze sie durch deine eigenen MP3s.

## 6. Punkte

Datei: `config/scoring.json`

Hier legst du Punkte fest für:
- jede einzelne Quizfrage
- Vor-Ort-Aufgaben der Stationen
- Guinness pro Logo
- Architektur pro Stil
- Wegbier pro gültigem Dosenbier

Beispiel:

```json
{
  "stationTaskPoints": { "1": 5, "2": 5, "3": 5, "4": 5 },
  "questionPoints": { "geo-neighbours": 2 },
  "guinnessPerLogo": 3,
  "architecturePerStyle": 1,
  "beerPerUniqueCan": 1
}
```

## 7. Architektur

Die Stile und Kurzbeschreibungen stehen in `config/stations.json`.

Aktuell:
- Gotik
- Barock
- Jugendstil
- Klassizismus
- Historismus

## 8. Admin

Im Admin kannst du:
- Teams hinzufügen/löschen
- Deadline laufend ändern
- Stations-Reihenfolge pro Team festlegen
- Teams auslosen
- Paare definieren, die zusammen sein müssen
- Paare definieren, die nicht zusammen sein dürfen
- Antworten prüfen
- Stationsantworten zurücksetzen
- Quiz-, Stations- und Challenge-Einträge bewerten

Stations-Reihenfolge z. B.:

```text
Team A: 1, 2, 3, 4
Team B: 3, 1, 4, 2
```

Johnny's Pub gehört nicht zur Stations-Reihenfolge. Trage nur die normalen Stations-IDs ein.

## 9. Challenges

### Guinness
- beliebig viele Uploads
- verschiedene Pubs
- Harfe + Guinness-Schriftzug sichtbar

### Architektur
- 1 Foto pro Stil
- Gebäudename eingeben

### Wegbier
- Foto + Bier/Sorte eingeben
- verschiedene Sorten zählen getrennt
- verschiedene Dosengrößen derselben Sorte nicht
- kein Radler, Cider, alkoholfreies Bier

## 10. GitHub

```powershell
git init
git add .
git commit -m "Wien Rätselrallye"
git branch -M main
git remote add origin https://github.com/DEIN-USERNAME/wien-raetselrallye.git
git push -u origin main
```

## 11. Vercel

GitHub-Repo in Vercel importieren und dieselben 7 Environment Variables aus `.env.local` eintragen.

Nach späteren Änderungen:

```powershell
git add .
git commit -m "Update"
git push
```

Vercel deployt automatisch.


## Update: Auswertung

Nach diesem Update die Datei `supabase/schema.sql` erneut komplett im Supabase SQL Editor ausführen. Sie ergänzt die Tabelle `evaluations` für die Admin-Wertung. Bestehende Daten bleiben erhalten.
