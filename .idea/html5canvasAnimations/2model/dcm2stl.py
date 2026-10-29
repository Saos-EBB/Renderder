#!/usr/bin/env python3
# ============================================================================
#  dcm2stl — macht aus einer CT-Serie (.dcm) eine .stl per Knochen-Schwellwert
# ============================================================================
#
#  BENUTZUNG: unten die Werte eintragen, Datei in WebStorm oeffnen, gruener
#  Pfeil. Kein Argument, keine Kommandozeile — wie die anderen Werkzeuge hier.
#
#  WOFUER: eine .dcm ist ein Stapel Graustufenbilder, kein Modell. Zwischen
#  einem CT-Datensatz und deiner Kette fehlt der Schritt, der aus Grauwerten
#  eine Oberflaeche macht. Das ist dieses Skript. Die Kette wird damit:
#
#      .dcm-Serie → dcm2stl → grosse .stl → cutInHalf → kleine .stl
#                                                          → stl2model → modell.js
#
#  LAEUFT NICHT? Braucht python3 und sonst nichts — reine Standardbibliothek,
#  kein numpy, kein pydicom, kein pip install. In WebStorm muss unter
#  Settings > Project > Python Interpreter ein System-Python eingetragen sein,
#  sonst kennt der gruene Pfeil die Datei nicht.
#
#  WAS DIESES SKRIPT NICHT MACHT: zentrieren, skalieren, spiegeln (macht
#  stl2model), dezimieren (macht cutInHalf), und es kann nur CT. MR hat keine
#  absolute Intensitaetsskala — dort bedeutet "Grauwert 300" bei jedem Geraet
#  etwas anderes und ein fester Schwellwert findet keinen Knochen.
#
#  DER ORDNER MUSS GENAU EINE SERIE ENTHALTEN. Eine CT-Studie besteht meist aus
#  mehreren Serien (verschiedene Rekonstruktionen, mit und ohne Kontrastmittel),
#  und die in ein Volumen zu werfen ergibt Matsch. Das Skript prueft das und
#  bricht ab, statt still Unsinn zu schreiben.
#
# ============================================================================
#  HIER EINTRAGEN
# ============================================================================

# Ordner mit den .dcm-Dateien EINER Serie. Absolut, dann ist egal, was in der
# Run Configuration als "Working directory" steht.
DICOM_ORDNER = "/home/saosgone/Schreibtisch/LookAtMe/98890234_20030505_CT/98890234/20030505/CT/CT3"

# Wohin die .stl geschrieben wird, und wie sie heissen soll. Der Dateiname
# bekommt Schwelle und Verkleinerung angehaengt — so ueberschreibt der naechste
# Versuch den vorigen nicht, und du siehst der Datei an, wie sie entstand.
AUSGABE_ORDNER = "/home/saosgone/Schreibtisch/coding/stlFiles"
NAME = "ct2003_kopf"

# Schwellwert in Hounsfield-Einheiten. CT ist kalibriert: Luft -1000, Wasser 0,
# Weichteile 20-80, spongioeser Knochen ab ~200, Kortikalis 500-1900.
# 300 trennt Knochen sauber von allem anderen. Kleiner holt Haut und Muskel
# dazu, groesser laesst duenne Knochen wie die Augenhoehle wegbrechen.
HU_SCHWELLE = 300

# Verkleinerung in x und y. 1 = volle Aufloesung. DER Hebel fuer die Groesse:
# die Dreieckszahl geht ungefaehr mit dem Quadrat. 4 liefert bei 512x512 rund
# 3 mm Voxel und ein paar hunderttausend Dreiecke — mehr lohnt nicht, weil
# cutInHalf danach ohnehin auf ~40.000 Vertizes eindampft.
# In z wird NICHT verkleinert, da gibt der Schichtabstand die Aufloesung vor.
VERKLEINERN = 4

# Nur die groesste zusammenhaengende Struktur behalten. Der Schwellwert nimmt
# auch den Patiententisch und die Kopfstuetze mit; die haengen nicht am
# Skelett und fallen damit weg. Haengt doch etwas dran, aendert sich nichts —
# die Meldung im Log sagt, wieviel uebrig blieb.
NUR_GROESSTE = True

# ============================================================================
#  ab hier nichts mehr eintragen
# ============================================================================

