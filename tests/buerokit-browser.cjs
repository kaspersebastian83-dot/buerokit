// BüroKit im echten Browser: Archivordner wählen, Tagesliste (überfällig/heute/offen/erledigt), Haken setzen und wegnehmen,
// Versand je Empfänger, eigene Aufgabe, Rückfrage, Filter „Meine“, frühere Büroübergabe. Synthetische OPFS-Ordner.
// node tests/buerokit-browser.cjs [chromium]
const assert = require('node:assert/strict'), fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.join(__dirname, '..'), browserName = process.argv[2] || 'chromium';
let browser, server;
(async () => {
  server = http.createServer((req, res) => {
    const file = path.join(root, new URL(req.url, 'http://x').pathname.replace(/^\/+/, '') || 'index.html');
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()){ res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.js') ? 'text/javascript' : file.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  browser = await playwright[browserName].launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.accept());
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  const ok = s => console.log(`OK ${browserName}: ${s}`);

  const gestern = await page.evaluate(async () => {
    const r = await navigator.storage.getDirectory(), B = window.BueroAufgaben;
    const put = async (dir, name, text) => { const w = await (await dir.getFileHandle(name, { create: true })).createWritable(); await w.write(text); await w.close(); };
    await put(r, '_Spektron-Mitarbeiter.json', JSON.stringify({ format: 'spektron-mitarbeiter', version: 1, personen: [{ ordnerKuerzel: 'Nad', appKuerzel: 'Nad', name: 'Nadine Test', aktiv: true }, { ordnerKuerzel: 'Ben', appKuerzel: 'Ben', name: 'Ben Test', aktiv: true }] }));
    const d = new Date(Date.now() - 864e5), z = n => String(n).padStart(2, '0'), gestern = `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
    const p1 = await r.getDirectoryHandle('26.0101 Musterstadt Ben', { create: true });
    await B.aufgabeAnlegen(p1, { art: 'gutachten', von: 'Ben', word: 'Mitteilungen/Gutachten.docx', faellig: gestern, hinweis: 'Mappe im Fach',
      empfaenger: [{ gruppe: 'versicherung', label: 'Auftraggeber', details: 'Muster AG\nMusterweg 5' }, { gruppe: 'versicherungsnehmer', label: 'Versicherungsnehmer', details: 'Erika Beispiel' }] });
    const p2 = await r.getDirectoryHandle('26.0102 Anderswo Nad', { create: true });
    const alt = await (await p2.getDirectoryHandle('_Buero', { create: true })).getDirectoryHandle('11111111-2222-4333-8444-555555555555', { create: true });
    await put(alt, 'auftrag.json', JSON.stringify({ format: 'spektron-buero', version: 1, id: '11111111-2222-4333-8444-555555555555', created: '2026-10-26T09:00:00.000Z',
      content: { project: { name: '26.0102 Anderswo Nad', nr: '26.0102', ort: 'Anderswo' }, word: 'Mitteilungen/Alt.docx', who: 'Nad', note: '', instruction: '', recipients: [{ id: 'r-1', group: 'versicherung', label: 'Auftraggeber', details: 'Beispiel Versicherung' }] } }));
    await r.getDirectoryHandle('26.0103 Ohne Aufgaben Ben', { create: true });
    window.showDirectoryPicker = async () => r;
    return gestern;
  });

  // Start: Archivordner wählen
  await page.locator('#btnArchiv2').click();
  await page.locator('.aufgabe').first().waitFor();
  assert.equal(await page.locator('#start').isVisible(), false);
  assert.match(await page.locator('section.ueberfaellig').innerText(), /26\.0101\s*Musterstadt[\s\S]*Ben Test[\s\S]*fällig seit/);
  assert.match(await page.locator('section.offen').innerText(), /26\.0102\s*Anderswo[\s\S]*übergeben von Nadine Test/);
  assert.match(await page.locator('#hinweise').innerText(), /Kürzel wählen/);
  ok('Archivordner wählen, Liste nach Fälligkeit, Ort und zuständige Person aus dem Ordnernamen, frühere Übergabe dabei');

  // ohne Kürzel kein Haken
  const karte1 = page.locator('.aufgabe', { hasText: '26.0101' });
  await karte1.locator('input[data-s="gegenlesen"]').click();
  await page.locator('#hinweise', { hasText: 'zuerst oben' }).waitFor();
  assert.equal(await karte1.locator('input[data-s="gegenlesen"]').isChecked(), false);
  await page.locator('#ich').selectOption('Nad');

  // Haken setzen, wieder wegnehmen, Versand je Empfänger → erledigt
  await karte1.locator('input[data-s="gegenlesen"]').check();
  await page.waitForFunction(() => document.querySelector('.aufgabe input[data-s="gegenlesen"]:checked'));
  assert.match(await karte1.locator('label.schritt.an').first().getAttribute('title'), /Nadine Test/);
  const fertig = () => page.waitForFunction(() => !document.querySelector('#liste input:disabled'));
  await karte1.locator('input[data-s="gegenlesen"]').uncheck(); await fertig();
  assert.equal(await karte1.locator('input[data-s="gegenlesen"]').isChecked(), false);
  await karte1.locator('input[data-s="gegenlesen"]').check(); await fertig();
  await karte1.locator('input[data-s="pdf"]').check(); await fertig();
  await karte1.locator('label.schritt.an', { hasText: 'PDF' }).waitFor();
  await karte1.locator('button.schritt[data-mehr]').click();
  assert.match(await karte1.locator('.pfad').first().innerText(), /Mitteilungen\/Gutachten\.docx/);
  const empf = karte1.locator('.empf input');
  assert.equal(await empf.count(), 2);
  await empf.nth(0).check();
  await karte1.locator('button.schritt[data-mehr]', { hasText: 'Versand 1/2' }).waitFor();
  await karte1.locator('.empf input').nth(1).check();
  await page.locator('#erledigtBox').waitFor();
  assert.equal(await page.locator('section.ueberfaellig').count(), 0);
  await page.locator('#erledigtBox > summary').click();
  assert.match(await page.locator('#erledigtBox').innerText(), /26\.0101/);
  const dateien = await page.evaluate(async () => { const r = await navigator.storage.getDirectory(); const v = await (await (await r.getDirectoryHandle('26.0101 Musterstadt Ben')).getDirectoryHandle('_Buero')).getDirectoryHandle('vermerke'); let n = 0; for await (const _ of v.keys()) n++; return n; });
  assert.equal(dateien, 6, 'je Haken eine Datei, auch fürs Wegnehmen');
  ok('Haken setzen und ohne Begründung wegnehmen, Versand je Empfänger, danach „Erledigt“');

  // eigene Aufgabe, heute fällig, für Nad
  await page.locator('#btnNeu').click();
  await page.locator('#neuProjekt').fill('26.0103');
  await page.locator('#neuTitel').fill('Laborrechnung prüfen');
  assert.equal(await page.locator('#neuFuer').inputValue(), 'Nad');
  await page.locator('#neuOk').click();
  await page.locator('section.heute .aufgabe', { hasText: 'Laborrechnung prüfen' }).waitFor();
  ok('eigene Aufgabe mit Fälligkeit heute und Zuständigkeit');

  // Rückfrage an der früheren Übergabe; Filter „Meine“
  const karte2 = page.locator('.aufgabe', { hasText: '26.0102' });
  await karte2.locator('button.toggle').click();
  await karte2.locator('button[data-akt="frage"]').click();
  await page.locator('#textFeld').fill('Fehlt die Anlage 3?'); await page.locator('#textOk').click();
  await page.locator('.aufgabe.frage', { hasText: '26.0102' }).waitFor();
  assert.match(await page.locator('.aufgabe', { hasText: '26.0102' }).innerText(), /Rückfrage offen[\s\S]*Fehlt die Anlage 3\?/);
  await page.locator('.chips [data-filter="meine"]').click();
  const meine = await page.locator('#liste .aufgabe').evaluateAll(es => es.map(e => e.querySelector('.titel').textContent));
  assert.deepEqual(meine.map(t => t.replace(/heute fällig.*/, '').trim()), ['Laborrechnung prüfen']);
  await page.locator('.chips [data-filter="alle"]').click();
  ok('Rückfrage an früherer Übergabe, Filter „Meine“');

  // eigene Aufgabe erledigen; Entfernen
  await page.locator('section.heute input[data-s="erledigt"]').check();
  await page.waitForFunction(() => !document.querySelector('section.heute'));
  await page.locator('.aufgabe', { hasText: '26.0102' }).locator('button[data-akt="loeschen"]').click();
  await page.waitForFunction(() => !document.querySelector('section.offen'));
  assert.match(await page.locator('#liste').innerText(), /Nichts offen/);
  ok('eigene Aufgabe erledigt, Aufgabe entfernt – Liste leer');

  assert.deepEqual(errors, []);
  await browser.close(); server.close();
})().catch(async e => { console.error(e); try{ await browser?.close(); server?.close(); }catch{} process.exit(1); });
