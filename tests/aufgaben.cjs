// Datenmodul buero-aufgaben.js gegen echte temporäre Ordner: Aufgaben anlegen, Haken setzen/wegnehmen, Versand je Empfänger,
// Rückfrage, eigene Aufgaben mit Fälligkeit, frühere Büroübergaben (Projektzentrale bis 1.27), kopierte Fremdaufgaben,
// beschädigte Einzeldateien. Nur erfundene Daten.
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), os = require('node:os'), path = require('node:path');
const B = require('../buero-aufgaben.js');
const notfound = () => Object.assign(Error('Nicht gefunden'), { name: 'NotFoundError' });
class Dir {
  constructor(p){ this.path = p; this.name = path.basename(p); this.kind = 'directory'; }
  async getDirectoryHandle(n, { create = false } = {}){ const p = path.join(this.path, n); if (create) await fs.mkdir(p, { recursive: true }); try{ if (!(await fs.stat(p)).isDirectory()) throw 0; }catch{ throw notfound(); } return new Dir(p); }
  async getFileHandle(n, { create = false } = {}){
    const p = path.join(this.path, n); if (create) await fs.appendFile(p, ''); else try{ await fs.access(p); }catch{ throw notfound(); }
    return { name: n, kind: 'file', getFile: async () => { const b = await fs.readFile(p); return { size: b.length, text: async () => b.toString() }; },
      createWritable: async () => { let t = ''; return { write: async x => { t += x; }, close: async () => fs.writeFile(p, t), abort: async () => {} }; } };
  }
  // Reihenfolge der Einträge wie im Dateisystem; Dir.reihenfolge = 'auf' | 'ab' erzwingt sie (Tests, die nicht davon abhängen dürfen)
  async *values(){ const l = await fs.readdir(this.path, { withFileTypes: true }); if (Dir.reihenfolge){ l.sort((x, y) => x.name.localeCompare(y.name)); if (Dir.reihenfolge === 'ab') l.reverse(); } for (const e of l) yield e.isDirectory() ? new Dir(path.join(this.path, e.name)) : { kind: 'file', name: e.name }; }
}
let n = 0; const ok = async (name, fn) => { await fn(); n++; console.log('OK ' + name); };

