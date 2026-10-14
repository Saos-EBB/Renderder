import {importModel} from "./modelle.js";
leinwand.width = 1200
leinwand.height = 1200
const BACKGROUND = '#000000'
const ctx = leinwand.getContext("2d")
function clear() {
    ctx.fillStyle = BACKGROUND
    ctx.fillRect(0, 0, leinwand.width, leinwand.height)
}


function screen(p) {
    // -1 .. 1 => 0 .. 2  => 0..1 => 0.. w (0.. h)
    // 0 , 0   in die mitte legen
    return {
        x: (p.x + 1) / 2 * leinwand.width,
        // 1-  um Y umzukehren
        y: (1 - (p.y + 1) / 2) * leinwand.height,
    }
}
// MAGIC FORMULA
//----------------------------------------------------
function magic({x, y, z}) {
    return {
        x: x / z,
        y: y / z,
    }
}
const FPS = 30;

function translate_z({x, y, z}, dz) {
    return {x, y, z: z + dz};
}
// dreht v in der durch [a, b] aufgespannten Ebene (z.B. ["x","z"] statt eigener rotate_xz)
function rotate(v, angle, [a, b]) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return {
        ...v,
        [a]: v[a] * c - v[b] * s,
        [b]: v[a] * s + v[b] * c,
    }
}

// --- Tiefen-Shading: Kanten nach Entfernung einfaerben (nah hell, fern dunkel)
// Palette aendern = nur dieses Array; der Rest passt sich an SHADES.length an.
// 16 Stufen aus HSL: Farbton 210, Saettigung 85 %, Helligkeit gleichmaessig von
// 75 % (Index 0, nah) bis 15 % (Index 15, fern), also L = 75 - Index * 4.
// Vorher ging die Rampe bis 90 % hoch. Bei der Saettigung lesen die obersten
// Stufen aber als Weiss, und wo viele nahe Kanten uebereinanderliegen, wurde
// daraus eine weisse Flaeche. Der Deckel liegt jetzt tiefer, die hellste Stufe
// ist ein erkennbares Blau.
// Einmal ausgerechnet und fest eingetragen — zur Laufzeit umzurechnen waere
// Arbeit pro Frame fuer ein Ergebnis, das sich nie aendert.
const SHADES = [
    "#89bff5",
    "#76b5f4",
    "#63abf2",
    "#50a1f1",
    "#3e96ef",
    "#2b8cee",
    "#1882ec",
    "#1278de",
    "#106ecb",
    "#0f63b8",
    "#0d59a5",
    "#0c4f92",
    "#0a457f",
    "#093b6d",
    "#07305a",
    "#062647",
]

let dz = 2.5;  // wo start ??

// 'Modelle ' ----------------------------------------
// await, weil importModel jetzt dynamisch nachlaedt. Modell und mesh MUESSEN
// vor den Maus-Listenern stehen: die feuern sonst waehrend des await und
// greifen auf ein noch nicht initialisiertes mesh zu.
// cube waehrend der Edit-Mode-Arbeit: 8 Vertizes, jede Ecke einzeln sichtbar.
// Auf einem 31k-Modell sieht man einen um zwei Pixel versetzten Punkt nicht.
// Name in eine Konstante, weil das Speichern ihn braucht: die Datei heisst
// danach, und der Bezeichner darin auch.
const MODELL_NAME = "skull"
const model = await importModel(MODELL_NAME);
const fs = model.fs
//----------------------------------------------------

// Orientierung als bereits gedrehte Vertizes. Start = dein Preset, einmal
// eingebacken. Danach dreht nur noch das Ziehen weiter.
let mesh = model.vs.map(v => rotate(rotate(v, 5.5, ["x", "z"]), 4.678, ["x", "y"]))

// --- Cutaway: eine Schnittebene laesst eine Haelfte weg, damit man ins Modell
// hineinsieht. Getestet wird auf den ROHEN Modellkoordinaten, also vor der
// Rotation — die Ebene dreht dadurch mit dem Modell mit statt im Raum zu
// stehen. Das ist gewollt und spart das Zuruecktransformieren.
// Die Achse wird zur Laufzeit per Seitentaste durchgeschaltet, deshalb let.
const ACHSEN = ["x", "y", "z"]
let ACHSE = "z"            // Startachse — je nach Ausrichtung des Modells
const CUT_SCHRITT = 0.05

// Schwerpunkt einer Flaeche auf der Schnittachse, auf den unrotierten
// Koordinaten. Gemittelt ueber f.length, nicht ueber 3: aus .obj kommen auch
// Vierecke (skull hat beides), aus .stl nur Dreiecke.
function schwerpunkt(f) {
    let s = 0
    for (const i of f) s += model.vs[i][ACHSE]
    return s / f.length
}

// Setzt den Schnitt so, dass NICHTS abgeschnitten ist: knapp ueber den
// groessten Schwerpunkt, den es auf der aktuellen Achse gibt. Geschnitten wird
// erst, wenn du mit gehaltener rechter Taste hineinscrollst.
// Aus dem Modell abgeleitet statt fest eingetragen, weil die Modelle die Achsen
// unterschiedlich weit ausfuellen — pochita30 reicht auf z nur bis rund 0.7.
// Ein fester Wert waere dort erst nach einem Dutzend Radschritten wirksam.
// Laeuft auch bei jedem Achsenwechsel: die neue Achse hat eine andere
// Ausdehnung, ein uebernommener Wert wuerde dort alles oder nichts wegschneiden.
let CUT = 0
function cutZuruecksetzen() {
    CUT = -Infinity
    for (const f of fs) {
        const m = schwerpunkt(f)
        if (m > CUT) CUT = m
    }
    CUT += CUT_SCHRITT
}
cutZuruecksetzen()

