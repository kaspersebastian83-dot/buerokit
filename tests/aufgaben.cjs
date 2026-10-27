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
  async *values(){ for (const e of await fs.readdir(this.path, { withFileTypes: true })) yield e.isDirectory() ? new Dir(path.join(this.path, e.name)) : { kind: 'file', name: e.name }; }
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
      assert.equal(B.offenText(x), 'Gegenlesen · PDF · Versand');
    });

    await ok('Haken setzen und wieder wegnehmen – ohne Begründung; Versand je Empfänger; erledigt erst mit allem', async () => {
      const [r1, r2] = a.empfaenger.map(r => r.id);
      await B.vermerken(p, { aufgabe: a.id, schritt: 'gegenlesen', von: 'Nad' });
      await B.vermerken(p, { aufgabe: a.id, schritt: 'pdf', von: 'Nad', pdf: 'Mitteilungen/Gutachten 26.0101.pdf' });
      await B.vermerken(p, { aufgabe: a.id, schritt: 'versand', empfaenger: r1, von: 'Nad', datum: '2026-10-28' });
      let x = (await B.projektLesen(p)).aufgaben[0];
      assert.equal(x.status, 'In Bearbeitung'); assert.equal(B.offenText(x), 'Versand 1/2'); assert.equal(x.versand[r1].datum, '2026-10-28'); assert.equal(x.gegenlesen.von, 'Nad');
      await B.vermerken(p, { aufgabe: a.id, schritt: 'gegenlesen', wert: false, von: 'Nad' });   // versehentlich gehakt
      x = (await B.projektLesen(p)).aufgaben[0]; assert.equal(x.gegenlesen, null); assert.equal(B.offenText(x), 'Gegenlesen · Versand 1/2');
      await B.vermerken(p, { aufgabe: a.id, schritt: 'gegenlesen', von: 'Nad' });
      await B.vermerken(p, { aufgabe: a.id, schritt: 'versand', empfaenger: r2, von: 'Ric' });
      x = (await B.projektLesen(p)).aufgaben[0]; assert.equal(x.status, 'Erledigt'); assert.ok(x.erledigtAm); assert.equal(x.verlauf.length, 6);
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
      const d2 = B.alsDurchlauf([x])[0]; assert.equal(d2.status, 'Erledigt'); assert.equal(d2.order.created, '2026-10-26T09:00:00.000Z'); assert.equal(d2.sent['r-1'].date, '2026-10-26');
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
      assert.equal(r.aufgaben.length, 3);
    });

    await ok('Archiv lesen: nur Projektordner, nur „_Buero“ wird gelesen; Projektliste für „+ Aufgabe“', async () => {
      const r = await B.archivLesen(archiv);
      assert.deepEqual(r.projekte, ['26.0103 Anderswo', '26.0102 Ohne Büro', '26.0101 Musterstadt Ben']);
      assert.equal(r.aufgaben.filter(a => a.projekt.name === '26.0103 Anderswo').length, 1);
      assert.equal(r.aufgaben.length, 4);
    });

    await ok('nie überschreiben: gleicher Dateiname wird abgelehnt', async () => {
      const auf = await (await p.getDirectoryHandle('_Buero')).getDirectoryHandle('aufgaben');
      const vorher = (await fs.readdir(auf.path)).length;
      const realUuid = globalThis.crypto.randomUUID; const fest = a.id; globalThis.crypto.randomUUID = () => fest;
      try{ await assert.rejects(B.aufgabeAnlegen(p, { art: 'eigene', titel: 'Kollision', von: 'Ben' }), /gibt es schon/); }finally{ globalThis.crypto.randomUUID = realUuid; }
      assert.equal((await fs.readdir(auf.path)).length, vorher);
      assert.equal(JSON.parse(await fs.readFile(path.join(auf.path, a.id + '.json'), 'utf8')).art, 'gutachten');
    });

    console.log(`${n} Prüfungen BüroKit-Daten bestanden`);
  }finally{ await fs.rm(tmp, { recursive: true, force: true }); }
})().catch(e => { console.error(e); process.exitCode = 1; });
