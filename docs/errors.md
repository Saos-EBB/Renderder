# Errors

## 2026-08-09 — Daumentasten kommen in WebStorms Preview nicht an
**Symptom:** BT4 schaltet die Schnittachse in Brave korrekt weiter, in WebStorms
eingebauter Vorschau passiert nichts bzw. das IDE navigiert stattdessen zurück.
**Ursache:** Zwei Schichten übereinander. Erstens belegt das JetBrains-Standard-Keymap
`Button4`/`Button5` mit *Navigate Back/Forward* — nicht in der Konfiguration sichtbar,
weil Voreinstellungen erst beim Ändern als Datei geschrieben werden. Zweitens, und das
ist die eigentliche Sperre: die Vorschau ist JCEF (Chromium Embedded), und dort kommen
die Daumentasten auch nach dem Entfernen der Keymap-Einträge nicht bei der Seite an.
Nicht am Code verifizierbar, die JCEF-Bibliothek liegt im Flatpak-Sandbox-Image.
**Fix:** Achsenwechsel zusätzlich auf die Taste `a` gelegt. Die Maustaste bleibt und
funktioniert in echten Browsern. Allgemeiner: Eingaben jenseits von links/mitte/rechts
und Rad sind in der IDE-Vorschau nicht verlässlich — dort gegen einen echten Browser
testen, oder von vornherein eine Tastatur-Zweitbelegung vorsehen.

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