// Eindeutige Kantenliste: fs aendert sich nie, und benachbarte Faces teilen
// sich jede Kante — ohne das hier zeichnen wir jede Kante doppelt (bei skull
// 161472 statt 80736 pro Frame).
// Hier faellt auch der Cutaway. Nicht in der Draw-Schleife, denn die laeuft
// ueber Kanten, nicht ueber Flaechen — der Test gehoert dahin, wo es noch
// Flaechen gibt. Nebeneffekt: er kostet nichts pro Frame, nur bei Aenderung.
// Bewusst grob: eine Flaeche ist ganz drin oder ganz draussen, entschieden
// ueber ihren Schwerpunkt. Die Schnittkante wird dadurch gezackt und folgt den
// Dreieckskanten, und das Innere liegt hohl frei. Genau richtig zum Reinschauen.
let kanten = []
// Von Hand gezogene Kanten. Eigene Liste statt Eintraegen in fs, obwohl das
// Format Zweier-Flaechen kennt (cube.js hat [0,4] neben den Vierecken) und
// kantenBauen() sie verarbeiten wuerde: schwerpunkt() liest model.vs, und fuer
// einen eingefuegten Punkt gibt es dort keine Position — Weg A hat keinen
// Rueckweg der Rotation. Ein Eintrag in fs liefe also auf undefined.
// Folge, bewusst: manuelle Kanten liegen ausserhalb des Cutaways. Sie bleiben
// sichtbar, auch wenn ringsum weggeschnitten ist. Beim Bauen will man ohnehin
// sehen, was man gerade zieht.
let extraKanten = []
// Verhindert, dass dieselbe Verbindung mehrfach in der Liste landet. Derselbe
// Schluessel wie unten, damit a-b und b-a als eine Kante gelten.
const extraSchluessel = new Set()
// Welche Vertizes der Cutaway stehen laesst. 1 = liegt auf mindestens einer
// Flaeche, die nicht weggeschnitten ist.
// Das Ding faellt in kantenBauen() nebenbei ab: dort laufen die Flaechen ohnehin
// durch, und nur dort steht fest, was der Schnitt uebrig laesst. Eine eigene
// Schleife waere derselbe Durchlauf ein zweites Mal.
// Gebraucht wird es fuers Picken und die Punktwolke — beides sah bisher das
// ganze Modell, auch die abgeschnittene Haelfte. Die liegt aber VORNE, und
// beim Picken gewann die Tiefe: aufgeschnitten und innen geklickt, griff man
// zuverlaessig die Aussenhaut, die man gerade weggeschnitten hatte.
// Uint8Array statt Set: der Test laeuft pro Vertex und pro Frame, und ein
// Index-Lookup ist billiger als ein Hash.
let sichtbar = new Uint8Array(model.vs.length)
function kantenBauen() {
    kanten = []
    sichtbar.fill(0)
    const gesehen = new Set()
    for (const f of fs) {
        if (schwerpunkt(f) > CUT) continue
        for (let i = 0; i < f.length; i++) {
            const a = f[i]
            const b = f[(i + 1) % f.length]
            sichtbar[a] = 1
            const key = a < b ? `${a},${b}` : `${b},${a}`
            if (gesehen.has(key)) continue
            gesehen.add(key)
            kanten.push([a, b])
        }
    }
    // Von Hand gesetzte Punkte stehen in keiner Flaeche und waeren nach dem
    // fill(0) fuer immer weg. Sie liegen ab model.vs.length und gelten immer als
    // sichtbar — dieselbe Entscheidung wie bei den manuellen Kanten oben: was du
    // selbst gebaut hast, verschwindet nicht im Schnitt.
    for (let i = model.vs.length; i < sichtbar.length; i++) sichtbar[i] = 1
    // Anhaengen statt in der Zeichenschleife zu beruecksichtigen: so ueberleben
    // die manuellen Kanten jeden Achsen- und Cut-Neubau von selbst, und die
    // Schleife merkt nichts davon — Shading, Nah-Grenze und Farbtoepfe gelten
    // fuer sie unveraendert.
    for (const k of extraKanten) kanten.push(k)
}
kantenBauen()

// Zwei Vertizes verbinden. Landet in beiden Listen: in kanten, damit die
// Verbindung sofort zu sehen ist, und in extraKanten, damit sie den naechsten
// Neubau uebersteht.
function kanteVerbinden(a, b) {
    const key = a < b ? `${a},${b}` : `${b},${a}`
    if (extraSchluessel.has(key)) return
    extraSchluessel.add(key)
    extraKanten.push([a, b])
    kanten.push([a, b])
}

// z-Fenster fuer das Shading: aus der echten z-Spanne des Meshes statt geraten.
// Fest verdrahtete +-1.8 waren breiter als jedes Modell, dadurch landeten fast
// alle Kanten in den mittleren zwei Farben. Nach jeder Drehung neu, weil sich
// die Spanne mitdreht.
let Z_NAH = 0
let Z_FERN = 1
function zFenster() {
    let lo = Infinity
    let hi = -Infinity
    for (const v of mesh) {
        if (v.z < lo) lo = v.z
        if (v.z > hi) hi = v.z
    }
    Z_NAH = lo + dz
    // flaches Modell exakt senkrecht zur Sicht -> sonst teilen wir durch 0
    Z_FERN = hi > lo ? hi + dz : Z_NAH + 1
}
zFenster()

