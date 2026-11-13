/* BüroKit – Anschreiben zur Mitteilung: ein einseitiger Brief je Empfänger (Word) und derselbe Text für die E-Mail.
   Nur rechnen und Word bauen, keine Dateizugriffe – BüroKit liest die Daten und speichert die Datei.

   Daten:   Aufgabe aus buero-aufgaben.js (Empfänger, Word-Datei, Anlagen), _Projekt.json (Objekt, Schaden-Nr., Schadendatum,
            Zuständig), _BerichtKit.json (Berichtsart, Nr. und Datum der Mitteilung, Anlagen-Liste, gewählte Unterschrift),
            _Spektron-BerichtKit.json (Namen/Rollen/Frau-Herr) und _Spektron-Mitarbeiter.json – alles nur gelesen.
   Layout:  wie das Deckblatt der Büroberichte (Logo + Firmenblock), Anschriftfeld für den Fensterumschlag (DIN 5008 Form B),
            Arial; dieselbe docx-Bibliothek und dasselbe Logo wie BerichtKit (vendor/docx.iife.js, assets/logo-schiffers.*).
   Texte:   stehen alle in TEXTE – dort ändern, nirgends sonst.

   Satz „Eine Ausfertigung …“: alle übrigen Empfänger des Verteilers, ohne den Adressaten und ohne Doppelte. „Dieselbe Stelle“
   = gleiche E-Mail-Adresse oder gleiche erste Anschriftzeile (ohne Herr/Herrn/Frau, Satzzeichen, Groß/klein) – z. B. VN
   beauftragt selbst (Auftraggeber = VN): Wer in der Anrede steht, kommt im Satz nicht noch einmal vor.
   Läuft im Browser (window.Anschreiben) und in Node (module.exports, für Tests). */
(function (root) {
'use strict';

const FIRMA = { name: 'Dr. Schiffers & Partner', strasse: 'Gouleystr. 59', ort: '52146 Würselen', tel: '02405-418 480',
  mail: 'Dr.Schiffers@t-online.de', web: 'https://dr-schiffers.de',
  zeilen: ['Sachverständige für die chemische Untersuchung von Brandfolgeschäden', 'Sachverständige für Schimmelpilzschäden in Innenräumen'] };

/* ---------- Texte (hier anpassen) ---------- */
const TEXTE = {
  // Betreff nach Berichtsart; n = Nummer der Mitteilung, titel = Sanierungsvorschlag/Untersuchungsbericht (Brand)
  betreff: {
    brand: (n, titel) => `${n}. Mitteilung – ${titel} (Brandschaden)`,
    asbest: n => `${n}. Mitteilung – Untersuchungsbericht (Asbest)`,
    sonst: n => `${n}. Mitteilung`,
  },
  // erster Satz; vom = „ vom 05.11.2026“ oder ''
  einleitung: {
    brand: (n, vom, titel) => `anbei übersenden wir Ihnen unsere ${n}. Mitteilung${vom} mit dem ${titel} zum oben genannten Brandschaden.`,
    asbest: (n, vom) => `anbei übersenden wir Ihnen unsere ${n}. Mitteilung${vom} mit dem Untersuchungsbericht zu den Asbestuntersuchungen im oben genannten Objekt.`,
    sonst: (n, vom) => `anbei übersenden wir Ihnen unsere ${n}. Mitteilung${vom} zum oben genannten Vorgang.`,
  },
  rueckfragen: 'Für Rückfragen stehen wir Ihnen gerne zur Verfügung.',
  gruss: 'Mit freundlichen Grüßen',
  // Empfängergruppen im Dativ [eins, mehrere] für „Eine Ausfertigung haben wir … übersandt.“
  dativ: { versicherung: ['dem Auftraggeber', 'den Auftraggebern'], sachverstaendiger: ['dem beteiligten Sachverständigen', 'den beteiligten Sachverständigen'],
    versicherungsnehmer: ['dem Versicherungsnehmer', 'den Versicherungsnehmern'], sanierung: ['dem Sanierungsunternehmen', 'den Sanierungsunternehmen'] },
  // Anlagen-Arten für den Satz „… liegen als Anlagen bei.“ [eins, mehrere]
  anlageArt: { pruefbericht: ['der Prüfbericht des Labors', 'die Prüfberichte des Labors'], bilddoku: ['die Bilddokumentation', 'die Bilddokumentation'],
    probenplan: ['der Probenplan', 'die Probenpläne'], brandgeruch: ['das Protokoll der Brandgeruchsprüfung', 'die Protokolle der Brandgeruchsprüfung'] },
  anlagenSonst: 'weitere Unterlagen',
};

/* ---------- kleine Helfer ---------- */
const s = v => (v == null ? '' : String(v)).trim();
const base = p => s(p).split(/[\\/]/).pop();
const ohneEndung = n => s(n).replace(/\.[A-Za-z0-9]{2,5}$/, '');
const deDatum = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s(iso)); return m ? `${m[3]}.${m[2]}.${m[1]}` : ''; };
const liste = w => (w.length <= 1 ? w.join('') : w.slice(0, -1).join(', ') + ' und ' + w[w.length - 1]);
const gross = t => t.charAt(0).toUpperCase() + t.slice(1);
const kNorm = k => s(k).normalize('NFC').toLowerCase().replace(/[\s.]/g, '');

