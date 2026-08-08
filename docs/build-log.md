# Build Log

## 2026-08-09 — feat(tools): obj2model nimmt auch einen ganzen Ordner
**Was:** `OBJ_DATEI` heißt jetzt `OBJ_QUELLE` und darf eine Datei **oder** ein Ordner
sein; beim Ordner wird jede `.obj` darin umgewandelt. Die Umwandlung ist dafür in
`umwandeln(datei, nameVorgabe)` gewandert. `MODELL_NAME` gilt nur noch im
Einzeldatei-Modus — zwanzig Dateien können nicht denselben Namen tragen, im Stapel
kommt er aus dem Dateinamen. Umbenannt, weil ein Name mit „DATEI" für etwas, das auch
ein Ordner sein darf, in die Irre führt.
**Nicht gebaut:** nicht rekursiv, keine Dateimuster, kein Überspringen vorhandener
Ausgaben, kein Parallelbetrieb. Zwei bewusste Zusätze: pro Datei ein `try/catch`, damit
eine kaputte den Stapel nicht abbricht, und ein Guard gegen 0 Vertizes — der hätte
sonst durch Division eine Datei voller NaN geschrieben, was im Stapel niemandem
auffällt.

## 2026-08-09 — feat(renderer): Achsenwechsel auch auf Taste `a`
**Was:** Die Daumentaste kommt in WebStorms eingebauter Vorschau nicht an — erst fängt
das Standard-Keymap `Button4` für *Navigate Back* ab, und nach dem Entfernen reicht
JCEF sie trotzdem nicht an die Seite durch. Der Achsenwechsel liegt deshalb zusätzlich
auf `a`; die Schaltlogik ist nach `achseWechseln()` gewandert, weil sie jetzt an zwei
Stellen hängt. Die Maustaste bleibt, in Brave funktioniert sie. Details in `errors.md`.
**Nicht gebaut:** keine Umbelegung der Taste über eine Konstante, keine Rückwärts-Taste.

## 2026-08-09 — feat(renderer): Daumentaste schaltet die Schnittachse
**Was:** BT4 (DOM `button === 3`) schaltet `ACHSE` x → y → z weiter. `ACHSE` musste
dafür von `const` auf `let`, und die CUT-Initialisierung ist zu `cutZuruecksetzen()`
geworden, weil sie bei jedem Wechsel erneut laufen muss: die Achsen sind
unterschiedlich weit ausgedehnt. Bei craniumCut01 liegt der Startwert je Achse bei
0,850 / 0,800 / 1,245 — ein übernommener Wert hätte nach dem Wechsel von y nach x neun
Radschritte lang gar nichts bewirkt. Geprüft an craniumCut01 und pochita30: jede Achse
startet bei 100 % sichtbar, erster Schnitt immer nach 2 Radschritten, Zyklus schließt.
**Nicht gebaut:** BT5 bleibt frei, keine Anzeige der aktiven Achse auf der Leinwand,
kein Rückwärts-Durchschalten. Ausnahme vom YAGNI: ein `auxclick`-Handler unterdrückt
zusätzlich die Zurück-Navigation — ein Seitenwechsel würde Drehung, Zoom und Schnitt
verlieren, und ob `preventDefault` auf `mousedown` allein reicht, ist browserabhängig.

## 2026-08-09 — refactor(renderer): Mausrad neu belegt — nackt zoomt, rechts schneidet
**Was:** Der Schnitt ist eine kontinuierliche Bewegung, dafür taugt das Rad besser als
16–24 Tastendrücke. Also: nacktes Rad = Zoom (Standardgeste, war ungenutzt), rechte
Taste + Rad = Schnittebene. `,` und `.` ersatzlos raus. Die Radschritte werden wie die
Drehwinkel aufgesammelt und einmal pro Frame angewandt — jede `CUT`-Änderung baut die
Kantenliste neu, bei skull 40.728 Flächen, und das Rad feuert schneller als Frames
kommen. Geprüft: nacktes Rad lässt `CUT` unberührt und umgekehrt, 8× rein + 8× raus
landet exakt am Start, Sammeln ist float-genau identisch mit Einzelanwendung.
README-Features auf die neue Belegung nachgezogen.
**Nicht gebaut:** kein Shift-Modifier, kein proportionaler Schritt aus dem
`deltaY`-Betrag, keine Tastensteuerung parallel zum Rad.

