# Renderer

Kleines Lernprojekt: ein simpler 3D-Wireframe-Renderer auf HTML5 Canvas, ohne
Bibliothek — eigene Mathe fürs Rotieren und Projizieren, ganz ohne Matrix: die
Vertizes werden direkt weitergedreht.

Die Idee und der Startpunkt stammen aus dem Video
[One Formula That Demystifies 3D Graphics](https://www.youtube.com/watch?v=qjWkNZ0SXfo)
von **Tsoding** — die „magic formula" ist die Perspektivdivision `x/z, y/z`,
die im Code bis heute so heißt. Der erste
Wurf war im Wesentlichen sein Code aus dem Video. Alles danach ist selbst
gebaut: Maussteuerung, Tiefen-Shading, dynamisches Nachladen der Modelle und
die Werkzeugkette, mit der aus einer heruntergeladenen .obj oder .stl — oder
aus einem CT-Datensatz — ein Modell wird, das der Renderer verkraftet.

## Features

- **Drehen** — linke Maustaste halten und ziehen. Die Winkel laufen auf und
  werden einmal pro Frame verrechnet, nicht pro Mausevent.
- **Zoom** — Mausrad. Vorwärts schiebt das Objekt weg, rückwärts holt es heran.
  Kanten hinter der Kamera werden verworfen.
- **Cutaway** — rechte Maustaste halten und scrollen fährt eine Schnittebene
  durchs Modell, sodass man hineinsieht. Vorwärts schneidet tiefer. Die
  Daumentaste (BT4) oder die Taste `a` schaltet die Schnittachse x → y → z
  weiter und setzt den Schnitt dabei zurück. Doppelt belegt, weil WebStorms
  eingebaute Vorschau die Daumentasten nicht an die Seite durchreicht. Im
  Edit-Mode setzt BT4 stattdessen einen Punkt — die Achse bleibt dort auf `a`.
  Die Ebene liegt in Modellkoordinaten und dreht mit.
  Grob nach Flächen-Schwerpunkt: die Schnittkante ist gezackt, das Innere
  liegt hohl frei.
- **Tiefen-Shading** — Kanten werden in 16 Stufen nach Entfernung eingefärbt,
  nah hell bis fern dunkel. Das z-Fenster kommt aus der echten Ausdehnung des
  Meshes.
- **Modelle werden einzeln nachgeladen** — statische Imports hätten den Browser
  bei jedem Seitenaufruf alle Modelle laden lassen, gut 19 MB.
- **Edit-Mode** — Vertizes greifen, ziehen, einsetzen und verbinden. Eigener
  Abschnitt unten.

## Edit-Mode

Taste `e` (oder die hintere Daumentaste) schaltet um. Erkennbar am ockerfarbenen
Rahmen; jeder Vertex bekommt einen Punkt, damit man sieht, was greifbar ist.

| Eingabe | macht |
|---|---|
| Linksklick auf Punkt + ziehen | Vertex verschieben, parallel zur Bildebene |
| Linksklick ins Leere + ziehen | Modell drehen, wie sonst auch |
| **BT4** oder `i` | Punkt am Cursor einsetzen — wird sofort Anker |
| **Shift+Klick** auf Punkt | Anker setzen, bzw. Kante vom Anker dorthin |
| `Escape` | Anker loslassen |
| **Shift+R** | zurück auf den Stand vom Betreten |
| **Strg+S** | Modell als `<name>_edit.js` in den Download-Ordner |

Rot ist der gegriffene Punkt, grün der Anker. Vom Anker läuft eine gestrichelte
Linie zum Cursor, solange eine Verbindung aussteht. Verbunden wird sternförmig:
der Anker bleibt stehen, jeder weitere Shift-Klick zieht eine Kante von ihm weg.

Beim Betreten wird der Stand gesichert und ab da an der Kopie gearbeitet. Beim
Verlassen bleiben die Änderungen — `e` drückt man zu oft, als dass es Arbeit
kosten dürfte. Shift+R holt den gesicherten Stand zurück.

### Was der Edit-Mode nicht kann

Editiert wird `mesh`, die bereits gedrehte Arbeitskopie. Es gibt keine
Rotationsmatrix und damit keinen Rückweg in die Modellkoordinaten — daraus folgt
alles Weitere:

- **`model.vs` läuft auseinander.** Der Cutaway entscheidet weiter auf der
  ursprünglichen Geometrie, verschobene Vertizes ändern daran nichts.
- **Eingesetzte Punkte und ihre Kanten kennt der Cutaway nicht.** Sie bleiben
  sichtbar, auch wenn ringsum weggeschnitten ist.
- **Gespeichert wird die Geometrie in ihrer jetzigen Lage.** Die Orientierung
  steckt in den Vertizes; beim Laden legt der Renderer sein Preset nochmal
  obendrauf, das Modell erscheint also gedreht.
- **Kein Undo, kein Löschen.** Shift+R ist der einzige Weg zurück, Reload der
  vollständige Reset.

Wer die Edits sauber behalten will, braucht eine Rotationsmatrix — das wäre ein
eigener Umbau und ist bewusst nicht Teil davon.

Die gespeicherte Datei landet im Download-Ordner; der Browser kann nicht nach
`modelle/` schreiben. Datei dorthin legen, Namen in `modelle.js` eintragen. Die
von Hand gezogenen Kanten stehen darin als Zweier-Einträge in `fs` — nach dem
Neuladen sind sie richtige Modellkanten und machen den Cutaway mit.

## Struktur

- `.idea/html5canvasAnimations/renderer.js` — Renderer + Maussteuerung
- `.idea/html5canvasAnimations/modelle.js` — Namensliste + `importModel`
- `.idea/html5canvasAnimations/modelle/` — Vertex/Face-Daten der 3D-Modelle
- `.idea/html5canvasAnimations/2model/` — die Konverter ins Modellformat
- `.idea/html5canvasAnimations/cutInHalf.js` — Dezimierer, siehe Werkzeuge
- `.idea/html5canvasAnimations/index.html` — Einstiegspunkt
- `docs/build-log.md` — was wann warum gebaut wurde, ein Eintrag je Commit
- `docs/errors.md` — Fehler, die Zeit gekostet haben, mit Ursache und Fix
- `docs/performance.md` — offene Befunde zur Renderer-Geschwindigkeit

Modell wechseln: Name in `renderer.js` bei `importModel(...)` einsetzen. In die
Liste eingetragen haben sich die Konverter schon selbst.

Die grossen Zwischenstufen — `stlFiles/`, `cutStlFiles/`, `objFiles/` — sind
bewusst nicht im Repo. Getrackt ist nur, was der Renderer lädt.

## Werkzeuge

Vier Skripte: die Konverter in `2model/`, `cutInHalf.js` neben dem Renderer.
Alle nach demselben Muster: Konfiguration als Konstanten oben in der Datei,
keine Kommandozeilenargumente — Datei in WebStorm öffnen, grüner Pfeil.

| Skript | macht |
|---|---|
| `2model/obj2model.js` | `.obj` → `.js` im Modellformat |
| `2model/stl2model.js` | `.stl` → `.js` im Modellformat (binär und ASCII, weldet Vertices) |
| `2model/dcm2stl.py` | CT-Serie (`.dcm`) → `.stl` per Knochen-Schwellwert |
| `cutInHalf.js` | `.stl` → kleinere `.stl` (Vertex-Clustering) |

Der Renderer schafft ungefähr 40.000 Vertizes. Echte Downloads haben leicht das
Zwanzigfache, deshalb die Kette:

```
grosse.stl  →  cutInHalf.js  →  kleine.stl  →  stl2model.js  →  modell.js

.dcm-Serie  →  dcm2stl.py  →  grosse.stl  →  weiter wie oben
```

`dcm2stl` ist als einziges Werkzeug Python statt Node — reine Standard-
bibliothek, kein `pip install`. Ein CT ist in Hounsfield-Einheiten kalibriert,
Knochen liegt über ~300 HU; daraus baut Marching Tetrahedra eine geschlossene
Oberfläche. Der Ordner muss genau **eine** Serie enthalten, sonst bricht das
Skript ab. Für MR taugt es nicht: dort sind die Grauwerte nicht kalibriert und
ein fester Schwellwert findet keinen Knochen.

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