/** Anschrift-Zeilen eines Empfängers (ohne E-Mail, Telefon, Fax, Web) */
function anschrift(e) {
  return s(e && e.details).split(/\r?\n/).map(s).filter(z => z && !/@/.test(z) && !/^(tel|telefon|fon|fax|mobil|handy|www\.|https?:)/i.test(z));
}
const mails = e => new Set((s(e && e.details).toLowerCase().match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) || []));
const nameKey = e => (anschrift(e)[0] || s(e && e.details).split(/\r?\n/)[0] || '').toLowerCase().normalize('NFC')
  .replace(/^(herrn?|frau|firma)\s+/, '').replace(/[^a-zäöüß0-9]+/g, '');
/** Dieselbe Stelle? Gleiche E-Mail-Adresse oder gleiche erste Anschriftzeile. */
function gleicheStelle(a, b) {
  if (a === b) return true;
  const na = nameKey(a), nb = nameKey(b);
  if (na && na === nb) return true;
  const mb = mails(b);
  return [...mails(a)].some(m => mb.has(m));
}

/** „Eine Ausfertigung …“ für den Brief an `an` aus dem ganzen Verteiler `alle` – '' wenn niemand sonst. */
function ausfertigungSatz(alle, an) {
  const andere = (alle || []).filter((e, i) => e !== an && !gleicheStelle(e, an) && !alle.slice(0, i).some(v => v !== an && gleicheStelle(v, e)));
  const teile = [];
  for (const e of andere) {
    const bekannt = !!TEXTE.dativ[e.gruppe], t = bekannt && teile.find(x => x.gruppe === e.gruppe);
    if (t) t.n++; else teile.push({ gruppe: bekannt ? e.gruppe : '', n: 1, name: anschrift(e)[0] || s(e.label) });
  }
  if (!teile.length) return '';
  const woerter = teile.map(x => (x.gruppe ? TEXTE.dativ[x.gruppe][x.n > 1 ? 1 : 0] : x.name));
  return teile.some(x => !x.gruppe) ? `Eine Ausfertigung erhalten außerdem: ${liste(woerter)}.` : `Eine Ausfertigung haben wir ${liste(woerter)} übersandt.`;
}

/** Anrede aus „z. Hd. Frau/Herrn …“ oder einer Zeile „Frau …“/„Herr(n) …“, sonst „Sehr geehrte Damen und Herren,“ */
function anrede(e) {
  for (const z of s(e && e.details).split(/\r?\n/).map(s)) {
    const m = /^(?:z\.?\s*H(?:d|än)\.?\s*(?:v\.\s*)?)?(Frau|Herrn?)\s+(.+)$/i.exec(z);
    if (!m) continue;
    const name = m[2].replace(/,.*$/, '').trim();
    if (!name) continue;
    return /^frau$/i.test(m[1]) ? `Sehr geehrte Frau ${name},` : `Sehr geehrter Herr ${name},`;
  }
  return 'Sehr geehrte Damen und Herren,';
}

