# Build Log

## 2026-08-10 — feat(renderer): Strg+S speichert den Arbeitsstand als .js
**Was:** Step 9. Strg+S schreibt den Stand als `<modell>_edit.js` im Format von `modelle/` —
dieselbe Form wie `cube.js` samt `export default`, also direkt wieder ladbar. Der Browser
kann nur in den Download-Ordner schreiben, nie zurück nach `modelle/`: Datei dorthin legen,
Namen in `modelle.js` eintragen, dann kennt `importModel` sie. `preventDefault()` ist
Pflicht, sonst legt der Browser seinen „Seite speichern"-Dialog darüber und schreibt das
HTML statt des Modells. Absichtlich nicht auf den Edit-Mode beschränkt, die Änderungen
bleiben ja auch nach dem Verlassen. Der Modellname steht jetzt in `MODELL_NAME`, weil
Dateiname und Bezeichner in der Datei ihn brauchen.
**Manuelle Kanten gehen als Zweier-Einträge in `fs`.** Das kennt das Format und
`kantenBauen()` liest sie wieder ein — nach dem Neuladen sind sie richtige Modellkanten und
machen den Cutaway mit. Die Einschränkung aus Step 6 löst sich beim Rundlauf also auf.
**Was man der Datei ansehen muss:** `vs` ist `mesh`, also die Geometrie in ihrer *jetzigen
Lage*. Die Orientierung steckt in Weg A in den Vertizes selbst, es gibt keine getrennte
Rotation zum Herausrechnen — und beim Laden legt `renderer.js` sein Preset (5.5 / 4.678)
nochmal obendrauf. Ein gespeichertes Modell erscheint beim Wiederladen deshalb gedreht.
Sauber trennen liesse sich das erst mit einer Matrix, in Weg B.
Koordinaten auf 6 Stellen, Nullen am Ende weg (`String(+n.toFixed(6))`) — die 17 Stellen aus
der Rotation machen die Datei sonst um ein Vielfaches grösser. Ausgabe gegen den Cube mit
eingefügtem Punkt und zwei Kanten erzeugt und geprüft: 9 `vs`, 8 `fs`-Zeilen, grösster Index
8, alle gültig, 623 Byte.
**Nicht gebaut:** kein Dateiname-Dialog, kein Zeitstempel (der Browser nummeriert Duplikate
selbst), kein automatischer Eintrag in `modelle.js`, kein .obj/.stl, kein Speichern nur der
Auswahl, kein Herausrechnen der Rotation.

## 2026-08-10 — feat(renderer): Arbeitskopie beim Betreten des Edit-Mode
**Was:** Step 8. Beim Einschalten des Edit-Mode wird der Stand gesichert, geändert wird ab
da an der Kopie. Beim Verlassen bleiben die Änderungen stehen — ein versehentliches `e`
darf keine Arbeit kosten, und es ist dieselbe Taste, die man ständig drückt. Der Weg zurück
liegt auf **Shift+R**, nicht auf `r` allein: eine Taste, die die ganze Sitzung wegwirft,
soll man nicht streifen. Jeder Eintritt setzt einen neuen Stand, wer raus und wieder rein
geht hat die Änderungen von vorhin also im Rücken statt sie zu verlieren.
Gesichert werden die Vertizes und die manuellen Kanten; `model.vs` und `fs` werden ohnehin
nie angefasst. Beim Zurücksetzen geht der Schlüsselsatz mit — sonst gälten entfernte
Verbindungen weiter als vorhanden und liessen sich nicht neu ziehen.
**Bewusster Nebeneffekt:** die Orientierung steckt in `mesh`, es gibt keine getrennte
Rotation. Zurücksetzen holt deshalb auch die Ansicht von damals zurück, das Modell springt
in die Lage vom Betreten. Trennen liesse sich das nur mit einer Matrix, also erst in Weg B.
**Anmerkung zur Anforderung:** eine Kopie beim Betreten ändert für sich genommen nichts am
Verhalten — `mesh` war schon immer von `model.vs` getrennt. Sichtbar wird sie erst durch
den Weg zurück, deshalb kommt das Zurücksetzen im selben Step und nicht später.
**Nicht gebaut:** kein mehrstufiges Undo, kein Zurücksetzen einzelner Punkte, kein Dialog,
kein Schnappschuss beim Verlassen, kein Zurück auf den Dateizustand (das ist ein Reload).

