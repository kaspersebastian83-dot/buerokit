# BüroKit – Aufgaben des Büros

**App öffnen:** https://kaspersebastian83-dot.github.io/buerokit/ · Version **1.0.0** · Teil der Suite **Spektron**, läuft aber auch allein (nur Chrome oder Edge und der Archivordner).

Eine Tagesliste für das Büro: übergebene Gutachten (Gegenlesen, PDF, Versand je Empfänger) und eigene Aufgaben je Projekt, sortiert nach überfällig, heute fällig, offen und erledigt.

## So geht's

1. Einmal den **Archivordner** wählen (der Ordner mit allen Projektordnern, z. B. „Mosaik Archivordner“). Der Browser merkt sich ihn.
2. Oben bei **„Ich bin“** das eigene Kürzel wählen. An jedem Haken stehen dann Name und Zeit.
3. Haken setzen, wenn ein Schritt erledigt ist – und wieder wegnehmen, wenn er versehentlich gesetzt war. Keine Begründung nötig.
4. **Versand ▾** klappt die Empfänger auf; jeder Empfänger bekommt seinen eigenen Haken (mit Datum).
5. **„＋ Aufgabe“** legt eine eigene Aufgabe zu einem Projekt an (z. B. „Laborrechnung prüfen“), mit Fälligkeit und für wen.
6. **„mehr“** an einer Aufgabe: Word-Datei (Pfad zum Kopieren), Rückfrage stellen oder beantworten, Fälligkeit ändern, „Ich mache das“, entfernen.

Gutachten kommen aus der **Projektzentrale** („Ans Büro“). Rückfragen sieht der Sachverständige dort am Projekt und kann sie dort beantworten.

## Gespeichert wird

Je Projekt im Ordner `_Buero`, ohne zentrale Datei und ohne Server:

```text
<Archiv>/<JJ.Nummer Ort Kürzel>/_Buero/aufgaben/<id>.json   eine Aufgabe
<Archiv>/<JJ.Nummer Ort Kürzel>/_Buero/vermerke/<id>.json   ein Haken (oder sein Zurücknehmen)
```

Jede Datei wird einmal geschrieben und nie geändert – zwei Kollegen können sich nichts überschreiben. Der Stand eines Schritts ist der neueste Vermerk dazu. Frühere Büroübergaben der Projektzentrale (bis 1.27, `_Buero/<Auftrags-UUID>/`) werden mitgelesen und wie Aufgaben gezeigt.

Das Datenmodul `buero-aufgaben.js` ist in BüroKit und Projektzentrale byte-gleich.

## Tests

```sh
node tests/aufgaben.cjs                    # Datenmodul gegen echte temporäre Ordner
node tests/buerokit-browser.cjs chromium   # Oberfläche im echten Browser (Playwright)
```
