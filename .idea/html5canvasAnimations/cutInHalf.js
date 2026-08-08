// ============================================================================
//  cutInHalf — dezimiert eine zu grosse .stl per Vertex-Clustering zu einer
//              kleineren .stl
// ============================================================================
//
//  BENUTZUNG: unten die Werte eintragen, Datei in WebStorm oeffnen, gruener
//  Pfeil. Fertig. Kein Argument, keine Kommandozeile.
//
//  WOFUER: der Renderer ist ein Software-Renderer auf Canvas und schafft
//  ungefaehr 40.000 Vertizes. Echte .stl aus dem Netz haben das Zwanzigfache.
//  cutInHalf faellt zwischen Download und stl2model: .stl rein, kleinere .stl
//  raus, danach wie gewohnt stl2model drueberlaufen lassen.
//
//  LAEUFT NICHT? Wenn Node "require is not defined" meldet, hat deine
//  package.json  "type": "module". Dann diese Datei in cutInHalf.CJS
//  umbenennen — die Endung sagt Node "das hier ist CommonJS". Sonst nichts.
//
//  WAS DIESES SKRIPT NICHT MACHT: zentrieren, skalieren, spiegeln. Es fasst
//  ausschliesslich Vertices zusammen. Groesse und Ausrichtung fuers Rendern
//  macht danach stl2model — hier wuerde es die Zellgroesse verfaelschen.
//
// ============================================================================
//  HIER EINTRAGEN
// ============================================================================

// Pfad zur .stl. Am sichersten ABSOLUT (mit / am Anfang) — dann ist egal,
// was in der Run Configuration als "Working directory" steht.
// Relativ geht auch, wird dann aber von genau diesem Working directory
// aus gezaehlt, nicht vom Speicherort dieser Datei.
// Findet er nichts, meldet Node ENOENT mit dem Pfad den er gesucht hat.
const STL_DATEI = "/home/saosgone/Schreibtisch/coding/stlFiles/skull.stl";

// Zellen pro laengster Achse — DER Hebel. Die Zellgroesse ist die groesste
// Bounding-Box-Ausdehnung geteilt durch diesen Wert, alle Ecken in derselben
// Zelle werden zu einer.
// Groesser = feiner = mehr Dreiecke. Kleiner = groeber = weniger.
// Weil die Zellgroesse aus der eigenen Ausdehnung des Meshes kommt, bedeutet
// GITTER=64 bei jedem Modell dasselbe, egal in welcher Einheit es vorliegt.
// Es gibt KEINE Zielvorgabe: du drehst hier, liest im Log die Vertex-Zahl und
// drehst nochmal. Ziel sind ungefaehr 40.000 — mehr vertraegt der Renderer
// nicht. Zwischen GITTER und Vertex-Zahl liegt die Form der Oberflaeche,
// zwei bis drei Laeufe sind normal.
const GITTER = 64;

// Wohin die verkleinerte .stl geschrieben wird. Gleiche Regel wie oben:
// absolut = eindeutig, relativ = vom Working directory aus.
// Der Ordner wird angelegt falls es ihn nicht gibt. Der Dateiname entsteht aus
// dem Original plus dem GITTER — so ueberschreibt der naechste Versuch den
// vorigen nicht, und du siehst der Datei an, mit welchem Wert sie entstand.
const AUSGABE_ORDNER = "/home/saosgone/Schreibtisch/coding/stlFiles";

// ============================================================================
//  ab hier nichts mehr eintragen
// ============================================================================

const fs = require("fs");
const path = require("path");

// ohne Encoding-Argument gibt readFileSync einen Buffer zurueck. Wichtig:
// binaere .stl als utf8 zu lesen zerstoert die Floats (ungueltige Bytes werden
// durch U+FFFD ersetzt), und binaer ist der Normalfall.
const buf = fs.readFileSync(STL_DATEI);

// ---------- binaer lesen ----------
//   80 Byte Header, dann uint32 mit der Dreieckszahl, dann pro Dreieck
//   50 Byte: 12 floats (Normale xyz + 3x Vertex xyz) + 2 Byte Attribut.
//   Alles Little-Endian.
//   Die Normale wird uebersprungen — geclustert wird ueber Positionen, und
//   die Ausgabe schreibt ohnehin Null-Normalen.
function binaerLesen(buf, anzahl) {
  const out = [];
  for (let i = 0; i < anzahl; i++) {
    const p = 84 + i * 50 + 12;   // +12 = ueber die Normale hinweg
    out.push([
      [buf.readFloatLE(p),      buf.readFloatLE(p + 4),  buf.readFloatLE(p + 8)],
      [buf.readFloatLE(p + 12), buf.readFloatLE(p + 16), buf.readFloatLE(p + 20)],
      [buf.readFloatLE(p + 24), buf.readFloatLE(p + 28), buf.readFloatLE(p + 32)],
    ]);
  }
  return out;
}

