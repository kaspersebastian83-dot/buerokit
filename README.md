# BüroKit – Aufgaben des Büros

**App öffnen:** https://kaspersebastian83-dot.github.io/buerokit/ · Version **1.5.0** · Teil der Suite **Spektron**, läuft aber auch allein (nur Chrome oder Edge und der Archivordner).

Eine Tagesliste für das Büro: übergebene Gutachten (Gegenlesen, PDF, Versand je Empfänger, Rechnung) und eigene Aufgaben je Projekt, sortiert nach überfällig, heute fällig, offen, „Versandt – Rechnung schreiben“ und erledigt.

## Neu in 1.5.0 · 29.10.2026

- **Projekte mit Umlauten im Ordnernamen** (Prüfbericht 29.10.): BüroKit merkt sich die echte Schreibweise des Projektordners. Bisher konnte ein Projekt gelistet sein, sich aber nicht öffnen lassen („nicht gefunden“), wenn der Ordner auf dem Laufwerk in einer anderen Unicode-Form gespeichert ist (gemeinsames Modul `buero-aufgaben.js`, gleich in der Projektzentrale 1.35).
- Abrechnung: Hinweise nennen beide Orte – die Daten liegen in `_Spektron/BelegKit` (ältere Projekte: „Abrechnung“), die CSV für Excel immer in „Abrechnung“.

## Neu in 1.4.1 · 29.10.2026

- Gemeinsames Modul spektron-ordner.js: Beim Umzug und bei der Ortswahl zählen in „Abrechnung“ nur noch die Dateien, die BelegKit selbst schreibt (Aufwand_<Kürzel>.json, _Abrechnung.json, <Nr>_Aufwand_<Datum>.json, _BelegKit_Sicherungen) – andere JSON dort bleiben liegen.

## Neu in 1.4.0 · 28.10.2026

- **Spektron-Ordner ist da:** Neue Projekte (ab 26.0560) und per Projektzentrale umgezogene Projekte haben Aufgaben und Haken jetzt unter `_Spektron/Buero`, die BelegKit-Stände unter `_Spektron/BelegKit`. Noch nicht umgezogene Projekte werden weiter am bisherigen Ort gelesen und geschrieben (`spektron-ordner.js`, Umstellung aktiv).

## Neu in 1.3.0 · 28.10.2026

- **Vorbereitung „Spektron-Ordner“:** Die App-Daten eines Projekts ziehen später in den Unterordner `_Spektron` (`_Buero` → `_Spektron/Buero`, BelegKit-Dateien → `_Spektron/BelegKit`). BüroKit liest und schreibt Aufgaben und Haken und liest die Abrechnung jetzt über `spektron-ordner.js`; gespeicherte BelegKit-Stände bleiben auch nach dem Umzug prüfbar. Bis zum Umzug ändert sich nichts.

## Neu in 1.2.0 · 28.10.2026

- **Je Person** unter „Abrechnung“ (zugeklappt): Stunden Ortstermin/Bericht als Sachverständiger bzw. Probenehmer, km, Spesen, Übernachtungen und Ortstermine je Kürzel, mit Summe – direkt aus den Zeitdateien `Abrechnung/Aufwand_<Kürzel>.json` (nur lesen). Nur in BüroKit; in den anderen Apps sieht jeder nur seine eigenen Zeiten. Einträge, die keine Zahl sind, stehen als „unklar“ daneben.

## Neu in 1.1.0 · 28.10.2026