import os
import struct
import sys
from array import array

# ---------- DICOM lesen ----------
# Nur so viel Parser, wie fuer Bilddaten noetig ist. Die Datei ist eine Folge
# von Elementen (Gruppe, Element, Laenge, Wert); wir laufen sie durch, merken
# uns eine Handvoll Tags und halten bei den Pixeldaten an.
#
# Diese VRs tragen die Laenge in 4 Byte hinter 2 Reservebytes, alle anderen in
# 2 Byte direkt hinter der VR.
LANGE_VR = {b"OB", b"OW", b"OF", b"OL", b"OD", b"SQ", b"UT", b"UN", b"UC", b"UR"}
GESUCHT = {
    (0x0020, 0x000E): "serie",      # SeriesInstanceUID
    (0x0020, 0x0032): "position",   # ImagePositionPatient, dritter Wert = z
    (0x0028, 0x0010): "zeilen",
    (0x0028, 0x0011): "spalten",
    (0x0028, 0x0030): "abstand",    # PixelSpacing in mm
    (0x0028, 0x0103): "vorzeichen", # PixelRepresentation
    (0x0028, 0x1052): "offset",     # RescaleIntercept
    (0x0028, 0x1053): "faktor",     # RescaleSlope
}
ALS_ZAHL = {(0x0028, 0x0010), (0x0028, 0x0011), (0x0028, 0x0103)}


def dicom_lesen(pfad):
    b = open(pfad, "rb").read()
    # 128 Byte Praeambel, dann "DICM". Fehlt das, ist es keine DICOM-Datei.
    if b[128:132] != b"DICM":
        raise SystemExit(f"{pfad}: kein DICM-Magic bei Byte 128, keine DICOM-Datei.")

    # Gruppe 0002 ist IMMER Explicit VR Little Endian, unabhaengig davon, wie
    # der Rest der Datei kodiert ist. Hier steht drin, wie der Rest zu lesen ist.
    p, transfer = 132, None
    while True:
        gruppe, element = struct.unpack_from("<HH", b, p)
        if gruppe != 0x0002:
            break
        vr = b[p + 4:p + 6]
        if vr in LANGE_VR:
            laenge, p = struct.unpack_from("<I", b, p + 8)[0], p + 12
        else:
            laenge, p = struct.unpack_from("<H", b, p + 6)[0], p + 8
        if (gruppe, element) == (0x0002, 0x0010):
            transfer = b[p:p + laenge].decode().strip("\x00 ")
        p += laenge

    if transfer not in ("1.2.840.10008.1.2", "1.2.840.10008.1.2.1"):
        raise SystemExit(
            f"{pfad}: Transfer Syntax {transfer} wird nicht unterstuetzt.\n"
            f"  Dieses Skript liest nur unkomprimiertes Little Endian.\n"
            f"  Bei JPEG/JPEG2000/RLE die Serie vorher dekomprimieren."
        )
    implicit = transfer == "1.2.840.10008.1.2"

    t = {}
    while p + 8 <= len(b):
        gruppe, element = struct.unpack_from("<HH", b, p)
        # Item- und Delimiter-Tags haben IMMER 8 Byte Kopf mit 4-Byte-Laenge,
        # egal ob implicit oder explicit. Wer die als VR liest, verliert den
        # Takt und liest ab da Muell.
        if gruppe == 0xFFFE:
            p += 8
            continue
        if implicit:
            laenge, kopf, vr = struct.unpack_from("<I", b, p + 4)[0], 8, b"UN"
        else:
            vr = b[p + 4:p + 6]
            if vr in LANGE_VR:
                laenge, kopf = struct.unpack_from("<I", b, p + 8)[0], 12
            else:
                laenge, kopf = struct.unpack_from("<H", b, p + 6)[0], 8
        if (gruppe, element) == (0x7FE0, 0x0010):     # PixelData, hier sind wir fertig
            t["daten"] = b[p + kopf:p + kopf + laenge]
            break
        # Sequenzen: hineinlaufen statt drueberspringen. 0xFFFFFFFF heisst
        # "Laenge unbekannt", da bleibt gar nichts anderes uebrig.
        if laenge == 0xFFFFFFFF or vr == b"SQ":
            p += kopf
            continue
        if (gruppe, element) in GESUCHT:
            roh = b[p + kopf:p + kopf + laenge]
            t[GESUCHT[(gruppe, element)]] = (
                struct.unpack("<H", roh)[0] if (gruppe, element) in ALS_ZAHL and len(roh) == 2
                else roh.decode("ascii", "replace").strip("\x00 ").strip()
            )
        p += kopf + laenge

    if "daten" not in t:
        raise SystemExit(f"{pfad}: keine Pixeldaten (7FE0,0010) gefunden.")
    return t