## 2026-08-10 — fix(renderer): Verbinden sichtbar machen — Gummiband + Anker-Falle
**Was:** Step 7. Das Verbinden aus Step 6 funktionierte, war aber praktisch nicht
bedienbar — Meldung vom Nutzer: „ich sehs nicht, die Punkte werden gesetzt".
Zwei Ursachen, beide meine:
**Die Anker-Falle.** Nach dem Einfügen ist der neue Punkt bereits Anker. Man klickt ihn
trotzdem an, weil man ihn als Ausgangspunkt haben will — und genau das lag auf
„abwählen". Danach war nichts ausgewählt, der nächste Shift-Klick setzte nur einen neuen
Anker, und die erste Linie entstand drei Klicks später zwischen zwei fremden Punkten. Ein
Klick auf den Anker hält ihn jetzt. Abgewählt wird über **Escape** oder Shift-Klick ins
Leere. Zustandsautomat gegen beide Abläufe durchgespielt: mit und ohne Vorklick entstehen
jetzt dieselben Kanten vom eingefügten Punkt.
**Keine Rückmeldung.** Man sah dem Bild nicht an, ob der nächste Shift-Klick eine Kante
zieht oder nur einen Anker setzt. Jetzt läuft ein gestricheltes grünes Gummiband vom Anker
zum Cursor — gestrichelt, weil es noch keine Kante ist. `setLineDash` geht danach zurück,
Kanten und Vorschau teilen sich den Kontext.
**Die Zeichenkette selbst war in Ordnung** und wurde vor dem Umbau nachgerechnet: Cube mit
Preset-Rotation, Punkt bei (300,300) eingefügt, zwei Kanten gezogen — beide landen in
`kanten`, überstehen den Neubau und bekommen die Blaustufen 7 und 8, also aus der Mitte
der Rampe und deutlich sichtbar. Am Rendern lag es nie.
**Nicht gebaut:** kein Kanten-Löschen, kein Hover-Highlight des Zielpunkts vor dem Klick,
keine eigene Farbe für manuelle Kanten.

## 2026-08-10 — feat(renderer): Vertizes verbinden per Shift+Klick
**Was:** Step 6, der Abschluss der Edit-Mode-Arbeit. Shift+Klick auf einen Punkt macht
ihn zum Anker (grün), jeder weitere Shift+Klick zieht eine Kante vom Anker dorthin —
**Stern**, der Anker bleibt stehen. Shift auf den Anker selbst oder ins Leere legt ihn ab.
Eine Zusatztaste statt eines eigenen Verbinde-Modus: so bleibt Ziehen jederzeit
erreichbar, und man muss sich nicht merken, in welchem Zustand die Maus gerade ist.
Shift startet nie ein Ziehen.
**Speicherung.** Manuelle Kanten leben in `extraKanten`, **nicht** in `fs` — obwohl das
Format Zweier-Flächen kennt (`cube.js` hat `[0,4]` neben den Vierecken) und
`kantenBauen()` sie anstandslos verarbeiten würde. Der Grund ist `schwerpunkt()`: es liest
`model.vs`, und für einen eingefügten Punkt gibt es dort keine Position, weil Weg A keinen
Rückweg der Rotation hat. Ein Eintrag in `fs` liefe also auf `undefined`.
`kantenBauen()` hängt `extraKanten` am Ende an. Damit überstehen manuelle Kanten jeden
Achsen- und Cut-Neubau von selbst, und die Zeichenschleife merkt nichts davon — Shading,
Nah-Grenze und Farbtöpfe gelten für sie unverändert. `kanteVerbinden()` schreibt in beide
Listen: in `kanten` für das sofortige Bild, in `extraKanten` für den nächsten Neubau.
Doppelte Verbindungen fängt derselbe `a<b`-Schlüssel ab, den `kantenBauen()` schon benutzt.
**Bewusst:** manuelle Kanten liegen ausserhalb des Cutaways und bleiben sichtbar, auch wenn
ringsum weggeschnitten ist — dieselbe Wurzel wie oben. Beim Bauen will man ohnehin sehen,
was man gerade zieht.
**Nicht gebaut:** kein Löschen von Kanten oder Punkten, kein Undo (Reload ist der Reset),
keine eigene Farbe für manuelle Kanten (sie sind jetzt Modell wie jede andere), kein
Erzeugen von Flächen aus drei Kanten, keine Dedup gegen Kanten die schon im Modell stehen —
verbindet man zwei ohnehin benachbarte Vertizes, wird dieselbe Linie zweimal gezogen, was
man nicht sieht. Kein Export: `model.vs` und `fs` bleiben unberührt, alles Neue lebt nur
in `mesh` und `extraKanten` und ist beim Reload weg.