## 2026-08-09 — fix(renderer): Cutaway startet ungeschnitten
**Was:** `CUT` startete auf 0, also war beim Laden sofort eine Hälfte weg — sah nach
kaputtem Modell aus. Der Startwert wird jetzt aus dem Modell abgeleitet: größter
Flächenschwerpunkt auf der Achse plus ein Schritt. Nicht fest eingetragen, weil die
Modelle die Achse verschieden weit ausfüllen (cat bis 0,74, klo bis 1,20) — ein fester
Wert hieße bei flachen Modellen ein Dutzend Tastendrücke, bevor überhaupt etwas
passiert. Die Schwerpunktrechnung ist dabei in `schwerpunkt(f)` gewandert, sie wird
jetzt an zwei Stellen gebraucht.
Geprüft an pochita30, skull, cat, klo: beim Laden je 100 % der Kanten, erster Schnitt
nach 2× `,`.
**Nicht gebaut:** kein Clamping nach oben, keine Reset-Taste.

## 2026-08-09 — feat(renderer): Cutaway per Schnittebene
**Was:** Achsen-ausgerichtete Schnittebene (`ACHSE`, `CUT`), die eine Hälfte weglässt,
damit man ins Modell sieht. `,` und `.` fahren den Schnitt durch. Der Test läuft auf
den rohen Koordinaten aus `model.vs`, die Ebene dreht also mit dem Modell mit.
**Wo der Test sitzt und warum:** die Draw-Schleife iteriert über die deduplizierte
Kantenliste, nicht über Flächen — es gibt dort keine Fläche zum Überspringen. Der
Test sitzt deshalb im Aufbau der Kantenliste, die bei Änderung von `CUT` neu gebaut
wird. Semantik identisch (Fläche ganz drin oder ganz draußen), kostet aber nichts pro
Frame und erhält die Dedup-Optimierung aus `a8da05a`.
Schwerpunkt über `f.length` statt über 3, weil `skull` nachweislich Dreiecke **und**
Vierecke enthält. Geprüft: 0 % der Kanten bei CUT −1.5, 100 % bei +1.5, monoton
dazwischen, über alle drei Achsen.
**Nicht gebaut:** kein Triangle-Splitting (Schnittkante bleibt gezackt), kein Deckel,
kein Per-Modell-Flag, keine kamera-relative Ebene, kein Clamping von `CUT`.

## 2026-08-09 — feat(modelle): sieben neue Modelle, Zwischenstufen ignoriert
**Was:** Die Namensliste nannte zehn Modelle, deren Dateien nicht im Repo lagen — ein
frischer Clone wäre beim Auswählen in einen 404 gelaufen. Sieben davon sind jetzt drin
(~7 MB): forMax01, craniumCut01, pochita10/30/64, klo, cat. Die drei anderen —
pochita128, pochita256, forMax00, zusammen 15 MB — sind Zwischenstufen aus der Suche
nach dem richtigen GITTER und fliegen aus Liste und Repo. Dazu `cutStlFiles/` in die
.gitignore, gleiche Kategorie wie `stlFiles/`. Geprüft: alle 18 Listeneinträge haben
eine Datei, und die einzigen Dateien ohne Eintrag sind die drei ignorierten.
**Nicht gebaut:** kein Namensschema, an dem sich Zwischenstufen automatisch erkennen
ließen — die drei stehen explizit in der .gitignore, weil es keine Konvention gibt.

## 2026-08-09 — delete(modelle): cube
**Was:** `cube.js` raus, der Eintrag in der Namensliste war schon weg. Das Würfelchen
war das Testmodell vom ersten Tag, seit es echte Meshes gibt ohne Zweck. Die Löschung
war versehentlich im vorigen Commit gelandet — siehe `errors.md`; dieser Commit trägt
sie jetzt allein und benannt.
**Nicht gebaut:** —

