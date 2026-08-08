// ============================================================================
//  obj2model — macht aus einer .obj-Datei eine .js im Format deiner Modelle
// ============================================================================
//
//  BENUTZUNG: unten die vier Werte eintragen, Datei in WebStorm oeffnen,
//  gruener Pfeil. Fertig. Kein Argument, keine Kommandozeile.
//
//  Das Ergebnis ist eine Datei mit  { vs: [...], fs: [...] }  und einem
//  export default — genau wie cube.js oder pyramid.js. Im Renderer dann:
//      import hand from "./modelle/hand.js";
//
//  LAEUFT NICHT? Wenn Node "require is not defined" meldet, hat deine
//  package.json  "type": "module". Dann diese Datei in obj2model.CJS
//  umbenennen — die Endung sagt Node "das hier ist CommonJS". Sonst nichts.
//
// ============================================================================
//  HIER EINTRAGEN
// ============================================================================

// Pfad zur .obj. Am sichersten ABSOLUT (mit / am Anfang) — dann ist egal,
// was in der Run Configuration als "Working directory" steht.
// Relativ geht auch, wird dann aber von genau diesem Working directory
// aus gezaehlt, nicht vom Speicherort dieser Datei.
// Findet er nichts, meldet Node ENOENT mit dem Pfad den er gesucht hat.
const OBJ_DATEI = "//home/saosgone/Schreibtisch/coding/dick_lp.obj";

// Wohin die fertige .js geschrieben wird. Gleiche Regel wie oben:
// absolut = eindeutig, relativ = vom Working directory aus.
// Der Ordner wird angelegt falls es ihn nicht gibt.
const AUSGABE_ORDNER = "/home/saosgone/Schreibtisch/coding/obj2model";

// Name der Konstante in der erzeugten Datei UND ihr Dateiname.
// Leer lassen ("") = wird aus dem .obj-Dateinamen abgeleitet.
// Selbst setzen lohnt, wenn die .obj kryptisch heisst (16834_hand_v1_NEW).
// Muss ein gueltiger JS-Bezeichner sein: keine Leerzeichen, keine Bindestriche,
// nicht mit einer Ziffer anfangen.
const MODELL_NAME = "dick01";

// Halbe Ausdehnung des fertigen Modells. Bei 1.2 reicht es von -1.2 bis +1.2,
// zentriert um 0,0,0. Passt zu deinen anderen Modellen und zu screen(),
// das -1..1 auf die Leinwand abbildet. Groesser = Modell fuellt mehr Bild.
const GROESSE = 1.2;

// z spiegeln. In deinem Renderer teilt magic() durch z, also ist KLEINERES z
// naeher an der Kamera. Die meisten .obj kommen aus Programmen, wo es umgekehrt
// ist. Ohne Spiegelung schaust du das Modell von innen an.
// Auf false stellen, falls ein Modell verkehrt herum wirkt.
const Z_SPIEGELN = true;

// ============================================================================
//  ab hier nichts mehr eintragen
// ============================================================================

const fs = require("fs");
const path = require("path");

// ---------- parsen ----------
//   v x y z          -> ein Vertex
//   f 1 2 3          -> eine Flaeche, Indizes AB 1 (nicht ab 0!) — daher das -1
//   f 1//1 2//2      -> mit Normalen-Index, wir nehmen nur den Teil vor dem Slash
const vs = [];
const faces = [];

for (const line of fs.readFileSync(OBJ_DATEI, "utf8").split("\n")) {
  const t = line.trim();
  if (t.startsWith("v ")) {
    const [, x, y, z] = t.split(/\s+/);
    vs.push({ x: +x, y: +y, z: +z });
  } else if (t.startsWith("f ")) {
    faces.push(
        t.split(/\s+/).slice(1).map((tok) => parseInt(tok.split("/")[0], 10) - 1)
    );
  }
}

// ---------- zentrieren + skalieren ----------
// Bounding-Box-Mitte auf 0,0,0 schieben, dann so skalieren dass die
// groesste der drei Halb-Ausdehnungen genau GROESSE ist.
const mid = {};
const half = {};
for (const k of ["x", "y", "z"]) {
  const v = vs.map((q) => q[k]);
  const lo = Math.min(...v);
  const hi = Math.max(...v);
  mid[k] = (lo + hi) / 2;
  half[k] = (hi - lo) / 2;
}
const f = GROESSE / Math.max(half.x, half.y, half.z);
const zf = Z_SPIEGELN ? -1 : 1;

const out = vs.map((v) => ({
  x: +((v.x - mid.x) * f).toFixed(3),
  y: +((v.y - mid.y) * f).toFixed(3),
  z: +((v.z - mid.z) * f * zf).toFixed(3),
}));

// ---------- schreiben ----------
let name = MODELL_NAME;
if (!name) {
  name = path.basename(OBJ_DATEI, ".obj").replace(/[^a-zA-Z0-9]/g, "_");
  // fuehrende Ziffer waere kein gueltiger JS-Bezeichner
  if (/^[0-9]/.test(name)) name = "m" + name;
}

const body =
    `const ${name} = {\n` +
    `  vs: [\n` +
    out.map((v) => `    {x: ${v.x}, y: ${v.y}, z: ${v.z}},`).join("\n") +
    `\n  ],\n  fs: [\n` +
    faces.map((f) => `    [${f.join(",")}],`).join("\n") +
    `\n  ]\n};\nexport default ${name};\n`;

fs.mkdirSync(AUSGABE_ORDNER, { recursive: true });
const ziel = path.join(AUSGABE_ORDNER, name + ".js");
fs.writeFileSync(ziel, body);

console.log(`${ziel} — ${out.length} vs, ${faces.length} fs`);