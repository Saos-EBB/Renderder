# Build Log

## 2026-08-08 — chore: ponytail-Audit — totes vite raus, setTimeout-Ceiling markiert
**Was:** `vite`-devDependency aus package.json entfernt (nie benutzt, kein Script/Config
dafür). In renderer.js einen `ponytail:`-Kommentar über der Animationsschleife ergänzt —
`setTimeout` statt `requestAnimationFrame` driftet unter Last / läuft im Hintergrundtab
weiter, Upgrade-Pfad steht im Kommentar.
**Nicht gebaut:** kein Umbau auf requestAnimationFrame selbst — nur markiert.
Lockfile/node_modules nicht nachgezogen (kein npm hier verfügbar), einmal
`npm install` auf deiner Maschine nötig.

## 2026-08-08 — fix(renderer): vertikale Mausrichtung invertiert
**Was:** `dy` beim Ziehen umgedreht (`letzte.y - e.clientY` statt umgekehrt) —
Ziehen nach oben dreht jetzt nach oben, nicht mehr nach unten.
**Nicht gebaut:** —

## 2026-08-08 — chore(repo): init repo, gitignore, README
**Was:** Repo für den Renderer aufgesetzt (Remote: Saos-EBB/Renderder), inkl. Fix für
`f.lenght` → `f.length` in renderer.js (Tippfehler crashte `frame()` bei jedem
Frame, Canvas blieb schwarz — das war der "Modell nicht mehr sichtbar"-Bug).
**Nicht gebaut:** kein LICENSE, kein CI. `node_modules/` zusätzlich zu `.claude/`
und `Skillz/` ignoriert (Standard, nicht explizit verlangt).
