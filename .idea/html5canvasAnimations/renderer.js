import {importModel} from "./modelle/modelle.js";
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
const FPS = 60;

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
const SHADES = ["#7395ec", "#5585ff", "rgb(53 95 201 / 1)", "rgb(23 53 131 / 1)"]

let dz = 2.5;  // wo start ??

// 'Modelle ' ----------------------------------------
// await, weil importModel jetzt dynamisch nachlaedt. Modell und mesh MUESSEN
// vor den Maus-Listenern stehen: die feuern sonst waehrend des await und
// greifen auf ein noch nicht initialisiertes mesh zu.
const model = await importModel("skull")
const fs = model.fs
//----------------------------------------------------

// Orientierung als bereits gedrehte Vertizes. Start = dein Preset, einmal
// eingebacken. Danach dreht nur noch das Ziehen weiter.
let mesh = model.vs.map(v => rotate(rotate(v, 5.5, ["x", "z"]), 4.678, ["x", "y"]))

// Eindeutige Kantenliste, einmal vorab: fs aendert sich nie, und benachbarte
// Faces teilen sich jede Kante — ohne das hier zeichnen wir jede Kante doppelt
// (bei skull 161472 statt 80736 pro Frame).
const kanten = []
const gesehen = new Set()
for (const f of fs) {
    for (let i = 0; i < f.length; i++) {
        const a = f[i]
        const b = f[(i + 1) % f.length]
        const key = a < b ? `${a},${b}` : `${b},${a}`
        if (gesehen.has(key)) continue
        gesehen.add(key)
        kanten.push([a, b])
    }
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

// --- Maussteuerung ---
let ziehen = false
let letzte = {x: 0, y: 0}
// aufgelaufene Drehung. mousemove feuert bis ~120x/s, das Mesh hat aber bis zu
// 110k Vertizes — pro Event drehen hiesse hunderttausende Objekte pro Sekunde
// neu allozieren. Hier nur Winkel addieren, gedreht wird einmal pro Frame.
let drehX = 0
let drehY = 0
leinwand.addEventListener("mousedown", (e) => {
    ziehen = true
    letzte = {x: e.clientX, y: e.clientY}
    e.preventDefault()          // verhindert Text-Markieren beim Ziehen
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