# ---------- Serie einlesen ----------
dateien = sorted(os.path.join(DICOM_ORDNER, f) for f in os.listdir(DICOM_ORDNER)
                 if os.path.isfile(os.path.join(DICOM_ORDNER, f)) and f != "DICOMDIR")
if not dateien:
    raise SystemExit(f"{DICOM_ORDNER}: keine Dateien gefunden.")

schichten = []
for pfad in dateien:
    t = dicom_lesen(pfad)
    # Die z-Position steht im dritten Wert von ImagePositionPatient. Danach wird
    # sortiert, NICHT nach Dateiname — der ist bei DICOM oft die Instanznummer
    # und laeuft nicht zwingend mit der Anatomie mit.
    t["z"] = float(str(t["position"]).split("\\")[2])
    schichten.append(t)
schichten.sort(key=lambda s: s["z"])

serien = {s.get("serie") for s in schichten}
if len(serien) > 1:
    raise SystemExit(
        f"{DICOM_ORDNER} enthaelt {len(serien)} verschiedene Serien.\n"
        f"  Ein Volumen aus mehreren Serien ist Matsch. Vorher nach\n"
        f"  SeriesInstanceUID (0020,000E) in eigene Ordner aufteilen."
    )

B0 = int(schichten[0]["spalten"])
H0 = int(schichten[0]["zeilen"])
px, py = (float(v) for v in str(schichten[0]["abstand"]).split("\\"))
offset = float(schichten[0].get("offset", 0) or 0)
faktor = float(schichten[0].get("faktor", 1) or 1)
vorzeichen = int(schichten[0].get("vorzeichen", 0) or 0)
# Rohwert = (HU - offset) / faktor. Einmal zurueckrechnen ist billiger, als
# jedes der Millionen Voxel nach HU umzurechnen.
schwelle = (HU_SCHWELLE - offset) / faktor
zs = [s["z"] for s in schichten]

print(f"{len(schichten)} Schichten  {B0}x{H0}  {px}x{py} mm  "
      f"z {zs[0]:.1f}..{zs[-1]:.1f} mm")
print(f"Schwelle {HU_SCHWELLE} HU -> Rohwert {schwelle:.0f}   "
      f"Verkleinerung xy /{VERKLEINERN}")

# ---------- verkleinern ----------
# MAX statt Mittel ueber jeden Block: Kortikalis ist an der Schaedelkalotte nur
# ein bis zwei Voxel dick. Ein Mittelwert zieht sie unter die Schwelle und
# reisst Loecher, das Maximum haelt sie. Der Knochen wird dadurch etwas zu
# dick — das ist der bessere Fehler.
D = VERKLEINERN
B, H = B0 // D, H0 // D
typ = "h" if vorzeichen else "H"
volumen = []
for s in schichten:
    a = array(typ)
    a.frombytes(s["daten"][:B0 * H0 * 2])
    if sys.byteorder != "little":
        a.byteswap()
    # ueber x: a[0::D], a[1::D] … sind je eine Spaltenauswahl, map(max, …)
    # laeuft in C. B0 ist durch D teilbar, also faellt kein Block ueber einen
    # Zeilenrand.
    ueber_x = list(map(max, *[a[i::D] for i in range(D)]))
    zeile = []
    for y in range(H):
        basis = y * D * B
        zeile += list(map(max, *[ueber_x[basis + i * B: basis + i * B + B] for i in range(D)]))
    volumen.append(zeile)
    s["daten"] = None                       # Speicher zurueck, sonst liegen alle Schichten roh im RAM
NZ = len(volumen)

