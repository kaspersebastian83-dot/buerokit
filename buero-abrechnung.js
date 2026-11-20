/* BUEROKIT-ABRECHNUNG v1 – BüroKit liest den neuesten BelegKit-Stand eines Projekts (nur lesen, nie schreiben).

     <Projekt>/Abrechnung/<Nr>_Aufwand_<Datum>[_n].json   „Stand speichern“ in BelegKit: Positionen, Hinweise, SHA-256 jeder Quelle

   Das Büro überträgt die Positionen ins Rechnungsprogramm. Damit es nicht nach einem veralteten Stand abrechnet, werden die
   Quellen des Stands (Zeiten der Kollegen, LabelKit-Proben, Berichte, Fotos, Einstellungen) erneut gelesen und mit den
   gespeicherten Prüfsummen verglichen; neue Zeitdateien, die im Stand fehlen, werden ebenfalls gemeldet.
   Die Positionen der Rechnung stehen oben; „je Person“ (Stunden, km, Spesen, Übernachtungen je Kürzel, aus
   Abrechnung/Aufwand_<Kürzel>.json) ist nur fürs Büro und standardmäßig zugeklappt.
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
/* Spektron-Ordner (spektron-ordner.js, falls geladen): Die App-Daten liegen künftig in „<Projekt>/_Spektron/…“.
   In den Ständen stehen weiter die festen Namen („Abrechnung/…“, „Laboraufträge/…“, „Fotos/_Bildumbenenner.json“,
   „_Projekt.json“) – hier wird daraus der tatsächliche Ort. So bleiben auch Stände von vor dem Umzug prüfbar. */
async function bereichDir(projektDir, bereich, altOrdner){
  const SO = root.SpektronOrdner;
  if (!SO) return altOrdner ? unter(projektDir, altOrdner) : projektDir;
  return (await SO.ort(projektDir, bereich)).dir;
}
const FESTE_NAMEN = [['', '_Projekt.json', 'projekt'], [ORDNER, null, 'belegkit'], ['Laboraufträge', /_Daten\.json$/i, 'labelkit'], ['Fotos', '_Bildumbenenner.json', 'fotokit']];
async function quelleLesen(projektDir, pfad){
  const teile = pfad.split('/'), name = teile[teile.length - 1], ordner = teile.slice(0, -1).join('/');
  for (const [o, n, bereich] of FESTE_NAMEN){
    if (ordner !== o || (n && (typeof n === 'string' ? n !== name : !n.test(name)))) continue;
    const dir = await bereichDir(projektDir, bereich, o);
    return dir ? datei(dir, name) : null;
  }
  let dir = projektDir;
  for (const t of teile.slice(0, -1)){ dir = dir && await unter(dir, t); }
  return dir ? datei(dir, name) : null;
}
async function sha256(file){
  const c = (root.crypto || globalThis.crypto).subtle;
  const b = new Uint8Array(await c.digest('SHA-256', await file.arrayBuffer()));
  return Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
}

/* ---------- Seitenzahl einer geänderten Mitteilung (Audit Lauf 3, C6) ----------
   Eine abgerechnete Mitteilung, die sich nach dem Stand geändert hat (z. B. Korrektur beim Gegenlesen), macht den Stand nur
   veraltet, wenn sich ihre Seitenzahl geändert hat. Word: docProps/app.xml (<Pages>), PDF: Seiten gezählt – gleich halten mit
   BelegKit appXml / wordSeitenPlausibel / pdfSeiten. */
