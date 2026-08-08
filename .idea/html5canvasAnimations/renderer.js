import {importModel} from "./modelle/modelle.js";
console.log(leinwand)
leinwand.width = 800
leinwand.height = 800
const BACKGROUND = '#000000'
const FOREGROUND = '#155545'
const ctx = leinwand.getContext("2d")
console.log(ctx)
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
    const dy = (e.clientY - letzte.y) * 0.01   // vertikal
    // um die BILDSCHIRM-Achsen drehen: horizontal -> Y, vertikal -> X
    mesh = mesh.map(v => rotate_yz(rotate_xz(v, dx), dy))
    letzte = {x: e.clientX, y: e.clientY}
})
// 'Modelle ' ----------------------------------------
const model = importModel("car")
const vs = model.vs
const fs = model.fs
//----------------------------------------------------
function translate_z({x, y, z}, dz) {
    return {x, y, z: z + dz};
}
function rotate_xz({x, y, z}, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return {
        x: x * c - z * s,
        y,
        z: x * s + z * c,
    }
}
function rotate_xy({x, y, z}, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return {
        x: x * c - y * s,
        y: x * s + y * c,
        z,
    }
}
function rotate_yz({x, y, z}, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return {
        x,
        y: y * c - z * s,
        z: y * s + z * c,
    }
}
let dz = 5;  // wo start ??

// --- Tiefen-Shading: Kanten nach Entfernung einfaerben (nah hell, fern dunkel)
// Palette aendern = nur dieses Array; der Rest passt sich an SHADES.length an.
const SHADES = ["#7395ec", "#5585ff", "rgb(53 95 201 / 1)", "rgb(23 53 131 / 1)"]
// z-Fenster: dz ist die Mitte, +-Wert steuert wie stark die Staffelung greift.
// Enger (z.B. 1.2) = kraeftigerer Kontrast. dz muss vorher deklariert sein!
const Z_NAH  = dz - 1.8
const Z_FERN = dz + 1.8

// Orientierung als bereits gedrehte Vertizes. Start = dein Preset, einmal
// eingebacken. Danach dreht nur noch das Ziehen weiter.
let mesh = vs.map(v => rotate_xy(rotate_xz(v, 5.5), 4.678))


function frame() {
    const dt = 0.5 / FPS // 0.5 /FPS  == SPEED of translate
    //dz += 0.25*dt
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
    setTimeout(frame, 1000 / FPS);
}
setTimeout(frame, 1000 / FPS);