# ---------- groesste zusammenhaengende Struktur ----------
if NUR_GROESSTE:
    drin = [[v >= schwelle for v in zeile] for zeile in volumen]
    marke = [[0] * (B * H) for _ in range(NZ)]
    groesse, beste, nr = {}, 0, 0
    for k0 in range(NZ):
        for i0 in range(B * H):
            if not drin[k0][i0] or marke[k0][i0]:
                continue
            nr += 1
            marke[k0][i0] = nr
            stapel, n = [(k0, i0)], 0
            while stapel:                   # Flutfuellung, 6er-Nachbarschaft
                k, i = stapel.pop()
                n += 1
                y, x = divmod(i, B)
                nachbarn = []
                if x > 0: nachbarn.append((k, i - 1))
                if x < B - 1: nachbarn.append((k, i + 1))
                if y > 0: nachbarn.append((k, i - B))
                if y < H - 1: nachbarn.append((k, i + B))
                if k > 0: nachbarn.append((k - 1, i))
                if k < NZ - 1: nachbarn.append((k + 1, i))
                for kk, ii in nachbarn:
                    if drin[kk][ii] and not marke[kk][ii]:
                        marke[kk][ii] = nr
                        stapel.append((kk, ii))
            groesse[nr] = n
            if n > groesse.get(beste, 0):
                beste = nr
    gesamt = sum(groesse.values())
    print(f"{nr} Strukturen, groesste {groesse[beste]} von {gesamt} Voxeln "
          f"({100 * groesse[beste] / gesamt:.1f} %) — Rest verworfen")
    # Verworfene Voxel werden auf Luft gesetzt, nicht auf irgendetwas sehr
    # Negatives: der Wert geht in die Interpolation ein, wenn eine Zelle eine
    # behaltene und eine verworfene Ecke hat. Luft ist der ehrliche Ersatz —
    # da war ja auch nichts, was zur behaltenen Struktur gehoert.
    luft = (-1000 - offset) / faktor
    for k in range(NZ):
        mk, vv = marke[k], volumen[k]
        for i in range(B * H):
            if mk[i] != beste:
                vv[i] = luft

# ---------- Randzellen finden ----------
# Eine Zelle ist nur dann interessant, wenn ihre acht Ecken nicht alle auf
# derselben Seite der Schwelle liegen. Das ueber eine Python-Schleife zu
# pruefen hiesse Millionen Iterationen; stattdessen wird jede Schicht zu EINEM
# Integer mit B*H Bit, und die acht Ecken sind acht Verschiebungen davon.
# Die Und-/Oder-Verknuepfung laeuft dann in C ueber die ganze Ebene auf einmal.
bits = []
for zeile in volumen:
    n = 0
    for i in range(len(zeile) - 1, -1, -1):
        n = (n << 1) | (zeile[i] >= schwelle)
    bits.append(n)
# Zellen am rechten und unteren Rand haetten keine vollstaendigen acht Ecken
gueltig = 0
for y in range(H - 1):
    gueltig |= ((1 << (B - 1)) - 1) << (y * B)

# ---------- Marching Tetrahedra ----------
# Jeder Wuerfel wird in 6 Tetraeder zerlegt, die alle die Raumdiagonale 0-6
# teilen. Warum nicht Marching Cubes: dort braucht man eine Tabelle mit 256
# Faellen, von denen mehrere mehrdeutig sind — waehlt man dort falsch, bekommt
# die Oberflaeche Loecher. Ein Tetraeder hat nur vier Ecken und damit keine
# Mehrdeutigkeit, die Faelle lassen sich hinschreiben statt nachschlagen, und
# weil alle Wuerfel dieselbe Diagonale nehmen, passen benachbarte Zellen
# luecklos zusammen. Preis: rund doppelt so viele Dreiecke wie Marching Cubes.
# Fuer einen Drahtgitter-Renderer, der die Normalen ohnehin wegwirft, ist das
# der bessere Tausch — und cutInHalf dampft danach sowieso ein.
ECKEN = [(0, 0, 0), (1, 0, 0), (1, 1, 0), (0, 1, 0),
         (0, 0, 1), (1, 0, 1), (1, 1, 1), (0, 1, 1)]
TETRAEDER = [(0, 1, 2, 6), (0, 2, 3, 6), (0, 3, 7, 6),
             (0, 7, 4, 6), (0, 4, 5, 6), (0, 5, 1, 6)]