## 2026-08-09 — feat(renderer): Farbtabelle auf 16 Blautöne
**Was:** `SHADES` von 4 auf 16 Einträge. Werte aus HSL 210° / 85 % / L = 90 − i·4.8,
einmal ausgerechnet und statisch eingetragen — zur Laufzeit umzurechnen wäre Arbeit
pro Frame für ein Ergebnis, das sich nie ändert. Die alte Tabelle mischte zwei
Formate (zwei Hex, zwei `rgb(r g b / a)`), jetzt durchgehend `#rrggbb`. Die
Index-Berechnung blieb unangetastet, sie zieht `SHADES.length` schon selbst.
Gemessen: pochita30 und skull belegen beide alle 16 Stufen, Verteilung glatt.
**Nicht gebaut:** keine Laufzeit-HSL-Funktion, keine Palette-Umschaltung, kein
Farbwähler.

## 2026-08-08 — docs(readme): Herkunft, Features und Werkzeugkette
**Was:** README stand noch auf dem Stand vom Repo-Init und beschrieb weder die
Maussteuerung noch die drei Konverter. Jetzt drin: Attribution an Tsoding (Basis
kam aus seinem Video über die „magic formula", der Rest ist selbst gebaut), die
vier Features, und die Kette `grosse.stl → cutInHalf → stl2model → modell.js`
mit der 40k-Vertex-Decke als Begründung. Nebenbei den abgeschnittenen Satz
in Zeile 3 repariert, der seit einer versehentlichen Kürzung dort stand.
**Nicht gebaut:** kein Screenshot, keine Auflistung der einzelnen Config-Werte
(die stehen kommentiert in den Skripten), kein Lizenz- oder Beitragsabschnitt.
Kein Link zum Tsoding-Video — die URL kenne ich nicht, nur der Name steht drin.
*Nachtrag: Link im Folge-Commit ergänzt, Titel „One Formula That Demystifies 3D
Graphics" von der Seite verifiziert.*

## 2026-08-08 — feat(tools): cutInHalf Step 3 — Binär-STL-Writer + Report
**Was:** Schreibt die geclusterten Dreiecke als binäre STL, Normalen bleiben 0,0,0
(`Buffer.alloc` nullt ohnehin, und Downstream wirft sie weg). Dateiname bekommt das
GITTER angehängt, damit aufeinanderfolgende Versuche sich nicht überschreiben.
Report nennt Dreiecke vorher→nachher, Reduktion % und die Vertex-Zahl — letztere ist
das, worauf der Nutzer hinarbeitet (~40k), ohne jedes Mal stl2model laufen zu lassen.
Pipeline end-to-end geprüft: skull.stl mit GITTER 64 → 60.694 Dreiecke / 3.034.784 Byte,
Ausgabe wird von der eigenen Erkennung wieder als binär gelesen, stl2model liefert
darauf **exakt** die vorhergesagten 26.704 vs. Abweichung 0.
**Nicht gebaut:** kein ASCII-Ausgabeformat, keine Normalen-Berechnung, kein
Überschreibschutz, keine Zielvorgabe-Automatik.

## 2026-08-08 — feat(tools): cutInHalf Step 2 — Vertex-Clustering
**Was:** GITTER als einziger Hebel: Zellgröße = größte Bounding-Box-Ausdehnung /
GITTER, jede Ecke per `floor((p−min)/zellgröße)` in eine Zelle, Repräsentant ist
das Mittel aller Ecken darin (nicht die Zellmitte — das Mittel liegt auf der echten
Oberfläche). Dreiecke, bei denen ≥2 Ecken in dieselbe Zelle fallen, werden verworfen;
genau dieses Droppen ist die Reduktion. Bewusst keine Vor-Normalisierung: weil die
Zellgröße aus der eigenen Ausdehnung kommt, ist GITTER einheitenunabhängig.
Gemessen an skull.stl (1.303.784 Dreiecke): GITTER 64 → 26.704 Vertizes,
128 → 105.915, 256 → 331.208. Monoton, wie es sein soll.
**Nicht gebaut:** kein Ziel-/Verhältnis-Modus mit Binärsuche, keine Quadric-Metrik
zur Repräsentantenwahl, keine Normalen-Neuberechnung, kein Randkanten-Schutz.
Ausnahme vom YAGNI: Guard gegen Ausdehnung 0 und gegen "alle Dreiecke kollabiert" —
beides würde sonst stumm Müll schreiben.

## 2026-08-08 — feat(tools): cutInHalf Step 1 — STL-Parser + Formaterkennung
**Was:** Grundgerüst für den Dezimierer. Parser und Erkennung 1:1 aus `stl2model.js`
übernommen statt geteilt — die beiden Skripte sind eigenständige WebStorm-Läufe
ohne Modul-Setup, ein gemeinsames `require` wäre hier mehr Struktur als Nutzen.
Erkennung über `84 + count*50 == Dateigröße`, nicht über den Header
(skullwithbrain.stl lügt dort). Liest die Dreieckssuppe und loggt die Rohzahl.
**Nicht gebaut:** kein GITTER, kein Ausgabepfad — kommen in Step 2 und 3. Keine
OBJ-Unterstützung, kein Streaming-Reader, Normalen werden beim Parsen verworfen.

## 2026-08-08 — feat(renderer): Zoom per Rechtsklick + Mausrad
**Was:** `dz` per Mausrad bei gehaltener rechter Taste, multiplikativ (Faktor 1.1),
weil ein fester Schritt bei dz=10 unsichtbar und bei dz=0.5 ein Sprung wäre.
Dazu drei Dinge, ohne die es nicht funktioniert: `mousedown` reagiert jetzt nur
noch auf die linke Taste (vorher startete auch Rechtsklick das Drehen),
`contextmenu` wird abgefangen, und die Kanten-Schleife verwirft Kanten hinter der
Kamera — sonst wirft `magic()` sie beim Reinzoomen gespiegelt und riesig ins Bild.
`zFenster()` bleibt unangetastet: `dz` kürzt sich in der Shading-Formel weg.
**Nicht gebaut:** kein DZ_MAX (Rauszoomen ist selbstkorrigierend), kein
Zoom-auf-Mausposition, kein Trackpad-proportionaler Schritt — nur das Vorzeichen
von `deltaY` zählt.

## 2026-08-08 — refactor(renderer): rotate_xz/xy/yz zusammengefasst, toten Code raus
**Was:** Ponytail-Audit-Fund umgesetzt: die drei fast identischen `rotate_xz/xy/yz`
zu einer `rotate(v, angle, [a,b])` zusammengefasst (Ebene als Achsenpaar statt
eigener Funktion pro Ebene). Dazu totes Zeug raus: unbenutztes `FOREGROUND`,
unbenutztes `dt` + auskommentiertes `dz += 0.25*dt`, Debug-`console.log`s.
**Nicht gebaut:** —

## 2026-08-08 — chore: ponytail-Audit — totes vite raus, setTimeout-Ceiling markiert
**Was:** `vite`-devDependency aus package.json entfernt (nie benutzt, kein Script/Config
dafür). In renderer.js einen `ponytail:`-Kommentar über der Animationsschleife ergänzt —
`setTimeout` statt `requestAnimationFrame` driftet unter Last / läuft im Hintergrundtab
weiter, Upgrade-Pfad steht im Kommentar.
**Nicht gebaut:** kein Umbau auf requestAnimationFrame selbst — nur markiert.
Lockfile/node_modules nicht nachgezogen (kein npm hier verfügbar), einmal
`npm install` auf deiner Maschine nötig.

## 2026-08-08 — fix(renderer): vertikale Mausrichtung invertiert
**Was:** `dy` beim Ziehen umgedreht (`letzte.y - e.clientY` statt umgekehrt) —
Ziehen nach oben dreht jetzt nach oben, nicht mehr nach unten.
**Nicht gebaut:** —

## 2026-08-08 — chore(repo): init repo, gitignore, README
**Was:** Repo für den Renderer aufgesetzt (Remote: Saos-EBB/Renderder), inkl. Fix für
`f.lenght` → `f.length` in renderer.js (Tippfehler crashte `frame()` bei jedem
Frame, Canvas blieb schwarz — das war der "Modell nicht mehr sichtbar"-Bug).
**Nicht gebaut:** kein LICENSE, kein CI. `node_modules/` zusätzlich zu `.claude/`
und `Skillz/` ignoriert (Standard, nicht explizit verlangt).
