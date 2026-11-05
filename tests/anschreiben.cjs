// anschreiben.js: Satz „Eine Ausfertigung …“ je Verteiler (ohne Adressat, ohne Doppelte), Anrede, Betreff/Text je Berichtsart,
// Anlagen, Unterzeichner, E-Mail-Text und eine echte Word-Datei (docx-Bibliothek in Node). Nur erfundene Daten.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const A = require('../anschreiben.js');
let n = 0; const ok = async (name, fn) => { await fn(); n++; console.log('OK ' + name); };
const E = (gruppe, ...zeilen) => ({ id: 'e' + Math.random().toString(36).slice(2, 8), gruppe, label: gruppe, details: zeilen.join('\n') });

(async () => {
  const AG = E('versicherung', 'Eifel-Rur Versicherung VVaG', 'z. Hd. Frau Lennartz', 'sach@eifelrur-beispiel.de');
  const SV = E('sachverstaendiger', 'Ing.-Büro Mertens', 'mertens@ib-beispiel.de'), SV2 = E('sachverstaendiger', 'SV-Büro Kurz', 'kurz@beispiel.de');
  const VN = E('versicherungsnehmer', 'Bäckerei Classen GbR', 'Indestr. 88', '52249 Eschweiler'), SAN = E('sanierung', 'Brandsanierung Kreuder', 'dispo@kreuder-beispiel.de');
  const HV = E('sonstige', 'Hausverwaltung Rurblick GmbH', 'info@rurblick-beispiel.de');
  const AGm = E('versicherung', 'Herrn Klaus Meier', 'Lindenweg 5', '52146 Würselen'), VNm = E('versicherungsnehmer', 'Herr Klaus Meier', 'Lindenweg 5');
  const AGv2 = E('sachverstaendiger', 'Regulierer Peters', 'SACH@eifelrur-beispiel.de');
  const satz = (l, an) => A.ausfertigungSatz(l, an);

  await ok('Verteiler-Satz: nur übrige Empfänger, Dativ, Plural, Komma und „und“, kein Satz ohne andere', () => {
    assert.equal(satz([AG], AG), '');
    assert.equal(satz([AG, VN], AG), 'Eine Ausfertigung haben wir dem Versicherungsnehmer übersandt.');
    assert.equal(satz([AG, SV, VN], AG), 'Eine Ausfertigung haben wir dem beteiligten Sachverständigen und dem Versicherungsnehmer übersandt.');
    assert.equal(satz([AG, SV, VN], VN), 'Eine Ausfertigung haben wir dem Auftraggeber und dem beteiligten Sachverständigen übersandt.');
    assert.equal(satz([AG, SV, VN], SV), 'Eine Ausfertigung haben wir dem Auftraggeber und dem Versicherungsnehmer übersandt.');
    assert.equal(satz([AG, SV, SV2, VN, SAN], AG), 'Eine Ausfertigung haben wir den beteiligten Sachverständigen, dem Versicherungsnehmer und dem Sanierungsunternehmen übersandt.');
    assert.equal(satz([AG, SV, VN, SAN], SAN), 'Eine Ausfertigung haben wir dem Auftraggeber, dem beteiligten Sachverständigen und dem Versicherungsnehmer übersandt.');
    assert.equal(satz([AG, HV], AG), 'Eine Ausfertigung erhalten außerdem: Hausverwaltung Rurblick GmbH.');
  });

  await ok('Keine Doppelung: Adressat in zweiter Rolle fehlt, doppelte Stelle zählt einmal (Name oder E-Mail)', () => {
    assert.equal(satz([AGm, VNm, SV], AGm), 'Eine Ausfertigung haben wir dem beteiligten Sachverständigen übersandt.');
    assert.equal(satz([AGm, VNm, SV], VNm), 'Eine Ausfertigung haben wir dem beteiligten Sachverständigen übersandt.');
    assert.equal(satz([AGm, VNm, SV], SV), 'Eine Ausfertigung haben wir dem Auftraggeber übersandt.');
    assert.equal(satz([AG, AGv2, VN], AG), 'Eine Ausfertigung haben wir dem Versicherungsnehmer übersandt.');
    assert.equal(satz([AG, AGv2, VN], VN), 'Eine Ausfertigung haben wir dem Auftraggeber übersandt.');
    assert.equal(satz([AGm, VNm], AGm), '');
  });

  await ok('Anrede aus z. Hd./Frau/Herr, sonst Damen und Herren; Anschrift ohne E-Mail', () => {
    assert.equal(A.anrede(AG), 'Sehr geehrte Frau Lennartz,');
    assert.equal(A.anrede(AGm), 'Sehr geehrter Herr Klaus Meier,');
    assert.equal(A.anrede(E('x', 'Firma X', 'z. Hd. Herrn Dr. Peters')), 'Sehr geehrter Herr Dr. Peters,');
    assert.equal(A.anrede(VN), 'Sehr geehrte Damen und Herren,');
    assert.deepEqual(A.anschrift(AG), ['Eifel-Rur Versicherung VVaG', 'z. Hd. Frau Lennartz']);
  });

  const aufgabe = { word: 'Mitteilungen/1. Mitteilung.docx', empfaenger: [AG, SV, VN],
    anlagen: ['Laborergebnisse/AR-26-LZ-119305-01.pdf', 'Fotos/26.0571_Bilddokumentation_1.pdf', 'Fotos/26.0571_Bilddokumentation_2.pdf', 'Pläne/26.0571_Probenplan.pdf'] };
  const bk = { format: 'spektron-bericht', art: 'brand', form: { brand: { titel: 'Sanierungsvorschlag' } },
    berichte: [{ datei: '1. Mitteilung.docx', art: 'brand', mitteilung: 1, datum: '2026-11-05',
      anlagenListe: [{ nr: 1, art: 'pruefbericht', titel: 'Prüfbericht', dateien: ['Laborergebnisse/AR-26-LZ-119305-01.pdf'] },
        { nr: 2, art: 'bilddoku', titel: 'Bilddokumentation', dateien: ['Fotos/26.0571_Bilddokumentation_1.pdf', 'Fotos/26.0571_Bilddokumentation_2.pdf'] },
        { nr: 3, art: 'probenplan', titel: 'Probenplan', dateien: ['Pläne/26.0571_Probenplan.pdf'] }] }] };
  const pj = { objekt: 'Bäckerei Classen GbR, Indestr. 88, 52249 Eschweiler', schadennummer: 'SN 26-4711-0815', schadendatum: '2026-10-27' };
  const mitarbeiter = [{ ordnerKuerzel: 'Dr. Ka', name: 'Dr. Sebastian Kasper' }, { ordnerKuerzel: 'Luc', name: 'Lucas vom Dorp' }];
  const basis = { aufgabe, pj, bk, mitarbeiter, cfg: { personen: { Luc: { rolle: 'mt' } } }, projekt: { nr: '26.0571', ort: 'Indestr. Eschweiler', kuerzel: 'Dr. Ka' }, heute: '2026-11-05' };

  await ok('Brandbericht an den Auftraggeber: Betreff, Text, Ihr Zeichen, Anlagen aus BerichtKit, Unterzeichner, Dateiname', () => {
    const m = A.modell({ ...basis, an: AG });
    assert.equal(m.betreff, '1. Mitteilung – Sanierungsvorschlag (Brandschaden)');
    assert.equal(m.objekt, 'Bäckerei Classen GbR, Indestr. 88, 52249 Eschweiler · Schaden vom 27.10.2026');
    assert.equal(m.absaetze[0], 'anbei übersenden wir Ihnen unsere 1. Mitteilung vom 05.11.2026 mit dem Sanierungsvorschlag zum oben genannten Brandschaden.');
    assert.equal(m.absaetze[1], 'Der Prüfbericht des Labors, die Bilddokumentation und der Probenplan liegen als Anlagen bei. Eine Ausfertigung haben wir dem beteiligten Sachverständigen und dem Versicherungsnehmer übersandt.');
    assert.deepEqual(m.infos, [['Ihr Zeichen', 'SN 26-4711-0815'], ['Unser Zeichen', '26.0571 / Dr. Ka'], ['Ansprechpartner', 'Dr. Sebastian Kasper'], ['Datum', '05.11.2026']]);
    assert.deepEqual(m.anlagen, ['1. Mitteilung vom 05.11.2026', 'Anlage 1: Prüfbericht AR-26-LZ-119305-01', 'Anlage 2: Bilddokumentation', 'Anlage 3: Probenplan']);
    assert.deepEqual(m.unterzeichner, { kuerzel: 'Dr. Ka', name: 'Dr. Sebastian Kasper', rolle: 'Sachverständiger' });
    assert.equal(m.dateiname, 'Anschreiben_1. Mitteilung_versicherung.docx');
    assert.equal(m.perPost, false);
    // nicht wie eine Mitteilung benennen – sonst hält die Suite das Anschreiben für den Bericht
    assert.equal(/^\d+[._\s]*Mitteilung(?![a-zäöüß]).*\.docx$/i.test(m.dateiname), false);
  });

  await ok('An den VN: Schaden-Nr. statt Ihr Zeichen, per Post; Untersuchungsbericht; Asbest; ohne BerichtKit aus der Übergabe', () => {
    const m = A.modell({ ...basis, an: VN });
    assert.equal(m.infos[0][0], 'Schaden-Nr.'); assert.equal(m.perPost, true); assert.equal(m.anrede, 'Sehr geehrte Damen und Herren,');
    const u = A.modell({ ...basis, an: AG, bk: { ...bk, form: { brand: { titel: 'Untersuchungsbericht' } } } });
    assert.equal(u.betreff, '1. Mitteilung – Untersuchungsbericht (Brandschaden)');
    const as = A.modell({ ...basis, an: AG, bk: { art: 'asbest', berichte: [{ datei: '2. Mitteilung.docx', art: 'asbest', mitteilung: 2, datum: '2026-11-06', anlagenListe: [] }] },
      aufgabe: { ...aufgabe, word: 'Mitteilungen/2. Mitteilung.docx', anlagen: [] } });
    assert.equal(as.betreff, '2. Mitteilung – Untersuchungsbericht (Asbest)');
    assert.match(as.absaetze[0], /Asbestuntersuchungen/);
    assert.match(as.absaetze[1], /^Eine Ausfertigung/);   // ohne Anlagen kein Anlagen-Satz
    const ohne = A.modell({ ...basis, an: AG, bk: null, pj: {} });
    assert.equal(ohne.betreff, '1. Mitteilung');
    assert.deepEqual(ohne.anlagen, ['1. Mitteilung', 'Anlage 1: AR-26-LZ-119305-01', 'Anlage 2: 26.0571 Bilddokumentation 1', 'Anlage 3: 26.0571 Bilddokumentation 2', 'Anlage 4: 26.0571 Probenplan']);
    assert.match(ohne.absaetze[1], /^Der Prüfbericht des Labors, die Bilddokumentation und der Probenplan liegen als Anlagen bei\./);
    assert.deepEqual(ohne.infos.map(x => x[0]), ['Unser Zeichen', 'Ansprechpartner', 'Datum']);
  });

  await ok('Unterzeichner: in BerichtKit gewählt > Zuständiger (SV) > erste SV, Messtechniker unterschreibt nicht von selbst', () => {
    assert.equal(A.modell({ ...basis, an: AG, bk: { ...bk, form: { sv: 'Luc' } } }).unterzeichner.name, 'Lucas vom Dorp');
    assert.equal(A.modell({ ...basis, an: AG, projekt: { ...basis.projekt, kuerzel: 'Luc' } }).unterzeichner.kuerzel, 'Dr. Ka');
    assert.equal(A.modell({ ...basis, an: AG, unterzeichnerKuerzel: 'Luc' }).unterzeichner.rolle, 'Messtechniker');
  });

  await ok('E-Mail-Text: gleicher Inhalt, Betreff mit Zeichen, Firmensignatur und Anlagen', () => {
    const m = A.modell({ ...basis, an: AG }), t = A.mailText(m);
    assert.equal(t.betreff, '1. Mitteilung – Sanierungsvorschlag (Brandschaden) · Bäckerei Classen GbR, Indestr. 88, 52249 Eschweiler · Ihr Zeichen SN 26-4711-0815 · Unser Zeichen 26.0571 / Dr. Ka');
    assert.match(t.text, /^Sehr geehrte Frau Lennartz,\n\nanbei übersenden/);
    assert.match(t.text, /Mit freundlichen Grüßen\n\nDr\. Sebastian Kasper\nSachverständiger\n\nDr\. Schiffers & Partner/);
    assert.match(t.text, /Anlagen:\n- 1\. Mitteilung vom 05\.11\.2026\n- Anlage 1: Prüfbericht AR-26-LZ-119305-01/);
  });

  await ok('Word-Datei: echte .docx mit Logo, Anschrift, Text und Unterschrift', async () => {
    vm.runInThisContext(fs.readFileSync(path.join(__dirname, '../vendor/docx.iife.js'), 'utf8') + ';globalThis.docx = docx;');
    const D = globalThis.docx, m = A.modell({ ...basis, an: AG });
    const png = fs.readFileSync(path.join(__dirname, '../assets/logo-schiffers.png'));
    const doc = A.dokument(D, m, { logoSvg: fs.readFileSync(path.join(__dirname, '../assets/logo-schiffers.svg')), logoPng: png, sig: { data: png, w: 393, h: 103 } });
    const buf = await D.Packer.toBuffer(doc);
    assert.ok(buf.length > 20000);
    assert.equal(buf.slice(0, 2).toString(), 'PK');
    if (process.env.ANSCHREIBEN_AUSGABE) fs.writeFileSync(process.env.ANSCHREIBEN_AUSGABE, buf);
    const s = buf.toString('latin1');
    assert.match(s, /word\/document\.xml/); assert.match(s, /word\/media\//);
  });

  console.log(`${n} Prüfungen bestanden`);
})().catch(e => { console.error(e); process.exit(1); });