// --- Projektions-Cache: ein Bildschirmpunkt pro Vertex, einmal pro Frame ---
// Die Kantenschleife lief ueber Index-PAARE und projizierte damit jeden Vertex
// einmal pro anliegender Kante — bei hand1_g128 192.882 Projektionen fuer
// 31.516 Vertizes, Faktor 6,1. Jetzt einmal pro Vertex hier, die Kanten lesen
// nur noch per Index nach.
//
// Zwei Gruende, warum das genau so aussieht:
// - Es gibt nur EINE Projektionsstelle. Wuerde die Kantenschleife weiter selbst
//   projizieren, koennten Punkte und Linienenden auseinanderlaufen, sobald
//   jemand screen() oder magic() anfasst.
// - psz haelt die Tiefe MIT dz, also genau die Zahl, durch die magic() teilt.
//   Wer hier mesh[i].z ohne dz ablegt, bekommt spaeter beim Ziehen eine um dz
//   verschobene Skala.
//
// mesh wird bei jeder Drehung neu zugewiesen. Die LAENGE aendert sich nur beim
// Einfuegen — deshalb let statt const: eine Float64Array kann nicht wachsen, sie
// wird dann neu angelegt. Das passiert pro eingefuegtem Punkt einmal, nicht pro
// Frame, also ist die Kopie billiger als jeden Frame ueber ein normales Array zu
// laufen.
let psx = new Float64Array(model.vs.length)
let psy = new Float64Array(model.vs.length)
let psz = new Float64Array(model.vs.length)
// Auf mesh.length bringen. Der Inhalt wird zwar jeden Frame neu gerechnet, aber
// zwischen dem Einfuegen und dem naechsten frame() liest schon jemand mit — der
// frische Punkt saesse sonst fuer einen Frame auf 0,0.
// sichtbar waechst mit: es wird ueber denselben Index gelesen wie psx/psy/psz,
// und ein zu kurzes Array liefert undefined — der frische Punkt waere damit
// unsichtbar und ungreifbar.
function puffernWachsen() {
    if (psx.length >= mesh.length) return
    const neuX = new Float64Array(mesh.length)
    const neuY = new Float64Array(mesh.length)
    const neuZ = new Float64Array(mesh.length)
    const neuS = new Uint8Array(mesh.length)
    neuX.set(psx)
    neuY.set(psy)
    neuZ.set(psz)
    neuS.set(sichtbar)
    psx = neuX
    psy = neuY
    psz = neuZ
    sichtbar = neuS
}
// Vertizes vor dieser Tiefe liegen hinter der Kamera. magic() wuerde sie
// gespiegelt und riesig ins Bild werfen; beim Reinzoomen faehrt das Modell da
// durch. Frueher stand die 0.01 nur in der Kantenschleife, jetzt pruefen
// Kanten UND Punkte dagegen, also einmal benannt.
const NAH_GRENZE = 0.01
function punkteRechnen() {
    for (let i = 0; i < mesh.length; i++) {
        const v = mesh[i]
        psz[i] = v.z + dz
        if (psz[i] <= NAH_GRENZE) continue   // sx/sy waeren Muell, gar nicht erst rechnen
        const p = screen(magic(translate_z(v, dz)))
        psx[i] = p.x
        psy[i] = p.y
    }
}

// Farbe der Vertex-Punkte. Warm, damit sie sich gegen die blaue Kantenrampe
// absetzen — auf Blau in Blau sieht man nicht, was man greifen koennte.
const DOT_FARBE = "#ffb454"
const DOT_GROESSE = 3

// --- Edit-Mode ---
// Aus im Normalfall: die Punkte sind nur beim Editieren interessant, und auf
// einem grossen Modell legen sie sich sonst als Raster ueber die Kanten.
// Der Rand ist die einzige Rueckmeldung, dass der Modus laeuft — ohne ihn
// sieht man an einem Modell ohne sichtbare Ecken nicht, in welchem Zustand
// man ist.
let editMode = false
const RAND_FARBE = "#c8922a"
const RAND_DICKE = 6

// Index des gegriffenen Vertex, -1 = keiner. Index und nicht das Vertex-Objekt:
// mesh wird bei jeder Drehung komplett neu zugewiesen (mesh.map in frame()),
// eine festgehaltene Objektreferenz zeigte danach auf eine Leiche aus dem
// letzten Frame. Der Index ueberlebt das, weil kanten und fs ihn auch benutzen.
let gegriffen = -1
// Greifradius in Bildschirmpixeln. Grosszuegig, weil die Punkte nur 3 px sind —
// wer genau treffen muesste, waere beim Explorieren nur beschaeftigt.
const GREIF_RADIUS = 12
const GEGRIFFEN_FARBE = "#ff2d55"
const GEGRIFFEN_GROESSE = 9

// Der Anker ist der Punkt, von dem aus verbunden wird — getrennt von gegriffen,
// und zwar mit Absicht: greift man zwischendurch eine andere Ecke, um sie zu
// verschieben, soll der Ausgangspunkt fuers Verbinden stehen bleiben. Ein
// gemeinsamer Zustand haette bei jedem Ziehen die Auswahl mitgenommen.
// Gruen gegen das Rot des Gegriffenen, damit man beide gleichzeitig auseinander
// halten kann.
let anker = -1
const ANKER_FARBE = "#3ddc84"
const ANKER_GROESSE = 11

// Maus-Position in LEINWAND-Koordinaten. Die uebrigen Handler rechnen mit
// clientX/clientY, also viewport-relativ — fuer die Drehung egal, dort zaehlen
// nur Deltas. Beim Picken sind es absolute Positionen, und die muessen im
// selben Raum liegen wie psx/psy.
// Der zweite Faktor ist Pflicht und nicht Vorsicht: der Backing Store steht
// fest auf 1200x1200, die Leinwand im Layout kann skaliert dargestellt sein.
// Ohne ihn trifft der Test bei skalierter Anzeige daneben.
// Nimmt die Zahlen, nicht das Event: das Einfuegen per Tastatur hat keins, es
// arbeitet mit der zuletzt gemerkten Cursorposition.
function leinwandPos(clientX, clientY) {
    const rect = leinwand.getBoundingClientRect()
    return {
        x: (clientX - rect.left) * (leinwand.width / rect.width),
        y: (clientY - rect.top) * (leinwand.height / rect.height),
    }
}

