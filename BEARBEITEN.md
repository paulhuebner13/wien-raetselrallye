# Inhalte bearbeiten

## Stationsbilder: JPG ist erlaubt

Die Stationsbilder müssen **nicht** SVG sein. JPG, JPEG, PNG und WebP funktionieren ebenfalls.

Beispiel für Station 1:

```text
public/stations/1/1_1.jpg
public/stations/1/1_2.jpg
public/stations/1/1_3.jpg
public/stations/1/1_4.jpg
public/stations/1/1_5.jpg
public/stations/1/1_6.jpg
```

Danach in `config/stations.json` die Pfade entsprechend eintragen:

```json
"images": [
  "/stations/1/1_1.jpg",
  "/stations/1/1_2.jpg",
  "/stations/1/1_3.jpg",
  "/stations/1/1_4.jpg",
  "/stations/1/1_5.jpg",
  "/stations/1/1_6.jpg"
]
```

Die Reihenfolge ist wichtig: erstes Bild = schwierigster Hinweis = 5 Punkte. Jedes weitere Bild kostet 1 Hinweispunkt. Bei 6 Bildern ergeben sich 5, 4, 3, 2, 1, 0 Punkte.

## Stationen ändern oder hinzufügen

Datei: `config/stations.json`

Jede normale Station ist ein Objekt in `stations`:

```json
{
  "id": 4,
  "title": "Station 4",
  "text": "Findet vor Ort ...",
  "answerLabel": "Antwort",
  "taskPoints": 5,
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

Für Station 4 zusätzlich den Ordner `public/stations/4/` anlegen und dort die Bilder ablegen.

`stationCount` muss immer der Gesamtzahl der Stationen entsprechen.

Johnny's Pub ist aktuell Station-ID `3` und bleibt durch

```json
"finalStationId": 3
```

immer die Finalstation. Neue Stationen können also IDs 4, 5, 6 usw. bekommen, ohne Johnny umzubenennen. Im Admin muss jede Team-Reihenfolge alle Station-IDs genau einmal enthalten und mit `3` enden, z. B. bei fünf Stationen:

```text
2, 5, 1, 4, 3
```

Wenn nachträglich Stationen ergänzt werden, zeigt der Admin bei alten ungültigen Reihenfolgen automatisch wieder die vollständige Standardreihenfolge an.

## Quizfragen ändern

Datei: `config/questions.json`

Eine Frage sieht z. B. so aus:

```json
{
  "id": "geo-flags",
  "category": "Geographie",
  "text": "Welche Farbe ...?"
}
```

- `id`: eindeutige technische ID. Nach Möglichkeit später nicht mehr ändern, wenn schon Antworten gespeichert wurden.
- `category`: Kategorie, die direkt bei der einzelnen Frage angezeigt wird.
- `text`: eigentlicher Fragetext.

## Kategorien der Fragenblöcke ändern

Ebenfalls in `config/questions.json`.

Jeder Block hat oben `categories`:

```json
{
  "id": "block-2",
  "categories": ["Geschichte", "Politik", "Geschichte / Antike"],
  "questions": [...]
}
```

Diese Liste bestimmt den Namen der Kachel im Rallye-Pfad, z. B.:

```text
Fragen · Geschichte / Politik / Geschichte / Antike
```

Die `category` jeder einzelnen Frage bestimmt dagegen die kleine Kategorie-Anzeige innerhalb des Fragenblocks.

Die Blöcke werden in der Reihenfolge verwendet, in der sie in `questions.json` stehen. Ein Block wird beim Verteilen zwischen den Stationen nie auseinandergerissen.

## Punkte ändern

Datei: `config/scoring.json`

Hier stehen u. a.:

- maximale Hinweispunkte
- Standardpunkte pro Stationsaufgabe
- individuelle Punkte einzelner Stationen
- Standardpunkte pro Quizfrage
- individuelle Punkte einzelner Quizfragen
- Punkte pro gültigem Guinness-Foto
- Punkte pro Architekturstil
- Punkte pro gültigem Dosenbier