async function zipEintrag(file, gesucht){
  const b = new Uint8Array(await file.arrayBuffer()), v = new DataView(b.buffer, b.byteOffset, b.byteLength), dec = new TextDecoder();
  let eocd = -1; for (let i = b.length - 22; i >= Math.max(0, b.length - 66000); i--) if (v.getUint32(i, true) === 0x06054b50){ eocd = i; break; }
  if (eocd < 0) return null;
  const cdSize = v.getUint32(eocd + 12, true), cdOff = v.getUint32(eocd + 16, true);
  for (let p = cdOff; p + 46 <= cdOff + cdSize && v.getUint32(p, true) === 0x02014b50;){
    const meth = v.getUint16(p + 10, true), cs = v.getUint32(p + 20, true), nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), lo = v.getUint32(p + 42, true);
    if (dec.decode(b.subarray(p + 46, p + 46 + nl)) === gesucht){
      const start = lo + 30 + v.getUint16(lo + 26, true) + v.getUint16(lo + 28, true), roh = b.subarray(start, start + cs);
      if (meth === 0) return dec.decode(roh);
      const DS = (root.DecompressionStream || globalThis.DecompressionStream);
      if (meth === 8 && DS) return dec.decode(await new Response(new Blob([roh]).stream().pipeThrough(new DS('deflate-raw'))).arrayBuffer());
      return null;
    }
    p += 46 + nl + xl + cl;
  }
  return null;
}
function pdfSeiten(text){
  const s = str(text); if (!/^%PDF-/.test(s)) return null;
  const obj = new Map(), re = /(\d+)\s+(\d+)\s+obj\b([\s\S]*?)\bendobj\b/g; let m;
  while ((m = re.exec(s))) obj.set(m[1] + ' ' + m[2], m[3]);
  const ref = (body, name) => { const r = new RegExp('/' + name + '\\s+(\\d+)\\s+(\\d+)\\s+R').exec(str(body)); return r ? r[1] + ' ' + r[2] : null; };
  const roots = [...s.matchAll(/\/Root\s+(\d+)\s+(\d+)\s+R/g)];
  if (roots.length){
    const r = roots[roots.length - 1], kat = obj.get(r[1] + ' ' + r[2]), baum = kat && obj.get(ref(kat, 'Pages'));
    const c = baum && /\/Count\s+(\d+)/.exec(baum);
    if (c && +c[1] > 0) return +c[1];
  }
  let n = 0; for (const body of obj.values()) if (/\/Type\s*\/Page(?![a-zA-Z])/.test(body)) n++;
  return n > 0 ? n : null;
}
/** Seitenzahl der Datei jetzt – null, wenn nicht sicher lesbar (Word speichert sie nicht immer aktuell). */
async function seitenJetzt(file, name){
  try{
    if (/\.docx$/i.test(name)){
      const xml = await zipEintrag(file, 'docProps/app.xml'), g = n => { const m = new RegExp('<' + n + '>(\\d+)</' + n + '>').exec(str(xml)); return m ? Number(m[1]) : null; };
      const seiten = g('Pages'), woerter = g('Words');
      return seiten > 0 && !(woerter && woerter / seiten > 900) ? seiten : null;
    }
    if (/\.pdf$/i.test(name) && file.size < 80e6) return pdfSeiten(new TextDecoder('latin1').decode(await file.arrayBuffer()));
  }catch(e){}
  return null;
}

/* ---------- Stornierte Proben (Audit Lauf 3, C4/C5) ----------
   Gleich halten mit BelegKit labelkitInfo/storniert: fünf Listen, jede Probe mit wahrem „storniert“. BelegKit vor 1.17.0 hat
   stornierte Proben noch mitgezählt. */
