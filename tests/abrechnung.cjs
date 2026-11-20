// buero-abrechnung.js gegen echte temporäre Ordner: neuester BelegKit-Stand, Prüfsummen der Quellen, neue Zeitdateien,
// Kopierformat fürs Rechnungsprogramm. Nur erfundene Daten.
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const R = require('../buero-abrechnung.js');
const notfound = () => Object.assign(Error('Nicht gefunden'), { name: 'NotFoundError' });
class Dir {
  constructor(p){ this.path = p; this.name = path.basename(p); this.kind = 'directory'; }
  async getDirectoryHandle(n){ const p = path.join(this.path, n); try{ if (!(await fs.stat(p)).isDirectory()) throw 0; }catch{ throw notfound(); } return new Dir(p); }
  async getFileHandle(n){
    const p = path.join(this.path, n); try{ await fs.access(p); }catch{ throw notfound(); }
    return { name: n, kind: 'file', getFile: async () => { const b = await fs.readFile(p), st = await fs.stat(p);
      return { size: b.length, lastModified: st.mtimeMs, text: async () => b.toString(), arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) }; } };
  }
  async *values(){ for (const e of await fs.readdir(this.path, { withFileTypes: true })) yield e.isDirectory() ? new Dir(path.join(this.path, e.name)) : { kind: 'file', name: e.name }; }
}
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
/** Kleine .docx (ZIP) mit docProps/app.xml (deflate wie Word). */
function docx(seiten, woerter, text = ''){
  const zlib = require('node:zlib'), dateien = [['word/document.xml', `<w:document>${text}</w:document>`], ['docProps/app.xml', `<Properties><Pages>${seiten}</Pages><Words>${woerter}</Words></Properties>`]];
  const lokal = [], zentral = []; let off = 0;
  for (const [name, inhalt] of dateien){
    const roh = Buffer.from(inhalt), dat = zlib.deflateRawSync(roh), n = Buffer.from(name), crc = zlib.crc32 ? zlib.crc32(roh) : 0;
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(8, 8); h.writeUInt32LE(crc >>> 0, 14); h.writeUInt32LE(dat.length, 18); h.writeUInt32LE(roh.length, 22); h.writeUInt16LE(n.length, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(8, 10); c.writeUInt32LE(crc >>> 0, 16); c.writeUInt32LE(dat.length, 20); c.writeUInt32LE(roh.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(off, 42);
    lokal.push(h, n, dat); zentral.push(c, n); off += 30 + n.length + dat.length;
  }
  const cd = Buffer.concat(zentral), e = Buffer.alloc(22); e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(dateien.length, 8); e.writeUInt16LE(dateien.length, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat([...lokal, cd, e]);
}
let n = 0; const ok = async (name, fn) => { await fn(); n++; console.log('OK ' + name); };

(async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'buerokit-abr-'));
  try{
    const PROJ = '26.0560 Musterstadt Dr. Ka', pd = path.join(tmp, PROJ), abr = path.join(pd, 'Abrechnung'), lab = path.join(pd, 'Laboraufträge');
    await fs.mkdir(abr, { recursive: true }); await fs.mkdir(lab, { recursive: true });
    const archiv = new Dir(tmp), projekt = await archiv.getDirectoryHandle(PROJ);
    const schreib = async (p, t) => { await fs.writeFile(p, t); return Buffer.from(t); };
    const zeitBen = await schreib(path.join(abr, 'Aufwand_BEN.json'), '{"format":"aufwandkit-zeiten","eintraege":[1]}');
    const daten = await schreib(path.join(lab, '26.0560_Daten.json'), '{"proben":[]}');
    const einst = await schreib(path.join(tmp, '_AufwandKit-Einstellungen.json'), '{"format":"aufwandkit-einstellungen"}');
    const stand = (erstellt, quellen) => JSON.stringify({ format: 'aufwandkit-stand', version: 1, projekt: PROJ, erstellt, von: 'BEN', programm: 'BelegKit 1.10.1',
      titel: [{ nr: 1, text: 'Ortstermin am 21.10.2026\nZeitaufwand', summe: 300, zeilen: [{ nr: '1.001', text: 'Sachverständiger', menge: 2.5, einheit: 'Std.', preis: 120, gesamt: 300 }] },
              { nr: 2, text: 'Analysen', summe: null, zeilen: [{ nr: '2.010', text: 'PAK Wischprobe', menge: 12, einheit: 'St.', preis: null, gesamt: null }] }],
      hinweise: ['3.002: Satz fehlt'], netto: null, quellen });
    const q = [{ datei: 'Abrechnung/Aufwand_BEN.json', bytes: zeitBen.length, sha256: sha(zeitBen) }, { datei: 'Laboraufträge/26.0560_Daten.json', bytes: daten.length, sha256: sha(daten) },
               { datei: '_AufwandKit-Einstellungen.json (Archivordner)', bytes: einst.length, sha256: sha(einst) }];

    await ok('kein Ordner „Abrechnung“ / kein Stand: kein Fehler, nur leer', async () => {
      await fs.mkdir(path.join(tmp, '26.0561 Leer'));
      const r = await R.neuesterStand(await archiv.getDirectoryHandle('26.0561 Leer'));
      assert.equal(r.stand, null); assert.equal(r.anzahl, 0);
      const r2 = await R.neuesterStand(projekt); assert.equal(r2.stand, null);
    });

    await fs.writeFile(path.join(abr, '26.0560_Aufwand_2026-10-27.json'), stand('2026-10-27T10:00:00.000Z', q));
    await fs.writeFile(path.join(abr, '26.0560_Aufwand_2026-10-28.json'), stand('2026-10-28T09:00:00.000Z', q));
    await fs.writeFile(path.join(abr, '26.0560_Aufwand_2026-10-28_2.json'), stand('2026-10-28T10:00:00.000Z', q));
    await fs.writeFile(path.join(abr, '26.0560_Aufwand_2026-10-28_2.csv'), 'egal');

    await ok('neuester Stand: Datum, dann laufende Nummer', async () => {
      const r = await R.neuesterStand(projekt);
      assert.equal(r.datei, 'Abrechnung/26.0560_Aufwand_2026-10-28_2.json'); assert.equal(r.anzahl, 3); assert.equal(r.stand.erstellt, '2026-10-28T10:00:00.000Z');
      assert.equal(r.stand.titel[0].zeilen[0].menge, 2.5); assert.deepEqual(r.stand.hinweise, ['3.002: Satz fehlt']);
    });

    await ok('Kopieren wie in BelegKit: Position, Text, Menge, Einheit', async () => {
      const t = R.tsv((await R.neuesterStand(projekt)).stand);
      assert.equal(t, 'Position\tText\tMenge\tEinheit\r\nTitel 1\tOrtstermin am 21.10.2026 – Zeitaufwand\t\t\r\n1.001\tSachverständiger\t2,5\tStd.\r\nTitel 2\tAnalysen\t\t\r\n2.010\tPAK Wischprobe\t12\tSt.\r\n');
    });

    await ok('Quellen unverändert: aktuell', async () => {
      const v = await R.standVergleichen(projekt, (await R.neuesterStand(projekt)).stand, archiv);
      assert.deepEqual(v, { aktuell: true, geaendert: [], ungeprueft: [], hinweise: [], storno: null });
    });

    await ok('geänderte Zeiten, neue Zeitdatei eines Kollegen, neuere LabelKit-Datei: gemeldet', async () => {
      await fs.writeFile(path.join(abr, 'Aufwand_BEN.json'), '{"format":"aufwandkit-zeiten","eintraege":[1,2]}');
      await fs.writeFile(path.join(abr, 'Aufwand_NAD.json'), '{}');
      const neu = path.join(lab, '26.0560_v2_Daten.json'); await fs.writeFile(neu, '{}'); await fs.utimes(neu, new Date('2026-10-29'), new Date('2026-10-29'));
      const v = await R.standVergleichen(projekt, (await R.neuesterStand(projekt)).stand, archiv);
      assert.equal(v.aktuell, false);
      assert.deepEqual(v.geaendert.sort(), ['Proben (LabelKit) neu seit dem Stand: 26.0560_v2_Daten.json', 'Zeiten BEN geändert', 'Zeiten NAD neu seit dem Stand'].sort());
    });

    await ok('ohne Archivordner: Einstellungen „ungeprüft“ statt still übergangen', async () => {
      const v = await R.standVergleichen(projekt, (await R.neuesterStand(projekt)).stand, null);
      assert.ok(v.ungeprueft.some(x => /Einstellungen/.test(x)));
    });

    await ok('beschädigter neuester Stand: gemeldet, nächstälterer gilt; fremdes Projekt abgelehnt', async () => {
      await fs.writeFile(path.join(abr, '26.0560_Aufwand_2026-10-29.json'), '{kaputt');
      await fs.writeFile(path.join(abr, '26.0560_Aufwand_2026-10-30.json'), stand('2026-10-30T10:00:00.000Z', q).replace(PROJ, '26.0999 Anderswo'));
      const r = await R.neuesterStand(projekt);
      assert.equal(r.datei, 'Abrechnung/26.0560_Aufwand_2026-10-28_2.json'); assert.equal(r.fehler.length, 2);
      assert.match(r.fehler.join('\n'), /gehört zu „26\.0999 Anderswo“/);
      const v = R.standBewerten(r, { aktuell: true, geaendert: [], ungeprueft: [] });
      assert.equal(v.aktuell, false, 'neuerer Stand unbrauchbar: älterer gilt nicht als aktuell'); assert.equal(v.ungeprueft.length, 2); assert.match(v.ungeprueft[0], /^Neuerer Abrechnungsstand nicht verwendbar – /);
      assert.equal(R.standBewerten({ fehler: [] }, { aktuell: true, geaendert: [], ungeprueft: [] }).aktuell, true);
    });

    await ok('Kopieren: Tabulator und Zeilenumbruch in Texten verschieben keine Spalten oder Zeilen', async () => {
      const t = R.tsv({ titel: [{ nr: 1, text: 'Ortstermin\nZeit\taufwand', zeilen: [{ nr: '1.001', text: 'Sachverständiger\tvor Ort\r\nund Büro', menge: 2.5, einheit: 'Std.\n' }] }] });
      const zeilen = t.trimEnd().split('\r\n');
      assert.equal(zeilen.length, 3); assert.ok(zeilen.every(z => z.split('\t').length === 4), zeilen.join(' | '));
      assert.equal(zeilen[1], 'Titel 1\tOrtstermin – Zeit aufwand\t\t'); assert.equal(zeilen[2].split('\t')[1], 'Sachverständiger vor Ort – und Büro');
    });

    await ok('je Person: Ortstermin/Bericht, SV/PN, km, Spesen, Übernachtung; Komma-Zahlen; Unklares gezählt; kaputte Datei genannt', async () => {
      await fs.writeFile(path.join(abr, 'Aufwand_BEN.json'), JSON.stringify({ format: 'aufwandkit-zeiten', version: 1, eintraege: [
        { datum: '2026-10-21', art: 'ort', rolle: 'Sachverständiger', stunden: '3,5', km: '84', spesen: '1' },
        { datum: '2026-10-22', art: 'ort', rolle: 'Sachverständiger', stunden: '2', km: '', hotelAnzahl: '1', hotelBetrag: '89,50' },
        { datum: '2026-10-25', art: 'buero', rolle: 'Sachverständiger', stunden: '4' },
        { datum: '2026-10-21', art: 'ort', rolle: 'Probenehmer', stunden: '1.250' } ] }));
      await fs.writeFile(path.join(abr, 'Aufwand_NAD.json'), JSON.stringify({ format: 'aufwandkit-zeiten', version: 1, eintraege: [{ datum: '2026-10-21', art: 'ort', rolle: 'Probenehmer', stunden: '3.5' }] }));
      await fs.writeFile(path.join(abr, 'Aufwand_RIC.json'), '{kaputt');
      const r = await R.jePerson(projekt);
      assert.deepEqual(r.personen.map(p => p.kuerzel), ['BEN', 'NAD']);
      const ben = r.personen[0];
      assert.deepEqual([ben.sv1, ben.pn1, ben.sv3, ben.km, ben.spesen, ben.hotelAnzahl, ben.hotelBetrag, ben.unklar], [5.5, 0, 4, 84, 1, 1, 89.5, 1]);
      assert.deepEqual(ben.termine, ['2026-10-21', '2026-10-22']);
      assert.equal(r.personen[1].pn1, 3.5);
      assert.equal(r.fehler.length, 1); assert.match(r.fehler[0], /Aufwand_RIC\.json/);
      assert.deepEqual(await R.jePerson(await archiv.getDirectoryHandle('26.0561 Leer')), { personen: [], fehler: [] });
    });

    // ---- Audit Lauf 3: C4 (alter Stand rechnet Storno mit), C5 (ResultKit-Hinweis), C6 (Mitteilung beim Gegenlesen geändert)
    const P2 = '26.0400 Test Ben', pd2 = path.join(tmp, P2);
    for (const d of ['Abrechnung', 'Mitteilungen', 'Laboraufträge', 'Laborergebnisse']) await fs.mkdir(path.join(pd2, d), { recursive: true });
    const lk2 = Buffer.from(JSON.stringify({ projekt: { nr: '26.0400' }, proben: [{ _nr: 1 }, { _nr: 2, storniert: { am: '2026-11-01' } }], chloridProben: [{ _nr: 3, storniert: true }] }));
    const w1 = docx(7, 2100, 'Fassung 1'), abrJson = Buffer.from(JSON.stringify({ berichte: { '1._Mitteilung_26.0400': { abrechnen: true, seiten: '7' } } }));
    await fs.writeFile(path.join(pd2, 'Laboraufträge', '26.0400_Daten.json'), lk2);
    await fs.writeFile(path.join(pd2, 'Mitteilungen', '1._Mitteilung_26.0400.docx'), w1);
    await fs.writeFile(path.join(pd2, 'Abrechnung', '_Abrechnung.json'), abrJson);
    const q2 = [{ datei: 'Laboraufträge/26.0400_Daten.json', bytes: lk2.length, sha256: sha(lk2) }, { datei: 'Mitteilungen/1._Mitteilung_26.0400.docx', bytes: w1.length, sha256: sha(w1) },
                { datei: 'Abrechnung/_Abrechnung.json', bytes: abrJson.length, sha256: sha(abrJson) }];
    const stand2 = programm => ({ format: 'aufwandkit-stand', version: 1, projekt: P2, erstellt: '2026-11-20T08:00:00.000Z', von: 'BEN', programm, titel: [], quellen: q2 });
    const p2 = await archiv.getDirectoryHandle(P2);

    await ok('C4: Stand aus BelegKit 1.16.1 mit stornierten Proben in unveränderter LabelKit-Datei → nicht aktuell, Proben genannt', async () => {
      const v = await R.standVergleichen(p2, R.standPruefen(stand2('BelegKit 1.16.1'), P2), null);
      assert.equal(v.aktuell, false);
      assert.deepEqual(v.geaendert, ['Diese Angaben wurden mit BelegKit 1.16.1 gespeichert und rechnen stornierte Proben noch mit (P2 PAK, P3 Chlorid) – bitte neue Angaben anfordern.']);
      for (const [pr, alt] of [['AufwandKit 1.20.0', true], ['', true], ['BelegKit 1.9.3', true], ['BelegKit 1.17.0', false], ['BelegKit 1.17.1', false], ['BelegKit 2.0.0', false]]) assert.equal(R.standRechnetStornoMit(pr), alt, pr);
    });

    await ok('C4/C5: Stand aus BelegKit 1.17.1 → aktuell; Hinweis nennt stornierte Proben, mit Laborergebnis laut ResultKit hervorgehoben', async () => {
      let v = await R.standVergleichen(p2, R.standPruefen(stand2('BelegKit 1.17.1'), P2), null);
      assert.equal(v.geaendert.length, 0); assert.equal(R.stornoText(v.storno), 'In LabelKit storniert und nicht abgerechnet: P2 PAK, P3 Chlorid.');
      await fs.writeFile(path.join(pd2, 'Laborergebnisse', '_Ergebnisse.json'), JSON.stringify({ format: 'spektron-ergebnisse', version: 1, projekt: '26.0400', uebernommen: '2026-11-19T10:00:00Z', storniertMitWert: ['P3'] }));
      v = await R.standVergleichen(p2, R.standPruefen(stand2('BelegKit 1.17.1'), P2), null);
      assert.match(R.stornoText(v.storno), /P3 Chlorid hat laut ResultKit \(übernommen am 19\.11\.2026\) aber ein Laborergebnis/);
      await fs.writeFile(path.join(pd2, 'Laborergebnisse', '_Ergebnisse.json'), JSON.stringify({ format: 'spektron-ergebnisse', version: 1, projekt: '26.0400', uebernommen: '2026-11-19T10:00:00Z' }));
      v = await R.standVergleichen(p2, R.standPruefen(stand2('BelegKit 1.17.1'), P2), null);
      assert.match(R.stornoText(v.storno), /zeigt ResultKit nach „Erneut übernehmen“/);
      await fs.writeFile(path.join(pd2, 'Laborergebnisse', '_Ergebnisse.json'), JSON.stringify({ format: 'spektron-ergebnisse', version: 1, projekt: '25.0100', storniertMitWert: ['P3'] }));
      v = await R.standVergleichen(p2, R.standPruefen(stand2('BelegKit 1.17.1'), P2), null);
      assert.equal(R.stornoText(v.storno), 'In LabelKit storniert und nicht abgerechnet: P2 PAK, P3 Chlorid.', 'Übernahme eines anderen Projekts zählt nicht');
      assert.ok(!q2.some(x => /_Ergebnisse/.test(x.datei)), '_Ergebnisse.json ist keine Quelle des Stands');
    });

    await ok('C6: Mitteilung geändert, gleiche Seitenzahl → gelbe Zeile, aktuell; andere Seitenzahl → veraltet; nicht lesbar → gelbe Zeile', async () => {
      const st = R.standPruefen(stand2('BelegKit 1.17.1'), P2), mitt = path.join(pd2, 'Mitteilungen', '1._Mitteilung_26.0400.docx');
      await fs.writeFile(mitt, docx(7, 2100, 'Fassung 2 – Tippfehler korrigiert'));
      let v = await R.standVergleichen(p2, st, null);
      assert.equal(v.geaendert.length, 0); assert.equal(v.hinweise.length, 1); assert.match(v.hinweise[0], /Seitenzahl gleich \(7\)/);
      await fs.writeFile(mitt, docx(8, 2400, 'Fassung 3 – Absatz ergänzt'));
      v = await R.standVergleichen(p2, st, null);
      assert.deepEqual(v.geaendert, ['Bericht 1._Mitteilung_26.0400.docx geändert: jetzt 8 Seiten, abgerechnet 7']);
      await fs.writeFile(mitt, docx(1, 5000, 'Word hat die Seitenzahl nicht aktualisiert'));
      v = await R.standVergleichen(p2, st, null);
      assert.equal(v.geaendert.length, 0); assert.match(v.hinweise[0], /Seitenzahl ließ sich nicht sicher lesen.*noch 7 Seiten/);
      await fs.writeFile(mitt, 'kein ZIP');
      v = await R.standVergleichen(p2, st, null);
      assert.equal(v.geaendert.length, 0); assert.match(v.hinweise[0], /nicht sicher lesen/);
    });

    await ok('C10: Rechnungskopf – Anschrift, Ihr Zeichen, Unser Zeichen, Objekt', async () => {
      assert.equal(R.rechnungskopf({ anschrift: ['Muster AG', 'z. Hd. Frau Beispiel', 'Musterweg 5', ''], schadennummer: 'SN-77', projekt: '26.0101', objekt: 'EFH, Am Hang 3' }),
        'Muster AG\r\nz. Hd. Frau Beispiel\r\nMusterweg 5\r\n\r\nIhr Zeichen: SN-77\r\nUnser Zeichen: 26.0101\r\nObjekt: EFH, Am Hang 3');
      assert.equal(R.rechnungskopf({ anschrift: [], projekt: '26.0101' }), 'Unser Zeichen: 26.0101');
    });

    console.log(`${n} Prüfungen Abrechnung bestanden`);
  }finally{ await fs.rm(tmp, { recursive: true, force: true }); }
})().catch(e => { console.error(e); process.exitCode = 1; });