/* Unterzeichner – gleiche Regeln wie BerichtKit (bericht-gemeinsam.js: person, svVorschlag) */
const ANREDE_STANDARD = { 'pütt': 'w', 'jung': 'w', 'kasper': 'm', 'grund': 'm', 'cremer': 'm', 'vom dorp': 'm' };
function geschlecht(name, c) {
  if (c && (c.geschlecht === 'w' || c.geschlecht === 'm')) return c.geschlecht;
  const w = s(name).toLowerCase().split(/\s+/);
  return ANREDE_STANDARD[w.slice(-2).join(' ')] || ANREDE_STANDARD[w[w.length - 1]] || '';
}
function person(cfg, mitarbeiter, kuerzel) {
  const k = s(kuerzel); if (!k) return null;
  const ma = (mitarbeiter || []).find(p => kNorm(p.ordnerKuerzel) === kNorm(k) || kNorm(p.appKuerzel) === kNorm(k)) || {};
  const ck = Object.keys((cfg && cfg.personen) || {}).find(x => kNorm(x) === kNorm(k));
  const c = ck ? cfg.personen[ck] : {};
  const name = s(c.name) || s(ma.name) || k, g = geschlecht(name, c), mt = c.rolle === 'mt';
  return { kuerzel: s(ma.ordnerKuerzel) || k, name, rolle: mt ? (g === 'w' ? 'Messtechnikerin' : 'Messtechniker') : (g === 'w' ? 'Sachverständige' : g === 'm' ? 'Sachverständiger' : 'Sachverständige(r)') };
}
/** Wer unterschreibt: in BerichtKit gewählt (form.sv), sonst der Zuständige, wenn Sachverständige(r), sonst die erste SV der Liste. */
function unterzeichner(o) {
  const cfg = o.cfg || {}, ma = o.mitarbeiter || [], f = (o.bk && o.bk.form) || {};
  const rolle = k => { const ck = Object.keys(cfg.personen || {}).find(x => kNorm(x) === kNorm(k)); return ck && cfg.personen[ck].rolle === 'mt' ? 'mt' : 'sv'; };
  let k = s(f.sv);
  const z = s(o.pj && o.pj.zustaendig) || s(o.projekt && o.projekt.kuerzel);
  if (!k && z && rolle(z) === 'sv') k = z;
  if (!k) { const erste = ma.find(p => s(p.ordnerKuerzel) && p.aktiv !== false && rolle(p.ordnerKuerzel) === 'sv'); k = erste ? s(erste.ordnerKuerzel) : z; }
  return person(cfg, ma, k) || { kuerzel: '', name: '', rolle: 'Sachverständige(r)' };
}

/** Eintrag in _BerichtKit.json → berichte[] zur Word-Datei der Aufgabe (sonst der zuletzt gespeicherte). */
function berichtEintrag(bk, word) {
  const b = (bk && Array.isArray(bk.berichte) ? bk.berichte : []).filter(x => x && typeof x === 'object');
  const w = base(word).normalize('NFC').toLowerCase();
  return (w && b.find(x => base(x.datei).normalize('NFC').toLowerCase() === w)) || null;
}

