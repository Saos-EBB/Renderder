# Build Log

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