// Naechster Vertex zu einem Leinwand-Punkt, oder -1. Verglichen wird das
// QUADRAT der Distanz — die Wurzel aendert an der Reihenfolge nichts und
// kostet pro Vertex.
// Gewonnen wird nach ABSTAND, die Tiefe entscheidet nur bei Gleichstand.
// Vorher war es umgekehrt: unter allen Punkten im Radius gewann der vorderste.
// Auf dem Wuerfel, an dem das entstand, war das dasselbe — da liegt nie mehr
// als ein Punkt im Radius. Auf skull mit 40.062 Vertizes ist der mittlere
// Punktabstand rund 3 px, in der Scheibe mit r=12 liegen also grob 50
// Kandidaten, und der vorderste davon ist fast nie der unter dem Cursor. Das
// Ergebnis sah aus wie ein fester Versatz, weil der Gewinner immer in dieselbe
// Richtung abwich: zur kameranaechsten Flaeche hin.
// Der grosse Radius darf damit bleiben — er hilft auf duennen Modellen und
// kostet auf dichten nichts mehr.
function vertexAn(x, y) {
    let treffer = -1
    let bestesD2 = Infinity
    let bestesZ = Infinity
    const r2 = GREIF_RADIUS * GREIF_RADIUS
    for (let i = 0; i < mesh.length; i++) {
        if (psz[i] <= NAH_GRENZE) continue   // hinter der Kamera, psx/psy sind Muell
        if (!sichtbar[i]) continue           // vom Cutaway entfernt, also auch nicht greifbar
        const dx = psx[i] - x
        const dy = psy[i] - y
        const d2 = dx * dx + dy * dy
        if (d2 > r2) continue
        if (d2 > bestesD2) continue
        // Exakter Gleichstand ist selten, aber genau der Fall, fuer den die
        // Tiefe gedacht war: zwei Punkte uebereinander, vorne gewinnt.
        if (d2 === bestesD2 && psz[i] >= bestesZ) continue
        bestesD2 = d2
        bestesZ = psz[i]
        treffer = i
    }
    return treffer
}

// Tiefe fuer einen neu einzufuegenden Punkt: die des bildschirm-naechsten
// Vertex, ohne Radiusgrenze. Ein Klick liefert nur x und y — die dritte Zahl
// muss irgendwoher kommen, und "so tief wie das, woneben ich klicke" ist die
// einzige Wahl, die ohne Vorauswahl auskommt.
// Bewusst NICHT vertexAn(): das hat einen Radius, und ohne Treffer darin gaebe
// es keine Tiefe. Hier zaehlt der naechste Punkt ueberhaupt, also eine eigene
// Schleife.
// Liegt gar nichts vor der Kamera, faellt es auf dz zurueck — das ist die Ebene
// durch den Modellursprung.
// Der Cutaway zaehlt auch hier: schneidet man auf und setzt innen einen Punkt,
// soll er die Tiefe von dem bekommen, was man sieht, und nicht von der
// weggeschnittenen Aussenhaut davor — sonst klebt der neue Punkt auf der
// Oberflaeche statt im Hohlraum.
function naechsteTiefe(x, y) {
    let bestesD2 = Infinity
    let tiefe = dz
    for (let i = 0; i < mesh.length; i++) {
        if (psz[i] <= NAH_GRENZE) continue
        if (!sichtbar[i]) continue
        const dx = psx[i] - x
        const dy = psy[i] - y
        const d2 = dx * dx + dy * dy
        if (d2 >= bestesD2) continue
        bestesD2 = d2
        tiefe = psz[i]
    }
    return tiefe
}

// Neuen Vertex an einer Leinwand-Position anlegen. Das ist der Hinweg
// rueckwaerts: screen() und magic() umgekehrt, in dieser Reihenfolge.
function vertexEinfuegen(lx, ly) {
    const vz = naechsteTiefe(lx, ly)
    // screen() umgekehrt. x_s = (x_n+1)/2 * W  ->  x_n = 2*x_s/W - 1
    // y_s = (1 - (y_n+1)/2) * H  ->  y_n = 1 - 2*y_s/H. Das Minus faellt hier
    // als vertauschte Reihenfolge an, es ist dasselbe Spiegeln wie beim Ziehen.
    const nx = 2 * lx / leinwand.width - 1
    const ny = 1 - 2 * ly / leinwand.height
    // magic() umgekehrt: dort wird durch die Tiefe geteilt, hier multipliziert.
    // z geht MINUS dz zurueck, weil translate_z() es auf dem Hinweg addiert —
    // vz ist die Tiefe vor der Kamera, mesh haelt sie ohne den Kameraabstand.
    mesh.push({x: nx * vz, y: ny * vz, z: vz - dz})
    const i = mesh.length - 1

    puffernWachsen()
    // Den frischen Punkt gleich selbst in den Cache schreiben statt auf den
    // naechsten frame() zu warten: er ist ab sofort Anker und wird gezeichnet,
    // und die Werte sind hier ohne Rechnung bekannt — nach genau diesen
    // Bildschirmkoordinaten wurde er ja konstruiert.
    psx[i] = lx
    psy[i] = ly
    psz[i] = vz
    // Sofort sichtbar setzen und nicht auf kantenBauen() warten: das laeuft hier
    // nicht mit, und bis zum naechsten Achsen- oder Cut-Wechsel waere der eben
    // gesetzte Punkt weder zu sehen noch zu greifen.
    sichtbar[i] = 1

    anker = i
    // Die z-Spanne kann sich durch den neuen Punkt geweitet haben, sonst
    // klemmen seine Kanten spaeter auf der aeussersten Farbstufe. Einmal pro
    // Einfuegen ist das billig — beim Ziehen bleibt es bewusst aus, das feuert
    // bis zu 120x pro Sekunde.
    zFenster()
}

