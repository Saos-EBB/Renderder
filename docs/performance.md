# Performance — Befunde und offene Fixes

Audit vom 2026-08-09. Stand: **nichts davon ist gebaut**, das hier ist die Liste,
nicht das Protokoll. Was erledigt wird, wandert in den `build-log.md` und fliegt
hier raus.

**Wie gemessen:** gar nicht. Auf der Maschine ist kein Node installiert, es gibt
also keine Laufzeiten. Die Vertex- und Kantenzahlen sind aus den Modelldateien
ausgezählt, die Allokationszahlen durch Abzählen im Draw-Loop. Wo unten „teuer"
steht, ist das eine Ableitung aus diesen Zahlen, keine Messung. Vor dem Umbau
einmal mit dem Performance-Profiler des Browsers gegenprüfen, ob der GC wirklich
oben steht — die Reihenfolge der Fixes hängt daran.

## Ausgangszahlen

| Modell | Vertizes | Faces | eindeutige Kanten |
|---|---|---|---|
| `hand1_g128` (Startmodell) | 31.516 | 70.996 | 96.441 |
| `Duo_Baldurs_Gate_g128` | 49.734 | 126.676 | 161.491 |
| `skull_g128` | 105.915 | 219.598 | 322.157 |

Kanten pro Vertex liegt bei allen um 3,05 — ein Vertex hängt im Schnitt an drei
Kanten. Diese Zahl trägt den ganzen Rest der Analyse.

---

## F1 — Draw-Loop alloziert 675.000 Objekte pro Frame

**Wo:** `renderer.js:277-289`

Pro Kante entstehen sieben kurzlebige Objekte: `translate_z` ×2, `magic` ×2,
`screen` ×2, dazu das Paar-Array für den Farbtopf. Bei `hand1_g128` sind das
96.441 × 7 = **675.087 Objekte pro Frame**, bei 30 fps also gut 20 Millionen pro
Sekunde. `skull_g128` liegt bei 2,25 Mio pro Frame.

**Fix:** Mesh als `Float32Array(3n)` statt Array von `{x,y,z}`. Einmal pro Frame
über die Vertizes laufen und in vorab angelegte `sx[]`/`sy[]`/`sz[]` schreiben
(rotieren, `+dz`, durch z teilen, auf Bildschirmkoordinaten). Die Kantenschleife
liest danach nur noch Indizes und schreibt Zahlen in vorab angelegte Puffer.
Allokationen im Frame: null.

**Wirkung:** vermutlich der größte Einzelsprung. Ändert nichts am Bild.

## F2 — Jeder Vertex wird sechsmal projiziert

**Wo:** `renderer.js:277-289`, dieselbe Schleife wie F1

Die Schleife läuft über Kanten, projiziert aber Endpunkte. 2 × 96.441 = 192.882
Projektionen für 31.516 Vertizes, also **6,1× mehr als nötig**. Jeder Vertex
hängt an drei Kanten und wird von jeder zweimal angefasst.

**Fix:** fällt mit F1 zusammen ab — die Projektion einmal pro Vertex ist genau
der Umbau, den F1 verlangt. Getrennt aufgeführt, weil es ein eigener Faktor ist:
F1 spart Speicherarbeit, F2 spart Rechenarbeit.

## F3 — Rotation klont pro Vertex zweimal

**Wo:** `renderer.js:261`, `rotate()` in `renderer.js:35-43`

`mesh.map(v => rotate(rotate(v, …), …))` erzeugt pro Vertex zwei Objekte über
Spread plus ein neues Array — auf jedem Frame, auf dem gezogen wird. Bei
`hand1_g128` 63.000 Objekte pro Drehframe, und zwar zusätzlich zu F1.

**Fix:** die beiden Winkel einmal pro Frame zu einer 3×3-Matrix komponieren und
in einem Durchlauf auf das Float32Array anwenden. Dabei gleich `zFenster()`
mitrechnen (siehe F5), dann ist es ein Durchlauf statt zwei.

