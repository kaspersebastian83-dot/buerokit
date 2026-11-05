// BüroKit im echten Browser: Archivordner wählen, Kürzel einmal fragen, Zähl-Kacheln, Tagesliste (überfällig/heute/später/Rechnung/erledigt),
// Hauptknopf je Karte, Schritt-Leiste (Haken setzen und wegnehmen), Versand je Empfänger mit vollem Explorer-Pfad, Rechnung aus dem BelegKit-Stand,
// Anschreiben als Word + E-Mail-Text, eigene Aufgabe, Rückfrage in der Karte, Filter „Für mich“, frühere Büroübergabe. Synthetische OPFS-Ordner.
// node tests/buerokit-browser.cjs [chromium]
const assert = require('node:assert/strict'), fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.join(__dirname, '..'), browserName = process.argv[2] || 'chromium';
let browser, server;
(async () => {
  server = http.createServer((req, res) => {
    const file = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html');
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()){ res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.js') ? 'text/javascript' : file.endsWith('.svg') ? 'image/svg+xml' : file.endsWith('.png') ? 'image/png' : 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  browser = await playwright[browserName].launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.accept());
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  const ok = s => console.log(`OK ${browserName}: ${s}`);

  await page.evaluate(async () => {
    const r = await navigator.storage.getDirectory(), B = window.BueroAufgaben;
    const put = async (dir, name, text) => { const w = await (await dir.getFileHandle(name, { create: true })).createWritable(); await w.write(text); await w.close(); };
    await put(r, '_Spektron-Mitarbeiter.json', JSON.stringify({ format: 'spektron-mitarbeiter', version: 1, personen: [{ ordnerKuerzel: 'Nad', appKuerzel: 'Nad', name: 'Nadine Test', aktiv: true }, { ordnerKuerzel: 'Ben', appKuerzel: 'Ben', name: 'Ben Test', aktiv: true }] }));
    const d = new Date(Date.now() - 864e5), z = n => String(n).padStart(2, '0'), gestern = `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
    const p1 = await r.getDirectoryHandle('26.0101 Musterstadt Ben', { create: true });
    await B.aufgabeAnlegen(p1, { art: 'gutachten', von: 'Ben', word: 'Mitteilungen/Gutachten.docx', faellig: gestern, hinweis: 'Mappe im Fach', anlagen: ['Fotos/26.0101_Bilddokumentation.pdf', 'Laborberichte Eurofins'],
      empfaenger: [{ gruppe: 'versicherung', label: 'Auftraggeber', details: 'Muster AG\nz. Hd. Frau Beispiel\nMusterweg 5\nschaden@muster-beispiel.de' }, { gruppe: 'versicherungsnehmer', label: 'Versicherungsnehmer', details: 'Erika Beispiel\nAm Hang 3' }] });
    await put(p1, '_Projekt.json', JSON.stringify({ format: 'mosaik-projekt', version: 1, objekt: 'EFH, Am Hang 3, 12345 Musterstadt', schadennummer: 'SN-77', schadendatum: '2026-10-01' }));
    const mitt = await p1.getDirectoryHandle('Mitteilungen', { create: true });
    await put(mitt, '_BerichtKit.json', JSON.stringify({ format: 'spektron-bericht', version: 1, nurEigene: true, art: 'brand', form: {},
      berichte: [{ datei: 'Gutachten.docx', art: 'brand', mitteilung: 1, datum: '2026-11-02', anlagenListe: [{ nr: 1, art: 'bilddoku', titel: 'Bilddokumentation', dateien: ['Fotos/26.0101_Bilddokumentation.pdf'] }] }] }));
    const p2 = await r.getDirectoryHandle('26.0102 Anderswo Nad', { create: true });
    const alt = await (await p2.getDirectoryHandle('_Buero', { create: true })).getDirectoryHandle('11111111-2222-4333-8444-555555555555', { create: true });
    await put(alt, 'auftrag.json', JSON.stringify({ format: 'spektron-buero', version: 1, id: '11111111-2222-4333-8444-555555555555', created: '2026-10-26T09:00:00.000Z',
      content: { project: { name: '26.0102 Anderswo Nad', nr: '26.0102', ort: 'Anderswo' }, word: 'Mitteilungen/Alt.docx', who: 'Nad', note: '', instruction: '', recipients: [{ id: 'r-1', group: 'versicherung', label: 'Auftraggeber', details: 'Beispiel Versicherung' }] } }));
    await r.getDirectoryHandle('26.0103 Ohne Aufgaben Ben', { create: true });
    window.showDirectoryPicker = async () => r;
  });

  // Start: Archivordner wählen → Liste; ohne Kürzel fragt BüroKit einmal
  await page.locator('#btnArchiv2').click();
  await page.locator('.karte').first().waitFor();
  await page.locator('#dlgIch[open]').waitFor();
  await page.locator('#ichAbbrechen').click();
  assert.match(await page.locator('section.ueberfaellig').innerText(), /26\.0101\s*Musterstadt[\s\S]*Ben Test[\s\S]*fällig seit[\s\S]*Gutachten[\s\S]*Mappe im Fach/);
  assert.match(await page.locator('section.offen').innerText(), /26\.0102\s*Anderswo/);
  assert.equal((await page.locator('#kacheln').innerText()).replace(/\s+/g, ' '), '1 überfällig 0 heute fällig 1 später fällig 0 Rechnung schreiben 0 diese Woche erledigt');
  assert.match(await page.title(), /^\(1\) BüroKit$/);
  assert.match(await page.locator('#hinweise').innerText(), /Kürzel wählen/);
  ok('Archivordner wählen, Kacheln und Gruppen nach Fälligkeit, Zahl im Fenstertitel, Kürzel wird gefragt');

  // ohne Kürzel kein Haken – Hauptknopf fragt nach dem Kürzel
  const karte1 = page.locator('.karte', { hasText: '26.0101' });
  await karte1.locator('button.primary[data-s="gegenlesen"]').click();
  await page.locator('#dlgIch[open]').waitFor();
  await page.locator('#ich').selectOption('Nad'); await page.locator('#formIch button.primary').click();
  await page.waitForFunction(() => /Nadine/.test(document.getElementById('gruss').textContent));
  const fertig = () => page.waitForFunction(() => !document.querySelector('#liste button[data-s]:disabled'));
  assert.equal(await karte1.locator('.st.fertig').count(), 0);
  ok('ohne Kürzel kein Haken, Begrüßung mit Vorname');

  // Hauptknopf: Gegengelesen → Schritt-Leiste; Haken über die Leiste wegnehmen und wieder setzen; PDF; Versand öffnet die Liste
  await karte1.locator('button.primary[data-s="gegenlesen"]').click(); await fertig();
  await karte1.locator('.st.fertig', { hasText: 'Gegenlesen' }).waitFor();
  assert.match(await karte1.locator('.st.fertig', { hasText: 'Gegenlesen' }).getAttribute('title'), /Nadine Test/);
  await karte1.locator('.st[data-s="gegenlesen"]').click(); await fertig();
  assert.equal(await karte1.locator('.st.fertig').count(), 0);
  await karte1.locator('.st[data-s="gegenlesen"]').click(); await fertig();
  await karte1.locator('button.primary[data-s="pdf"]').click(); await fertig();
  await karte1.locator('.st.fertig', { hasText: 'PDF' }).waitFor();
  // Explorer-Pfad einstellen (Mehr …)
  await page.locator('#btnMehr').click(); await page.locator('[data-menue="pfad"]').click();
  await page.locator('#pfadFeld').fill('X:\\Archiv'); await page.locator('#formPfad button.primary').click();
  await karte1.locator('button.primary[data-mehr]', { hasText: 'Jetzt versenden' }).click();
  await karte1.locator('.empf').first().waitFor();
  const das = await karte1.locator('.box', { hasText: 'Das geht mit' }).innerText();
  assert.match(das, /…\\Mitteilungen\\Gutachten\.docx[\s\S]*…\\Fotos\\26\.0101_Bilddokumentation\.pdf[\s\S]*Laborberichte Eurofins/);
  const kopien = await karte1.locator('.box', { hasText: 'Das geht mit' }).locator('[data-kopie]').evaluateAll(es => es.map(e => e.dataset.kopie));
  assert.ok(kopien.includes('X:\\Archiv\\26.0101 Musterstadt Ben\\Mitteilungen\\Gutachten.docx'), 'voller Pfad zum Kopieren');
  assert.ok(kopien.includes('X:\\Archiv\\26.0101 Musterstadt Ben\\Fotos\\26.0101_Bilddokumentation.pdf'));
  assert.equal(await karte1.locator('.empf button.gut').count(), 2);
  assert.match(await karte1.locator('.empf').nth(1).innerText(), /per Post/);
  assert.match(await karte1.locator('details.unter').textContent(), /Noch keine Rechnungsangaben/);
  ok('Hauptknopf je Schritt, Haken über die Leiste zurücknehmen, voller Explorer-Pfad, per Post erkannt');

  // Anschreiben an den Auftraggeber: Vorbelegung, Word speichern (und ersetzen), E-Mail-Text
  await karte1.locator('[data-anschreiben]').first().click();
  await page.waitForFunction(() => !document.getElementById('asWord').disabled);
  assert.equal(await page.locator('#asAnrede').inputValue(), 'Sehr geehrte Frau Beispiel,');
  assert.equal(await page.locator('#asBetreff').inputValue(), '1. Mitteilung – Sanierungsvorschlag (Brandschaden)');
  assert.match(await page.locator('#asText').inputValue(), /Mitteilung vom 02\.11\.2026[\s\S]*Die Bilddokumentation liegt als Anlage bei\. Eine Ausfertigung haben wir dem Versicherungsnehmer übersandt\./);
  assert.equal(await page.locator('#asAnschrift').inputValue(), 'Muster AG\nz. Hd. Frau Beispiel\nMusterweg 5');
  await page.locator('#asWord').click();
  await page.locator('#asStatus', { hasText: 'Gespeichert' }).waitFor({ timeout: 20000 });
  await page.locator('#asWord').click();
  await page.locator('#asStatus', { hasText: 'Gespeichert' }).waitFor({ timeout: 20000 });
  const word = await page.evaluate(async () => { const r = await navigator.storage.getDirectory(); const m = await (await r.getDirectoryHandle('26.0101 Musterstadt Ben')).getDirectoryHandle('Mitteilungen');
    const l = []; for await (const h of m.values()) if (/^Anschreiben/.test(h.name)) l.push([h.name, (await h.getFile()).size]); return l; });
  assert.equal(word.length, 1, 'ersetzt, nicht verdoppelt');
  assert.equal(word[0][0], 'Anschreiben_Gutachten_Auftraggeber.docx'); assert.ok(word[0][1] > 20000);
  await page.locator('#asMail').click();
  const mail = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  if (mail) assert.match(mail, /^Sehr geehrte Frau Beispiel,\n\nanbei übersenden wir Ihnen[\s\S]*Nadine Test|^Sehr geehrte Frau Beispiel,/);
  await page.locator('#asSchliessen').click();
  ok('Anschreiben: Anrede, Betreff und Text aus den Projektdaten, Word in „Mitteilungen“ (ersetzen statt doppelt), E-Mail-Text');

  // Versand je Empfänger → Rechnung schreiben
  await karte1.locator('.empf button.gut').first().click(); await fertig();
  await karte1.locator('.st', { hasText: '1/2' }).waitFor();
  await karte1.locator('.empf button.gut').first().click(); await fertig();
  await page.locator('section.rechnung .karte', { hasText: '26.0101' }).waitFor();
  assert.equal(await page.locator('section.ueberfaellig').count(), 0);
  assert.match(await page.locator('section.rechnung').innerText(), /versandt/);
  ok('Versand je Empfänger – danach unter „Rechnung schreiben“');

  // BelegKit-Stand ablegen → Positionen sichtbar und kopierbar; neue Zeitdatei → Warnung
  await page.evaluate(async () => {
    const r = await navigator.storage.getDirectory(), abr = await (await r.getDirectoryHandle('26.0101 Musterstadt Ben')).getDirectoryHandle('Abrechnung', { create: true });
    const put = async (name, text) => { const w = await (await abr.getFileHandle(name, { create: true })).createWritable(); await w.write(text); await w.close(); };
    await put('26.0101_Aufwand_2026-10-28.json', JSON.stringify({ format: 'aufwandkit-stand', version: 1, projekt: '26.0101 Musterstadt Ben', erstellt: '2026-10-28T10:00:00.000Z', von: 'BEN',
      titel: [{ nr: 1, text: 'Ortstermin\nZeitaufwand', zeilen: [{ nr: '1.001', text: 'Sachverständiger', menge: 3.5, einheit: 'Std.' }] }], hinweise: [], netto: null, quellen: [] }));
  });
  const k1 = page.locator('section.rechnung .karte', { hasText: '26.0101' });
  await k1.locator('[data-abr-neu]').first().click();
  await k1.locator('.abr', { hasText: 'Sachverständiger' }).waitFor();
  assert.match(await k1.locator('.block').innerText(), /Positionen kopieren[\s\S]*MOS'aik[\s\S]*Angaben sind aktuell[\s\S]*1\.001\s*Sachverständiger\s*3,5\s*Std\./);
  await page.evaluate(async () => { const r = await navigator.storage.getDirectory(); const abr = await (await r.getDirectoryHandle('26.0101 Musterstadt Ben')).getDirectoryHandle('Abrechnung');
    const w = await (await abr.getFileHandle('Aufwand_NAD.json', { create: true })).createWritable(); await w.write('{}'); await w.close(); });
  await k1.locator('[data-abr-neu]').first().click();
  await k1.locator('.ampel.warn', { hasText: 'Zeiten NAD neu seit dem Stand' }).waitFor();
  await page.evaluate(async () => { const r = await navigator.storage.getDirectory(); const abr = await (await r.getDirectoryHandle('26.0101 Musterstadt Ben')).getDirectoryHandle('Abrechnung');
    const w = await (await abr.getFileHandle('Aufwand_NAD.json', { create: true })).createWritable();
    await w.write(JSON.stringify({ format: 'aufwandkit-zeiten', version: 1, eintraege: [{ datum: '2026-10-21', art: 'ort', rolle: 'Probenehmer', stunden: '3,5', km: '84', hotelBetrag: '89,50' }] })); await w.close(); });
  await k1.locator('[data-abr-neu]').first().click();
  await k1.locator('details.person').waitFor();
  assert.equal(await k1.locator('details.person').evaluate(d => d.open), false, 'je Person zugeklappt');
  await k1.locator('details.person > summary').click();
  assert.match(await k1.locator('details.person tbody').innerText(), /Nadine Test\s+–\s+3,5\s+–\s+–\s+84\s+–\s+89,50 €/, 'Betrag Übernachtung auch ohne Anzahl');
  await k1.locator('[data-abr-neu]').first().click(); await page.waitForTimeout(300);
  assert.equal(await k1.locator('details.person').evaluate(d => d.open), true, 'bleibt nach „neu lesen“ offen');
  ok('Rechnung aus dem BelegKit-Stand; neue Zeitdatei danach wird gemeldet');

  // Rechnung geschrieben (Warnung bestätigen) → erledigt, mit Stand im Vermerk
  await k1.locator('button.gut[data-s="rechnung"]').click();
  await page.locator('#g-erledigt').waitFor();
  assert.equal(await page.locator('section.rechnung').count(), 0);
  await page.locator('#g-erledigt > summary').click();
  assert.match(await page.locator('#g-erledigt').innerText(), /26\.0101/);
  const dateien = await page.evaluate(async () => { const r = await navigator.storage.getDirectory(); const v = await (await (await r.getDirectoryHandle('26.0101 Musterstadt Ben')).getDirectoryHandle('_Buero')).getDirectoryHandle('vermerke'); let n = 0; for await (const _ of v.keys()) n++; return n; });
  assert.equal(dateien, 7, 'je Haken eine Datei, auch fürs Wegnehmen');
  const stand = await page.evaluate(async () => { const r = await navigator.storage.getDirectory(); const v = await (await (await r.getDirectoryHandle('26.0101 Musterstadt Ben')).getDirectoryHandle('_Buero')).getDirectoryHandle('vermerke');
    for await (const h of v.values()){ const o = JSON.parse(await (await h.getFile()).text()); if (o.schritt === 'rechnung') return o.stand; } });
  assert.equal(stand, 'Abrechnung/26.0101_Aufwand_2026-10-28.json');
  ok('Rechnung mit Stand – danach „Diese Woche erledigt“');

  // eigene Aufgabe, heute fällig, für Nad
  await page.locator('#btnNeu').click();
  await page.locator('#neuProjekt').fill('26.0103');
  await page.locator('#neuTitel').fill('Laborrechnung prüfen');
  assert.equal(await page.locator('#neuFuer').inputValue(), 'Nad');
  await page.locator('#neuOk').click();
  await page.locator('section.heute .karte', { hasText: 'Laborrechnung prüfen' }).waitFor();
  assert.match(await page.locator('section.heute .karte').innerText(), /für dich/);
  ok('eigene Aufgabe mit Fälligkeit heute und Zuständigkeit');

  // Rückfrage an der früheren Übergabe – steht dann in der Karte; Filter „Für mich“
  const karte2 = page.locator('.karte', { hasText: '26.0102' });
  await karte2.locator('button.link[data-mehr]').click();
  await karte2.locator('button[data-akt="frage"]').click();
  await page.locator('#textFeld').fill('Fehlt die Anlage 3?'); await page.locator('#textOk').click();
  await page.locator('.karte .frage', { hasText: 'Fehlt die Anlage 3?' }).waitFor();
  assert.match(await page.locator('.karte', { hasText: '26.0102' }).innerText(), /Wartet auf Antwort[\s\S]*Fehlt die Anlage 3\?/);
  await page.locator('.chips [data-filter="meine"]').click();
  const meine = await page.locator('#liste .karte').evaluateAll(es => es.map(e => e.querySelector('.titel').textContent));
  assert.deepEqual(meine, ['Laborrechnung prüfen']);
  await page.locator('.chips [data-filter="alle"]').click();
  ok('Rückfrage an früherer Übergabe steht in der Karte, Filter „Für mich“');

  // eigene Aufgabe erledigen; Entfernen
  await page.locator('section.heute button.gut[data-s="erledigt"]').click();
  await page.waitForFunction(() => !document.querySelector('section.heute'));
  await page.locator('.karte', { hasText: '26.0102' }).locator('button[data-akt="loeschen"]').click();
  await page.waitForFunction(() => !document.querySelector('section.offen'));
  assert.match(await page.locator('#liste').innerText(), /Nichts offen/);
  ok('eigene Aufgabe erledigt, Aufgabe entfernt – Liste leer');

  assert.deepEqual(errors, []);
  await browser.close(); server.close();
})().catch(async e => { console.error(e); try{ await browser?.close(); server?.close(); }catch{} process.exit(1); });
