# BüroKit – Aufgaben des Büros

**App öffnen:** https://kaspersebastian83-dot.github.io/buerokit/ · Version **1.10.0** · Teil der Suite **Spektron**, läuft aber auch allein (nur Chrome oder Edge und der Archivordner).

Eine Tagesliste für das Büro: übergebene Gutachten (Gegenlesen, PDF, Versand je Empfänger, Rechnung) und eigene Aufgaben je Projekt, sortiert nach überfällig, heute fällig, später fällig, „Rechnung schreiben“ und erledigt. Für die Bürokräfte ist BüroKit die einzige Spektron-App – darum ohne Spektron-Leiste und ohne Fachbegriffe der anderen Apps.

## Neu in 1.10.0 · 20.11.2026 (Audit Lauf 3)

- **Liste bleibt aktuell:** Auch wenn ein Knopf in der Liste den Fokus hat (nach „Pfad kopieren“, „E-Mail-Adresse kopieren“, „In Word öffnen“), liest BüroKit jede Minute und beim Zurückkommen neu. Ausgesetzt wird nur, solange jemand im Datumsfeld tippt; der Fokus bleibt auf demselben Knopf.
- **Keine doppelte Rechnung:** Vor „① Positionen kopieren“ und vor „③ Rechnung geschrieben ✓“ liest BüroKit das Projekt frisch. Hat eine Kollegin die Rechnung schon geschrieben, steht das oben („Die Rechnung hat … schon geschrieben“) und es wird nichts kopiert bzw. gespeichert. „① Positionen kopieren“ setzt „Ich kümmere mich“, damit die anderen sehen, wer gerade abrechnet. Kümmert sich schon jemand anderes, fragt BüroKit vor dem Kopieren nach. Ist das Projekt in dem Moment nicht lesbar, bricht BüroKit ab statt mit dem alten Stand weiterzumachen. Prüfen und Speichern sind auf dem Laufwerk kein einzelner Schritt – klicken zwei Kolleginnen fast gleichzeitig, sieht BüroKit das direkt nach dem Speichern und warnt („… fast gleichzeitig … bitte absprechen“).
- **Rechnungskopf kopieren:** neuer Knopf neben ①: Anschrift des Auftraggebers (aus der Übergabe, ohne E-Mail), „Ihr Zeichen“ (Schaden-Nr.), „Unser Zeichen“ (Projekt-Nr.) und Objekt – zum Einfügen in MOS'aik.
- **Fälligkeit tippen:** gespeichert wird erst beim Verlassen des Felds oder mit Enter (vorher speicherte schon der erste getippte Teil). Ein Jahr außerhalb von „letztes Jahr bis in fünf Jahren“ wird nicht gespeichert.
- **Alte BelegKit-Angaben mit stornierten Proben:** Angaben aus BelegKit vor 1.17.0 rechneten stornierte Proben noch mit. Ist die LabelKit-Datei seitdem unverändert und hat stornierte Proben, gelten die Angaben als nicht aktuell („… rechnen stornierte Proben noch mit (P2 PAK) – bitte neue Angaben anfordern“).
- **Stornierte Proben im Rechnungsblock:** Neuere Angaben nennen die in LabelKit stornierten (nicht abgerechneten) Proben; hat eine davon laut ResultKit ein Laborergebnis (`_Ergebnisse.json`, Feld `storniertMitWert`, nur gelesen), steht das dabei. `_Ergebnisse.json` gehört nicht zu den Quellen der Angaben.
- **Korrektur beim Gegenlesen:** Ändert sich eine abgerechnete Mitteilung nach den Angaben, vergleicht BüroKit ihre Seitenzahl (Word: `docProps/app.xml`, PDF: gezählt) mit der abgerechneten. Nur eine andere Seitenzahl macht die Angaben veraltet; gleiche oder nicht sicher lesbare Seitenzahl → gelbe Zeile.
- Tests: `tests/kollegen-browser.cjs` (zwei Fenster), neue Fälle in `tests/abrechnung.cjs`; `tests/aufgaben.cjs` vergleicht `buero-aufgaben.js` jetzt auch von BüroKit aus byte-gleich mit der Projektzentrale (in CI Pflicht).

