# Rallye bearbeiten

## 1. Stationen

Datei: `config/stations.json`

Aktuell gibt es **4 normale Stationen**. Johnny's Pub ist **keine Station**, sondern nur der feste Endpunkt auf der Rallye-Karte.

Die vier Stationen haben die IDs `1`, `2`, `3`, `4`. Im Admin kannst du für jedes Team eine andere Reihenfolge eintragen, z. B. `2, 4, 1, 3`.

### Stationsbilder

Die Bilder liegen direkt in GitHub:

- `public/stations/1/1_1.jpg` bis `1_6.jpg`
- `public/stations/2/2_1.jpg` bis `2_6.jpg`
- `public/stations/3/3_1.jpg` bis `3_6.jpg`
- `public/stations/4/4_1.jpg` bis `4_6.jpg`

Alle Hinweisbilder sind fest auf **3:4 Hochformat** ausgelegt, z. B. 1200 × 1600 px.

Bild 1 = 5 Hinweispunkte. Jeder weitere Hinweis kostet 1 Punkt. Bild 6 = 0 Hinweispunkte.

### Mehr Stationen

1. In `config/stations.json` `stationCount` erhöhen.
2. Unter `stations` ein weiteres Stationsobjekt ergänzen.
3. Ordner `public/stations/5/` erstellen.
4. `5_1.jpg` bis `5_6.jpg` ablegen.
5. Bei Bedarf Stationspunkte im Admin ergänzen.

Johnny's Pub bleibt immer der Endpunkt und braucht keine Bilder oder Hinweise.

## 2. Johnny's Pub

In `config/stations.json`:

```json
"finish": {
  "title": "Johnny's Pub"
}
```

Es erscheint nach **Antworten prüfen** als letzter Punkt auf der Karte.

## 3. Kategorien, Blöcke und Fragen

Alles steht in `config/questions.json`.

### Kategorien erstellen

Ganz oben steht die Liste aller möglichen Kategorien:

```json
"categories": [
  "Picture Round",
  "Geographie",
  "Geschichte"
]
```

Neue Kategorie: einfach einen weiteren Namen ergänzen. Eine Kategorie darf existieren, ohne in einem Block verwendet zu werden.

### Die 7 Fragenblöcke

Direkt darunter stehen die Blöcke:

```json
{
  "id": "block-2",
  "name": "Geographie & Geschichte",
  "categories": ["Geographie", "Geschichte"]
}
```

- `name` = Text auf der quadratischen Kachel in der Rallye
- `categories` = alle Kategorien, deren Fragen in diesem Block erscheinen
- Auf der Rallye steht kein zusätzliches Wort „Fragen“, nur das `?` und dein Blockname.

Aktuell gibt es **7 Blöcke**. Bei 4 Stationen werden sie automatisch so angeordnet:

**Station 1 → Block 1 → Block 2 → Station 2 → Block 3 → Block 4 → Station 3 → Block 5 → Block 6 → Station 4 → Block 7 → Antworten prüfen → Johnny's Pub**

### Fragen erstellen

Weiter unten steht die gemeinsame Fragenliste:

```json
{
  "id": "meine-frage",
  "category": "Geschichte",
  "text": "Meine Frage?"
}
```

Jede Frage gehört genau einer Kategorie. Sie erscheint automatisch in dem Block, dem diese Kategorie zugeordnet ist.

`id` muss eindeutig sein und sollte nach dem Start nicht mehr geändert werden.

### Zeit pro Fragenblock

Ganz oben steht:

```json
"blockDurationMinutes": 5
```

Beim ersten Öffnen eines Blocks erscheint zuerst der Startscreen. Erst mit **Los** beginnt der Timer. Der Start wird in Supabase gespeichert. Reload oder erneutes Öffnen setzt den Timer nicht zurück. Nach Ablauf sind die Antworten dieses Blocks gesperrt.

## 4. Picture Round

Die 8 Bilder liegen direkt im Projekt:

- `public/picture-round/1.png`
- ...
- `public/picture-round/8.png`

Sie werden quadratisch angezeigt und können groß geöffnet werden.

Im Admin kannst du jedes Bild einzeln als **Richtig** markieren.

Standardwertung:

- 0–3 richtig = 0 Punkte
- 4–7 richtig = 1 Punkt
- 8/8 = 2 Punkte

Die Schwelle und Punkte kannst du im Admin ändern.

## 5. Music Round

Dateien:

- `public/music-round/1.mp3`
- `public/music-round/2.mp3`
- `public/music-round/3.mp3`
- `public/music-round/4.mp3`

Im Quiz gibt es vier Songs. Jeder Song startet mit Hörstufe 1. Über „Mehr hören“ werden nacheinander Stufe 2, 3 und 4 freigeschaltet. Die Hörlängen stellst du im Admin unter **Music Round** ein. Standardpunkte pro richtig erkanntem Song: Stufe 1 = 2 P., Stufe 2 = 1,5 P., Stufe 3 = 1 P., Stufe 4 = 0,5 P. Die verwendete Stufe wird pro Team gespeichert.

## 6. Punkte

Die Punkte kannst du direkt im Admin ändern. Die gespeicherten Admin-Werte liegen in Supabase und haben Vorrang vor `config/scoring.json`.

## 7. Team-Auslosung

Spielerliste, Teamanzahl, Zusammen-/Getrennt-Paare und das letzte Ergebnis werden automatisch in Supabase gespeichert.

## Fragenblock-Timer

Im Admin unter **Fragenblock-Timer**:

- **Aus:** Kein „Los“-Dialog und kein eigener Timer. Quizantworten bleiben bis zum Gesamt-Zeitlimit für Johnny's Pub bearbeitbar.
- **An:** Für jeden der 7 Blöcke kann separat eine Dauer in Minuten eingestellt werden. Erst mit **Los** startet der jeweilige Block.
- Der Blockstart wird pro Team in Supabase gespeichert. Alle Geräte desselben Teams teilen sich denselben Timer.
- Wird der Blocktimer ausgeschaltet, werden alte Blockzeiten ignoriert. Wird er später wieder aktiviert, starten die Blöcke für alle Teams neu.


## Music Round – Hörstufen
Standardmäßig sind die vier Hörstufen 1 / 2 / 5 / 15 Sekunden. Im Admin können alle vier Werte geändert und gespeichert werden. Die Team-App übernimmt die gespeicherten Werte serverseitig; der Button zeigt jeweils die aktuell freigegebene bzw. nächste Dauer an.