- **Rechnung** als eigener Haken am Gutachten. Nach dem Versand wandert das Gutachten in die Gruppe „Versandt – Rechnung schreiben“; erledigt ist es erst mit dem Rechnungs-Haken. Frühere Übergaben (Projektzentrale bis 1.27) bleiben ohne Rechnungsschritt.
- **Abrechnung** unter „mehr“: die Positionen aus dem neuesten BelegKit-Stand (`Abrechnung/<Nr>_Aufwand_<Datum>.json`, „💾 Stand speichern“ in BelegKit) mit Menge und Einheit – „⧉ Positionen kopieren“ wie in BelegKit. BüroKit prüft dabei die Quellen des Stands (Zeiten aller Kollegen, LabelKit-Proben, Berichte, Fotos, Einstellungen) gegen die gespeicherten Prüfsummen und warnt, wenn sich seitdem etwas geändert hat; dann per Rückfrage einen neuen Stand anfordern. Gezeigt werden nur die Rechnungspositionen, keine Stunden einzelner Kollegen.
- **Anlagen**: Was mit dem Gutachten mitgeschickt werden muss, steht an der Aufgabe (aus der Projektzentrale „Ans Büro“, ab 1.30), Pfade zum Kopieren.
- Beim Haken „Rechnung“ wird vermerkt, nach welchem Stand abgerechnet wurde. Kein Stand oder ein veralteter: Rückfrage vor dem Haken.

## Neu in 1.0.1 · 27.10.2026

- Frühere Büroübergaben (Projektzentrale bis 1.27) mit mehreren neuen Fassungen: Die Änderungen werden jetzt in zeitlicher Reihenfolge gelesen. Vorher konnte je nach Dateisystem eine ältere Word-Datei (samt Empfängern und Hinweis) als aktuelle erscheinen. Gemeinsames Modul `buero-aufgaben.js` – byte-gleich in der Projektzentrale.

## So geht's

1. Einmal den **Archivordner** wählen (der Ordner mit allen Projektordnern, z. B. „Mosaik Archivordner“). Der Browser merkt sich ihn.
2. Oben bei **„Ich bin“** das eigene Kürzel wählen. An jedem Haken stehen dann Name und Zeit.
3. Haken setzen, wenn ein Schritt erledigt ist – und wieder wegnehmen, wenn er versehentlich gesetzt war. Keine Begründung nötig.
4. **Versand ▾** klappt die Empfänger auf; jeder Empfänger bekommt seinen eigenen Haken (mit Datum).
5. **„＋ Aufgabe“** legt eine eigene Aufgabe zu einem Projekt an (z. B. „Laborrechnung prüfen“), mit Fälligkeit und für wen.
6. **„mehr“** an einer Aufgabe: Word-Datei und Anlagen (Pfade zum Kopieren), Abrechnung aus BelegKit, Rückfrage stellen oder beantworten, Fälligkeit ändern, „Ich mache das“, entfernen.
7. **Rechnung**: Positionen kopieren, im Rechnungsprogramm einfügen, Haken „Rechnung“ setzen. Die Projektzentrale zeigt dann „abgerechnet“.

Gutachten kommen aus der **Projektzentrale** („Ans Büro“). Rückfragen sieht der Sachverständige dort am Projekt und kann sie dort beantworten.

## Gespeichert wird

Je Projekt im Ordner `_Buero`, ohne zentrale Datei und ohne Server:

```text
<Archiv>/<JJ.Nummer Ort Kürzel>/_Buero/aufgaben/<id>.json   eine Aufgabe
<Archiv>/<JJ.Nummer Ort Kürzel>/_Buero/vermerke/<id>.json   ein Haken (oder sein Zurücknehmen)
```

Jede Datei wird einmal geschrieben und nie geändert – zwei Kollegen können sich nichts überschreiben. Der Stand eines Schritts ist der neueste Vermerk dazu. Frühere Büroübergaben der Projektzentrale (bis 1.27, `_Buero/<Auftrags-UUID>/`) werden mitgelesen und wie Aufgaben gezeigt.

Das Datenmodul `buero-aufgaben.js` ist in BüroKit und Projektzentrale byte-gleich. `buero-abrechnung.js` (nur BüroKit) liest den BelegKit-Stand und die Zeitdateien und schreibt nie in „Abrechnung“.

## Tests

```sh
node tests/aufgaben.cjs                    # Datenmodul gegen echte temporäre Ordner
node tests/abrechnung.cjs                  # BelegKit-Stand lesen, Quellen vergleichen, Kopierformat, je Person
node tests/buerokit-browser.cjs chromium   # Oberfläche im echten Browser (Playwright)
```
