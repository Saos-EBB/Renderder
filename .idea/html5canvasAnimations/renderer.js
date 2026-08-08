import {importModel} from "./modelle/modelle.js";
leinwand.width = 800
leinwand.height = 800
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
// --- Maussteuerung ---
let ziehen = false
let letzte = {x: 0, y: 0}
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
    const dx = (e.clientX - letzte.x) * 0.01   // horizontal
    const dy = (letzte.y - e.clientY) * 0.01   // vertikal (invertiert)
    // um die BILDSCHIRM-Achsen drehen: horizontal -> Y, vertikal -> X
    mesh = mesh.map(v => rotate(rotate(v, dx, ["x", "z"]), dy, ["y", "z"]))
    letzte = {x: e.clientX, y: e.clientY}
})
// 'Modelle ' ----------------------------------------
const model = importModel("teapot")
const vs = model.vs
const fs = model.fs
//----------------------------------------------------
let dz = 2.5;  // wo start ??


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
// z-Fenster: dz ist die Mitte, +-Wert steuert wie stark die Staffelung greift.
// Enger (z.B. 1.2) = kraeftigerer Kontrast. dz muss vorher deklariert sein!
const Z_NAH  = dz - 1.8
const Z_FERN = dz + 1.8

// Orientierung als bereits gedrehte Vertizes. Start = dein Preset, einmal
// eingebacken. Danach dreht nur noch das Ziehen weiter.
let mesh = vs.map(v => rotate(rotate(v, 5.5, ["x", "z"]), 4.678, ["x", "y"]))


function frame() {
    clear()


    //render lines + rotate + tiefen-shading
    // Kanten in Helligkeits-Toepfe sortieren statt sofort zu zeichnen
    const toepfe = SHADES.map(() => [])
    for (const f of fs) {
        for (let i = 0; i < f.length; i++) {
            // rotate + translate, z BLEIBT erhalten (magic wirft es sonst weg)
            const a = translate_z(mesh[f[i]], dz)
            const b = translate_z(mesh[f[(i + 1) % f.length]], dz)
            // mittlere Tiefe der Kante -> Farbindex
            let t = (((a.z + b.z) / 2) - Z_NAH) / (Z_FERN - Z_NAH)
            t = Math.max(0, Math.min(1, t))
            const idx = Math.min(SHADES.length - 1, Math.floor(t * SHADES.length))
            toepfe[idx].push([screen(magic(a)), screen(magic(b))])
        }
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