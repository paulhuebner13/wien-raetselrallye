# Rallye bearbeiten

## 1. Stationen

Datei:

`config/stations.json`

Aktuell gibt es **4 normale Stationen**. Johnny's Pub ist **keine Station**, sondern nur der feste Endpunkt auf der Rallye-Karte.

Die vier Stationen haben die IDs `1`, `2`, `3`, `4`. Im Admin kannst du für jedes Team eine andere Reihenfolge eintragen, z. B.:

`2, 4, 1, 3`

Jede Stations-ID muss genau einmal vorkommen.

### Stationsbilder

Die Bilder liegen direkt in GitHub unter:

- `public/stations/1/1_1.jpg` bis `1_6.jpg`
- `public/stations/2/2_1.jpg` bis `2_6.jpg`
- `public/stations/3/3_1.jpg` bis `3_6.jpg`
- `public/stations/4/4_1.jpg` bis `4_6.jpg`

Die vorhandenen JPGs sind nur Platzhalter. Einfach durch deine eigenen JPG-Dateien mit denselben Namen ersetzen.

Bild 1 = 5 Hinweispunkte. Jeder weitere Hinweis kostet 1 Punkt. Bild 6 = 0 Hinweispunkte.

### Mehr als 4 Stationen

1. In `config/stations.json` `stationCount` erhöhen.
2. Unter `stations` ein weiteres Stationsobjekt ergänzen.
3. Einen Ordner wie `public/stations/5/` erstellen.
4. Dort `5_1.jpg` bis `5_6.jpg` ablegen.
5. In `config/scoring.json` bei Bedarf Punkte für Station 5 ergänzen.

Johnny's Pub bleibt unabhängig davon immer der Endpunkt und braucht keine Bilder oder Hinweise.

## 2. Johnny's Pub

Der Endpunkt steht in `config/stations.json`:

```json
"finish": {
  "title": "Johnny's Pub"
}
```

Er erscheint nach **Antworten prüfen** als letzter Punkt auf der Karte. Er hat keine Tipps, keine Antwort und keine Stationspunkte.

## 3. Fragen und Kategorien

Datei:

`config/questions.json`

Jede normale Frage hat mindestens:

```json
{
  "id": "meine-frage",
  "category": "Geschichte",
  "text": "Meine Frage?"
}
```

- `category` = Kategorie über der Frage
- `text` = Fragetext
- `id` = eindeutige technische ID; nach dem Start möglichst nicht mehr ändern

Die Namen auf den Kacheln kommen aus `categories` des jeweiligen Blocks:

```json
"categories": ["Geschichte", "Politik"]
```

## 4. Picture Round

Die 8 Bilder liegen direkt im Projekt:

- `public/picture-round/1.png`
- ...
- `public/picture-round/8.png`

Einfach durch deine Picture-Round-Bilder ersetzen und auf GitHub pushen.

Im Admin kannst du für jedes der 8 Bilder einzeln **Richtig** anhaken.

Wertung:

- 0–4 richtig = 0 Punkte
- 5–7 richtig = 1 Punkt
- 8 richtig = 2 Punkte

## 5. Fußballfrage

In `config/questions.json` ist eine Zuordnungsfrage eingebaut:

- SV Ried
- Austria Wien
- Rapid Wien
- WSG Tirol

Die möglichen Jahre stehen im Fragetext. Für jeden Club erscheint ein eigenes Jahresfeld.

## 6. Music Round

Die beiden MP3-Dateien liegen direkt im Projekt:

- `public/music-round/1.mp3`
- `public/music-round/2.mp3`

Die vorhandenen Dateien sind nur stille Platzhalter. Durch deine MP3s mit denselben Namen ersetzen.

Im Quiz gibt es für jeden Song einen Player und ein Feld für den Songtitel. Im Admin kannst du beide Songs einzeln als richtig markieren.

Wertung: 0, 1 oder 2 Punkte.

## 7. Punkte

Datei:

`config/scoring.json`

Hier stellst du die Punkte für normale Fragen, Stationsaufgaben sowie Guinness, Architektur und Wegbier ein.

Picture Round und Music Round werden automatisch mit maximal 2 Punkten gewertet.

## Bildformat der Stationshinweise

Alle Hinweisbilder sind fest für Hochformat ausgelegt: **3:4 (Breite:Höhe)**. Verwende für alle Stationsbilder dasselbe Format, z. B. 1200 × 1600 px.

Die Picture-Round-Bilder können in der Rallye angetippt und groß geöffnet werden.
