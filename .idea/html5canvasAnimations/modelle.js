// Namensliste der Modelle. Die Daten selbst liegen daneben in modelle/ —
// diese Datei ist das Verzeichnis, nicht der Inhalt.
// Nur die Namen, keine statischen Imports: sonst laedt der Browser beim
// Seitenaufruf ALLE Modelle (~19 MB, dick.js allein 9,5 MB), um eins zu zeigen.
const models = [
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
    "duoOG",
];

export async function importModel(name) {

    if (!models.includes(name)) {
        throw new Error(`Model :  ${name} not found`);
    }

    return (await import(`./modelle/${name}.js`)).default;
}