/** Anlagen des Briefs: zuerst die Mitteilung, dann ihre Anlagen (aus BerichtKit, sonst aus der Übergabe). */
function anlagenListe(a, eintrag, n, vom) {
  const r = [`${n}. Mitteilung${vom}`], arten = [];
  const bk = eintrag && Array.isArray(eintrag.anlagenListe) ? eintrag.anlagenListe : null;
  if (bk && bk.length) {
    for (const x of bk) {
      const pb = x.art === 'pruefbericht' && (x.dateien || []).length ? ' ' + ohneEndung(base(x.dateien[0])) : '';
      r.push(`Anlage ${x.nr}: ${s(x.titel)}${pb}`); arten.push(x.art || '');
    }
  } else {
    let i = 0;
    for (const x of (a.anlagen || [])) {
      const n2 = base(x), datei = /\.[A-Za-z0-9]{2,5}$/.test(n2);
      r.push(`Anlage ${++i}: ${datei ? ohneEndung(n2).replace(/_/g, ' ') : s(x)}`);
      arten.push(/laborergebnisse\//i.test(x) || /^AR-/i.test(n2) ? 'pruefbericht' : /bilddok/i.test(n2) ? 'bilddoku' : /probenplan/i.test(n2) ? 'probenplan' : /brandgeruch/i.test(n2) ? 'brandgeruch' : '');
    }
  }
  return { zeilen: r, arten };
}
/** „Der Prüfbericht des Labors, die Bilddokumentation und der Probenplan liegen als Anlagen bei.“ – '' ohne Anlagen */
function anlagenSatz(arten) {
  if (!arten.length) return '';
  const zahl = {}, folge = [];
  let sonst = 0;
  for (const a of arten) { if (TEXTE.anlageArt[a]) { if (!zahl[a]) folge.push(a); zahl[a] = (zahl[a] || 0) + 1; } else sonst++; }
  const w = folge.map(a => TEXTE.anlageArt[a][zahl[a] > 1 ? 1 : 0]);
  if (sonst) w.push(TEXTE.anlagenSonst);
  const mehrere = arten.length > 1;
  return `${gross(liste(w))} ${mehrere ? 'liegen' : 'liegt'} als ${mehrere ? 'Anlagen' : 'Anlage'} bei.`;
}

/**
 * Inhalt des Anschreibens an Empfänger `an`.
 * o = { aufgabe, an, projekt:{nr, ort, kuerzel}, pj, bk, cfg, mitarbeiter, heute:'JJJJ-MM-TT', unterzeichnerKuerzel? }
 * → { anschrift[], anrede, betreff, objekt, infos[[l, w]], absaetze[], gruss, unterzeichner, anlagen[], dateiname, art, n }
 */
function modell(o) {
  const a = o.aufgabe || {}, an = o.an || {}, pj = o.pj || {}, bk = o.bk || {}, P = o.projekt || {};
  const e = berichtEintrag(bk, a.word);
  const n = +((e && e.mitteilung) || (/^(\d+)[._\s]*Mitteilung/i.exec(base(a.word)) || [])[1] || 1) || 1;
  const art = s((e && e.art) || bk.art).toLowerCase();
  const brandTitel = ['Sanierungsvorschlag', 'Untersuchungsbericht'].includes(s(bk.form && bk.form.brand && bk.form.brand.titel)) ? bk.form.brand.titel : 'Sanierungsvorschlag';
  const vom = e && deDatum(e.datum) ? ' vom ' + deDatum(e.datum) : '';
  const betreff = art === 'brand' ? TEXTE.betreff.brand(n, brandTitel) : art === 'asbest' ? TEXTE.betreff.asbest(n) : TEXTE.betreff.sonst(n);
  const einleitung = art === 'brand' ? TEXTE.einleitung.brand(n, vom, brandTitel) : art === 'asbest' ? TEXTE.einleitung.asbest(n, vom) : TEXTE.einleitung.sonst(n, vom);
  const anl = anlagenListe(a, e, n, vom);
  const u = o.unterzeichnerKuerzel ? (person(o.cfg, o.mitarbeiter, o.unterzeichnerKuerzel) || unterzeichner(o)) : unterzeichner(o);
  const schaden = s(pj.schadennummer), sd = deDatum(pj.schadendatum);
  const objekt = [s(pj.objekt) || s(P.ort), sd ? `Schaden vom ${sd}` : ''].filter(Boolean).join(' · ');
  const kurz = s(u.kuerzel) || s(P.kuerzel);
  const infos = [
    ...(schaden ? [[an.gruppe === 'versicherung' ? 'Ihr Zeichen' : 'Schaden-Nr.', schaden]] : []),
    ['Unser Zeichen', [s(P.nr), kurz].filter(Boolean).join(' / ')],
    ...(u.name ? [['Ansprechpartner', u.name]] : []),
    ['Datum', deDatum(o.heute)],
  ];
  const absaetze = [einleitung, [anlagenSatz(anl.arten.slice()), ausfertigungSatz(a.empfaenger || [], an)].filter(Boolean).join(' '), TEXTE.rueckfragen].filter(Boolean);
  const wer = s(an.label || an.gruppe || 'Empfaenger').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim();
  const stamm = ohneEndung(base(a.word)) || `${n}. Mitteilung`;
  return { anschrift: anschrift(an), anrede: anrede(an), betreff, objekt, infos, absaetze, gruss: TEXTE.gruss, unterzeichner: u,
    anlagen: anl.zeilen, art, n, dateiname: `Anschreiben_${stamm}_${wer}.docx`, perPost: !mails(an).size };
}

/** Derselbe Inhalt als E-Mail: { betreff, text } (reiner Text, Signatur mit Firmenangaben). */
function mailText(m) {
  const zeichen = m.infos.filter(([l]) => l !== 'Datum' && l !== 'Ansprechpartner').map(([l, w]) => `${l} ${w}`);
  return {
    betreff: [m.betreff, m.objekt.split(' · ')[0], ...zeichen].filter(Boolean).join(' · '),
    text: [m.anrede, '', ...m.absaetze.flatMap(x => [x, '']), m.gruss, '', m.unterzeichner.name, m.unterzeichner.rolle, '',
      FIRMA.name, `${FIRMA.strasse} · ${FIRMA.ort}`, `Tel: ${FIRMA.tel} · ${FIRMA.web}`, '', 'Anlagen:', ...m.anlagen.map(x => '- ' + x)].join('\n'),
  };
}

/* ---------- Word ---------- */
/** Word-Dokument (docx-Bibliothek D). bilder = { logoSvg, logoPng, sig?: {data, w, h} } */
function dokument(D, m, bilder) {
  const { Document, Paragraph, TextRun, ImageRun, Header, Footer, TabStopType, BorderStyle, HorizontalPositionRelativeFrom,
    VerticalPositionRelativeFrom, TextWrappingType, AlignmentType, Table, TableRow, TableCell, WidthType } = D;
  const FONT = 'Arial', cmPx = cm => cm / 2.54 * 96, cmEmu = cm => Math.round(cm * 360000), tw = cm => Math.round(cm / 2.54 * 1440);
  const LINE1 = { line: 240, lineRule: 'auto' }, LINE15 = { line: 360, lineRule: 'auto' };
  const t = (text, o = {}) => new TextRun({ text, font: FONT, ...o });
  const p = (children, o = {}) => new Paragraph({ children: Array.isArray(children) ? children : [children], spacing: { ...LINE1, after: 0 }, ...o });
  const B = 11906 - tw(2.5) - tw(2), LINKS = tw(8.5), RECHTS = B - LINKS;

  /* Kopf wie das Deckblatt der Berichte: Logo links, Firmenblock rechts */
  const ADR = 6381;
  const adr = (text, o = {}) => p(t(text, { size: 16, ...o }), { indent: { left: ADR } });
  const logo = new ImageRun({ type: 'svg', data: bilder.logoSvg, fallback: { type: 'png', data: bilder.logoPng },
    transformation: { width: cmPx(9.2), height: cmPx(9.2 * 103 / 393) },
    floating: { horizontalPosition: { relative: HorizontalPositionRelativeFrom.COLUMN, offset: cmEmu(-0.74) },
      verticalPosition: { relative: VerticalPositionRelativeFrom.PARAGRAPH, offset: cmEmu(0.1) }, wrap: { type: TextWrappingType.NONE }, allowOverlap: true },
    altText: { title: 'Logo', description: 'Dr. Heinz Schiffers & Partner', name: 'Logo' } });
  const kopf = new Header({ children: [
    new Paragraph({ children: [logo, t(FIRMA.name, { size: 16, bold: true })], indent: { left: ADR }, spacing: { ...LINE1, after: 0 } }),
    adr(FIRMA.strasse), adr(FIRMA.ort), adr('Tel: ' + FIRMA.tel), adr('E-Mail: ' + FIRMA.mail), adr(FIRMA.web),
  ] });
  const fuss = new Footer({ children: [p(t(FIRMA.zeilen.join(' · '), { size: 14, color: '595959' }),
    { alignment: AlignmentType.CENTER, border: { top: { style: BorderStyle.SINGLE, size: 4, color: '363A90', space: 4 } } })] });

  /* Anschriftfeld (Rücksendezeile + Anschrift) und Infoblock – Tabelle ohne Rahmen, feste Höhe 4,5 cm */
  const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, nb = { top: NONE, bottom: NONE, left: NONE, right: NONE };
  const info = (l, w) => p([t(l, { size: 18, color: '595959' }), t('\t'), t(w, { size: 20 })], { tabStops: [{ type: TabStopType.LEFT, position: tw(3.1) }], spacing: { ...LINE1, after: 20 } });
  const feld = new Table({ width: { size: B, type: WidthType.DXA }, columnWidths: [LINKS, RECHTS], borders: { ...nb, insideHorizontal: NONE, insideVertical: NONE },
    rows: [new TableRow({ height: { value: tw(4.5), rule: 'exact' }, children: [
      new TableCell({ width: { size: LINKS, type: WidthType.DXA }, borders: nb, margins: { left: 0, right: 0 }, children: [
        p(t(`${FIRMA.name} · ${FIRMA.strasse} · ${FIRMA.ort}`, { size: 14, underline: {} }), { spacing: { ...LINE1, after: 120 } }),
        ...(m.anschrift.length ? m.anschrift : ['']).slice(0, 7).map(z => p(t(z, { size: 22 }))),
      ] }),
      new TableCell({ width: { size: RECHTS, type: WidthType.DXA }, borders: nb, margins: { left: tw(0.9), right: 0 }, children: [
        p(t(''), { spacing: { ...LINE1, after: 120 } }), ...m.infos.map(([l, w]) => info(l, w)),
      ] }),
    ] })] });

  const sig = bilder.sig && bilder.sig.data ? (() => {
    const h = 1.6, w = Math.min(6, h * bilder.sig.w / bilder.sig.h);
    return [new ImageRun({ type: 'png', data: bilder.sig.data, transformation: { width: cmPx(w), height: cmPx(w * bilder.sig.h / bilder.sig.w) } })];
  })() : [];
  const kinder = [
    feld,
    p(t(m.betreff, { bold: true }), { spacing: { ...LINE1, before: 480, after: 60 } }),
    ...(m.objekt ? [p(t(m.objekt, { size: 20 }))] : []),
    p(t(m.anrede), { spacing: { ...LINE15, before: 480, after: 120 } }),
    ...m.absaetze.map(x => p(t(x), { alignment: AlignmentType.JUSTIFIED, spacing: { ...LINE15, after: 120 } })),
    p(t(m.gruss), { spacing: { ...LINE15, before: 120, after: 0 }, keepNext: true }),
    p(t(FIRMA.name, { size: 20 }), { keepNext: true }),
    p(sig, { spacing: sig.length ? { before: 120, after: 0 } : { before: tw(1.5), after: 0 }, keepNext: true,
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 1 } }, indent: { right: B - tw(6.5) } }),
    p(t(m.unterzeichner.name || '', { size: 22 }), { keepNext: true }), p(t(m.unterzeichner.rolle || '', { size: 22, color: '595959' })),
    p(t('Anlagen', { bold: true, size: 20 }), { spacing: { ...LINE1, before: 480, after: 60 }, keepNext: true }),
    ...m.anlagen.map((x, i) => p([t('–', { size: 20 }), t('\t'), t(x, { size: 20 })], { tabStops: [{ type: TabStopType.LEFT, position: tw(0.5) }],
      indent: { left: tw(0.5), hanging: tw(0.5) }, spacing: { ...LINE1, after: 20 }, keepNext: i < m.anlagen.length - 1 })),
  ];
  return new Document({ creator: FIRMA.name + ' · BüroKit', title: 'Anschreiben – ' + m.betreff,
    styles: { default: { document: { run: { font: FONT, size: 22 } } } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: tw(4.5), right: tw(2), bottom: tw(2), left: tw(2.5), header: tw(1), footer: tw(0.8) } } },
      headers: { default: kopf }, footers: { default: fuss }, children: kinder }] });
}