// ---------- ascii lesen ----------
//   solid name / facet normal nx ny nz / outer loop / vertex x y z (3x) /
//   endloop / endfacet / endsolid
//   Wir sammeln stumpf alle "vertex"-Zeilen und schneiden sie in Dreierpakete.
//   Die facet-normal-Zeilen fallen dabei von selbst weg.
function asciiLesen(text) {
  const ecken = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("vertex ")) continue;
    const [, x, y, z] = t.split(/\s+/);
    ecken.push([+x, +y, +z]);
  }
  const out = [];
  for (let i = 0; i + 2 < ecken.length; i += 3) {
    out.push([ecken[i], ecken[i + 1], ecken[i + 2]]);
  }
  return out;
}

// ---------- binaer oder ascii? ----------
// Dem Header ist nicht zu trauen: skullwithbrain.stl traegt zwar "MESHMIXER-
// STL-BINARY-FORMAT" vorne drin, meldet aber 93972 Dreiecke bei einer Datei,
// in die 1397756 passen. Verlaesslich ist nur die Rechnung
// 80 Byte Header + 4 Byte Anzahl + 50 Byte pro Dreieck == Dateigroesse.
// Geht die nicht auf und steht auch kein "facet" drin, wird abgebrochen statt
// still Muell zu schreiben.
const anzahl = buf.length >= 84 ? buf.readUInt32LE(80) : 0;
let dreiecke;
let format;

if (buf.length === 84 + anzahl * 50) {
  format = "binaer";
  dreiecke = binaerLesen(buf, anzahl);
} else if (buf.toString("utf8", 0, 4096).includes("facet")) {
  format = "ascii";
  dreiecke = asciiLesen(buf.toString("utf8"));
} else {
  throw new Error(
      `${STL_DATEI} ist weder gueltiges Binaer-STL noch ASCII-STL.\n` +
      `  Dateigroesse ${buf.length} Byte, der Header meldet ${anzahl} Dreiecke — ` +
      `das waeren ${84 + anzahl * 50} Byte.\n` +
      `  Kein "facet" in den ersten 4096 Byte, also auch kein ASCII.\n` +
      `  Datei vermutlich beschaedigt oder abgeschnitten: in MeshLab oder ` +
      `Blender oeffnen und neu als STL exportieren.`
  );
}

if (dreiecke.length === 0) {
  throw new Error(`${STL_DATEI} enthaelt keine Dreiecke.`);
}

console.log(`${format}, ${dreiecke.length} Dreiecke gelesen`);

// ---------- gitter ----------
// Bounding-Box ueber alle Ecken. Bewusst KEIN Zentrieren und KEIN Skalieren:
// die Zellgroesse leitet sich aus der eigenen Ausdehnung des Meshes ab, damit
// ist das Ergebnis von der Einheit der Datei unabhaengig. Groesse und
// Ausrichtung fuers Rendern macht spaeter stl2model.
const lo = [Infinity, Infinity, Infinity];
const hi = [-Infinity, -Infinity, -Infinity];
for (const d of dreiecke) {
  for (const e of d) {
    for (const k of [0, 1, 2]) {
      if (e[k] < lo[k]) lo[k] = e[k];
      if (e[k] > hi[k]) hi[k] = e[k];
    }
  }
}
const ausdehnung = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
if (ausdehnung === 0) {
  throw new Error(`${STL_DATEI}: alle Ecken liegen auf einem Punkt, nichts zu clustern.`);
}
const zellgroesse = ausdehnung / GITTER;

// In welche Zelle faellt eine Ecke? Die Ecke genau am oberen Rand landet
// rechnerisch in Zelle GITTER statt GITTER-1. Stoert nicht: die Zellen stehen
// in einer Map, nicht in einem Array fester Groesse.
function schluessel(e) {
  const ix = Math.floor((e[0] - lo[0]) / zellgroesse);
  const iy = Math.floor((e[1] - lo[1]) / zellgroesse);
  const iz = Math.floor((e[2] - lo[2]) / zellgroesse);
  return `${ix},${iy},${iz}`;
}