## Neu in 1.9.0 · 13.11.2026

- **Mitteilung und Anschreiben getrennt öffnen:** BüroKit liest den Ordner „Mitteilungen“ der offenen Gutachten und zeigt unter „Das geht mit“ den Bericht *und* die Anschreiben dieser Mitteilung, jedes mit „In Word öffnen“ und „Pfad kopieren“. Anschreiben gehören über die Nummer zur Mitteilung („Anschreiben 1. Mitteilung.docx“, „Anschreiben_2. Mitteilung_Auftraggeber.docx“), ohne Nummer über den Namen der Mitteilung.
- **Nennt eine Übergabe das Anschreiben statt der Mitteilung** (ältere Übergaben, Wahl von Hand), nimmt BüroKit die Mitteilung mit derselben Nummer – für Titel, „In Word öffnen“ beim Gegenlesen, „Word-Pfad kopieren“ und das Anschreiben. Ist sie nicht da, steht das in der Karte.
- **2., 3. Mitteilung …:** jede Karte zeigt ihre eigene Mitteilung mit ihren Anschreiben; die übrigen Mitteilungen des Projekts (mit ihren Anschreiben) stehen zugeklappt unter „Andere Mitteilungen in diesem Projekt“.
- Entwürfe (`_Entwurf`, Vorlage, Vorbereitung) und Word-Sperrdateien (`~$…`) zählen nicht; bei mehreren Fassungen derselben Nummer gilt die neueste. Gelesen wird höchstens einmal pro Minute je Projekt und sofort nach einem gespeicherten Anschreiben. Logik: `wordDateien` in `anschreiben.js`.

## Neu in 1.8.0 · 13.11.2026

- **Word-Dateien direkt öffnen:** „📝 In Word öffnen“ statt „Word-Pfad kopieren“ beim Gegenlesen, dazu „In Word öffnen“ neben „Pfad kopieren“ bei jeder Word-Datei im Versand-Schritt (Bericht, Word-Anlagen) und beim gespeicherten Anschreiben. Gleicher Weg wie „Bericht in Word öffnen“ in LexiKit: ein `ms-word:ofe|u|file:///…`-Link auf den Windows-Pfad aus „Mehr … › Pfad im Explorer“ (zum Bearbeiten, damit Korrekturen beim Gegenlesen gehen). Edge fragt beim ersten Mal „Word öffnen?“ – „Immer zulassen“ anhaken.
- Der Klick kopiert zusätzlich den Pfad – falls Word nicht aufgeht, geht es wie bisher mit Einfügen weiter.
- **„Pfad kopieren“ bleibt** für Outlook (Datei anfügen → Dateiname einfügen), ebenso „Projektordner-Pfad kopieren“ und „Word-Pfad kopieren“ unter den Unterlagen. Ordner öffnet der Browser nicht direkt.

## Neu in 1.7.0 · 05.11.2026