/* ---------- Welche Word-Datei in „Mitteilungen“ gehört zu welcher Mitteilung? ---------- */
// Die Übergabe nennt eine Word-Datei. Ältere Übergaben (oder eine Wahl von Hand) nennen manchmal das Anschreiben statt
// der Mitteilung – dann wird die Mitteilung mit derselben Nummer gesucht. Anschreiben gehören über die Nummer zur Mitteilung
// („Anschreiben 1. Mitteilung.docx“, „Anschreiben_2. Mitteilung_Auftraggeber.docx“), ohne Nummer über den Dateinamen der Mitteilung.
const AS_NAME = /^Anschreiben(?![a-zäöüß])/i;
const MITT_NAME = /^(\d+)[._\s]*Mitteilung(?![a-zäöüß])/i;
const NEBEN = /entwurf|vorlage|vorbereitung/i;
const nrIn = n => { const m = /(?:^|\D)(\d+)[._\s]*Mitteilung(?![a-zäöüß])/i.exec(s(n)); return m ? +m[1] : 0; };
/** liste = Dateien im Ordner der Mitteilung ([{ name, t }] oder Namen), word = Datei aus der Übergabe (relativ).
    → { bericht: rel | '', anschreiben: [rel], nr, andere: [{ nr, bericht, anschreiben }] } – andere = übrige Mitteilungen des Projekts */