**Nebenbefund, nicht dringend:** `mesh` wird bei jeder Drehung aus sich selbst
neu berechnet, die Rundungsfehler summieren sich also über die Sitzung. Bei
Float64 und einer Drehung pro Frame dauert es sehr lange, bis das sichtbar wird
— bei Float32 (F1) weniger lange. Falls es je auffällt: Gesamtwinkel mitführen
und aus `model.vs` neu rechnen statt inkrementell weiterzudrehen.

## F4 — Schnittebene baut pro Radschritt die halbe Welt neu

**Wo:** `kantenBauen()`, `renderer.js:135-149`

Der Aufbau läuft über 70.996 Faces × 3 Kanten und erzeugt dabei 212.988
Template-Strings als Schlüssel für ein `Set<string>`. Das passiert bei jeder
Änderung von `CUT`, also beim Scrollen mit gehaltener rechter Taste einmal pro
Frame. Das ist der Ruckler beim Schneiden.

**Fix:** einmal pro Achse vorberechnen statt pro Radschritt neu. Für jede
eindeutige Kante das Minimum der Schwerpunkte ihrer Nachbarflächen ablegen — eine
Kante ist sichtbar, sobald irgendeine ihrer Flächen sichtbar ist. Die Kantenliste
danach einmal sortieren: die sichtbare Menge ist dann ein Präfix des Arrays, und
eine `CUT`-Änderung kostet eine Binärsuche plus das Setzen einer Zählvariable.
Der Neuaufbau bleibt nur beim Achsenwechsel (`achseWechseln()`, `renderer.js:192`).

**Achtung beim Umbau:** die grobe Semantik muss erhalten bleiben — eine Fläche
ist ganz drin oder ganz draußen, entschieden über ihren Schwerpunkt. Die gezackte
Schnittkante ist gewollt (`renderer.js:131-133`), nicht wegoptimieren.

## F5 — Bug: `zFenster()` läuft beim Zoomen nicht

**Wo:** `zFenster()` `renderer.js:158-168`, aufgerufen nur in `renderer.js:264`

`Z_NAH = lo + dz` und `Z_FERN = hi + dz` hängen von `dz` ab. Aufgerufen wird
`zFenster()` aber nur im Rotationszweig. Der Wheel-Handler ändert `dz`
(`renderer.js:242`), ohne das Fenster nachzuziehen — nach dem Zoomen ist die
Farbrampe also gegen das alte `dz` gerechnet, bis man das nächste Mal dreht.
Beim starken Reinzoomen kippt die Tiefeneinfärbung dadurch sichtbar.

**Fix:** `dz`-Änderung wie `drehX/drehY/cutDelta` behandeln — im Wheel-Handler
nur merken, im Frame anwenden und `zFenster()` mit aufrufen. Kleinster Fix auf
der Liste und der einzige, der einen echten Fehler behebt.

---

## Entlastung ohne Punkte zu verlieren

F1–F4 sind gratis in dem Sinn, dass das Bild identisch bleibt. Ab hier kostet es
etwas, dafür skaliert es weiter.

### E1 — Level of Detail während der Bewegung

Solange gezogen oder gezoomt wird, nur jede n-te Kante zeichnen; im Ruhezustand
alle. Beim Drehen sieht man die fehlenden Linien schlicht nicht, und flüssig muss
es genau dann sein. Faktor 2–4 an der Stelle, wo es zählt, für etwa zehn Zeilen.
Ein Frame Verzögerung nach dem Loslassen, bis das volle Bild steht.

### E2 — Sub-Pixel-Kanten verwerfen

`if (dx*dx + dy*dy < 2.25) continue` vor dem Einsortieren in die Farbtöpfe.
Ehrlich zur Wirkung: bei voller Zoomstufe sind die Kanten im Schnitt rund 4–5 px
lang, da bringt es wenig. Herausgezoomt kollabieren sie unter ein Pixel und der
Filter wirft die Hälfte weg — es hilft genau dort, wo es sonst zäh wird.

