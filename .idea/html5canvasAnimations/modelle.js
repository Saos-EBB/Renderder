// Namensliste der Modelle. Die Daten selbst liegen daneben in modelle/ —
// diese Datei ist das Verzeichnis, nicht der Inhalt.
// Nur die Namen, keine statischen Imports: sonst laedt der Browser beim
// Seitenaufruf ALLE Modelle (~19 MB, dick.js allein 9,5 MB), um eins zu zeigen.
const models = [
    // 8 Vertizes, 12 Kanten — Testmodell fuer alles, wo man die Ecken einzeln
    // sehen und nachzaehlen koennen muss. Genau dafuer wieder da.
    "cube",
    "beetle",
    "teapot",
    "car",
    "ducky",
    "skull",
    "shark",
    "dick",
    "katana",
    "stoneman",
    "statue00",
    "totempole",
    "forMax01",
    "craniumCut01",
    "pochita10",
    "pochita30",
    "pochita64",
    "pochita128",
    "pochita256",
    "klo",
    "cat",
    "Duo_Baldurs_Gate_g128",
    "Duo_Baldurs_Gate_g64",
    "Human_tibia_and_fibula_g128",
    "hand1_g128",
    "skull_g128",
    "SegmentCraneo00",
    "Segmentation_craneo_camilo_g128",
    "Segmentation_craneo_camilo_g32",
    "Segmentation_craneo_camilo_g64",
    "ct2001_thorax",
    "ct2003_kopf_CT2",
    "ct2003_kopf_CT3",
];

export async function importModel(name) {

    if (!models.includes(name)) {
        throw new Error(`Model :  ${name} not found`);
    }

    return (await import(`./modelle/${name}.js`)).default;
}
