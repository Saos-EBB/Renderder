# Errors

## 2026-08-09 — Commit enthielt eine Löschung, die nicht dazugehörte
**Symptom:** Der Commit „Farbtabelle auf 16 Blautöne" (`89888ff`, verworfen) enthielt
neben `renderer.js` und `docs/` auch die Löschung von `modelle/cube.js`.
**Ursache:** `git add <pfad>` stagt gezielt, aber `git commit` ohne Pfadangabe schreibt
den **gesamten Index** — nicht nur das, was man gerade hinzugefügt hat. Die Löschung
von `cube.js` lag schon vorher im Index und kam damit mit. Der `git status` vor dem
Commit zeigte das `D ` in der ersten Spalte, geprüft wurde es nicht.
**Fix:** `git reset --soft HEAD~1`, dann `git reset` für einen leeren Index, dann
`git commit -- <pfade>`. Die Pathspec-Form committet ausschließlich die genannten
Pfade und ignoriert, was sonst im Index liegt. Bei dreckigem Working Tree ist das
die sichere Variante — `git add` + `git commit` ist es nicht.
