# Renderer

Kleines Lernprojekt: ein simpler 3D-Wireframe-Renderer auf HTML5 Canvas, ohne
Bibliothek — eigene Matrix-Mathe fürs Rotieren und Projizieren.

Die Idee und der Startpunkt stammen aus dem Video
[One Formula That Demystifies 3D Graphics](https://www.youtube.com/watch?v=qjWkNZ0SXfo)
von **Tsoding** — die „magic formula" ist die Perspektivdivision `x/z, y/z`,
die im Code bis heute so heißt. Der erste
Wurf war im Wesentlichen sein Code aus dem Video. Alles danach ist selbst
gebaut: Maussteuerung, Tiefen-Shading, dynamisches Nachladen der Modelle und
die Werkzeugkette, mit der aus einer heruntergeladenen .obj oder .stl ein
Modell wird, das der Renderer verkraftet.

## Features

- **Drehen** — linke Maustaste halten und ziehen. Die Winkel laufen auf und
  werden einmal pro Frame verrechnet, nicht pro Mausevent.
- **Zoom** — Mausrad. Vorwärts schiebt das Objekt weg, rückwärts holt es heran.
  Kanten hinter der Kamera werden verworfen.
- **Cutaway** — rechte Maustaste halten und scrollen fährt eine Schnittebene
  durchs Modell, sodass man hineinsieht. Vorwärts schneidet tiefer. Die
  Daumentaste (BT4) oder die Taste `a` schaltet die Schnittachse x → y → z
  weiter und setzt den Schnitt dabei zurück. Doppelt belegt, weil WebStorms
  eingebaute Vorschau die Daumentasten nicht an die Seite durchreicht. Die Ebene liegt in Modellkoordinaten und dreht mit.
  Grob nach Flächen-Schwerpunkt: die Schnittkante ist gezackt, das Innere
  liegt hohl frei.
- **Tiefen-Shading** — Kanten werden in 16 Stufen nach Entfernung eingefärbt,
  nah hell bis fern dunkel. Das z-Fenster kommt aus der echten Ausdehnung des
  Meshes.
- **Modelle werden einzeln nachgeladen** — statische Imports hätten den Browser
  bei jedem Seitenaufruf alle Modelle laden lassen, gut 19 MB.

## Struktur

- `.idea/html5canvasAnimations/renderer.js` — Renderer + Maussteuerung
- `.idea/html5canvasAnimations/modelle.js` — Namensliste + `importModel`
- `.idea/html5canvasAnimations/modelle/` — Vertex/Face-Daten der 3D-Modelle
- `.idea/html5canvasAnimations/index.html` — Einstiegspunkt

Modell wechseln: Name in `renderer.js` bei `importModel(...)` einsetzen. In die
Liste eingetragen haben sich die Konverter schon selbst.

## Werkzeuge

Drei Node-Skripte neben dem Renderer. Alle nach demselben Muster: Konfiguration
als Konstanten oben in der Datei, keine Kommandozeilenargumente — Datei in
WebStorm öffnen, grüner Pfeil.

| Skript | macht |
|---|---|
| `obj2model.js` | `.obj` → `.js` im Modellformat |
| `stl2model.js` | `.stl` → `.js` im Modellformat (binär und ASCII, weldet Vertices) |
| `cutInHalf.js` | `.stl` → kleinere `.stl` (Vertex-Clustering) |

Der Renderer schafft ungefähr 40.000 Vertizes. Echte Downloads haben leicht das
Zwanzigfache, deshalb die Kette:

```
grosse.stl  →  cutInHalf.js  →  kleine.stl  →  stl2model.js  →  modell.js
```

`obj2model` und `stl2model` nehmen eine einzelne Datei oder einen ganzen Ordner,
schreiben nach `modelle/` und tragen den Namen selbst in `modelle.js` ein. Der
Name kommt aus dem Dateinamen, Leerzeichen und alles andere, was in einem
JS-Bezeichner nicht vorkommen darf, wird zu `_`.

`cutInHalf` hat einen einzigen Hebel: `GITTER`, die Zellenzahl entlang der
längsten Achse. Größer heißt feiner heißt mehr Dreiecke. Es gibt keine
Zielvorgabe — das Skript meldet die Vertex-Zahl, du drehst am `GITTER` und
lässt es nochmal laufen. Zwei bis drei Versuche sind normal.

## Starten

Browser blockieren ES-Module über `file://` — ein lokaler Server ist nötig:

```
npx serve .idea/html5canvasAnimations
```
