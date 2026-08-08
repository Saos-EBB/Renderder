# Build Log

## 2026-08-08 — feat(renderer): Zoom per Rechtsklick + Mausrad
**Was:** `dz` per Mausrad bei gehaltener rechter Taste, multiplikativ (Faktor 1.1),
weil ein fester Schritt bei dz=10 unsichtbar und bei dz=0.5 ein Sprung wäre.
Dazu drei Dinge, ohne die es nicht funktioniert: `mousedown` reagiert jetzt nur
noch auf die linke Taste (vorher startete auch Rechtsklick das Drehen),
`contextmenu` wird abgefangen, und die Kanten-Schleife verwirft Kanten hinter der
Kamera — sonst wirft `magic()` sie beim Reinzoomen gespiegelt und riesig ins Bild.
`zFenster()` bleibt unangetastet: `dz` kürzt sich in der Shading-Formel weg.
**Nicht gebaut:** kein DZ_MAX (Rauszoomen ist selbstkorrigierend), kein
Zoom-auf-Mausposition, kein Trackpad-proportionaler Schritt — nur das Vorzeichen
von `deltaY` zählt.

## 2026-08-08 — refactor(renderer): rotate_xz/xy/yz zusammengefasst, toten Code raus
**Was:** Ponytail-Audit-Fund umgesetzt: die drei fast identischen `rotate_xz/xy/yz`
zu einer `rotate(v, angle, [a,b])` zusammengefasst (Ebene als Achsenpaar statt
eigener Funktion pro Ebene). Dazu totes Zeug raus: unbenutztes `FOREGROUND`,
unbenutztes `dt` + auskommentiertes `dz += 0.25*dt`, Debug-`console.log`s.
**Nicht gebaut:** —

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