### E3 — Punkte statt Linien, falls es die Dichte ist, die zählt

Die optische Dichte kommt von den Punkten, nicht von den Strichen dazwischen.
Wenn die Punktwolke der eigentliche Look ist: nicht mit `fillRect` zeichnen,
sondern direkt in ein `ImageData`-`Uint32Array` schreiben und einmal
`putImageData`. 31.516 Pixel-Schreibvorgänge statt 96.441 anti-aliaster Linien —
eine völlig andere Größenordnung, und die Kantenliste samt Dedup entfällt.

### E4 — Die Decke: WebGL

`skull_g128` mit 322.157 Kanten wird auf Canvas2D nicht flüssig, auch nach F1–F4
und E1 nicht. Mit WebGL: ein Vertex-Buffer, `gl.LINES`, Rotation und Division im
Vertex-Shader, Farbe als varying über z. Das ist ein Umbau der Zeichenroutine,
grob 80 Zeilen; die gesamte Pipeline davor — `cutInHalf`, die Konverter, das
Modellformat, `modelle.js` — bleibt unangetastet. Danach ist die
40.000-Vertizes-Grenze aus dem README gegenstandslos, und `cutInHalf` wird vom
Pflichtschritt zur Option.

---

## Frame-Takt

`FPS` hochzudrehen bringt nichts. `setTimeout(frame, 1000 / FPS)` steht am **Ende**
von `frame()` (`renderer.js:302`), die Periode ist also *Arbeit + 33,3 ms*. Bei
25 ms Zeichenzeit läuft das Ganze real mit 1000/58 ≈ 17 fps, nicht mit 30. `FPS =
45` verkürzt nur die Pause: 1000/(22+25) ≈ 21 fps. Die Konstante steuert die
Leerlaufzeit, nicht das Tempo.

Dazu passen 45 fps nicht auf ein 60-Hz-Panel — die Frames stehen abwechselnd
einen und zwei Refreshes lang, das ruckelt sichtbarer als saubere 30.

**Fix:** `requestAnimationFrame` statt `setTimeout` (steht schon als `ponytail:`
in `renderer.js:300`) und die Frames fallen lassen, wo sie fallen. Wenn ein
fester Deckel sein muss, dann 30 oder 60 — nichts dazwischen.

---

## Aufräumen, unabhängig von Performance

- **Konverter-Duplikat.** `nameAus`, `inListeEintragen`, Zentrieren/Skalieren und
  das Schreiben stehen in `2model/obj2model.js` und `2model/stl2model.js`
  zweimal fast gleich, rund 60 Zeilen. Bisher hieß „Konverter ändern" immer,
  dieselbe Änderung zweimal zu machen. Jetzt, wo beide in `2model/` liegen, wäre
  ein `2model/gemeinsam.js` der naheliegende Ort. Bewusst offen gelassen, siehe
  Build-Log vom 2026-08-09.
- **Modellformat.** `{x: -0.821, y: -0.092, z: 0.178}` als JS-Quelltext heißt bei
  `skull_g128` 9,4 MB parsen und 106.000 Heap-Objekte anlegen. Ein flaches
  `[x,y,z,x,y,z,…]` wäre rund 40 % kleiner und ginge direkt in ein
  `Float32Array`. Betrifft beide Konverter, den Renderer und **alle bestehenden
  Modelle** — nur sinnvoll gemeinsam mit F1, sonst zweimal migrieren.
- **`leinwand` ist ein impliziter Global** aus der Element-ID (`index.html:1`).
  Funktioniert in jedem Browser, ist aber nirgends deklariert und dadurch beim
  Lesen unsichtbar.
- **Die `models`-Liste in `modelle.js`** ist eine Handkopie des Ordnerinhalts,
  gepflegt von den Konvertern. Läuft auseinander, sobald jemand eine Datei von
  Hand löscht.