## 2026-08-10 — feat(renderer): Vertex einfügen per BT4 / Taste „i"
**Was:** Step 5. Die vordere Daumentaste (DOM `button 3`, auf der Maus BT4) bekommt zwei
Bedeutungen: im Betrachten schaltet sie wie bisher die Schnittachse, im Edit-Mode setzt
sie einen neuen Vertex an den Cursor. Beides dort, wo man es braucht — die Achse braucht
man beim Editieren nicht, und einen Punkt setzen kann man ausserhalb nicht. Taste **`i`**
liegt daneben, aus demselben Grund wie `a` und `e`: JCEF reicht die Daumentasten nicht
durch (`docs/errors.md`), ohne die Taste wäre das Feature im WebStorm-Preview nicht
testbar. Dafür merkt sich `mousemove` die rohe Cursorposition — roh, weil `leinwandPos()`
`getBoundingClientRect()` ruft und den Browser sonst bis zu 120×/s nach dem Layout fragte,
für eine Zahl die fast immer weggeworfen wird.
**Die Tiefe** kommt vom bildschirm-nächsten Vertex (`naechsteTiefe()`). Ein Klick liefert
nur x und y, die dritte Zahl muss irgendwoher. Bewusst **nicht** `vertexAn()` mit grossem
Radius: dort gewinnt unter mehreren Treffern der vorderste — über die ganze Leinwand
angewandt wäre das immer der kameranächste Punkt des Modells, egal wo der Cursor steht.
Zwei Regeln, zwei Funktionen. Fallback `dz`, falls nichts vor der Kamera liegt.
**Der Rückweg** ist `screen()` und `magic()` umgekehrt: `nx = 2·lx/W − 1`,
`ny = 1 − 2·ly/H` (dasselbe Spiegeln wie beim Ziehen), dann `x = nx·vz`, `y = ny·vz`,
`z = vz − dz` — **minus** `dz`, weil `translate_z()` es auf dem Hinweg addiert. Rundlauf
gegen die echten Formeln durchgerechnet, grösster Fehler 2,2e−16 über Cube-Ecke,
car-Vertex, Ursprung und einen Punkt bei Tiefe 0,5.
**Puffer:** `psx/psy/psz` sind Float64Arrays und können nicht wachsen, also `const` → `let`
plus `puffernWachsen()`, die neu alloziert und kopiert. Einmal pro eingefügtem Punkt, nicht
pro Frame — billiger als jeden Frame über normale Arrays zu laufen. Der frische Punkt
schreibt seine Cache-Werte gleich selbst, sonst sässe er bis zum nächsten `frame()` auf 0,0.
`zFenster()` läuft einmal nach, sonst klemmen die Kanten des neuen Punkts später auf der
äussersten Farbstufe; beim Ziehen bleibt das bewusst aus, das feuert 120×/s.
**Anker** (grün) ist getrennt von `gegriffen` (rot): greift man zwischendurch eine andere
Ecke zum Verschieben, soll der Ausgangspunkt fürs Verbinden stehen bleiben. Ein
eingefügter Punkt wird sofort Anker. Beide werden beim Moduswechsel zurückgesetzt.
**Nicht gebaut:** kein Verbinden (Step 6) — der neue Punkt hängt an keiner Kante und ist
vorerst ein einzelner Fleck, greifbar und ziehbar wie jeder andere. Kein Löschen, kein
Undo (Reload ist der Reset), kein Einfügen auf einer bestehenden Kante, kein Snapping,
keine Vorschau vor dem Setzen. `model.vs` wächst **nicht** mit: für einen eingefügten
Punkt gibt es keine Modellraum-Position, weil Weg A keinen Rückweg der Rotation hat.
Cutaway und Export sehen ihn deshalb nie — dieselbe Drift wie in Step 4, nur grösser.