const LK_LISTEN = [['proben', 'PAK'], ['chloridProben', 'Chlorid'], ['asbestProben', 'Asbest'], ['sonstigeProben', 'Sonstige'], ['brandgeruchProben', 'Brandgeruch']];
const probeNr = p => { for (const v of [p._nr, p.chloridNr]){ const n = Number(v); if (Number.isSafeInteger(n) && n > 0) return 'P' + n; } return ''; };
function stornierteProben(daten){
  const d = daten && typeof daten === 'object' ? daten : {};
  return LK_LISTEN.flatMap(([n, liste]) => (Array.isArray(d[n]) ? d[n] : []).filter(p => p && typeof p === 'object' && p.storniert).map(p => ({ nr: probeNr(p), liste })))
    .sort((a, b) => (Number(a.nr.slice(1)) || 1e9) - (Number(b.nr.slice(1)) || 1e9));
}
/** Stand von BelegKit/AufwandKit vor 1.17.0 (oder ohne erkennbare Version)? Diese Fassungen rechneten stornierte Proben mit. */
function standRechnetStornoMit(programm){
  const m = /^(BelegKit|AufwandKit)\s+(\d+)\.(\d+)(?:\.(\d+))?/i.exec(str(programm).trim());
  if (!m) return true;
  if (/^aufwandkit$/i.test(m[1])) return true;
  return +m[2] < 1 || (+m[2] === 1 && +m[3] < 17);
}
const probenText = l => l.map(x => (x.nr ? x.nr + ' ' : '') + x.liste).join(', ');
/** ResultKit-Übernahme (_Ergebnisse.json, nur lesen) – wie BelegKit ergebnisInfo. null = keine gültige Übernahme dieses Projekts. */
async function ergebnisInfo(projektDir){
  const dir = await bereichDir(projektDir, 'resultkit', 'Laborergebnisse');
  const f = dir ? await datei(dir, '_Ergebnisse.json') : null;
  if (!f) return null;
  const d = JSON.parse(await f.text());
  if (!d || typeof d !== 'object' || d.format !== 'spektron-ergebnisse' || d.version !== 1) return null;
  const nr = (/^(\d{2}\.\d{2,6})/.exec(str(projektDir.name).normalize('NFC').trim()) || [])[1] || '';
  if (str(d.projekt).trim() && nr && str(d.projekt).trim() !== nr) return null;
  const u = /^\d{4}-\d{2}-\d{2}/.exec(str(d.uebernommen));
  return { uebernommen: u ? u[0] : '', storniertMitWert: Array.isArray(d.storniertMitWert) ? d.storniertMitWert.map(x => str(x).trim().toUpperCase()).filter(Boolean) : null };
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
  const abr = await bereichDir(projektDir, 'belegkit', ORDNER), fehler = [];
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
 * Sind die Quellen noch so wie beim Stand? → {aktuell, geaendert: [Text], ungeprueft: [Text], hinweise: [Text], storno}
 * geaendert/ungeprueft machen den Stand veraltet; hinweise sind gelbe Zeilen ohne Wirkung auf „aktuell“.
 * storno: {proben: [{nr, liste}], mitgerechnet, erg} – stornierte Proben der LabelKit-Datei des Stands (für den Hinweis im Rechnungsblock).
 * archivDir: der Archivordner (für die Einstellungen); darf fehlen.
 */
async function standVergleichen(projektDir, stand, archivDir){
  const geaendert = [], ungeprueft = [], hinweise = [];
  const bekannt = new Set(stand.quellen.map(q => q.datei)), anders = new Set();
  const mitteilungen = [];
  for (const q of stand.quellen){
    let f = null;
    try{
      if (q.datei.startsWith(EINST)) f = archivDir ? await datei(archivDir, EINST) : undefined;
      else f = await quelleLesen(projektDir, q.datei);
    }catch(e){ ungeprueft.push(`${quelleName(q.datei)}: nicht lesbar (${e.message})`); continue; }
    if (f === undefined){ ungeprueft.push(`${quelleName(q.datei)}: Archivordner nicht verfügbar`); continue; }
    if (!f){ geaendert.push(`${quelleName(q.datei)} gibt es nicht mehr`); anders.add(q.datei); continue; }
    if (f.size !== q.bytes || await sha256(f) !== q.sha256){
      anders.add(q.datei);
      if (/^Mitteilungen\/[^/]+\.(docx|pdf)$/i.test(q.datei)) mitteilungen.push({ q, f });   // erst nach den Berichtsangaben bewerten (C6)
      else geaendert.push(`${quelleName(q.datei)} geändert`);
    }
  }
  // C6: geänderte Mitteilung – nur eine andere Seitenzahl als abgerechnet macht den Stand veraltet
  if (mitteilungen.length){
    let berichte = null;
    try{ const f = await quelleLesen(projektDir, ORDNER + '/_Abrechnung.json'); const o = f ? JSON.parse(await f.text()) : null; berichte = o && o.berichte && typeof o.berichte === 'object' ? o.berichte : null; }catch(e){ berichte = null; }
    for (const { q, f } of mitteilungen){
      const name = q.datei.split('/').pop(), stamm = name.replace(/\.(docx?|pdf)$/i, '');
      const roh = berichte && berichte[stamm] ? str(berichte[stamm].seiten).trim() : '', abgerechnet = /^\d+$/.test(roh) ? +roh : null;
      const jetzt = await seitenJetzt(f, name);
      if (jetzt != null && abgerechnet != null && jetzt !== abgerechnet) geaendert.push(`${quelleName(q.datei)} geändert: jetzt ${jetzt} Seite${jetzt === 1 ? '' : 'n'}, abgerechnet ${abgerechnet}`);
      else if (jetzt != null && abgerechnet != null) hinweise.push(`${quelleName(q.datei)} wurde nach den Angaben geändert (z. B. beim Gegenlesen) – Seitenzahl gleich (${jetzt}), die Rechnung bleibt richtig.`);
      else hinweise.push(`${quelleName(q.datei)} wurde nach den Angaben geändert (z. B. beim Gegenlesen) – die Seitenzahl ließ sich nicht sicher lesen. Bitte in Word nachsehen, ob es noch ${abgerechnet != null ? abgerechnet + ' Seite' + (abgerechnet === 1 ? '' : 'n') : 'die abgerechnete Seitenzahl'} sind.`);
    }
  }
  // Neue Dateien, die BelegKit beim Stand noch nicht kannte
  try{
    const abr = await bereichDir(projektDir, 'belegkit', ORDNER);
    if (abr) for await (const h of abr.values()){
      if (h.kind !== 'file') continue;
      const pfad = ORDNER + '/' + h.name;
      if ((ZEITEN.test(h.name) || h.name === '_Abrechnung.json') && !bekannt.has(pfad)) geaendert.push(`${quelleName(pfad)} neu seit dem Stand`);
    }
  }catch(e){ ungeprueft.push(`Abrechnung: nicht lesbar (${e.message})`); }
  try{
    const la = await bereichDir(projektDir, 'labelkit', 'Laboraufträge'), t = Date.parse(stand.erstellt);
    if (la && Number.isFinite(t)) for await (const h of la.values()){
      if (h.kind !== 'file' || !/_Daten\.json$/i.test(h.name) || bekannt.has('Laboraufträge/' + h.name)) continue;
      const f = await datei(la, h.name);
      if (f && f.lastModified > t) geaendert.push(`Proben (LabelKit) neu seit dem Stand: ${h.name}`);
    }
  }catch(e){ ungeprueft.push(`Laboraufträge: nicht lesbar (${e.message})`); }
  // C4/C5: stornierte Proben der LabelKit-Datei, nach der abgerechnet wurde
  let storno = null;
  const lq = stand.quellen.find(q => /^Laborauftr[^/]*\/[^/]+_Daten\.json$/i.test(q.datei));
  if (lq && !anders.has(lq.datei)){
    try{
      const f = await quelleLesen(projektDir, lq.datei), proben = f ? stornierteProben(JSON.parse(await f.text())) : [];
      if (proben.length){
        const mitgerechnet = standRechnetStornoMit(stand.programm);
        let erg = null; try{ erg = await ergebnisInfo(projektDir); }catch(e){ erg = null; }
        storno = { proben, mitgerechnet, erg };
        if (mitgerechnet) geaendert.push(`Diese Angaben wurden mit ${stand.programm || 'einer älteren BelegKit-Fassung'} gespeichert und rechnen stornierte Proben noch mit (${probenText(proben)}) – bitte neue Angaben anfordern.`);
      }
    }catch(e){ ungeprueft.push(`Proben (LabelKit): nicht lesbar (${e.message})`); }
  }
  return { aktuell: !geaendert.length && !ungeprueft.length, geaendert, ungeprueft, hinweise, storno };
}

/** Text zu stornierten Proben für den Rechnungsblock (C5): '' wenn nichts zu sagen ist. */
function stornoText(storno){
  if (!storno || !storno.proben.length || storno.mitgerechnet) return '';
  const set = new Set(storno.erg && Array.isArray(storno.erg.storniertMitWert) ? storno.erg.storniertMitWert : []);
  const mit = storno.proben.filter(x => x.nr && set.has(x.nr.toUpperCase())), am = storno.erg && storno.erg.uebernommen ? ` (übernommen am ${storno.erg.uebernommen.split('-').reverse().join('.')})` : '';
  let t = `In LabelKit storniert und nicht abgerechnet: ${probenText(storno.proben)}.`;
  if (mit.length) t += ` ${probenText(mit)} ${mit.length === 1 ? 'hat' : 'haben'} laut ResultKit${am} aber ein Laborergebnis – soll${mit.length === 1 ? ' sie' : 'en sie'} berechnet werden, muss der Sachverständige das Storno in LabelKit aufheben und neue Angaben speichern.`;
  else if (storno.erg && Array.isArray(storno.erg.storniertMitWert)) t += ` Laut ResultKit${am} hat keine davon ein Laborergebnis.`;
  else if (storno.erg) t += ' Ob eine davon ein Laborergebnis hat, zeigt ResultKit nach „Erneut übernehmen“.';
  return t;
}

/** Rechnungskopf (C10): Empfänger, Ihr Zeichen, Objekt, Projekt – Zeilen zum Einfügen ins Rechnungsprogramm. */
function rechnungskopf({ anschrift, schadennummer, objekt, projekt, schadendatum }){
  const z = [];
  for (const x of anschrift || []) if (str(x).trim()) z.push(str(x).trim());
  if (z.length) z.push('');
  if (str(schadennummer).trim()) z.push(`Ihr Zeichen: ${str(schadennummer).trim()}`);
  if (str(projekt).trim()) z.push(`Unser Zeichen: ${str(projekt).trim()}`);
  if (str(objekt).trim()) z.push(`Objekt: ${str(objekt).trim()}`);
  if (str(schadendatum).trim()) z.push(`Schadentag: ${/^\d{4}-\d{2}-\d{2}$/.test(str(schadendatum).trim()) ? str(schadendatum).trim().split('-').reverse().join('.') : str(schadendatum).trim()}`);
  while (z.length && !z[z.length - 1]) z.pop();
  return z.join('\r\n');
}

/** Zahl wie in BelegKit: „7,5“ oder „7.5“; leer = 0; „1.250“ (mehrdeutig) oder Unlesbares = NaN. */
function zahlText(v){
  const r = str(v).trim().replace(/\s/g, '');
  if (!r) return 0;
  if (/^-?\d{1,3}(\.\d{3})+$/.test(r)) return NaN;
  const s = r.replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}
/**
 * Zeiten je Person aus Abrechnung/Aufwand_<Kürzel>.json → {personen: [{kuerzel, sv1, pn1, sv3, pn3, km, spesen, hotelAnzahl,
 * hotelBetrag, termine: [Datum], geaendert, unklar}], fehler: [Text]}. Ortstermin = Titel 1 (…1), Auswertung/Bericht = Titel 3 (…3).
 */
async function jePerson(projektDir){
  const abr = await bereichDir(projektDir, 'belegkit', ORDNER), personen = [], fehler = [];
  if (!abr) return { personen, fehler };
  for await (const h of abr.values()){
    const m = h.kind === 'file' && ZEITEN.exec(h.name);
    if (!m) continue;
    const kuerzel = m[1].toUpperCase();
    try{
      const f = await datei(abr, h.name);
      if (!f) continue;
      if (f.size > MAX_STAND) throw Error('Datei ist zu groß');
      const o = JSON.parse(await f.text());
      if (!o || o.format !== 'aufwandkit-zeiten' || !Array.isArray(o.eintraege)) throw Error('unbekanntes Format');
      const p = { kuerzel, sv1: 0, pn1: 0, sv3: 0, pn3: 0, km: 0, spesen: 0, hotelAnzahl: 0, hotelBetrag: 0, termine: [], geaendert: str(o.geaendert), unklar: 0 };
      const termine = new Set();
      for (const e of o.eintraege){
        if (!e || typeof e !== 'object') continue;
        const n = feld => { const x = zahlText(e[feld]); if (Number.isNaN(x) || x < 0){ p.unklar++; return 0; } return x; };
        const art = e.art === 'buero' ? 3 : 1, rolle = e.rolle === 'Probenehmer' ? 'pn' : 'sv';
        p[rolle + art] += n('stunden'); p.km += n('km'); p.spesen += n('spesen'); p.hotelAnzahl += n('hotelAnzahl'); p.hotelBetrag += n('hotelBetrag');
        if (art === 1 && /^\d{4}-\d{2}-\d{2}$/.test(str(e.datum))) termine.add(e.datum);
      }
      p.termine = [...termine].sort();
      personen.push(p);
    }catch(e){ fehler.push(`${h.name}: ${e.message}`); }
  }
  personen.sort((a, b) => a.kuerzel.localeCompare(b.kuerzel, 'de'));
  return { personen, fehler };
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

const api = { ORDNER, neuesterStand, standVergleichen, standBewerten, standPruefen, quelleName, jePerson, zahlText, tsv, fmt, euro,
  seitenJetzt, stornierteProben, standRechnetStornoMit, ergebnisInfo, stornoText, rechnungskopf };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BueroAbrechnung = api;
})(typeof window !== 'undefined' ? window : globalThis);
