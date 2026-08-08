import {importModel} from "./modelle/modelle.js";
leinwand.width = 1300
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
// 90 % (Index 0, nah) bis 18 % (Index 15, fern), also L = 90 - Index * 4.8.
// Einmal ausgerechnet und fest eingetragen — zur Laufzeit umzurechnen waere
// Arbeit pro Frame fuer ein Ergebnis, das sich nie aendert.
const SHADES = [
    "#d0e5fb",
    "#b9d9f9",
    "#a3cdf8",
    "#8cc1f6",
    "#75b5f4",
    "#5fa8f2",
    "#489cf0",
    "#3190ee",
    "#1b84ec",
    "#1277dd",
    "#106bc6",
    "#0e5faf",
    "#0c5399",
    "#0b4682",
    "#093a6c",
    "#072e55",
]

let dz = 2.5;  // wo start ??

// 'Modelle ' ----------------------------------------
// await, weil importModel jetzt dynamisch nachlaedt. Modell und mesh MUESSEN
// vor den Maus-Listenern stehen: die feuern sonst waehrend des await und
// greifen auf ein noch nicht initialisiertes mesh zu.
const model = await importModel("pochita30");
const fs = model.fs
//----------------------------------------------------

// Orientierung als bereits gedrehte Vertizes. Start = dein Preset, einmal
// eingebacken. Danach dreht nur noch das Ziehen weiter.
let mesh = model.vs.map(v => rotate(rotate(v, 5.5, ["x", "z"]), 4.678, ["x", "y"]))

// --- Cutaway: eine Schnittebene laesst eine Haelfte weg, damit man ins Modell
// hineinsieht. Getestet wird auf den ROHEN Modellkoordinaten, also vor der
// Rotation — die Ebene dreht dadurch mit dem Modell mit statt im Raum zu
// stehen. Das ist gewollt und spart das Zuruecktransformieren.
const ACHSE = "z"          // "x" | "y" | "z" — je nach Ausrichtung des Modells
let CUT = 0                // Modellkoordinate, sinnvoll etwa -1.2 .. 1.2
const CUT_SCHRITT = 0.05

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
function kantenBauen() {
    kanten = []
    const gesehen = new Set()
    for (const f of fs) {
        // Schwerpunkt auf der Schnittachse. Ueber f.length, nicht ueber 3:
        // aus .obj kommen auch Vierecke, aus .stl nur Dreiecke.
        let s = 0
        for (const i of f) s += model.vs[i][ACHSE]
        if (s / f.length > CUT) continue
        for (let i = 0; i < f.length; i++) {
            const a = f[i]
            const b = f[(i + 1) % f.length]
            const key = a < b ? `${a},${b}` : `${b},${a}`
            if (gesehen.has(key)) continue
            gesehen.add(key)
            kanten.push([a, b])
        }
    }
}
kantenBauen()

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

// --- Maussteuerung ---
let ziehen = false
let letzte = {x: 0, y: 0}
// aufgelaufene Drehung. mousemove feuert bis ~120x/s, das Mesh hat aber bis zu
// 110k Vertizes — pro Event drehen hiesse hunderttausende Objekte pro Sekunde
// neu allozieren. Hier nur Winkel addieren, gedreht wird einmal pro Frame.
let drehX = 0
let drehY = 0
// Zoom: rechte Taste halten + Mausrad. Multiplikativ statt fester Schritt —
// bei dz=10 waere ein fester Wert kaum sichtbar, bei dz=0.5 ein Sprung.
const ZOOM_SCHRITT = 1.1
// magic() teilt durch z. Ganz auf 0 lassen wir dz nicht runter, sonst steckt
// das Modell komplett hinter der Kamera und es bleibt nichts zu zeichnen.
const DZ_MIN = 0.3
leinwand.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return  // nur links dreht, rechts gehoert dem Zoom
    ziehen = true
    letzte = {x: e.clientX, y: e.clientY}
    e.preventDefault()          // verhindert Text-Markieren beim Ziehen
})
// ohne das poppt beim Rechtsklick das Browser-Menue auf — unter Linux schon
// beim Druecken, nicht erst beim Loslassen
leinwand.addEventListener("contextmenu", (e) => e.preventDefault())
// passive: false ist Pflicht, sonst ignoriert der Browser das preventDefault()
// und die Seite scrollt beim Zoomen mit
leinwand.addEventListener("wheel", (e) => {
    // e.buttons ist eine Bitmaske, Bit 2 = rechte Taste. Spart es, den
    // Tastenzustand ueber mousedown/mouseup selbst mitzuzaehlen.
    if (!(e.buttons & 2)) return
    e.preventDefault()
    // vorwaerts scrollen = deltaY negativ = Objekt weg von dir = groesseres dz.
    // Nur das Vorzeichen zaehlt: deltaY ist je nach Maus, Browser und deltaMode
    // mal 3, mal 100, bei Trackpads krumm.
    dz = e.deltaY < 0 ? dz * ZOOM_SCHRITT : dz / ZOOM_SCHRITT
    if (dz < DZ_MIN) dz = DZ_MIN
}, {passive: false})
// "," und "." fahren die Schnittebene durch das Modell. Die Kantenliste muss
// dabei neu gebaut werden — das kostet einmal pro Tastendruck, nicht pro Frame.
window.addEventListener("keydown", (e) => {
    if (e.key === ",") CUT -= CUT_SCHRITT
    else if (e.key === ".") CUT += CUT_SCHRITT
    else return
    kantenBauen()
})
// bewusst auf window, nicht auf leinwand: sonst bleibt das Modell haengen,
// sobald du beim Ziehen aus der Leinwand rausfaehrst
window.addEventListener("mouseup", () => { ziehen = false })
window.addEventListener("mousemove", (e) => {
    if (!ziehen) return
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

    //render lines + tiefen-shading
    // Kanten in Helligkeits-Toepfe sortieren statt sofort zu zeichnen
    const toepfe = SHADES.map(() => [])
    for (const [ia, ib] of kanten) {
        // translate, z BLEIBT erhalten (magic wirft es sonst weg)
        const a = translate_z(mesh[ia], dz)
        const b = translate_z(mesh[ib], dz)
        // hinter der Kamera: magic() wuerde die Kante sonst gespiegelt und
        // riesig ins Bild werfen. Beim Reinzoomen faehrt das Modell da durch.
        if (a.z <= 0.01 || b.z <= 0.01) continue
        // mittlere Tiefe der Kante -> Farbindex
        let t = (((a.z + b.z) / 2) - Z_NAH) / (Z_FERN - Z_NAH)
        t = Math.max(0, Math.min(1, t))
        const idx = Math.min(SHADES.length - 1, Math.floor(t * SHADES.length))
        toepfe[idx].push([screen(magic(a)), screen(magic(b))])
    }
    // fern zuerst zeichnen, damit nahe (helle) Kanten obenauf liegen
    for (let s = SHADES.length - 1; s >= 0; s--) {
        ctx.strokeStyle = SHADES[s]
        ctx.beginPath()
        for (const [a, b] of toepfe[s]) {
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
        }
        ctx.stroke()
    }
    // ponytail: setTimeout statt requestAnimationFrame — driftet unter Last
    // und laeuft im Hintergrundtab weiter. Upgrade auf rAF, falls das stoert.
    setTimeout(frame, 1000 / FPS);
}
setTimeout(frame, 1000 / FPS);
