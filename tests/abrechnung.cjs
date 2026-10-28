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
      assert.deepEqual(v, { aktuell: true, geaendert: [], ungeprueft: [] });
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
    });

    console.log(`${n} Prüfungen Abrechnung bestanden`);
  }finally{ await fs.rm(tmp, { recursive: true, force: true }); }
})().catch(e => { console.error(e); process.exitCode = 1; });