## 2026-08-09 — feat(renderer): Vertex ziehen — Edit-Mode fertig
**Was:** Step 4 von Weg A, der Schluss. Die gegriffene Ecke folgt der Maus, das Mesh
verformt sich live, alle Kanten an der Ecke wandern mit (`kanten` zeigt auf den Index,
der ändert sich nicht). Recycelt das bestehende Gerüst: `ziehen` wird beim Greifen mit
gesetzt, `mousemove` zweigt vor dem Dreh-Zweig ab, `mouseup` beendet beides. Nach dem
Loslassen bleibt die Ecke markiert, folgt aber nicht mehr.
Der Rückweg hat **zwei** Schritte, kein transponiertes R — es gibt keine
Rotationsmatrix, `mesh` *ist* die gedrehte Geometrie, die Ecke liegt also schon in dem
Raum, in dem das Delta entsteht. Pixel→NDC mit **getrennten** Faktoren für `width` und
`height` (`screen()` rechnet die Achsen getrennt, und `width` stand zwischenzeitlich
auf 1300 — ein gemeinsamer „scale" bräche lautlos an einer nicht-quadratischen
Leinwand), Minus bei y als Umkehr des Spiegelns. Dann NDC→mesh mit `vz = mesh[i].z + dz`
— **mit `dz`**, weil `translate_z` es vor der Projektion addiert; ohne wäre die Skala um
`dz` daneben. `z` bleibt unangetastet, die Ecke wandert parallel zur Bildebene.
Das Rad ist gesperrt, solange eine Ecke am Cursor hängt: Zoom ändert `dz` und damit den
Divisor mitten im Ziehen. Bewusst enger als im Auftrag (`ziehen && gegriffen !== -1`
statt `ziehen && editMode`) — beim blossen Drehen im Edit-Mode gibt es kein `vz`, das
konstant bleiben müsste, also darf dort gezoomt werden wie immer.

**Bewusster Tausch — Weg A, kein Bug:**
- `model.vs` läuft auseinander. Editiert wird `mesh`, `model.vs` bleibt die Ausgangsform.
  Ein Export gäbe die alte Geometrie. Wer die Edits behalten will, braucht Weg B mit
  Matrix — separates Test-Renderfile, später, nicht hier.
