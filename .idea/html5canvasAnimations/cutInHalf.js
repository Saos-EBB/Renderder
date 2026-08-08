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

// ============================================================================
//  ab hier nichts mehr eintragen
// ============================================================================

const fs = require("fs");

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