// --- Maussteuerung ---
let ziehen = false
let letzte = {x: 0, y: 0}
// Zweite Merkposition, in LEINWAND-Koordinaten. letzte bleibt viewport-relativ,
// weil die Drehung daran haengt und ein Umstellen ihre Geschwindigkeit aendern
// wuerde, sobald die Leinwand skaliert dargestellt ist. Das Ziehen braucht
// dagegen dasselbe Mass wie psx/psy, sonst passt die Umrechnung nach NDC nicht.
let letzteLein = {x: 0, y: 0}
// Letzte bekannte Cursorposition, roh wie sie das Event liefert. Das Einfuegen
// per Tastatur braucht eine Position, und ein keydown hat keine.
// Roh gemerkt und erst beim Einfuegen umgerechnet: leinwandPos() ruft
// getBoundingClientRect() auf, und das bei jeder Mausbewegung zu tun hiesse,
// den Browser bis zu 120x pro Sekunde nach dem Layout zu fragen — fuer eine
// Zahl, die fast immer weggeworfen wird.
let mausClient = {x: 0, y: 0}
// aufgelaufene Drehung. mousemove feuert bis ~120x/s, das Mesh hat aber bis zu
// 110k Vertizes — pro Event drehen hiesse hunderttausende Objekte pro Sekunde
// neu allozieren. Hier nur Winkel addieren, gedreht wird einmal pro Frame.
let drehX = 0
let drehY = 0
// Zoom: Mausrad ohne Taste. Multiplikativ statt fester Schritt — bei dz=10
// waere ein fester Wert kaum sichtbar, bei dz=0.5 ein Sprung.
const ZOOM_SCHRITT = 1.1
// aufgelaufene Radschritte fuer die Schnittebene. Wie bei der Drehung: das Rad
// feuert schneller als Frames kommen, und jede Aenderung baut die Kantenliste
// neu — bei skull sind das 40728 Flaechen. Also sammeln und einmal pro Frame.
let cutDelta = 0
// magic() teilt durch z. Ganz auf 0 lassen wir dz nicht runter, sonst steckt
// das Modell komplett hinter der Kamera und es bleibt nichts zu zeichnen.
const DZ_MIN = 0.3
// Schnittachse x -> y -> z weiterschalten. Danach ist wieder alles sichtbar:
// die Achsen sind unterschiedlich weit ausgedehnt, ein uebernommener CUT wuerde
// auf der neuen Achse alles oder nichts wegschneiden.
function achseWechseln() {
    ACHSE = ACHSEN[(ACHSEN.indexOf(ACHSE) + 1) % ACHSEN.length]
    cutZuruecksetzen()
    kantenBauen()
}
// --- Arbeitskopie ---
// Beim Betreten des Edit-Mode wird der Stand gesichert, geaendert wird ab da an
// der Kopie. Beim Verlassen bleiben die Aenderungen stehen — ein versehentliches
// "e" darf keine Arbeit kosten, und es ist dieselbe Taste, die man staendig
// drueckt. Der Weg zurueck liegt auf Shift+R.
// Jeder Eintritt setzt einen neuen Stand. Wer raus und wieder rein geht, hat
// damit die Aenderungen von vorhin im Ruecken statt sie zu verlieren.
// Was mitkommt: die Vertizes und die manuellen Kanten. model.vs und fs werden
// ohnehin nie angefasst.
let schnappschuss = null
function schnappschussNehmen() {
    schnappschuss = {
        mesh: mesh.map(v => ({x: v.x, y: v.y, z: v.z})),
        extraKanten: extraKanten.map(([a, b]) => [a, b]),
    }
}
// ACHTUNG, bewusster Nebeneffekt: die Orientierung steckt in mesh, es gibt
// keine getrennte Rotation. Zuruecksetzen holt deshalb auch die Ansicht von
// damals zurueck — das Modell springt in die Lage, in der es beim Betreten
// stand. Trennen liesse sich das nur mit einer Matrix, also erst in Weg B.
function schnappschussZurueck() {
    if (schnappschuss === null) return
    mesh = schnappschuss.mesh.map(v => ({x: v.x, y: v.y, z: v.z}))
    extraKanten = schnappschuss.extraKanten.map(([a, b]) => [a, b])
    // Der Schluesselsatz muss mitgehen, sonst gelten geloeschte Verbindungen
    // weiter als vorhanden und liessen sich nicht neu ziehen.
    extraSchluessel.clear()
    for (const [a, b] of extraKanten) {
        extraSchluessel.add(a < b ? `${a},${b}` : `${b},${a}`)
    }
    gegriffen = -1
    anker = -1
    kantenBauen()
    zFenster()
}
// Beim Verlassen die Auswahl loeschen, sonst leuchtet beim naechsten Einschalten
// die Ecke von vorhin weiter — und das an einer Stelle, die inzwischen
// weggedreht sein kann.
function editModeUmschalten() {
    editMode = !editMode
    gegriffen = -1
    anker = -1
    if (editMode) schnappschussNehmen()
}
// --- Speichern ---
// Schreibt den Arbeitsstand als .js im Format von modelle/ — dieselbe Form wie
// cube.js, also direkt wieder ladbar. Der Browser kann nur in den
// Download-Ordner schreiben, nie zurueck nach modelle/: die Datei dort
// hinlegen und den Namen in modelle.js eintragen, dann kennt importModel sie.
//
// Zwei Dinge, die man der Datei ansehen muss:
// - vs ist mesh, also die Geometrie in ihrer JETZIGEN Lage. Die Orientierung
//   steckt in Weg A in den Vertizes selbst, es gibt keine getrennte Rotation
//   zum Herausrechnen. Beim Laden legt renderer.js ausserdem sein Preset
//   (5.5 / 4.678) obendrauf — das gespeicherte Modell erscheint also gedreht.
//   Sauber trennen liesse sich das erst mit einer Matrix, in Weg B.
// - Die manuellen Kanten gehen als Zweier-Eintraege in fs. Das kennt das Format
//   (cube.js hat [0,4] neben den Vierecken) und kantenBauen() liest sie wieder
//   ein. Nach dem Neuladen sind sie damit richtige Modellkanten und machen den
//   Cutaway mit — die Einschraenkung aus Step 6 loest sich beim Rundlauf auf.
const SPEICHER_STELLEN = 6
function zahl(n) {
    // toFixed schneidet die 17 Stellen ab, die aus der Rotation herausfallen,
    // das + macht daraus wieder eine Zahl und wirft die Nullen am Ende weg:
    // 0.500000 -> 0.5. Sonst waere die Datei ein Vielfaches so gross.
    return String(+n.toFixed(SPEICHER_STELLEN))
}
function modellSpeichern() {
    const zeilen = []
    zeilen.push(`const ${MODELL_NAME}_edit = {`)
    zeilen.push(`    vs :[`)
    for (const v of mesh) {
        zeilen.push(`    {x: ${zahl(v.x)}, y: ${zahl(v.y)}, z: ${zahl(v.z)} },`)
    }
    zeilen.push(`    ],`)
    zeilen.push(`    fs : [`)
    for (const f of fs) zeilen.push(`    [${f.join(", ")}],`)
    for (const [a, b] of extraKanten) zeilen.push(`    [${a}, ${b}],`)
    zeilen.push(`        ]`)
    zeilen.push(`};`)
    zeilen.push(`export default ${MODELL_NAME}_edit;`)
    zeilen.push(``)

    // Blob + a[download] ist der einzige Weg, aus einer Seite heraus eine Datei
    // abzulegen. revoke danach, sonst haelt der Tab den Inhalt bis zum Neuladen
    // im Speicher — bei einem 100k-Modell merkt man das.
    const blob = new Blob([zeilen.join("\n")], {type: "text/javascript"})
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${MODELL_NAME}_edit.js`
    a.click()
    URL.revokeObjectURL(url)
}

// Alle drei Funktionen liegen doppelt, Daumentaste und Tastatur, und zwar nicht
// aus Bequemlichkeit: WebStorms eingebaute Vorschau laeuft auf JCEF und reicht
// die Daumentasten nicht bis zur Seite durch. In Brave arbeiten die Maustasten,
// im Preview "a" fuer die Achse, "e" fuer den Edit-Mode und "i" fuers Einfuegen.
// Die Tasten sind die Wahrheit, die Maustasten die Zugabe.
window.addEventListener("keydown", (e) => {
    // Strg+S vor allem anderen, und preventDefault ist Pflicht: sonst legt der
    // Browser seinen "Seite speichern"-Dialog darueber und schreibt das HTML
    // statt des Modells. Absichtlich nicht auf den Edit-Mode beschraenkt — die
    // Aenderungen bleiben ja auch, wenn man ihn verlassen hat.
    if (e.ctrlKey && (e.key === "s" || e.key === "S")) {
        e.preventDefault()
        modellSpeichern()
        return
    }
    if (e.key === "a" || e.key === "A") achseWechseln()
    if (e.key === "e" || e.key === "E") editModeUmschalten()
    if (editMode && (e.key === "i" || e.key === "I")) {
        const p = leinwandPos(mausClient.x, mausClient.y)
        vertexEinfuegen(p.x, p.y)
    }
    // Anker loslassen. Braucht es, seit ein Klick auf den Anker ihn haelt
    // statt ihn abzuwaehlen — sonst haengt das Gummiband am Cursor fest.
    if (e.key === "Escape") anker = -1
    // Zurueck auf den Stand vom Betreten. Auf Shift+R und nicht auf "r" allein:
    // die Taste wirft die ganze Sitzung weg, die soll man nicht streifen.
    if (editMode && e.shiftKey && (e.key === "R" || e.key === "r")) {
        schnappschussZurueck()
    }
})
leinwand.addEventListener("mousedown", (e) => {
    // Die vordere Daumentaste. In der DOM-Zaehlung ist das button 3; die Maus
    // selbst nennt sie meist BT4, weil sie ab 1 zaehlt und die Radklicks
    // mitzaehlt. Sie hat je nach Modus zwei Bedeutungen: im Betrachten schaltet
    // sie wie bisher die Schnittachse weiter, im Edit-Mode setzt sie einen
    // Punkt. Zwei Aufgaben auf einer Taste, weil beide dort hingehoeren, wo man
    // gerade ist — die Achse braucht man beim Editieren nicht, und einen Punkt
    // setzen kann man ausserhalb nicht.
    if (e.button === 3) {
        e.preventDefault()      // sonst navigiert der Browser damit zurueck
        if (editMode) {
            const p = leinwandPos(e.clientX, e.clientY)
            vertexEinfuegen(p.x, p.y)
        } else {
            achseWechseln()
        }
        return
    }
    // Die zweite Daumentaste war bisher nur geschluckt. auxclick faengt sie
    // schon ab, hier kommt die Wirkung dazu.
    if (e.button === 4) {
        e.preventDefault()
        editModeUmschalten()
        return
    }
    if (e.button !== 0) return  // nur links dreht, rechts gehoert dem Schnitt
    // Im Edit-Mode fragt der Linksklick zuerst, ob eine Ecke unter dem Cursor
    // liegt. Trifft er eine, gehoert der Klick ihr und das Modell dreht nicht
    // mit — man will die Ecke greifen, nicht die Ansicht verschieben.
    // Trifft er daneben, faellt er auf das gewohnte Drehen zurueck: ohne das
    // waere das Modell im Edit-Mode festgenagelt, und an Ecken auf der
    // Rueckseite kaeme man nie heran.
    if (editMode) {
        const p = leinwandPos(e.clientX, e.clientY)
        const treffer = vertexAn(p.x, p.y)

        // Shift+Klick verbindet, statt zu greifen. Eine Zusatztaste und kein
        // eigener Modus: Ziehen bleibt dadurch jederzeit erreichbar, und man
        // muss sich nicht merken, in welchem Zustand die Maus gerade ist.
        // Stern statt Kette — der Anker bleibt stehen, jeder weitere Klick
        // zieht eine Kante von ihm weg. Fuer eine Kette klickt man den neuen
        // Ausgangspunkt zwischendurch selbst an.
        // Ein Klick auf den Anker selbst tut nichts. Er lag vorher auf
        // "abwaehlen", und das war eine Falle: nach dem Einfuegen ist der neue
        // Punkt bereits Anker, man klickt ihn aber trotzdem an — weil man ihn
        // ja als Ausgangspunkt haben will. Das schaltete ihn dann ab, und die
        // erste Linie entstand drei Klicks spaeter an der falschen Stelle.
        // Abgewaehlt wird ueber Escape oder einen Shift-Klick ins Leere.
        if (e.shiftKey) {
            e.preventDefault()
            if (treffer === -1) {
                anker = -1                      // ins Leere: Anker ablegen
            } else if (anker === -1 || treffer === anker) {
                anker = treffer                 // Ausgangspunkt setzen bzw. halten
            } else {
                kanteVerbinden(anker, treffer)
            }
            return                              // Shift zieht nie
        }

        gegriffen = treffer
        if (gegriffen !== -1) {
            // ziehen wird auch hier gesetzt: das Geruest ist dasselbe, nur
            // zweigt mousemove gleich in den Editier-Pfad ab. Nach dem mouseup
            // bleibt die Ecke markiert, folgt aber nicht mehr.
            ziehen = true
            letzteLein = p
            // letzte trotzdem mitfuehren: schaltet jemand mitten im Drag den
            // Edit-Mode aus, faellt der naechste mousemove in den Dreh-Zweig,
            // und der rechnet sein Delta gegen genau diesen Wert. Stuende hier
            // noch der vom vorletzten Ziehen, spraenge das Modell.
            letzte = {x: e.clientX, y: e.clientY}
            e.preventDefault()
            return
        }
    }
    ziehen = true
    letzte = {x: e.clientX, y: e.clientY}
    e.preventDefault()          // verhindert Text-Markieren beim Ziehen
})
// Guertel und Hosentraeger: manche Browser haengen die Zurueck-Navigation nicht
// an mousedown, sondern an auxclick. Ein Seitenwechsel waere hier besonders
// aergerlich, weil Drehung, Zoom und Schnitt dabei verloren gehen.
leinwand.addEventListener("auxclick", (e) => {
    if (e.button === 3 || e.button === 4) e.preventDefault()
})
// ohne das poppt beim Rechtsklick das Browser-Menue auf — unter Linux schon
// beim Druecken, nicht erst beim Loslassen
leinwand.addEventListener("contextmenu", (e) => e.preventDefault())
// passive: false ist Pflicht, sonst ignoriert der Browser das preventDefault()
// und die Seite scrollt beim Zoomen mit
leinwand.addEventListener("wheel", (e) => {
    e.preventDefault()
    // Waehrend eine Ecke am Cursor haengt, ist das Rad gesperrt. Zoom aendert
    // dz, dz steckt im Divisor vz — mitten im Ziehen umgestellt, springt die
    // Ecke. Nur bei gegriffener Ecke, nicht schon im Edit-Mode: beim blossen
    // Drehen darf gezoomt werden wie immer.
    if (ziehen && gegriffen !== -1) return
    // Nur das Vorzeichen von deltaY zaehlt, nie der Betrag: der ist je nach
    // Maus, Browser und deltaMode mal 3, mal 100, bei Trackpads krumm.
    // Vorwaerts scrollen (deltaY negativ) schiebt weg bzw. hinein.
    //
    // e.buttons ist eine Bitmaske, Bit 2 = rechte Taste. Spart es, den
    // Tastenzustand ueber mousedown/mouseup selbst mitzuzaehlen.
    if (e.buttons & 2) {
        // rechte Taste gehalten: Schnittebene faehrt ins Modell
        cutDelta += e.deltaY < 0 ? -CUT_SCHRITT : CUT_SCHRITT
        return
    }
    // ohne Taste: Zoom
    dz = e.deltaY < 0 ? dz * ZOOM_SCHRITT : dz / ZOOM_SCHRITT
    if (dz < DZ_MIN) dz = DZ_MIN
}, {passive: false})
// bewusst auf window, nicht auf leinwand: sonst bleibt das Modell haengen,
// sobald du beim Ziehen aus der Leinwand rausfaehrst
window.addEventListener("mouseup", () => { ziehen = false })
window.addEventListener("mousemove", (e) => {
    // Vor dem ziehen-Test: die Position wird auch gebraucht, wenn gerade nichts
    // gezogen wird — "i" fuegt dort ein, wo der Cursor zuletzt stand.
    mausClient = {x: e.clientX, y: e.clientY}
    if (!ziehen) return
    // Haengt eine Ecke am Cursor, gehoert die Bewegung ihr und nicht der
    // Ansicht. gegriffen !== -1 kann es nur im Edit-Mode geben, das Umschalten
    // setzt den Index zurueck.
    if (gegriffen !== -1) {
        const p = leinwandPos(e.clientX, e.clientY)
        const dPixelX = p.x - letzteLein.x
        const dPixelY = p.y - letzteLein.y
        letzteLein = p

        // Rueckweg Pixel -> mesh-Raum. Zwei Schritte, kein transponiertes R:
        // es gibt keine Rotationsmatrix, mesh IST die gedrehte Geometrie, und
        // damit liegt die Ecke schon in dem Raum, in dem das Delta entsteht.
        //
        // 1. Pixel -> NDC. Die Faktoren sind PRO ACHSE, kein gemeinsamer scale:
        //    screen() rechnet mit leinwand.width und leinwand.height getrennt,
        //    und width stand zwischenzeitlich auf 1300. Ein einzelner Faktor
        //    braeche lautlos, sobald die Leinwand nicht quadratisch ist.
        //    Das Minus bei y ist das Spiegeln aus screen() rueckwaerts.
        const dNdcX = 2 * dPixelX / leinwand.width
        const dNdcY = -2 * dPixelY / leinwand.height

        // 2. NDC -> mesh-Raum. magic() teilt durch die Tiefe, hier wird wieder
        //    multipliziert. MIT dz, weil translate_z es vor der Projektion
        //    addiert — ohne waere die Skala um dz daneben und die Ecke liefe
        //    dem Cursor davon oder hinterher.
        const vz = mesh[gegriffen].z + dz
        mesh[gegriffen].x += dNdcX * vz
        mesh[gegriffen].y += dNdcY * vz
        // z bleibt unangetastet: die Ecke wandert parallel zur Bildebene, sonst
        // aendert sich waehrend des Ziehens der eigene Divisor.
        return
    }
    drehY += (e.clientX - letzte.x) * 0.01   // horizontal
    drehX += (letzte.y - e.clientY) * 0.01   // vertikal (invertiert)
    letzte = {x: e.clientX, y: e.clientY}
})


function frame() {
    clear()

    // um die BILDSCHIRM-Achsen drehen: horizontal -> Y, vertikal -> X
    if (drehX !== 0 || drehY !== 0) {
        mesh = mesh.map(v => rotate(rotate(v, drehY, ["x", "z"]), drehX, ["y", "z"]))
        drehX = 0
        drehY = 0
        zFenster()
    }

    // Schnittebene verschoben: Kantenliste einmal neu, nicht pro Rad-Event
    if (cutDelta !== 0) {
        CUT += cutDelta
        cutDelta = 0
        kantenBauen()
    }

    // alle Vertizes einmal projizieren, danach wird nur noch nachgeschlagen
    punkteRechnen()

    //render lines + tiefen-shading
    // Kanten in Helligkeits-Toepfe sortieren statt sofort zu zeichnen.
    // In den Topf gehen die INDIZES, flach hintereinander — zwei Eintraege je
    // Kante. Fertige Punktobjekte waeren pro Frame ein Wegwerf-Objekt je Ecke.
    const toepfe = SHADES.map(() => [])
    for (const [ia, ib] of kanten) {
        const za = psz[ia]
        const zb = psz[ib]
        if (za <= NAH_GRENZE || zb <= NAH_GRENZE) continue
        // mittlere Tiefe der Kante -> Farbindex
        let t = (((za + zb) / 2) - Z_NAH) / (Z_FERN - Z_NAH)
        t = Math.max(0, Math.min(1, t))
        const idx = Math.min(SHADES.length - 1, Math.floor(t * SHADES.length))
        toepfe[idx].push(ia, ib)
    }
    // fern zuerst zeichnen, damit nahe (helle) Kanten obenauf liegen
    for (let s = SHADES.length - 1; s >= 0; s--) {
        const topf = toepfe[s]
        ctx.strokeStyle = SHADES[s]
        ctx.beginPath()
        for (let j = 0; j < topf.length; j += 2) {
            const ia = topf[j]
            const ib = topf[j + 1]
            ctx.moveTo(psx[ia], psy[ia])
            ctx.lineTo(psx[ib], psy[ib])
        }
        ctx.stroke()
    }

    // Vertex-Punkte zuletzt, damit sie ueber den Kanten liegen — man soll
    // sehen, was greifbar ist, nicht was davor gezeichnet wurde.
    if (editMode) {
        // Gummiband vom Anker zum Cursor. Es ist die einzige Rueckmeldung,
        // dass eine Verbindung aussteht: vorher sah man dem Bild nicht an, ob
        // der naechste Shift-Klick eine Kante zieht oder nur einen Anker setzt,
        // und genau daran ist das Verbinden gescheitert.
        // Gestrichelt, weil es noch keine Kante ist. setLineDash geht danach
        // zurueck — die Kanten im naechsten Frame teilen sich den Kontext.
        // getBoundingClientRect() einmal pro Frame ist hier vertretbar, anders
        // als bei jeder Mausbewegung.
        if (anker !== -1 && psz[anker] > NAH_GRENZE) {
            const c = leinwandPos(mausClient.x, mausClient.y)
            ctx.strokeStyle = ANKER_FARBE
            ctx.setLineDash([6, 6])
            ctx.beginPath()
            ctx.moveTo(psx[anker], psy[anker])
            ctx.lineTo(c.x, c.y)
            ctx.stroke()
            ctx.setLineDash([])
        }
        ctx.fillStyle = DOT_FARBE
        const halb = DOT_GROESSE / 2
        for (let i = 0; i < mesh.length; i++) {
            if (psz[i] <= NAH_GRENZE) continue
            // Dieselbe Bedingung wie beim Picken, und das ist der Punkt: was du
            // siehst, ist genau das, was du treffen kannst. Vorher lagen die
            // Punkte der weggeschnittenen Haelfte weiter im Bild und sahen aus
            // wie greifbare Ecken.
            if (!sichtbar[i]) continue
            ctx.fillRect(psx[i] - halb, psy[i] - halb, DOT_GROESSE, DOT_GROESSE)
        }
        // Der Anker als groesster Fleck und ganz unten in der Reihenfolge: der
        // gegriffene Punkt darf ihn ueberdecken, wenn beide derselbe sind —
        // was man anfasst, ist die dringendere Information.
        // Die Tiefenpruefung wie bei den Punkten: dreht man ihn nach hinten
        // durch die Kamera, sind psx/psy Muell und der Fleck landet irgendwo.
        if (anker !== -1 && psz[anker] > NAH_GRENZE) {
            const aHalb = ANKER_GROESSE / 2
            ctx.fillStyle = ANKER_FARBE
            ctx.fillRect(psx[anker] - aHalb, psy[anker] - aHalb,
                ANKER_GROESSE, ANKER_GROESSE)
        }
        // Der gegriffene Vertex danach und in Rot: groesser als die ockernen
        // Punkte, damit man ihn zwischen ihnen findet, und obenauf, damit ein
        // benachbarter Punkt ihn nicht verdeckt.
        if (gegriffen !== -1 && psz[gegriffen] > NAH_GRENZE) {
            const gHalb = GEGRIFFEN_GROESSE / 2
            ctx.fillStyle = GEGRIFFEN_FARBE
            ctx.fillRect(psx[gegriffen] - gHalb, psy[gegriffen] - gHalb,
                GEGRIFFEN_GROESSE, GEGRIFFEN_GROESSE)
        }
        // Rahmen um die ganze Leinwand. Um die halbe Dicke nach innen gesetzt,
        // weil strokeRect die Linie auf dem Pfad zentriert — sonst liegt die
        // aeussere Haelfte ausserhalb und man sieht nur den halben Rand.
        // lineWidth wird danach zurueckgestellt: die Kanten im naechsten Frame
        // zeichnen mit demselben Kontext und waeren sonst fett.
        ctx.strokeStyle = RAND_FARBE
        ctx.lineWidth = RAND_DICKE
        ctx.strokeRect(RAND_DICKE / 2, RAND_DICKE / 2,
            leinwand.width - RAND_DICKE, leinwand.height - RAND_DICKE)
        ctx.lineWidth = 1
    }
    // ponytail: setTimeout statt requestAnimationFrame — driftet unter Last
    // und laeuft im Hintergrundtab weiter. Upgrade auf rAF, falls das stoert.
    setTimeout(frame, 1000 / FPS);
}
setTimeout(frame, 1000 / FPS);
