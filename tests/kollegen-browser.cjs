// Zwei Büro-Fenster auf demselben Archiv (Audit Lauf 3): Liste liest weiter, auch wenn ein Knopf den Fokus hat (C1);
// Rechnung kann nicht doppelt geschrieben werden, „① Positionen kopieren“ setzt „Ich kümmere mich“ (C2); Fälligkeit tippen
// speichert erst beim Verlassen (C3); Rechnungskopf kopieren (C10). Synthetische OPFS-Ordner. Beide Fenster teilen sich den
// Browser-Speicher (also auch das Kürzel) – geprüft wird darum, dass der zweite Haken abgelehnt wird, nicht wessen Name dasteht.
// node tests/kollegen-browser.cjs [chromium]
const assert = require('node:assert/strict'), fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.join(__dirname, '..'), browserName = process.argv[2] || 'chromium';
let browser, server;
(async () => {
  server = http.createServer((req, res) => {
    const file = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html');
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()){ res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  browser = await playwright[browserName].launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'de-DE' });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  const url = `http://127.0.0.1:${server.address().port}/index.html`, errors = [];
  const ok = s => console.log(`OK ${browserName}: ${s}`);
  const seite = async kuerzel => {
    const p = await ctx.newPage(); p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto(url);
    await p.evaluate(k => { localStorage.setItem('buerokit-ich', k); window.showDirectoryPicker = async () => navigator.storage.getDirectory(); }, kuerzel);
    if (await p.locator('#btnArchiv2').isVisible()) await p.locator('#btnArchiv2').click(); else await p.reload();
    await p.locator('.karte').first().waitFor();
    return p;
  };
  const A = await ctx.newPage(); A.on('pageerror', e => errors.push(e.message));
  await A.goto(url);
  const aufgabe = await A.evaluate(async () => {
    const r = await navigator.storage.getDirectory(), B = window.BueroAufgaben;
    const put = async (dir, name, text) => { const w = await (await dir.getFileHandle(name, { create: true })).createWritable(); await w.write(text); await w.close(); };
    await put(r, '_Spektron-Mitarbeiter.json', JSON.stringify({ format: 'spektron-mitarbeiter', version: 1, personen: [{ ordnerKuerzel: 'Nad', name: 'Nadine Test' }, { ordnerKuerzel: 'Ben', name: 'Ben Test' }] }));
    const p = await r.getDirectoryHandle('26.0101 Musterstadt Ben', { create: true });
    const a = await B.aufgabeAnlegen(p, { art: 'gutachten', von: 'Ben', word: 'Mitteilungen/1._Mitteilung_26.0101.docx', faellig: '2099-01-01',
      empfaenger: [{ gruppe: 'versicherung', label: 'Auftraggeber', details: 'Muster AG\nz. Hd. Frau Beispiel\nMusterweg 5\nschaden@muster-beispiel.de' }] });
    for (const s of ['gegenlesen', 'pdf']) await B.vermerken(p, { aufgabe: a.id, schritt: s, von: 'Ben' });
    await B.vermerken(p, { aufgabe: a.id, schritt: 'versand', empfaenger: a.empfaenger[0].id, von: 'Ben' });
    await B.aufgabeAnlegen(p, { art: 'eigene', titel: 'Laborrechnung prüfen', von: 'Ben', faellig: '2099-02-01' });
    await B.aufgabeAnlegen(p, { art: 'gutachten', von: 'Ben', word: 'Mitteilungen/2._Mitteilung_26.0101.docx', faellig: '2099-03-01', empfaenger: [{ gruppe: 'versicherung', label: 'Auftraggeber', details: 'Muster AG\nschaden@muster-beispiel.de' }] });
    const abr = await p.getDirectoryHandle('Abrechnung', { create: true });
    await put(abr, '26.0101_Aufwand_2026-11-20.json', JSON.stringify({ format: 'aufwandkit-stand', version: 1, projekt: '26.0101 Musterstadt Ben', erstellt: new Date().toISOString(), von: 'BEN', programm: 'BelegKit 1.17.1',
      projektdaten: { objekt: 'EFH, Am Hang 3, 12345 Musterstadt', auftraggeber: 'Muster AG', schadennummer: 'SN-77' },
      titel: [{ nr: 1, text: 'Ortstermin', zeilen: [{ nr: '1.001', text: 'Sachverständiger', menge: 2.5, einheit: 'Std.' }] }], quellen: [] }));
    return a.id;
  });
  await A.close();
  const nad = await seite('Nad'), ben = await seite('Ben');

  // C10 + C2: Nadine kopiert Kopf und Positionen → „Ich kümmere mich“; Ben sieht die Rechnung noch offen, darf aber nicht doppelt abrechnen
  for (const p of [nad, ben]){ await p.locator('.karte', { hasText: '1._Mitteilung' }).locator('button.primary', { hasText: 'Rechnung schreiben' }).click(); await p.locator('[data-abr-kopie]').waitFor(); }
  await nad.locator('[data-abr-kopf]').click();
  assert.equal(await nad.evaluate(() => navigator.clipboard.readText()), 'Muster AG\r\nz. Hd. Frau Beispiel\r\nMusterweg 5\r\n\r\nIhr Zeichen: SN-77\r\nUnser Zeichen: 26.0101\r\nObjekt: EFH, Am Hang 3, 12345 Musterstadt');
  await nad.locator('[data-abr-kopie]').click();
  await nad.locator('.karte .meta', { hasText: 'du kümmerst dich' }).waitFor();
  assert.match(await nad.evaluate(() => navigator.clipboard.readText()), /^Position\tText\tMenge\tEinheit\r\n/);
  await nad.locator('button', { hasText: '③ Rechnung geschrieben' }).click();
  await nad.waitForFunction(() => !document.querySelector('#g-rechnung'));
  await ben.locator('button', { hasText: '③ Rechnung geschrieben' }).click();
  await ben.locator('#hinweise .hinweis.err', { hasText: /Die Rechnung hat .+ schon geschrieben .*Nichts gespeichert/ }).waitFor();
  const zahl = await ben.evaluate(async () => { const r = await navigator.storage.getDirectory(); const d = await (await (await r.getDirectoryHandle('26.0101 Musterstadt Ben')).getDirectoryHandle('_Buero')).getDirectoryHandle('vermerke');
    let n = 0; for await (const [, h] of d.entries()) if (JSON.parse(await (await h.getFile()).text()).schritt === 'rechnung') n++; return n; });
  assert.equal(zahl, 1, 'nur ein Rechnung-Vermerk');
  ok('Rechnungskopf kopieren; „Positionen kopieren“ setzt „Ich kümmere mich“; zweiter Rechnung-Haken abgelehnt');

  // C1: Fokus auf „Pfad kopieren“ – neue Aufgabe eines Kollegen erscheint trotzdem
  await ben.reload(); await ben.locator('.karte').first().waitFor();
  await ben.locator('.karte', { hasText: 'Laborrechnung' }).locator('button.link[data-mehr]').click();
  await ben.locator('.karte', { hasText: 'Laborrechnung' }).locator('input[data-akt="faellig"]').waitFor();
  await nad.evaluate(async () => { const r = await navigator.storage.getDirectory();
    await window.BueroAufgaben.aufgabeAnlegen(await r.getDirectoryHandle('26.0101 Musterstadt Ben'), { art: 'eigene', titel: 'Neu von Nadine', von: 'Nad' }); });
  await ben.locator('.karte', { hasText: '2._Mitteilung' }).locator('button.link[data-mehr]').click();
  await ben.locator('button[data-kopie]').first().click();
  assert.equal(await ben.evaluate(() => document.activeElement.matches('button[data-kopie]')), true);
  await ben.evaluate(() => window.dispatchEvent(new Event('focus')));
  await ben.locator('.karte', { hasText: 'Neu von Nadine' }).waitFor({ timeout: 10000 });
  assert.equal(await ben.evaluate(() => !!document.activeElement.closest('#liste')), true, 'Fokus bleibt in der Liste');
  ok('Liste liest weiter, auch wenn „Pfad kopieren“ den Fokus hat');

  // C3: Fälligkeit tippen – erst beim Verlassen gespeichert, unplausibles Jahr abgelehnt
  const feld = ben.locator('.karte', { hasText: 'Laborrechnung' }).locator('input[data-akt="faellig"]');
  const faellig = () => ben.evaluate(async () => { const r = await navigator.storage.getDirectory(); const d = await (await (await r.getDirectoryHandle('26.0101 Musterstadt Ben')).getDirectoryHandle('_Buero')).getDirectoryHandle('vermerke');
    const o = []; for await (const [, h] of d.entries()){ const x = JSON.parse(await (await h.getFile()).text()); if (x.schritt === 'faellig') o.push(x.datum); } return o.sort(); });
  const j = new Date().getFullYear() + 1;
  // Reihenfolge der Teile wie der Browser sie zeigt (Edge in Deutschland: TT.MM.JJJJ, Headless oft MM/TT/JJJJ)
  const teile = await ben.evaluate(() => new Intl.DateTimeFormat().formatToParts(new Date(2026, 10, 20)).map(x => x.type).filter(t => ['day', 'month', 'year'].includes(t)));
  await feld.focus();
  await feld.pressSequentially(teile.map(t => ({ day: '15', month: '12', year: String(j) })[t]).join(''), { delay: 60 });
  assert.deepEqual(await faellig(), [], 'beim Tippen noch nichts gespeichert');
  const getippt = await feld.inputValue();   // Reihenfolge der Teile hängt vom Browser ab – gespeichert werden muss genau das Getippte
  assert.match(getippt, new RegExp(`^${j}-12-1[25]$`));
  await feld.press('Enter');
  await ben.waitForFunction(() => document.querySelector('.karte') && true);
  await ben.waitForTimeout(800);
  assert.deepEqual(await faellig(), [getippt]);
  const f2 = ben.locator('.karte', { hasText: 'Laborrechnung' }).locator('input[data-akt="faellig"]');
  if (!(await f2.count())) await ben.locator('.karte', { hasText: 'Laborrechnung' }).locator('button.link[data-mehr]').click();
  await f2.fill('0001-12-15'); await f2.press('Enter');
  await ben.locator('#hinweise .hinweis.err', { hasText: 'nicht gespeichert' }).waitFor();
  assert.deepEqual(await faellig(), [getippt]);
  ok('Fälligkeit: erst mit Enter/Verlassen gespeichert, Jahr 0001 abgelehnt');

  assert.deepEqual(errors, []);
  await browser.close(); server.close();
})().catch(async e => { console.error(e); try{ await browser?.close(); server?.close(); }catch(_){} process.exit(1); });
