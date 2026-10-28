/* BUEROKIT-ABRECHNUNG v1 – BüroKit liest den neuesten BelegKit-Stand eines Projekts (nur lesen, nie schreiben).

     <Projekt>/Abrechnung/<Nr>_Aufwand_<Datum>[_n].json   „Stand speichern“ in BelegKit: Positionen, Hinweise, SHA-256 jeder Quelle

   Das Büro überträgt die Positionen ins Rechnungsprogramm. Damit es nicht nach einem veralteten Stand abrechnet, werden die
   Quellen des Stands (Zeiten der Kollegen, LabelKit-Proben, Berichte, Fotos, Einstellungen) erneut gelesen und mit den
   gespeicherten Prüfsummen verglichen; neue Zeitdateien, die im Stand fehlen, werden ebenfalls gemeldet.
   Gezeigt werden nur die Positionen der Rechnung (Summen je Position) – keine Stunden einzelner Kollegen.
   Läuft im Browser (window.BueroAbrechnung) und in Node (module.exports, für Tests). */
(function(root){
'use strict';
const ORDNER = 'Abrechnung', FORMAT = 'aufwandkit-stand', EINST = '_AufwandKit-Einstellungen.json';
const STAND = /^(.+)_Aufwand_(\d{4}-\d{2}-\d{2})(?:_(\d+))?\.json$/i, ZEITEN = /^Aufwand_([A-Za-zÄÖÜäöü]{1,6})\.json$/;
const MAX_STAND = 4 * 1024 * 1024;
const fehlt = e => e && (e.name === 'NotFoundError' || e.name === 'TypeMismatchError');
const str = v => v == null ? '' : String(v);
const zahl = v => typeof v === 'number' && Number.isFinite(v) ? v : null;

async function unter(dir, name){
  try{ return await dir.getDirectoryHandle(name); }catch(e){ if (fehlt(e)) return null; throw e; }
}
async function datei(dir, name){
  try{ return await (await dir.getFileHandle(name)).getFile(); }catch(e){ if (fehlt(e)) return null; throw e; }
}
async function sha256(file){
  const c = (root.crypto || globalThis.crypto).subtle;
  const b = new Uint8Array(await c.digest('SHA-256', await file.arrayBuffer()));
  return Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
}

/** Mengen wie in BelegKit: höchstens zwei Nachkommastellen, deutsches Komma. */
function fmt(x){
  if (x == null || Number.isNaN(x)) return '';
  const r = Math.round(x * 100) / 100, d = Number.isInteger(r) ? 0 : Number.isInteger(r * 10) ? 1 : 2;
  return r.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
}
const euro = x => x == null || Number.isNaN(x) ? '' : (Math.round(x * 100) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

/** Stand prüfen und auf das Nötige kürzen. Wirft bei fremdem oder beschädigtem Format. */
function standPruefen(o, projektName){
  if (!o || o.format !== FORMAT || o.version !== 1 || !Array.isArray(o.titel)) throw Error('kein BelegKit-Stand (unbekanntes Format)');
  if (projektName && o.projekt && str(o.projekt).normalize('NFC') !== str(projektName).normalize('NFC')) throw Error(`gehört zu „${str(o.projekt).slice(0, 200)}“`);
  const titel = o.titel.filter(t => t && Array.isArray(t.zeilen)).map(t => ({
    nr: str(t.nr), text: str(t.text), summe: zahl(t.summe),
    zeilen: t.zeilen.filter(Boolean).map(x => ({ nr: str(x.nr), text: str(x.text), zusatz: str(x.zusatz), menge: zahl(x.menge), einheit: str(x.einheit), preis: zahl(x.preis), gesamt: zahl(x.gesamt) }))
  }));
  return { erstellt: str(o.erstellt), von: str(o.von), programm: str(o.programm), titel, netto: zahl(o.netto),
    hinweise: Array.isArray(o.hinweise) ? o.hinweise.map(str).filter(Boolean) : [],
    projektdaten: o.projektdaten && typeof o.projektdaten === 'object' ? o.projektdaten : {},
    quellen: Array.isArray(o.quellen) ? o.quellen.filter(q => q && typeof q.datei === 'string' && typeof q.sha256 === 'string') : [] };
}

/** Neuester lesbarer Stand: {stand, datei, anzahl, fehler} – stand null, wenn es keinen gibt. */
async function neuesterStand(projektDir){
  const abr = await unter(projektDir, ORDNER), fehler = [];
  if (!abr) return { stand: null, datei: '', anzahl: 0, fehler };
  const namen = [];
  for await (const h of abr.values()){ const m = h.kind === 'file' && STAND.exec(h.name); if (m) namen.push({ name: h.name, datum: m[2], n: +(m[3] || 1) }); }
  namen.sort((a, b) => b.datum.localeCompare(a.datum) || b.n - a.n);
  for (const k of namen){
    try{
      const f = await datei(abr, k.name);
      if (!f) continue;
      if (f.size > MAX_STAND) throw Error('Datei ist zu groß');
      const stand = standPruefen(JSON.parse(await f.text()), projektDir.name);
      return { stand, datei: ORDNER + '/' + k.name, anzahl: namen.length, fehler };
    }catch(e){ fehler.push(`${k.name}: ${e.message}`); }   // beschädigt: nächstälteren nehmen, aber melden
  }
  return { stand: null, datei: '', anzahl: namen.length, fehler };
}

/** Lesbarer Name einer Quelle („Zeiten BEN“, „Proben (LabelKit)“ …). */
function quelleName(pfad){
  const p = str(pfad), n = p.split('/').pop();
  const z = ZEITEN.exec(n);
  if (z) return `Zeiten ${z[1].toUpperCase()}`;
  if (n === '_Abrechnung.json') return 'Berichtsseiten (BelegKit)';
  if (n === '_Projekt.json') return 'Projektdaten';
  if (/^Laborauftr/i.test(p)) return 'Proben (LabelKit)';
  if (n === '_Bildumbenenner.json') return 'Fotos (FotoKit)';
  if (/^Mitteilungen\//i.test(p)) return `Bericht ${n}`;
  if (p.startsWith(EINST)) return 'BelegKit-Einstellungen';
  return p;
}

/**
 * Sind die Quellen noch so wie beim Stand? → {aktuell, geaendert: [Text], ungeprueft: [Text]}
 * archivDir: der Archivordner (für die Einstellungen); darf fehlen.
 */
async function standVergleichen(projektDir, stand, archivDir){
  const geaendert = [], ungeprueft = [];
  const bekannt = new Set(stand.quellen.map(q => q.datei));
  for (const q of stand.quellen){
    let f = null;
    try{
      if (q.datei.startsWith(EINST)) f = archivDir ? await datei(archivDir, EINST) : undefined;
      else {
        const teile = q.datei.split('/'); let dir = projektDir;
        for (const t of teile.slice(0, -1)){ dir = dir && await unter(dir, t); }
        f = dir ? await datei(dir, teile[teile.length - 1]) : null;
      }
    }catch(e){ ungeprueft.push(`${quelleName(q.datei)}: nicht lesbar (${e.message})`); continue; }
    if (f === undefined){ ungeprueft.push(`${quelleName(q.datei)}: Archivordner nicht verfügbar`); continue; }
    if (!f){ geaendert.push(`${quelleName(q.datei)} gibt es nicht mehr`); continue; }
    if (f.size !== q.bytes || await sha256(f) !== q.sha256) geaendert.push(`${quelleName(q.datei)} geändert`);
  }
  // Neue Dateien, die BelegKit beim Stand noch nicht kannte
  try{
    const abr = await unter(projektDir, ORDNER);
    if (abr) for await (const h of abr.values()){
      if (h.kind !== 'file') continue;
      const pfad = ORDNER + '/' + h.name;
      if ((ZEITEN.test(h.name) || h.name === '_Abrechnung.json') && !bekannt.has(pfad)) geaendert.push(`${quelleName(pfad)} neu seit dem Stand`);
    }
  }catch(e){ ungeprueft.push(`Abrechnung: nicht lesbar (${e.message})`); }
  try{
    const la = await unter(projektDir, 'Laboraufträge'), t = Date.parse(stand.erstellt);
    if (la && Number.isFinite(t)) for await (const h of la.values()){
      if (h.kind !== 'file' || !/_Daten\.json$/i.test(h.name) || bekannt.has('Laboraufträge/' + h.name)) continue;
      const f = await datei(la, h.name);
      if (f && f.lastModified > t) geaendert.push(`Proben (LabelKit) neu seit dem Stand: ${h.name}`);
    }
  }catch(e){ ungeprueft.push(`Laboraufträge: nicht lesbar (${e.message})`); }
  return { aktuell: !geaendert.length && !ungeprueft.length, geaendert, ungeprueft };
}

/** Wie „Kopieren“ in BelegKit: Position, Text, Menge, Einheit – tabulatorgetrennt fürs Rechnungsprogramm oder Excel. */
function tsv(stand){
  // Tabulator und Zeilenumbruch in einer Zelle würden beim Einfügen Spalten bzw. Zeilen verschieben
  const zelle = s => String(s == null ? '' : s).replace(/\r?\n/g, ' – ').replace(/[\t\r\n]+/g, ' ').trim();
  const z = ['Position\tText\tMenge\tEinheit'];
  for (const ti of stand.titel){ z.push([`Titel ${zelle(ti.nr)}`, zelle(ti.text), '', ''].join('\t')); for (const x of ti.zeilen) z.push([x.nr, x.text, fmt(x.menge), x.einheit].map(zelle).join('\t')); }
  return z.join('\r\n') + '\r\n';
}

/** Ist ein neuerer Stand unlesbar oder aus einem anderen Projekt, gilt der ältere nicht als aktuell (sonst Rechnung vom veralteten Stand). */
function standBewerten(r, v){
  if (!v || !r || !r.fehler || !r.fehler.length) return v;
  return { ...v, aktuell: false, ungeprueft: [...v.ungeprueft, ...r.fehler.map(f => `Neuerer Abrechnungsstand nicht verwendbar – ${f}`)] };
}

const api = { ORDNER, neuesterStand, standVergleichen, standBewerten, standPruefen, quelleName, tsv, fmt, euro };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BueroAbrechnung = api;
})(typeof window !== 'undefined' ? window : globalThis);
