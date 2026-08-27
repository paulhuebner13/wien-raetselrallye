# Wien Rätselrallye

Next.js + Supabase Web-App für eine mobile Wiener Rätselrallye.

## Bearbeiten

Siehe `BEARBEITEN.md`.

Wichtigste Dateien:

- `config/stations.json` – Stationen, Texte, Endpunkt, Architekturstile
- `config/questions.json` – Fragen, Kategorien, Spezialfragen
- `config/scoring.json` – Punkte
- `public/stations/` – Stationshinweise als JPG
- `public/picture-round/` – 8 Picture-Round-JPGs
- `public/music-round/` – 2 MP3-Dateien

Johnny's Pub ist nur der Endpunkt der Karte und keine Station mit Hinweisen.

## Admin: Punkte und Auslosung

- Punkte können direkt im Admin geändert werden; die gespeicherten Werte liegen in `app_settings` in Supabase und gelten auch in der Team-App.
- Die Team-Auslosung speichert Spielerliste, Teamanzahl, Zusammen-/Getrennt-Regeln und das letzte Ergebnis automatisch.
- Die Auswertung zeigt Teams nebeneinander und wertet Picture Round standardmäßig mit 0 Punkten bei 0–3, 1 Punkt bei 4–7 und 2 Punkten bei 8/8.


## Fragenblock-Timer

Jeder Fragenblock startet erst nach Klick auf **Los**. Standard: 5 Minuten. Der Startzeitpunkt wird in Supabase in `quiz_block_progress` gespeichert. Nach einem Update mit dieser Funktion `supabase/schema.sql` erneut im Supabase SQL Editor ausführen.

### Quiz-Timer
Der Admin kann Blocktimer global deaktivieren oder aktivieren. Bei aktivem Timer ist die Dauer für jeden Fragenblock separat einstellbar; Start und Restzeit gelten teamweit über Supabase.

- Music Round mit vier gestuften Songs; Hörlängen im Admin, Stufe pro Team gespeichert.


## Music Round – Hörstufen
Standardmäßig sind die vier Hörstufen 1 / 2 / 5 / 15 Sekunden. Im Admin können alle vier Werte geändert und gespeichert werden. Die Team-App übernimmt die gespeicherten Werte serverseitig; der Button zeigt jeweils die aktuell freigegebene bzw. nächste Dauer an.
