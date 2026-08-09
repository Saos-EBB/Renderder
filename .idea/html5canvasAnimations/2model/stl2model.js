// ============================================================================
//  stl2model — macht aus einer .stl-Datei eine .js im Format deiner Modelle
// ============================================================================
//
//  BENUTZUNG: unten die fuenf Werte eintragen, Datei in WebStorm oeffnen,
//  gruener Pfeil. Fertig. Kein Argument, keine Kommandozeile.
//
//  Das Ergebnis ist eine Datei mit  { vs: [...], fs: [...] }  und einem
//  export default — genau wie cube.js oder skull.js. Danach in modelle.js
//  den Namen in die Liste eintragen, dann im Renderer:
//      const model = await importModel("skull")
//
//  LAEUFT NICHT? Wenn Node "require is not defined" meldet, hat deine
//  package.json  "type": "module". Dann diese Datei in stl2model.CJS
//  umbenennen — die Endung sagt Node "das hier ist CommonJS". Sonst nichts.
//
//  UNTERSCHIED ZU obj2model: eine .obj hat geteilte Vertices und Indizes, eine
//  .stl nicht. Dort ist jedes Dreieck einfach drei rohe Koordinaten-Tripel —
//  dieselbe Ecke steht so oft in der Datei, wie Dreiecke an ihr haengen. Das
//  Zielformat ist aber indiziert, also werden identische Vertices hier
//  zusammengefasst ("welden") und die Faces auf die neuen Indizes umgeschrieben.
//
// ============================================================================
//  HIER EINTRAGEN
// ============================================================================

// Pfad zur .stl. Am sichersten ABSOLUT (mit / am Anfang) — dann ist egal,
// was in der Run Configuration als "Working directory" steht.
// Relativ geht auch, wird dann aber von genau diesem Working directory
// aus gezaehlt, nicht vom Speicherort dieser Datei.
// Findet er nichts, meldet Node ENOENT mit dem Pfad den er gesucht hat.
//
// Darf eine einzelne .stl sein ODER ein ganzer Ordner. Beim Ordner wird jede
// .stl darin umgewandelt — nicht rekursiv, Unterordner bleiben aussen vor.
// Eine kaputte Datei haelt den Stapel nicht auf, sie wird gemeldet und
// uebersprungen. Genau der Fall skullwithbrain.stl.
const STL_QUELLE = "/home/saosgone/Schreibtisch/coding/stlFiles/Duo Baldurs Gate.stl"
// Wohin die fertige .js geschrieben wird. Gleiche Regel wie oben:
// absolut = eindeutig, relativ = vom Working directory aus.
// Der Ordner wird angelegt falls es ihn nicht gibt.
// Standard ist direkt der Modellordner des Renderers — dann entfaellt das
// Herueberschieben von Hand.
const AUSGABE_ORDNER = "/home/saosgone/Schreibtisch/coding/.idea/html5canvasAnimations/modelle";

// Die Namensliste des Renderers. Jeder erzeugte Name wird dort eingetragen,
// falls er noch fehlt — sonst kennt importModel das neue Modell nicht.
// Muss zu AUSGABE_ORDNER passen: die Liste laedt "./modelle/<name>.js"
// relativ zu sich selbst.
const MODELLE_JS = "/home/saosgone/Schreibtisch/coding/.idea/html5canvasAnimations/modelle.js";

// Name der Konstante in der erzeugten Datei UND ihr Dateiname.
// Leer lassen ("") = wird aus dem .stl-Dateinamen abgeleitet.
// Selbst setzen lohnt, wenn die .stl kryptisch heisst (12327_Statue_V1_L3).
// Muss ein gueltiger JS-Bezeichner sein: keine Leerzeichen, keine Bindestriche,
// nicht mit einer Ziffer anfangen.
// Gilt nur bei einer einzelnen Datei. Zeigt STL_QUELLE auf einen Ordner, wird
// dieser Wert ignoriert — zwanzig Dateien koennen nicht denselben Namen haben,
// jede bekommt dann ihren aus dem Dateinamen.
const MODELL_NAME = "duoOG";