function wordDateien(liste, word) {
  const w = s(word), ordner = w.includes('/') ? w.slice(0, w.lastIndexOf('/') + 1) : 'Mitteilungen/';
  const docs = (liste || []).map(x => typeof x === 'string' ? { name: x, t: 0 } : x)
    .filter(x => x && /\.docx?$/i.test(s(x.name)) && !/^~\$/.test(x.name));
  const nachName = (a, b) => a.name.localeCompare(b.name, 'de', { numeric: true });
  const berichtZu = nr => {
    const k = docs.filter(x => MITT_NAME.test(x.name) && +MITT_NAME.exec(x.name)[1] === nr && !NEBEN.test(x.name))
      .sort((a, b) => (b.t || 0) - (a.t || 0) || nachName(a, b));
    return k.length ? ordner + k[0].name : '';
  };
  const anschreibenZu = (nr, stamm) => docs.filter(x => AS_NAME.test(x.name) && (nr ? nrIn(x.name) === nr : !!stamm && x.name.includes(stamm)))
    .sort(nachName).map(x => ordner + x.name);
  const wb = base(w), nr = nrIn(wb);
  const bericht = w && !AS_NAME.test(wb) ? w : (nr ? berichtZu(nr) : '');
  const anschreiben = anschreibenZu(nr, ohneEndung(base(bericht)));
  const nrs = [...new Set(docs.map(x => MITT_NAME.test(x.name) ? +MITT_NAME.exec(x.name)[1] : AS_NAME.test(x.name) ? nrIn(x.name) : 0))]
    .filter(k => k && k !== nr).sort((a, b) => a - b);
  const andere = nrs.map(k => ({ nr: k, bericht: berichtZu(k), anschreiben: anschreibenZu(k, '') })).filter(g => g.bericht || g.anschreiben.length);
  return { bericht, anschreiben, nr, andere };
}
/** Beschriftung eines Anschreibens: „Anschreiben · Auftraggeber“ (Empfänger aus dem BüroKit-Namen), sonst „Anschreiben“ */
function anschreibenTitel(rel, stamm) {
  let r = ohneEndung(base(rel)).replace(/^Anschreiben[\s_-]*/i, '');
  r = r.replace(/^\d+[._\s]*Mitteilung(?![a-zäöüß])[\s_-]*/i, '');
  if (stamm && r.startsWith(stamm)) r = r.slice(stamm.length).replace(/^[\s_-]+/, '');
  return r ? 'Anschreiben · ' + r : 'Anschreiben';
}

const API = { wordDateien, anschreibenTitel, FIRMA, TEXTE, modell, mailText, dokument, ausfertigungSatz, anrede, anschrift, gleicheStelle, anlagenSatz, unterzeichner, person, berichtEintrag };
if (typeof module === 'object' && module.exports) module.exports = API;
root.Anschreiben = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