- **Cut/`kanten` werden nach einem Move NICHT neu gebaut, und der Neubau wäre ein No-op.**
  Der Auftrag nennt das als Falle („Vertex über die Schnittebene ziehen → Kantenliste
  veraltet"), aber das gilt für Weg B: `schwerpunkt()` liest `model.vs[i]`, und
  `cutZuruecksetzen()` / `kantenBauen()` hängen ausschliesslich daran. Ein Mesh-Edit
  ändert die Cut-Entscheidung nie. Ein Neubau nach Drag-Ende erzeugte exakt dieselbe
  Liste und liefe bei grossen Modellen pro Drag durch alle Flächen. Der Cutaway rechnet
  weiter auf der uneditierten Geometrie — das ist dieselbe Einschränkung wie oben,
  nicht eine zweite.
- `zFenster()` bleibt nach einem Move stale: es liest `mesh`, läuft aber nur im
  Rotationszweig. Das Tiefen-Shading passt sich der verschobenen Ecke erst beim nächsten
  Drehen an. Akzeptiert (F5 in `performance.md` ist beim Zoom ohnehin schon offen).
- Kein Clipping: zieht man eine Ecke durch die Kameraebene, geht `vz` gegen 0 und sie
  schiesst ins Unendliche. Am Aussenmodell unkritisch, aber kennen.

**Nicht gebaut:** kein Cut-/`kanten`-Neubau (No-op, siehe oben), kein Clipping, kein
Undo (Reload ist der Reset), keine z-Verschiebung, kein Export, kein Mehrfach-Select.

## 2026-08-09 — feat(renderer): Vertex picken + Highlight
**Was:** Step 3 von Weg A. Linksklick im Edit-Mode sucht über den Projektions-Cache
den nächsten Vertex im Radius und markiert ihn rot; noch kein Ziehen — Picking wird
**vor** der Zieh-Mathe bewiesen, damit man nie beides gleichzeitig debuggt.
Drei Entscheidungen, die den Ausschlag geben:
`leinwandPos()` rechnet `clientX/clientY` über `getBoundingClientRect()` in
Leinwand-Koordinaten um, **inklusive** `leinwand.width / rect.width` — der Backing
Store steht fest auf 1200×1200, die Leinwand im Layout kann skaliert dargestellt sein,
ohne den zweiten Faktor trifft der Test dann daneben. Für die Rotation war das egal,
weil dort nur Deltas zählen; beim Picking sind es absolute Positionen.
Bei Überlappung gewinnt der kleinste `psz`, also der vorderste Punkt — sonst bekäme man
den, der zufällig zuerst in der Schleife auftaucht, bei einem geschlossenen Modell also
gern den auf der Rückseite. Verglichen wird das Distanz-**Quadrat**, die Wurzel ändert
an der Reihenfolge nichts.
Gehalten wird der **Index**, nicht das Vertex-Objekt: `mesh` wird bei jeder Drehung per
`map` neu zugewiesen, eine Objektreferenz zeigte danach auf eine Leiche aus dem letzten
Frame. Trifft der Klick daneben, fällt er auf das gewohnte Drehen zurück — sonst wäre
das Modell im Edit-Mode festgenagelt und an Ecken auf der Rückseite käme man nie heran.
Beim Verlassen des Modus wird die Auswahl gelöscht (`editModeUmschalten()`), sonst
leuchtet beim nächsten Einschalten eine Ecke weiter, die inzwischen weggedreht ist.
**Nicht gebaut:** kein Ziehen (Step 4), kein Mehrfach-Select, kein Deselect durch Klick
ins Leere, kein Hover-Highlight ohne Klick, keine Beschleunigungsstruktur für die
Nächste-Suche — lineare Schleife über alle Vertizes, einmal pro Klick, nicht pro Frame.

## 2026-08-09 — feat(renderer): Edit-Mode-Toggle mit ockerfarbenem Rand
**Was:** Step 2 von Weg A. Flag `editMode`, Toggle auf Taste **`e`** — die Taste ist
die Wahrheit, nicht die Maus: WebStorms JCEF-Vorschau reicht die Daumentasten nicht
an die Seite durch (`docs/errors.md`), ohne Tastatur-Binding wäre der Modus in der
Standardumgebung nicht testbar. Button 4 liegt zusätzlich drauf, fürs echte
Browser-Env; `auxclick` schluckte ihn bisher nur, jetzt hat er eine Wirkung. Die
Vertex-Punkte aus Step 1 zeichnen nur noch im Edit-Mode — auf einem grossen Modell
legen sie sich sonst als Raster über die Kanten. Dazu ein ockerfarbener Rahmen um die
Leinwand als einzige Rückmeldung, dass der Modus läuft; an einem Modell ohne sichtbare
Ecken sieht man sonst nicht, in welchem Zustand man ist. Der Rahmen sitzt um die halbe
Strichdicke nach innen (`strokeRect` zentriert die Linie auf dem Pfad, sonst läge die
äussere Hälfte ausserhalb), und `lineWidth` wird danach auf 1 zurückgestellt — Kanten
und Rahmen teilen sich den Kontext, der nächste Frame zöge sonst fette Linien.
Bewusst NICHT in die bestehenden Handler eingegriffen: Rotation, Zoom und Schnitt
verhalten sich im Edit-Mode Zeichen für Zeichen wie vorher.
**Nicht gebaut:** kein Picking, kein Highlight, kein Ziehen — Step 3 und 4. Keine
Konfigurierbarkeit des Rands über Farbe und Dicke hinaus, kein Zustand der den Reload
überlebt, keine Anzeige des Modus als Text.

## 2026-08-09 — feat(renderer): Projektions-Cache pro Vertex + Vertex-Punkte
**Was:** Step 1 von Weg A. Neuer Durchlauf `punkteRechnen()` projiziert einmal pro
Frame **jeden Vertex einmal** nach `psx/psy/psz`; die Kantenschleife projiziert nicht
mehr selbst, sondern schlägt per Index nach. Vorher lief sie über Index-Paare und
projizierte jeden Vertex einmal pro anliegender Kante — bei `hand1_g128` 192.882
Projektionen für 31.516 Vertizes. Zwei Dinge fallen damit zusammen: das Picking
braucht genau diesen Cache, und es gibt jetzt nur noch **eine** Projektionsstelle,
also können Punkte und Linienenden nicht mehr auseinanderlaufen.
`psz` hält bewusst die Tiefe **mit `dz`** (`v.z + dz`) — das ist die Zahl, durch die
`magic()` teilt, und in Step 4 die Umkehr des Divisors. Stünde hier `mesh[i].z`, wäre
die Zieh-Skala um `dz` verschoben. Die Farbtöpfe halten jetzt flache Index-Paare statt
fertiger Punktobjekte, das spart pro Frame ein Wegwerf-Objekt je Kantenende. Die 0.01
für „hinter der Kamera" heisst jetzt `NAH_GRENZE`, weil sie an zwei Stellen geprüft
wird. Startmodell auf `cube` umgestellt, wie im Auftrag verlangt.
**Nicht gebaut:** kein Edit-Mode-Flag — die Punkte zeichnen in diesem Step
unbedingt, damit er allein testbar ist; das Gating kommt in Step 2. Keine
allokationsfreie Inline-Projektion (F1 aus `performance.md`): `punkteRechnen()` ruft
`screen(magic(translate_z(…)))` auf und alloziert damit drei Objekte pro Vertex —
bewusst, damit die Formel eine einzige Quelle behält. Kein Umbau der Farbtöpfe auf
typisierte Arrays, keine Behebung von F5 (`zFenster` beim Zoom).

## 2026-08-09 — chore(repo): Baseline für Edit-Mode, cube zurück als Testmodell
**Was:** Startpunkt für Weg A auf Branch `editmode/weg-a`. Zwei Dinge, die vorher
liegen mussten. Erstens der Arbeitsstand, der uncommittet im Baum lag und in genau den
zwei Dateien steckt, die der Umbau anfasst: `leinwand.width` 1300 → 1200 und das
Startmodell in `renderer.js`, dazu die zwölf neuen Modellnamen in `modelle.js`. Ohne
diesen Commit hätte jeder Edit-Mode-Step sie mitgeschleppt und sein Diff wäre nicht
mehr lesbar gewesen. Zweitens `cube.js`, aus `bd95aa9^` zurückgeholt — 8 Vertizes,
2 Vierecke plus 4 Streben. Das **kehrt die Löschung aus `bd95aa9` um**, wo es hiess
„seit es echte Meshes gibt ohne Zweck": für Vertex-Picking braucht es ein Modell, bei
dem man die Ecken einzeln sieht und nachzählen kann, und 8 Vertizes sind dafür genau
richtig. Auf `hand1_g128` mit 31.516 Vertizes ist ein versetzter Punkt nicht zu sehen.
**Nicht gebaut:** kein neu geschriebenes Testmodell (der alte Würfel kommt 1:1 aus der
History), kein Aufräumen an `cutInHalf.js`, `stl2model.js` (steht lokal auf
`MODELL_NAME = "XXXX"`) oder der gelöschten `.idea/vcs.xml` — die bleiben uncommittet
liegen, sie gehören nicht zu diesem Umbau.

## 2026-08-09 — chore(repo): fünf zu grosse Modelle in .gitignore
**Was:** `SegmentCraneo00`, `ct2003_kopf_CT2/CT3`, `skull_g128` und `ct2001_thorax`
stehen jetzt namentlich in `.gitignore`, zusammen 90 MB. Anlass: ein `git add .` hatte
sie samt sieben weiterer Modelle vorgemerkt — 105 MB in ein Repo, dessen `.git` 35 MB
gross ist, `SegmentCraneo00.js` allein 47 MB. Alle fünf liegen ausserdem weit über den
~40.000 Vertizes, die der Renderer packt (536.706 bis 76.061), sind also ohne einen
Lauf durch `cutInHalf` gar nicht benutzbar. Dieselbe Begründung wie bei
`pochita128/256`, `forMax00` und `duoOG`, deshalb derselbe Mechanismus: namentlich
aufgezählt statt Muster, weil den Dateinamen nicht anzusehen ist, welche gemeint sind.
Wichtig war der Zeitpunkt — vor dem ersten Commit. Was einmal in der History liegt,
geht nur noch mit `filter-repo` und einem Force-Push über alles wieder raus.
Geprüft mit `git check-ignore`: die fünf greifen, die übrigen sieben bleiben sichtbar.
**Nicht gebaut:** die zwei Grenzfälle `Duo_Baldurs_Gate_g128` (49.734) und
`Segmentation_craneo_camilo_g128` (50.076) sind bewusst NICHT eingetragen — knapp über
der Grenze, aber noch lauffähig, das ist eine Entscheidung für später. Sie bleiben
vorerst ungetrackt. Keins der Modelle wurde aus `modelle.js` entfernt; wie bei `duoOG`
bleiben sie gelistet und damit lokal ladbar.

## 2026-08-09 — refactor(tools): Konverter in eigenen 2model-Ordner
**Was:** `obj2model.js` und `stl2model.js` liegen jetzt in
`html5canvasAnimations/2model/` statt neben dem Renderer. Reines Verschieben, Git
erkennt beides als Rename, kein Byte am Inhalt geändert. Funktional folgenlos: beide
Skripte arbeiten mit absoluten Pfaden für `AUSGABE_ORDNER` und `MODELLE_JS`, es gibt
also keinen relativen Bezug, der sich mitverschiebt. Kein Code referenziert die
Dateien; die Treffer in `cutInHalf.js` und im Build-Log sind Fließtext.
**Nicht gebaut:** kein gemeinsames Modul für die doppelten Hilfsfunktionen — die
liegen jetzt zwar nebeneinander, sind aber weiterhin zwei Kopien.

## 2026-08-09 — feat(tools): dcm2stl, CT-Serie zu .stl
**Was:** Neues Werkzeug `2model/dcm2stl.py`. Es füllt die Lücke vor der Kette: eine
`.dcm` ist ein Stapel Graustufenbilder, kein Modell, und bisher fing alles erst bei
einer fertigen `.stl` an. Schwellwert 300 HU trennt Knochen (CT ist in Hounsfield
kalibriert), danach Marching Tetrahedra. Bewusst nicht Marching Cubes: dort braucht
es eine Tabelle mit 256 Fällen, von denen mehrere mehrdeutig sind und bei falscher
Wahl Löcher hinterlassen. Ein Tetraeder hat vier Ecken, keine Mehrdeutigkeit, die
Fälle stehen im Code statt in einer Tabelle, und weil alle Würfel dieselbe
Raumdiagonale teilen, passen Nachbarzellen lückenlos. Preis rund doppelt so viele
Dreiecke — egal, `cutInHalf` dampft danach ohnehin ein und der Renderer wirft die
Normalen weg. Verkleinerung in xy per **Maximum** statt Mittelwert, weil die
Schädelkalotte nur ein bis zwei Voxel dick ist und ein Mittelwert Löcher reisst.
Randzellen werden über Bitmasken gesucht (eine Schicht = ein Integer mit B·H Bit,
acht Ecken = acht Verschiebungen), sonst wären es Millionen Python-Iterationen; so
läuft eine Serie in 2–3 s. Ein Zusammenhangs-Filter behält nur die grösste Struktur
und wirft damit den Patiententisch weg (beim Thorax 16,5 % der Voxel in 176
Fragmenten). Python statt Node, weil kein Node auf der Maschine liegt; reine
Standardbibliothek, kein numpy, kein pydicom. Geprüft an zwei Serien aus
`~/Schreibtisch/LookAtMe`: Thorax 2001 (107 Schichten → 202.360 Dreiecke) und Kopf
2003 (32 Schichten → 329.498). Der Querschnitt zeigt beim Kopf einen hohlen Ring,
also äussere und innere Schädeltafel getrennt — echter Knochen, keine Hautoberfläche.
Der Serien-Schutz wurde gegen einen Mischordner getestet und bricht ab.
**Nicht gebaut:** kein MR (Grauwerte dort nicht kalibriert, fester Schwellwert
sinnlos), kein Ordnermodus über mehrere Serien, kein Aufteilen einer Studie nach
`SeriesInstanceUID` — das Skript meldet nur, dass es nötig wäre. Keine Glättung,
kein Füllen von Löchern, keine Dezimierung (bleibt bei `cutInHalf`), keine
komprimierten Transfer Syntaxen (JPEG/JPEG2000/RLE brechen mit Meldung ab).

## 2026-08-09 — fix(repo): Startmodell zeigte auf eine Datei, die nicht im Repo liegt
**Was:** `renderer.js` lud beim Start `duoOG` — die Datei ist aber 41 MB und war nie
committet, ein frischer Clone crashte also sofort beim Modul-Import. Startmodell auf
`skull` umgestellt (getrackt, 2,6 MB), `duoOG.js` in `.gitignore` zu den anderen
lokalen Grossmodellen. Gleicher Zug: der Merge-Commit von gestern hatte beim
Konfliktlösen 29 Zeilen README gefressen (Herkunft + kompletter Features-Abschnitt).
Die 22 lokalen Commits sind linear auf `origin/master` rebased, der Konflikt diesmal
zugunsten der lokalen Fassung aufgelöst — die Merge-Blase ist damit weg.
**Nicht gebaut:** `duoOG` bleibt in `modelle.js` gelistet, genau wie die ebenfalls
ignorierten `pochita128/256` — so bleibt es lokal ladbar. Wer klont und es auswaehlt,
bekommt einen Import-Fehler; das ist bestehendes Verhalten, nicht neu. duoOG wurde
nicht dezimiert.

## 2026-08-09 — feat(tools): Konverter schreiben nach modelle/ und tragen sich ein
**Was:** `AUSGABE_ORDNER` zeigt bei beiden Konvertern jetzt direkt auf
`html5canvasAnimations/modelle`, und nach dem Schreiben trägt `inListeEintragen()` den
Namen in `modelle.js` ein, falls er fehlt — damit entfällt sowohl das Verschieben von
Hand als auch das Nachtragen. Neuer Konfigwert `MODELLE_JS`; bewusst explizit statt aus
`AUSGABE_ORDNER` abgeleitet, weil das Layout sich gerade erst geändert hat.
Namensregel wie gewünscht Dateiname mit `_` statt Leerzeichen — **aber** auch Punkte,
Klammern und Striche werden zu `_`, sonst ist `const <name> = {...}` kein gültiges JS.
Geprüft: Einfügen verträgt fehlendes Komma und leere Liste, zweiter Lauf dupliziert
nicht, End-to-End gegen eine Kopie der echten `modelle.js`.
**Nicht gebaut:** kein gemeinsames Modul für die beiden Kopien von `nameAus` und
`inListeEintragen` (die Skripte bleiben eigenständig, wie schon beim STL-Parser), kein
Entfernen von Namen, keine Sortierung, keine Rückfrage beim Überschreiben.

## 2026-08-09 — refactor(modelle): Namensliste eine Ebene über die Daten
**Was:** `modelle/modelle.js` → `modelle.js`. Das Verzeichnis steht damit neben dem
Ordner, den es beschreibt, statt darin. Zwei Pfade drehen sich um: `renderer.js`
importiert `./modelle.js`, und der dynamische Import darin wird zu
`./modelle/${name}.js`. Geprüft: alle 21 Einträge lösen unter dem neuen Layout auf.
**Nicht gebaut:** kein Re-Export-Stub am alten Ort, keine Umbenennung der Datei, keine
Änderung an der Signatur von `importModel`.

## 2026-08-09 — fix(renderer): Farbrampe entschärft, nahe Kanten wurden weiß
**Was:** Die Rampe ging bis L 90 %. Bei S 85 % lesen die obersten Stufen als Weiß —
`#d0e5fb` hat Minimalkanal 208 von 255 und nur 43 Buntheit —, und wo viele nahe Kanten
übereinanderliegen, wurde daraus eine weiße Fläche. Jetzt `L = 75 − i·4`, also 75 % bis
15 %. Hellste Stufe `#89bff5`: Minimalkanal 137, Buntheit 108, zweieinhalbmal so farbig.
**Nicht gebaut:** keine nichtlineare Rampe, keine Änderung an Sättigung oder Farbton,
keine Transparenz.

## 2026-08-09 — feat(tools): stl2model nimmt auch einen ganzen Ordner
**Was:** Gleiche Änderung wie bei obj2model, damit beide Konverter sich gleich bedienen
lassen. `STL_DATEI` → `STL_QUELLE`, darf Datei oder Ordner sein; Umwandlung steckt in
`umwandeln(datei, nameVorgabe)`; `MODELL_NAME` gilt nur im Einzeldatei-Modus. Der
`try/catch` pro Datei zahlt sich hier direkt aus: skullwithbrain.stl ist kaputt und
liegt im selben Ordner wie die guten. Geprüft an einem Ordner mit zwei gültigen STL,
skullwithbrain, einer 9-Byte-Attrappe und einer .txt — beide gültigen umgewandelt,
beide kaputten mit Grund gemeldet, .txt ignoriert, Stapel lief durch.
**Nicht gebaut:** nicht rekursiv, keine Filter, kein Überspringen vorhandener Ausgaben.

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