// Halbe Ausdehnung des fertigen Modells. Bei 1.2 reicht es von -1.2 bis +1.2,
// zentriert um 0,0,0. Passt zu deinen anderen Modellen und zu screen(),
// das -1..1 auf die Leinwand abbildet. Groesser = Modell fuellt mehr Bild.
const GROESSE = 1.2;

// z spiegeln. In deinem Renderer teilt magic() durch z, also ist KLEINERES z
// naeher an der Kamera. Die meisten .stl kommen aus Programmen, wo es umgekehrt
// ist. Ohne Spiegelung schaust du das Modell von innen an.
// Auf false stellen, falls ein Modell verkehrt herum wirkt.
const Z_SPIEGELN = true;

// ============================================================================
//  ab hier nichts mehr eintragen
// ============================================================================

const fs = require("fs");
const path = require("path");

// ---------- binaer lesen ----------
//   80 Byte Header, dann uint32 mit der Dreieckszahl, dann pro Dreieck
//   50 Byte: 12 floats (Normale xyz + 3x Vertex xyz) + 2 Byte Attribut.
//   Alles Little-Endian.
//   Die Normale wird uebersprungen — das Zielformat kennt keine, genau wie
//   obj2model die Normalen-Indizes hinter dem Slash wegwirft.
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