(async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'buerokit-')), archiv = new Dir(tmp);
  try{
    const p = await archiv.getDirectoryHandle('26.0101 Musterstadt Ben', { create: true });
    await archiv.getDirectoryHandle('26.0102 Ohne Büro', { create: true });
    await archiv.getDirectoryHandle('Kein Projekt', { create: true });
    let a;

    await ok('Gutachten übergeben: Empfänger aus den Projektdaten, Pflichtangaben', async () => {
      const v = B.empfaengerVorschlag({ auftraggeber: 'Muster AG, Musterweg 5, 99999 Fiktivstadt', sachverstaendigerBeteiligt: '', versicherungsnehmer: 'Erika Beispiel' });
      assert.deepEqual(v.map(r => [r.gruppe, r.an]), [['versicherung', true], ['sachverstaendiger', false], ['versicherungsnehmer', false], ['sanierung', false]]);
      await assert.rejects(B.aufgabeAnlegen(p, { art: 'gutachten', von: 'Ben', empfaenger: [] }), /Empfänger/);
      await assert.rejects(B.aufgabeAnlegen(p, { art: 'gutachten', von: '', empfaenger: v.filter(r => r.an) }), /Kürzel/);
      await assert.rejects(B.aufgabeAnlegen(await archiv.getDirectoryHandle('Kein Projekt'), { art: 'eigene', titel: 'x', von: 'Ben' }), /kein Projektordner/);
      a = await B.aufgabeAnlegen(p, { art: 'gutachten', von: 'Ben', word: 'Mitteilungen/Gutachten 26.0101.docx', faellig: '2026-11-03', hinweis: 'Mappe liegt im Fach',
        empfaenger: [...v.filter(r => r.an), { gruppe: 'versicherungsnehmer', label: 'Versicherungsnehmer', details: 'Erika Beispiel, Beispielweg 1' }] });
      const r = await B.projektLesen(p);
      assert.deepEqual(r.fehler, []); assert.equal(r.aufgaben.length, 1);
      const x = r.aufgaben[0];
      assert.equal(x.status, 'Neu'); assert.equal(x.faellig, '2026-11-03'); assert.equal(x.empfaenger.length, 2); assert.equal(x.projekt.nr, '26.0101');
      assert.equal(B.offenText(x), 'Gegenlesen · PDF · Versand · Rechnung'); assert.ok(x.rechnungNoetig); assert.equal(x.abgeschlossen, false);
    });

    await ok('Haken setzen und wieder wegnehmen – ohne Begründung; Versand je Empfänger; erledigt erst mit allem', async () => {
      const [r1, r2] = a.empfaenger.map(r => r.id);
      await B.vermerken(p, { aufgabe: a.id, schritt: 'gegenlesen', von: 'Nad' });
      await B.vermerken(p, { aufgabe: a.id, schritt: 'pdf', von: 'Nad', pdf: 'Mitteilungen/Gutachten 26.0101.pdf' });
      await B.vermerken(p, { aufgabe: a.id, schritt: 'versand', empfaenger: r1, von: 'Nad', datum: '2026-10-28' });
      let x = (await B.projektLesen(p)).aufgaben[0];
      assert.equal(x.status, 'In Bearbeitung'); assert.equal(B.offenText(x), 'Versand 1/2 · Rechnung'); assert.equal(x.versand[r1].datum, '2026-10-28'); assert.equal(x.gegenlesen.von, 'Nad');
      await B.vermerken(p, { aufgabe: a.id, schritt: 'gegenlesen', wert: false, von: 'Nad' });   // versehentlich gehakt
      x = (await B.projektLesen(p)).aufgaben[0]; assert.equal(x.gegenlesen, null); assert.equal(B.offenText(x), 'Gegenlesen · Versand 1/2 · Rechnung');
      await B.vermerken(p, { aufgabe: a.id, schritt: 'gegenlesen', von: 'Nad' });
      await B.vermerken(p, { aufgabe: a.id, schritt: 'versand', empfaenger: r2, von: 'Ric' });
      x = (await B.projektLesen(p)).aufgaben[0]; assert.equal(x.status, 'Erledigt'); assert.ok(x.erledigtAm); assert.equal(x.verlauf.length, 6);
      // versandt heißt noch nicht abgeschlossen: die Rechnung fehlt
      assert.equal(x.abgeschlossen, false); assert.equal(B.offenText(x), 'Rechnung'); assert.equal(B.alsDurchlauf([x])[0].status, 'Erledigt');
    });

    await ok('Rechnung: eigener Haken mit BelegKit-Stand; erst dann abgeschlossen; wieder wegnehmen geht', async () => {
      const versandtAm = (await B.projektLesen(p)).aufgaben[0].erledigtAm; await new Promise(r => setTimeout(r, 15));
      await B.vermerken(p, { aufgabe: a.id, schritt: 'rechnung', von: 'Nad', stand: 'Abrechnung/26.0101_Aufwand_2026-10-28.json' });
      let x = (await B.projektLesen(p)).aufgaben[0];
      assert.equal(x.erledigtAm, versandtAm, 'erledigt = versandt: Rechnung verschiebt den Zeitpunkt nicht'); assert.ok(x.abgeschlossenAm > versandtAm);
      assert.equal(x.rechnung.von, 'Nad'); assert.equal(x.rechnung.stand, 'Abrechnung/26.0101_Aufwand_2026-10-28.json');
      assert.equal(x.abgeschlossen, true); assert.ok(x.abgeschlossenAm >= x.erledigtAm); assert.equal(B.offenText(x), 'erledigt');
      await B.vermerken(p, { aufgabe: a.id, schritt: 'rechnung', wert: false, von: 'Nad' });
      x = (await B.projektLesen(p)).aufgaben[0]; assert.equal(x.rechnung, null); assert.equal(x.abgeschlossen, false);
      await B.vermerken(p, { aufgabe: a.id, schritt: 'rechnung', von: 'Nad' });
    });

    await ok('Anlagen: Pfade und Texte, ohne Doppelte und Leere', async () => {
      const g = await B.aufgabeAnlegen(p, { art: 'gutachten', von: 'Ben', empfaenger: [{ gruppe: 'versicherung', label: 'Auftraggeber', details: 'Muster AG' }],
        anlagen: ['Fotos/26.0101_Bilddokumentation.pdf', ' ', 'Laborberichte Eurofins', 'Fotos/26.0101_Bilddokumentation.pdf', 42] });
      const x = (await B.projektLesen(p)).aufgaben.find(y => y.id === g.id);
      assert.deepEqual(x.anlagen, ['Fotos/26.0101_Bilddokumentation.pdf', 'Laborberichte Eurofins']);
      await B.vermerken(p, { aufgabe: g.id, schritt: 'geloescht', von: 'Ben' });
    });

    await ok('Rückfrage und Antwort; Fälligkeit ändern; eigene Aufgabe mit „erledigt“', async () => {
      const e = await B.aufgabeAnlegen(p, { art: 'eigene', titel: 'Laborrechnung prüfen', von: 'Nad', fuer: 'Nad', faellig: '2026-10-27' });
      await assert.rejects(B.vermerken(p, { aufgabe: e.id, schritt: 'frage', von: 'Nad', text: ' ' }), /Text/);
      await B.vermerken(p, { aufgabe: e.id, schritt: 'frage', von: 'Nad', text: 'Welche Rechnung ist gemeint?' });
      let x = (await B.projektLesen(p)).aufgaben.find(y => y.id === e.id);
      assert.equal(x.status, 'Rückfrage'); assert.equal(x.frage.text, 'Welche Rechnung ist gemeint?'); assert.equal(x.fuer, 'Nad');
      await B.vermerken(p, { aufgabe: e.id, schritt: 'antwort', von: 'Ben', text: 'Eurofins, Oktober' });
      await B.vermerken(p, { aufgabe: e.id, schritt: 'faellig', von: 'Nad', datum: '2026-10-30' });
      x = (await B.projektLesen(p)).aufgaben.find(y => y.id === e.id);
      assert.equal(x.frage, null); assert.equal(x.status, 'Neu'); assert.equal(x.faellig, '2026-10-30'); assert.equal(B.offenText(x), 'offen');
      await B.vermerken(p, { aufgabe: e.id, schritt: 'erledigt', von: 'Nad' });
      x = (await B.projektLesen(p)).aufgaben.find(y => y.id === e.id); assert.equal(x.status, 'Erledigt');
      await B.vermerken(p, { aufgabe: e.id, schritt: 'erledigt', wert: false, von: 'Nad' });
      x = (await B.projektLesen(p)).aufgaben.find(y => y.id === e.id); assert.equal(x.status, 'Neu', 'wieder geöffnet');
      await B.vermerken(p, { aufgabe: e.id, schritt: 'geloescht', von: 'Nad' });
      x = (await B.projektLesen(p)).aufgaben.find(y => y.id === e.id); assert.equal(x.status, 'Zurückgezogen');
    });

    await ok('frühere Büroübergabe (Projektzentrale bis 1.27) wird als Aufgabe gelesen; neue Haken dazu wirken', async () => {
      const id = '11111111-2222-4333-8444-555555555555', d = await (await p.getDirectoryHandle('_Buero')).getDirectoryHandle(id, { create: true });
      const put = (name, o) => fs.writeFile(path.join(d.path, name), JSON.stringify(o));
      await put('auftrag.json', { format: 'spektron-buero', version: 1, id, created: '2026-10-26T09:00:00.000Z', content: { project: { name: '26.0101 Musterstadt Ben', nr: '26.0101', ort: 'Musterstadt' },
        word: 'Mitteilungen/Alt.docx', who: 'Dr. Ka', note: 'eilig', instruction: '', recipients: [{ id: 'r-1', group: 'versicherung', label: 'Auftraggeber', details: 'Muster AG' }, { id: 'r-2', group: 'versicherungsnehmer', label: 'Versicherungsnehmer', details: 'Erika Beispiel' }] } });
      const ev = (eid, at, type, payload) => put(`rueckmeldung-${eid}.json`, { format: 'spektron-buero', version: 1, id: eid, orderId: id, at, actor: 'Nad', parents: [], type, payload });
      await ev('e1aaaaaa-0000-4000-8000-000000000001', '2026-10-26T10:00:00.000Z', 'claim', {});
      await ev('e1aaaaaa-0000-4000-8000-000000000002', '2026-10-26T10:05:00.000Z', 'proof', {});
      await ev('e1aaaaaa-0000-4000-8000-000000000003', '2026-10-26T10:10:00.000Z', 'send', { ids: ['r-1'], date: '2026-10-26', pdf: '' });
      await ev('e1aaaaaa-0000-4000-8000-000000000004', '2026-10-26T10:20:00.000Z', 'question', { text: 'Anlage fehlt?' });
      let x = (await B.projektLesen(p)).aufgaben.find(y => y.id === id);
      assert.ok(x.alt); assert.equal(x.von, 'Dr. Ka'); assert.equal(x.hinweis, 'eilig'); assert.equal(x.word, 'Mitteilungen/Alt.docx');
      assert.equal(x.status, 'Rückfrage'); assert.ok(x.gegenlesen); assert.equal(x.pdf, null); assert.equal(x.versand['r-1'].datum, '2026-10-26'); assert.equal(x.uebernommen.von, 'Nad');
      await B.vermerken(p, { aufgabe: id, schritt: 'antwort', von: 'Dr. Ka', text: 'Nein, ist dabei' });
      await B.vermerken(p, { aufgabe: id, schritt: 'pdf', von: 'Nad' });
      await B.vermerken(p, { aufgabe: id, schritt: 'versand', empfaenger: 'r-2', von: 'Nad' });
      x = (await B.projektLesen(p)).aufgaben.find(y => y.id === id); assert.equal(x.status, 'Erledigt');
      assert.equal(x.rechnungNoetig, false); assert.equal(x.abgeschlossen, true); assert.deepEqual(x.anlagen, []);   // frühere Übergaben: ohne Rechnungsschritt
      const d2 = B.alsDurchlauf([x])[0]; assert.equal(d2.status, 'Erledigt'); assert.equal(d2.order.created, '2026-10-26T09:00:00.000Z'); assert.equal(d2.sent['r-1'].date, '2026-10-26');
    });

    await ok('frühere Büroübergabe mit zwei neuen Fassungen: die zeitlich letzte gilt, egal in welcher Reihenfolge die Dateien gelesen werden', async () => {
      const eigen = new Dir(await fs.mkdtemp(path.join(os.tmpdir(), 'buerokit-fassungen-'))), q = await eigen.getDirectoryHandle('26.0104 Fassungen', { create: true });   // eigenes Archiv: zählt nicht in den Archivlisten unten
      const id = '22222222-3333-4444-8555-666666666666', d = await (await q.getDirectoryHandle('_Buero', { create: true })).getDirectoryHandle(id, { create: true });
      const put = (name, o) => fs.writeFile(path.join(d.path, name), JSON.stringify(o));
      const rcp = label => [{ id: 'r-1', group: 'versicherung', label, details: 'Muster AG' }];
      await put('auftrag.json', { format: 'spektron-buero', version: 1, id, created: '2026-10-20T09:00:00.000Z', content: { project: { name: '26.0104 Fassungen', nr: '26.0104', ort: 'Fassungen' },
        word: 'Mitteilungen/Fassung 1.docx', who: 'Dr. Ka', note: 'erste', instruction: '', recipients: rcp('Auftraggeber') } });
      const ev = (eid, at, type, payload) => put(`rueckmeldung-${eid}.json`, { format: 'spektron-buero', version: 1, id: eid, orderId: id, at, actor: 'Dr. Ka', parents: [], type, payload });
      // Dateiname der neueren Fassung sortiert VOR der älteren
      await ev('f0000000-0000-4000-8000-000000000003', '2026-10-22T09:00:00.000Z', 'revise', { content: { word: 'Mitteilungen/Fassung 3.docx', note: 'dritte', recipients: rcp('Versicherung (neu)') } });
      await ev('f9999999-0000-4000-8000-000000000002', '2026-10-21T09:00:00.000Z', 'revise', { content: { word: 'Mitteilungen/Fassung 2.docx', note: 'zweite', recipients: rcp('Versicherung (alt)') } });
      try{
        for (const r of ['auf', 'ab']){
          Dir.reihenfolge = r;
          const x = (await B.projektLesen(q)).aufgaben.find(y => y.id === id);
          assert.equal(x.word, 'Mitteilungen/Fassung 3.docx', `Word-Fassung (Lesereihenfolge ${r})`);
          assert.equal(x.hinweis, 'dritte'); assert.equal(x.empfaenger[0].label, 'Versicherung (neu)');
          assert.equal(x.gegenlesen, null); assert.equal(x.pdf, null);
        }
      }finally{ Dir.reihenfolge = ''; await fs.rm(eigen.path, { recursive: true, force: true }); }
    });

    await ok('kopierte Aufgabe aus einem anderen Projekt und kaputte Einzeldatei: genannt, Rest bleibt sichtbar', async () => {
      const q = await archiv.getDirectoryHandle('26.0103 Anderswo', { create: true });
      const fremd = await B.aufgabeAnlegen(q, { art: 'eigene', titel: 'Fremd', von: 'Ric' });
      const auf = await (await p.getDirectoryHandle('_Buero')).getDirectoryHandle('aufgaben');
      await fs.copyFile(path.join(tmp, '26.0103 Anderswo', '_Buero', 'aufgaben', fremd.id + '.json'), path.join(auf.path, fremd.id + '.json'));
      await fs.writeFile(path.join(auf.path, 'aaaaaaaa-0000-4000-8000-00000000dead.json'), '');
      const r = await B.projektLesen(p);
      assert.ok(!r.aufgaben.some(y => y.id === fremd.id));
      assert.equal(r.fehler.length, 2); assert.match(r.fehler.join('\n'), /gehört zu „26\.0103 Anderswo“/); assert.match(r.fehler.join('\n'), /leer/);
      assert.equal(r.aufgaben.length, 4);   // inkl. der entfernten Anlagen-Aufgabe (bleibt nachvollziehbar)
    });

    await ok('Archiv lesen: nur Projektordner, nur „_Buero“ wird gelesen; Projektliste für „+ Aufgabe“', async () => {
      const r = await B.archivLesen(archiv);
      assert.deepEqual(r.projekte, ['26.0103 Anderswo', '26.0102 Ohne Büro', '26.0101 Musterstadt Ben']);
      assert.equal(r.aufgaben.filter(a => a.projekt.name === '26.0103 Anderswo').length, 1);
      assert.equal(r.aufgaben.length, 5);
    });

    await ok('nie überschreiben: gleicher Dateiname wird abgelehnt', async () => {
      const auf = await (await p.getDirectoryHandle('_Buero')).getDirectoryHandle('aufgaben');
      const vorher = (await fs.readdir(auf.path)).length;
      const realUuid = globalThis.crypto.randomUUID; const fest = a.id; globalThis.crypto.randomUUID = () => fest;
      try{ await assert.rejects(B.aufgabeAnlegen(p, { art: 'eigene', titel: 'Kollision', von: 'Ben' }), /gibt es schon/); }finally{ globalThis.crypto.randomUUID = realUuid; }
      assert.equal((await fs.readdir(auf.path)).length, vorher);
      assert.equal(JSON.parse(await fs.readFile(path.join(auf.path, a.id + '.json'), 'utf8')).art, 'gutachten');
    });

    await ok('NFD-Ordnername bleibt als erreichbarer Ordnername erhalten',async()=>{
      const raw='99.9001 Synthe\u0308tic A',dir=await archiv.getDirectoryHandle(raw,{create:true});
      await B.aufgabeAnlegen(dir,{art:'eigene',titel:'Synthetic task',von:'AA'});
      const r=await B.archivLesen(archiv),a=r.aufgaben.find(x=>x.projekt.nr==='99.9001');
      assert.equal(a.projekt.name,raw);assert.ok(r.projekte.includes(raw));
      assert.equal((await archiv.getDirectoryHandle(a.projekt.name)).name,raw);
    });

    console.log(`${n} Prüfungen BüroKit-Daten bestanden`);
  }finally{ await fs.rm(tmp, { recursive: true, force: true }); }
})().catch(e => { console.error(e); process.exitCode = 1; });