// ---------- snappen ----------
// Repraesentant einer Zelle ist das MITTEL aller Ecken die hineinfallen, nicht
// die Zellmitte: das Mittel liegt auf der echten Oberflaeche, die Zellmitte
// kann daneben im Leeren sitzen.
const zellen = new Map();
for (const d of dreiecke) {
  for (const e of d) {
    const key = schluessel(e);
    let z = zellen.get(key);
    if (z === undefined) {
      z = {x: 0, y: 0, z: 0, n: 0, idx: -1};
      zellen.set(key, z);
    }
    z.x += e[0];
    z.y += e[1];
    z.z += e[2];
    z.n++;
  }
}
for (const z of zellen.values()) {
  z.x /= z.n;
  z.y /= z.n;
  z.z /= z.n;
}

// ---------- dreiecke neu, entartete raus ----------
// Fallen zwei oder drei Ecken eines Dreiecks in dieselbe Zelle, ist es zu einer
// Linie oder einem Punkt kollabiert und faellt weg. DAS ist die Reduktion —
// im Gegensatz zu stl2model, wo entartete Faces stehenbleiben duerfen, weil es
// dort ums Indizieren geht und nicht ums Verkleinern.
// Vergleich ueber Objektidentitaet: dieselbe Zelle ist dasselbe Map-Objekt.
const vertizes = [];   // Repraesentanten in Reihenfolge des ersten Auftretens
const neu = [];        // Dreiecke als Index-Tripel
for (const d of dreiecke) {
  const za = zellen.get(schluessel(d[0]));
  const zb = zellen.get(schluessel(d[1]));
  const zc = zellen.get(schluessel(d[2]));
  if (za === zb || zb === zc || za === zc) continue;
  for (const z of [za, zb, zc]) {
    if (z.idx < 0) {
      z.idx = vertizes.length;
      vertizes.push(z);
    }
  }
  neu.push([za.idx, zb.idx, zc.idx]);
}

if (neu.length === 0) {
  throw new Error(
      `GITTER=${GITTER} ist zu grob — alle ${dreiecke.length} Dreiecke sind ` +
      `kollabiert. Groesseren Wert eintragen.`
  );
}

// ---------- binaer schreiben ----------
// 80 Byte Header, uint32 Dreieckszahl, dann 50 Byte je Dreieck:
// Normale 3x float32, drei Ecken je 3x float32, 2 Byte Attribut. Little-Endian.
// Buffer.alloc nullt den Speicher, deshalb bleiben Normale und Attribut
// einfach 0 — stl2model wirft die Normalen ohnehin weg, und ein
// Wireframe-Renderer braucht sie nicht.
// Was der Header sagt, ist egal; entscheidend ist, dass 84 + n * 50 exakt der
// Dateigroesse entspricht. Genau daran erkennt der Leser oben eine gueltige
// Datei — und daran scheitert skullwithbrain.stl.
const aus = Buffer.alloc(84 + neu.length * 50);
aus.write(`cutInHalf GITTER=${GITTER}`, 0, 80, "ascii");
aus.writeUInt32LE(neu.length, 80);
let p = 84;
for (const dreieck of neu) {
  p += 12;                       // Normale ueberspringen, bleibt 0,0,0
  for (const i of dreieck) {
    const v = vertizes[i];
    aus.writeFloatLE(v.x, p);
    aus.writeFloatLE(v.y, p + 4);
    aus.writeFloatLE(v.z, p + 8);
    p += 12;
  }
  p += 2;                        // Attribut ueberspringen, bleibt 0
}

fs.mkdirSync(AUSGABE_ORDNER, { recursive: true });
const basis = path.basename(STL_DATEI, path.extname(STL_DATEI));
const ziel = path.join(AUSGABE_ORDNER, `${basis}_g${GITTER}.stl`);
fs.writeFileSync(ziel, aus);

// ---------- report ----------
// Die Vertex-Zahl ist die Zahl auf die du hinarbeitest: rund 40.000 vertraegt
// der Renderer. Sie steht hier, damit du am GITTER drehen kannst, ohne jedes
// Mal stl2model laufen zu lassen.
const weg = dreiecke.length - neu.length;
console.log(`GITTER=${GITTER}, Zellgroesse ${zellgroesse.toFixed(4)}`);
console.log(`Dreiecke ${dreiecke.length} -> ${neu.length}  (${(100 * weg / dreiecke.length).toFixed(1)} % weg)`);
console.log(`eindeutige Vertizes: ${vertizes.length}  (belegte Zellen: ${zellen.size})`);
console.log(`${ziel} — ${aus.length} Byte`);