- **Anschreiben zur Mitteilung:** Im Versand-Schritt hat jeder Empfänger „📄 Anschreiben“. Ein einseitiger Brief mit Logo und Firmenkopf (wie das Deckblatt der Berichte), Anschriftfeld für den Fensterumschlag (DIN 5008 Form B), Infoblock (Ihr Zeichen = Schaden-Nr. beim Auftraggeber, sonst „Schaden-Nr.“; Unser Zeichen; Ansprechpartner; Datum), Betreff je Berichtsart, Text, Unterschrift (Bild aus `_Spektron-Unterschriften`, sonst Linie) und Anlagenliste.
  - Vorbelegt aus `_Projekt.json`, `_BerichtKit.json` (Berichtsart, Nr./Datum der Mitteilung, Anlagen), `_Spektron-BerichtKit.json` und der Mitarbeiterliste – alles nur gelesen. Anschrift, Anrede, Betreff, Text und Unterschrift sind vor dem Speichern änderbar.
  - Anrede aus „z. Hd. Frau/Herrn …“, sonst „Sehr geehrte Damen und Herren“.
  - „Eine Ausfertigung haben wir … übersandt.“ nennt die übrigen Empfänger des Verteilers – ohne den Adressaten und ohne Doppelte (gleiche E-Mail oder gleicher Name, z. B. VN beauftragt selbst). Niemand sonst → Satz entfällt.
  - „Word speichern“ legt `Anschreiben_<Mitteilung>_<Empfänger>.docx` in „Mitteilungen“ ab (vorhanden → ersetzen oder daneben). Der Name beginnt bewusst nicht mit „1. Mitteilung“, damit die Suite das Anschreiben nie für den Bericht hält. „E-Mail-Text kopieren“ und „Betreff kopieren“ liefern denselben Inhalt für die E-Mail.
  - Texte stehen an einer Stelle: `TEXTE` in `anschreiben.js`. Word-Baustein und Logo wie in BerichtKit (`vendor/docx.iife.js`, `assets/logo-schiffers.*`), nur beim ersten Anschreiben geladen.

## Neu in 1.6.0 · 05.11.2026 – einfache Oberfläche für die Bürokräfte

- Kopf mit Begrüßung („Guten Morgen, Nadine“) und Datum, „aktualisiert … · läuft von selbst“ und ein Knopf **„Mehr …“** (Jetzt neu laden, Kürzel wählen, Pfad im Explorer, Handbuch, Fehler oder Wunsch melden, Archivordner wechseln, Version).
- **Kürzel einmal wählen** – BüroKit fragt beim ersten Start, danach nur noch unter „Mehr …“.
- **Fünf Zähl-Kacheln** (überfällig · heute · später · Rechnung schreiben · diese Woche erledigt), Klick springt zur Gruppe; Zahl der fälligen Aufgaben im Fenstertitel („(3) BüroKit“) für die Taskleiste.
- **Karten:** Farbstreifen je Gruppe, **Schritt-Leiste** Gegenlesen → PDF → Versand → Rechnung (✓ / jetzt / später; Klick setzt einen Haken oder nimmt ihn nach Rückfrage zurück) und **ein großer Knopf für den nächsten Handgriff** („Gegengelesen ✓“ mit „Word-Pfad kopieren“, „PDF ist gemacht ✓“, „Weiter versenden (2 offen) →“, „Rechnung schreiben →“, bei eigenen Aufgaben „✓ Erledigt“). Titel aus der Word-Datei („1. Mitteilung“) statt „Gutachten“. Badges „neu“ (seit dem letzten Öffnen), „für dich“, „per Post“.
- **Rückfrage steht in der Karte** („Wartet auf Antwort: …“) mit „Antwort eintragen“.
- **Details je Schritt:** Versand = links „Das geht mit“ (Bericht + Anlagen, Pfad kopieren), rechts „An wen“ mit großem „Versandt ✓“ je Empfänger, E-Mail-Adresse/Anschrift kopieren; Rechnung = Anleitung in drei Schritten, Positionen, „① Positionen kopieren“ und „③ Rechnung geschrieben ✓“ (Warnung bei geändertem Stand wie bisher).
- **Volle Windows-Pfade** zum Einfügen in Outlook („Datei anfügen → Diesen PC durchsuchen → Dateiname“) und Explorer. Der Browser kennt nur den Ordnernamen – der Archivordner im Explorer wird einmal unter „Mehr …“ › „Pfad im Explorer“ eingestellt (vorbelegt `C:\Daten\<Archivordner>`).
- Daten, Dateien und Haken unverändert: `buero-aufgaben.js` und `buero-abrechnung.js` sind nicht angefasst, die Projektzentrale sieht alles wie bisher.

