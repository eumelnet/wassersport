# Havelkanal – Streifenkarte Web-Viewer

Interaktive Webansicht der 1:5.000-Streifenkarte (km 0,0 – 34,59) aus ENC-Daten.

## Starten
Einfach `index.html` im Browser öffnen (funktioniert als lokale Datei **und** über einen
Webserver, z. B. `python3 -m http.server 8123` im Ordner `web/`).

## Bedienung
- **Ziehen** – verschieben entlang des Kanals
- **Mausrad** – zoomen
- **Rechtes Panel** – Sprung zu km-Eingabe oder Listenpunkt (Brücken, Schleuse, Häfen, Ortschaften …)
- **Untere Anzeige** – km-Station und seitlicher Abstand zur Achse unter dem Mauszeiger
- **Links im Band** – km-Markierungen an der Wasserachse

## Aufbau
- `index.html` – Viewer (Leaflet 1.9.4, lokal eingebunden, komplett offline-fähig)
- `tiles/{z}/{x}/{y}.png` – Tile-Pyramide, 7 Zoomstufen (0,03 … 1,92 px/m)
- `config.json`, `pois.json` – Geometrie/POI-Daten (in `index.html` eingebettet)
- `leaflet.js`, `leaflet.css` – Leaflet-Kopie

## Karten-Koordinatensystem
- `lat` = `s` (Meter entlang der HvK-Achse, km 0 oben), `lng` = `t` (Meter quer)
- Pixeldichte: 2^z · 0,03 px/m; Tile-Nummern passen exakt zur Pyramide.

Neu erzeugen: `/tmp/plot/gen_tiles.py` (löst `chartlib`-Band-Daten in Tiles auf).