// Dateiname -> Modellname. Leerzeichen werden zu _, wie gewuenscht. Alles
// andere, was in einem JS-Bezeichner nicht vorkommen darf — Punkte, Klammern,
// Striche — muss es allerdings auch, denn der Name steht in der erzeugten
// Datei als "const <name> = {...}". Aus "F 011 - Dragon (X).stl" wird so
// F_011_Dragon_X.
function nameAus(datei) {
  let name = path.basename(datei, path.extname(datei))
      .replace(/[^a-zA-Z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
  // fuehrende Ziffer waere kein gueltiger JS-Bezeichner
  if (/^[0-9]/.test(name)) name = "m" + name;
  // bliebe nichts uebrig, schrieben wir "const  = {...}" — kaputtes JS
  return name || "modell";
}

// Traegt den Namen in die Liste in modelle.js ein, falls er noch fehlt.
// Ohne diesen Schritt liegt die .js zwar am richtigen Ort, importModel kennt
// sie aber nicht. Rueckgabe: true wenn neu eingetragen.
function inListeEintragen(name) {
  const quelle = fs.readFileSync(MODELLE_JS, "utf8");
  const ende = quelle.indexOf("];");
  if (ende < 0) {
    throw new Error(`${MODELLE_JS}: Liste "const models = [ ... ];" nicht gefunden.`);
  }
  const vorher = quelle.slice(0, ende);
  if (vorher.includes(`"${name}"`)) return false;
  // fehlendes Komma hinter dem letzten Eintrag wuerde die Liste zerlegen
  const getrimmt = vorher.trimEnd();
  const komma = getrimmt.endsWith(",") || getrimmt.endsWith("[") ? "" : ",";
  fs.writeFileSync(MODELLE_JS, `${getrimmt}${komma}\n    "${name}",\n${quelle.slice(ende)}`);
  return true;
}

// Wandelt genau eine .stl um. nameVorgabe leer = Name aus dem Dateinamen.
function umwandeln(stlDatei, nameVorgabe) {
// ohne Encoding-Argument gibt readFileSync einen Buffer zurueck. Wichtig:
// binaere .stl als utf8 zu lesen zerstoert die Floats (ungueltige Bytes werden
// durch U+FFFD ersetzt), und binaer ist der Normalfall.
const buf = fs.readFileSync(stlDatei);

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
      `${stlDatei} ist weder gueltiges Binaer-STL noch ASCII-STL.\n` +
      `  Dateigroesse ${buf.length} Byte, der Header meldet ${anzahl} Dreiecke — ` +
      `das waeren ${84 + anzahl * 50} Byte.\n` +
      `  Kein "facet" in den ersten 4096 Byte, also auch kein ASCII.\n` +
      `  Datei vermutlich beschaedigt oder abgeschnitten: in MeshLab oder ` +
      `Blender oeffnen und neu als STL exportieren.`
  );
}

if (dreiecke.length === 0) {
  throw new Error(`${stlDatei} enthaelt keine Dreiecke.`);
}

// Der Renderer ist ein Software-Renderer: er rechnet jede Kante pro Frame in JS
// durch. Ein paar tausend Dreiecke sind sein Arbeitsbereich, nicht Millionen.
// Dezimieren macht dieses Skript NICHT — das gehoert nach MeshLab (Filters >
// Remeshing > Quadric Edge Collapse Decimation) oder Blender (Decimate-Modifier).
if (dreiecke.length > 50000) {
  console.warn(
      `WARNUNG: ${dreiecke.length} Dreiecke — zu viele fuer den Software-Renderer.\n` +
      `         Vorher dezimieren (MeshLab/Blender), sonst ruckelt das Drehen\n` +
      `         oder der Tab friert ein. Die .js wird trotzdem geschrieben.`
  );
}

// ---------- zentrieren + skalieren ----------
// Wie in obj2model: Bounding-Box-Mitte auf 0,0,0 schieben, dann so skalieren
// dass die groesste der drei Halb-Ausdehnungen genau GROESSE ist. Nur laeuft es
// hier ueber die rohen Dreiecks-Ecken — indiziert wird erst danach.
const mid = [0, 0, 0];
const half = [0, 0, 0];
for (const k of [0, 1, 2]) {
  let lo = Infinity, hi = -Infinity;
  for (const d of dreiecke) {
    for (const e of d) {
      if (e[k] < lo) lo = e[k];
      if (e[k] > hi) hi = e[k];
    }
  }
  mid[k] = (lo + hi) / 2;
  half[k] = (hi - lo) / 2;
}
const f = GROESSE / Math.max(half[0], half[1], half[2]);
const zf = Z_SPIEGELN ? -1 : 1;

// ---------- welden ----------
// Der eigentliche Unterschied zu obj2model. .stl kennt keine geteilten
// Vertices: eine Ecke, an der 6 Dreiecke haengen, steht 6x in der Datei.
// Ungeweldet waere vs dreimal so lang wie noetig und fs bloss
// [0,1,2],[3,4,5],... — also Map von Koordinate auf Index.
// Geweldet wird auf den FERTIGEN, gerundeten Werten: der String ist als
// Schluessel eindeutig (kein Float-Vergleich noetig) und entspricht exakt dem,
// was gleich in der Datei landet.
const out = [];
const index = new Map();
const faces = [];

for (const d of dreiecke) {
  const face = [];
  for (const e of d) {
    const x = +((e[0] - mid[0]) * f).toFixed(3);
    const y = +((e[1] - mid[1]) * f).toFixed(3);
    const z = +((e[2] - mid[2]) * f * zf).toFixed(3);
    const key = `${x},${y},${z}`;
    let i = index.get(key);
    if (i === undefined) {
      i = out.length;
      index.set(key, i);
      out.push({ x, y, z });
    }
    face.push(i);
  }
  faces.push(face);
}

// ---------- schreiben ----------
const name = nameVorgabe || nameAus(stlDatei);

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

const neu = inListeEintragen(name);
console.log(`${format}, ${dreiecke.length} Dreiecke = ${dreiecke.length * 3} rohe Ecken -> ${out.length} nach dem Welden`);
console.log(`${ziel} — ${out.length} vs, ${faces.length} fs` +
    (neu ? `, als "${name}" eingetragen` : `, "${name}" stand schon in der Liste`));
}

// ---------- einzelne datei oder ganzer ordner? ----------
if (fs.statSync(STL_QUELLE).isDirectory()) {
  const dateien = fs.readdirSync(STL_QUELLE)
      .filter((n) => n.toLowerCase().endsWith(".stl"))
      .sort();
  if (dateien.length === 0) {
    throw new Error(`${STL_QUELLE} enthaelt keine .stl-Dateien.`);
  }
  let fehler = 0;
  for (const n of dateien) {
    // eine kaputte Datei darf den Rest des Stapels nicht aufhalten
    try {
      umwandeln(path.join(STL_QUELLE, n), "");
    } catch (e) {
      fehler++;
      console.error(`${n} uebersprungen: ${e.message}`);
    }
  }
  console.log(`${dateien.length - fehler} von ${dateien.length} umgewandelt`);
} else {
  umwandeln(STL_QUELLE, MODELL_NAME);
}