dreiecke = []
for k in range(NZ - 1):
    unten, oben = bits[k], bits[k + 1]
    ecke = [unten, unten >> 1, unten >> (B + 1), unten >> B,
            oben, oben >> 1, oben >> (B + 1), oben >> B]
    alle = ecke[0] & ecke[1] & ecke[2] & ecke[3] & ecke[4] & ecke[5] & ecke[6] & ecke[7]
    eine = ecke[0] | ecke[1] | ecke[2] | ecke[3] | ecke[4] | ecke[5] | ecke[6] | ecke[7]
    rand = (eine & ~alle) & gueltig
    if not rand:
        continue
    for bi, byte in enumerate(rand.to_bytes((rand.bit_length() + 7) // 8, "little")):
        if not byte:
            continue
        for bit in range(8):
            if not (byte >> bit) & 1:
                continue
            y, x = divmod(bi * 8 + bit, B)
            # Abstand zur Schwelle und Weltkoordinate der acht Ecken. Die
            # z-Koordinate kommt aus der echten Schichtposition, nicht aus dem
            # Index — Schichtabstaende sind nicht immer exakt gleich.
            f, punkt = [], []
            for dx, dy, dz in ECKEN:
                f.append(volumen[k + dz][(y + dy) * B + (x + dx)] - schwelle)
                punkt.append(((x + dx) * D * px, (y + dy) * D * py, zs[k + dz]))

            def schnitt(i, o):
                """Punkt auf der Kante i->o, wo der Wert genau die Schwelle trifft."""
                t = f[i] / (f[i] - f[o])
                a, b = punkt[i], punkt[o]
                return (a[0] + t * (b[0] - a[0]),
                        a[1] + t * (b[1] - a[1]),
                        a[2] + t * (b[2] - a[2]))

            for tet in TETRAEDER:
                innen = [i for i in tet if f[i] >= 0]
                aussen = [i for i in tet if f[i] < 0]
                if not innen or not aussen:
                    continue          # ganz drin oder ganz draussen, keine Flaeche
                if len(innen) == 1:
                    dreiecke.append(tuple(schnitt(innen[0], o) for o in aussen))
                elif len(aussen) == 1:
                    dreiecke.append(tuple(schnitt(i, aussen[0]) for i in innen))
                else:                 # 2 drin, 2 draussen -> Viereck aus zwei Dreiecken
                    q = (schnitt(innen[0], aussen[0]), schnitt(innen[0], aussen[1]),
                         schnitt(innen[1], aussen[1]), schnitt(innen[1], aussen[0]))
                    dreiecke.append((q[0], q[1], q[2]))
                    dreiecke.append((q[0], q[2], q[3]))

if not dreiecke:
    raise SystemExit(
        f"Kein einziges Dreieck bei {HU_SCHWELLE} HU.\n"
        f"  Entweder liegt nichts im Datensatz ueber der Schwelle, oder es ist\n"
        f"  kein CT — bei MR sind die Grauwerte nicht in Hounsfield kalibriert."
    )

# ---------- schreiben ----------
# Binaeres STL: 80 Byte Kopf, 4 Byte Anzahl, dann je Dreieck 12 float (Normale
# plus drei Ecken) und 2 Byte Attribut = 50 Byte. Die Normale bleibt 0,0,0 —
# cutInHalf und stl2model werfen sie weg, und der Renderer zeichnet Kanten.
vertizes = len({e for d in dreiecke for e in d})
os.makedirs(AUSGABE_ORDNER, exist_ok=True)
ziel = os.path.join(AUSGABE_ORDNER, f"{NAME}_hu{HU_SCHWELLE}_d{D}.stl")
with open(ziel, "wb") as fh:
    fh.write(b"dcm2stl marching tetrahedra".ljust(80, b" "))
    fh.write(struct.pack("<I", len(dreiecke)))
    for a, b_, c in dreiecke:
        fh.write(struct.pack("<12fH", 0, 0, 0, *a, *b_, *c, 0))

print(f"{len(dreiecke)} Dreiecke, {vertizes} eindeutige Vertizes")
print(f"geschrieben: {ziel}  ({os.path.getsize(ziel) / 1e6:.1f} MB)")
if vertizes > 40000:
    print(f"HINWEIS: {vertizes} Vertizes sind zu viele fuer den Renderer (~40.000).\n"
          f"         Jetzt cutInHalf drueberlaufen lassen, danach stl2model.")
