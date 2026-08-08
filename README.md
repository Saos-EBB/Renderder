# Renderer

Kleines Lernprojekt: ein simpler 3D-Wireframe-Renderer auf HTML5 Canvas, ohne
Bibliothek.

## Struktur

- `.idea/html5canvasAnimations/renderer.js` — Renderer + Maussteuerung (Drehen per Drag)
- `.idea/html5canvasAnimations/modelle/` — Vertex/Face-Daten der 3D-Modelle
- `.idea/html5canvasAnimations/index.html` — Einstiegspunkt

## Starten

Browser blockieren ES-Module über `file://` — ein lokaler Server ist nötig:

```
npx serve .idea/html5canvasAnimations
```