## Neu in 1.5.1 · 30.10.2026

- Gemeinsames Modul spektron-ordner.js: neuer Bereich „BerichtKit“ (Angaben zum Bericht in „_Spektron/BerichtKit“); sonst unverändert.

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

1. Einmal den **Archivordner** wählen (der Ordner mit allen Projektordnern, z. B. „Mosaik Archivordner“) und das eigene **Kürzel**. Der Browser merkt sich beides.
2. Oben zeigen die Kacheln, was heute dran ist. Jede Karte hat **einen großen Knopf** für den nächsten Handgriff.
3. **Gegenlesen:** „📝 In Word öffnen“ (beim ersten Mal in Edge „Immer zulassen“), lesen und korrigieren, dann „Gegengelesen ✓“. **PDF:** in Word als PDF speichern, dann „PDF ist gemacht ✓“.
4. **Versand:** „Jetzt versenden →“ zeigt, was mitgeht (Pfade kopieren) und an wen. Je Empfänger „📄 Anschreiben“ (Word speichern, E-Mail-Text kopieren), versenden, dann „Versandt ✓“.
5. **Rechnung:** „① Positionen kopieren“ (und „Rechnungskopf kopieren“), im Rechnungsprogramm einfügen, „③ Rechnung geschrieben ✓“. Die Projektzentrale zeigt dann „abgerechnet“.
6. Versehen? Auf den Schritt in der Leiste klicken nimmt den Haken (nach Rückfrage) zurück. „Details“ hat Rückfrage, „Ich kümmere mich“, Fälligkeit, Entfernen und den Verlauf.
7. **„＋ Neue Aufgabe“** legt eine eigene Aufgabe zu einem Projekt an (z. B. „Laborrechnung prüfen“), mit Fälligkeit und für wen.

Gutachten kommen aus der **Projektzentrale** („Ans Büro übergeben“). Rückfragen sieht der Sachverständige dort am Projekt und kann sie dort beantworten.

## Gespeichert wird

Je Projekt im Ordner `_Spektron/Buero` (ältere Projekte: `_Buero`), ohne zentrale Datei und ohne Server. Anschreiben landen als Word-Datei in „Mitteilungen“.

```text
<Archiv>/<JJ.Nummer Ort Kürzel>/_Buero/aufgaben/<id>.json   eine Aufgabe
<Archiv>/<JJ.Nummer Ort Kürzel>/_Buero/vermerke/<id>.json   ein Haken (oder sein Zurücknehmen)
```

Jede Datei wird einmal geschrieben und nie geändert – zwei Kollegen können sich nichts überschreiben. Der Stand eines Schritts ist der neueste Vermerk dazu. Frühere Büroübergaben der Projektzentrale (bis 1.27, `_Buero/<Auftrags-UUID>/`) werden mitgelesen und wie Aufgaben gezeigt.

Das Datenmodul `buero-aufgaben.js` ist in BüroKit und Projektzentrale byte-gleich. `buero-abrechnung.js` (nur BüroKit) liest den BelegKit-Stand und die Zeitdateien und schreibt nie in „Abrechnung“.

## Tests

```sh
node tests/aufgaben.cjs                    # Datenmodul gegen echte temporäre Ordner (+ byte-gleich mit ../projektzentrale)
node tests/abrechnung.cjs                  # BelegKit-Stand lesen, Quellen vergleichen, Kopierformat, je Person
node tests/anschreiben.cjs                 # Anschreiben: Verteiler-Satz ohne Doppelung, Anrede, Texte, echte Word-Datei
node tests/buerokit-browser.cjs chromium   # Oberfläche im echten Browser (Playwright)
node tests/kollegen-browser.cjs chromium   # zwei Büro-Fenster: Aktualisieren, doppelte Rechnung, Fälligkeit tippen
```
