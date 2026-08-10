// Smoke-Test der Domänenlogik — laufen lassen mit:
//   deno run --allow-read --allow-net test/smoke.js
//
// Lädt das echte index.html in ein DOM (deno-dom), führt den echten
// <script>-Block aus und ruft die Handler direkt auf. Deckt die Punkte 3-11
// der Checkliste in AGENTS.md ab.
//
// KEIN Ersatz für den Browser-Test: es gibt hier keine Layout-Engine, keine
// echten Events und keinen Service Worker. Optik, Touch-Bedienung, das iOS
// Share Sheet und das Offline-Verhalten muss weiterhin von Hand geprüft
// werden — siehe AGENTS.md, Abschnitt "Testen".

import { DOMParser } from "jsr:@b-fuze/deno-dom@0.1.56";
const SRC = new URL('../index.html', import.meta.url);
const html = await Deno.readTextFile(SRC);
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];

const store = {};                 // überlebt "Reloads"
let toasts = [], alerts = [], downloads = [], confirmAnswer = true;

function boot() {                 // simuliert einen Seiten-Load
  const doc = new DOMParser().parseFromString(html, 'text/html');
  for (const el of doc.querySelectorAll('input')) {
    Object.defineProperty(el, 'value', {
      get(){ return this.getAttribute('value') ?? '' },
      set(v){ this.setAttribute('value', String(v)) }, configurable: true });
  }
  globalThis.document = doc;
  // Deno hat ein eingebautes, plattenpersistentes localStorage (Getter!) —
  // eine einfache Zuweisung wird ignoriert, defineProperty ist Pflicht.
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem:k=>k in store?store[k]:null,
    setItem:(k,v)=>{store[k]=String(v)}, removeItem:k=>{delete store[k]} } });
  globalThis.navigator = { userAgent:'Mozilla/5.0 (iPhone)', standalone:true };
  globalThis.window = { confirm:(m)=>{ return confirmAnswer }, addEventListener(){}, navigator:globalThis.navigator };
  globalThis.alert = (m)=>alerts.push(m);
  globalThis.setTimeout = (fn)=>0;  clearTimeout = ()=>{};
  globalThis.Blob = class { constructor(p,o){ this.text_=p.join(''); this.type=o?.type } };
  globalThis.File  = class { constructor(p,n,o){ this.name=n; this.text_=p[0]?.text_ } };
  const _ce = doc.createElement.bind(doc);
  doc.createElement = (tag)=>{ const el=_ce(tag); el.click=()=>downloads.push(el.getAttribute('download')); return el };
  globalThis.URL = { createObjectURL:()=>'blob:x', revokeObjectURL(){} };
  globalThis.FileReader = class {
    readAsText(f){ this.onload({ target:{ result:f.__content } }) } };
  const api = new Function(script.replace(/if \('serviceWorker' in navigator\)[\s\S]*$/, '') + `
    return { addSession, saveEdit, removeSession, startEdit, setMode, updatePreview, savePrice,
             exportCSV, exportToiCloud, importFromFile, onSlider, calcKwh,
             sessions:()=>sessions, price:()=>currentPrice, mode:()=>currentMode };`)();
  // Toast + Download abgreifen
  const t = doc.getElementById('toast');
  Object.defineProperty(t, 'textContent', { set(v){ toasts.push(v) }, get(){ return '' }, configurable:true });
  return { doc, api };
}
const $ = (doc,id) => doc.getElementById(id);
let fail = 0;
const t = (name, cond, extra='') => { console.log((cond?'  ok   ':'  FAIL ')+name+(cond?'':'  → '+extra)); if(!cond) fail++; };
globalThis.__dl = downloads;

// ── 3. SOC-Modus: Vorschau ────────────────────────────────────────────
console.log('\n③ SOC-Modus — Vorschau');
let { doc, api } = boot();
$(doc,'soc-start').value = '21'; $(doc,'soc-end').value = '49';
api.updatePreview();
let pv = $(doc,'preview').innerHTML;
t('zeigt kWh',        /6\.57 kWh/.test(pv), pv);
t('zeigt Kosten €',   /2\.50 €/.test(pv), pv);
t('zeigt Verlust-€',  /16% Verlust \(0\.40 €\)/.test(pv), pv);
t('zeigt Netto €/kWh',/0\.45 €\/kWh netto/.test(pv), pv);

// ── 4. kWh-Modus + Slider sichtbar ────────────────────────────────────
console.log('\n④ kWh-Modus — Direkteingabe, Slider muss erreichbar bleiben');
api.setMode('kwh');
t('soc-inputs versteckt',  $(doc,'soc-inputs').classList.contains('hidden'));
t('kwh-inputs sichtbar',  !$(doc,'kwh-inputs').classList.contains('hidden'));
const lossRow = doc.querySelector('.loss-row');
t('loss-row NICHT in #soc-inputs (der alte Bug)', !$(doc,'soc-inputs').contains(lossRow));
t('loss-row sichtbar im kWh-Modus', !lossRow.classList.contains('hidden'));
$(doc,'kwh-direct').value = '5.60'; api.updatePreview();
pv = $(doc,'preview').innerHTML;
t('Vorschau rechnet direkt', /5\.60 kWh/.test(pv) && /2\.13 €/.test(pv), pv);
$(doc,'loss-slider').value = '20'; api.onSlider();
pv = $(doc,'preview').innerHTML;
t('Slider wirkt im kWh-Modus (Netto-Preis steigt)', /0\.47 €\/kWh netto/.test(pv), pv);
t('loss-display aktualisiert', $(doc,'loss-display').textContent === '20%', $(doc,'loss-display').textContent);

// ── 5. Speichern → Liste + Stats ──────────────────────────────────────
console.log('\n⑤ Eintrag speichern');
$(doc,'loss-slider').value = '16'; api.onSlider();
api.setMode('soc'); $(doc,'soc-start').value='21'; $(doc,'soc-end').value='49';
$(doc,'input-date').value = '2026-05-12';
api.addSession();
t('1 Eintrag in sessions', api.sessions().length===1);
t('kwh korrekt berechnet', api.sessions()[0].kwh===6.567, String(api.sessions()[0].kwh));
t('Stat kWh',   $(doc,'stat-kwh').textContent==='6.57',  $(doc,'stat-kwh').textContent);
t('Stat Kosten',$(doc,'stat-cost').textContent==='2.50', $(doc,'stat-cost').textContent);
t('Stat Anzahl',$(doc,'stat-count').textContent==='1');
t('Liste gerendert', /21% → 49%/.test($(doc,'sessions-list').innerHTML));
t('Toast bestätigt', toasts.includes('Ladung gespeichert ✓'), JSON.stringify(toasts));

// ── 6. Reload → Persistenz ────────────────────────────────────────────
console.log('\n⑥ Reload (localStorage)');
({ doc, api } = boot());
t('Eintrag überlebt Reload', api.sessions().length===1);
t('Werte unverändert', api.sessions()[0].kwh===6.567 && api.sessions()[0].price===0.38);
t('Liste nach Reload gerendert', /21% → 49%/.test($(doc,'sessions-list').innerHTML));

// ── 7. Bearbeiten: Verlust ändern ─────────────────────────────────────
console.log('\n⑦ Eintrag bearbeiten — Verlust 16 → 20 %');
const id = api.sessions()[0].id;
api.startEdit(id);
t('Edit-Felder gerendert', !!$(doc,'edit-loss-'+id));
$(doc,'edit-loss-'+id).value = '20';
$(doc,'edit-date-'+id).value = '2026-05-12';
$(doc,'edit-soc-start-'+id).value = '21';
$(doc,'edit-soc-end-'+id).value = '49';
api.saveEdit(id);
const e = api.sessions()[0];
t('loss übernommen', e.loss===20, String(e.loss));
t('kWh NEU berechnet', e.kwh===6.895, String(e.kwh));      // 19.7*.28/.80
t('meta mitgezogen', e.meta==='~2.2 kW · 20% Verlust', e.meta);
t('Verlust-€ in der Liste', /0\.52 € Verlust/.test($(doc,'sessions-list').innerHTML), $(doc,'sessions-list').innerHTML.match(/[\d.]+ € Verlust/)?.[0]);

// ── 8. Strompreis ändern ──────────────────────────────────────────────
console.log('\n⑧ Einstellungen — Strompreis 0.38 → 0.42');
$(doc,'price-input').value = '0.42'; api.savePrice();
t('currentPrice übernommen', api.price()===0.42, String(api.price()));
t('ALTER Eintrag behält 0.38', api.sessions()[0].price===0.38, String(api.sessions()[0].price));
$(doc,'soc-start').value='10'; $(doc,'soc-end').value='20'; api.addSession();
t('NEUER Eintrag bekommt 0.42', api.sessions()[0].price===0.42, String(api.sessions()[0].price));
t('beide Preise nebeneinander in der Liste',
  /0\.380 €\/kWh/.test($(doc,'sessions-list').innerHTML) && /0\.420 €\/kWh/.test($(doc,'sessions-list').innerHTML));

// ── 9. Löschen mit Rückfrage ──────────────────────────────────────────
console.log('\n⑨ Löschen — Rückfrage');
const before = api.sessions().length;
confirmAnswer = false; api.removeSession(api.sessions()[0].id);
t('Abbrechen löscht NICHT', api.sessions().length===before, `${api.sessions().length} statt ${before}`);
confirmAnswer = true;  api.removeSession(api.sessions()[0].id);
t('OK löscht', api.sessions().length===before-1);

// ── 10. CSV ───────────────────────────────────────────────────────────
console.log('\n⑩ CSV-Export (DE-Format)');
let captured = null;
globalThis.Blob = class { constructor(p,o){ this.text_=p.join(''); captured=this.text_; this.type=o?.type } };
api.exportCSV();
const lines = captured.split('\n');
t('BOM vorangestellt', captured.charCodeAt(0)===0xFEFF);
t('Semikolon-Header', lines[0].replace('\uFEFF','').startsWith('Datum;Beschreibung'), lines[0]);
t('Dezimalkomma in kWh', /;6,895;/.test(lines[1]), lines[1]);
t('Dezimalkomma im Preis', /;0,380;/.test(lines[1]), lines[1]);
const cols = lines[1].split(';');
t('Zahlenspalten ohne Dezimalpunkt', cols.slice(3).every(c=>!/\d\.\d/.test(c)), JSON.stringify(cols.slice(3)));
t('genau 6 Spalten', cols.length===6, String(cols.length));
t('Gesamt-Zeile vorhanden', lines.some(l=>l.startsWith('Gesamt;')), JSON.stringify(lines.slice(-3)));

// ── 11. JSON Export → Re-Import ───────────────────────────────────────
console.log('\n⑪ JSON-Export → Re-Import');
captured = null; api.exportToiCloud();
const exported = captured;
t('Export ist gültiges JSON', (()=>{try{JSON.parse(exported);return true}catch{return false}})());
const parsed = JSON.parse(exported);
t('Format {eintraege,version}', Array.isArray(parsed.eintraege) && parsed.version===1);
const nBefore = api.sessions().length;
confirmAnswer = true;   // OK = Ersetzen
api.importFromFile({ target:{ files:[Object.assign(new File([],'x'),{__content:exported})], value:'' } });
t('Re-Import stellt gleiche Anzahl her', api.sessions().length===nBefore, `${api.sessions().length} statt ${nBefore}`);
t('kWh unverändert', api.sessions()[0].kwh===6.895, String(api.sessions()[0].kwh));
t('Preis-Historie erhalten', api.sessions()[0].price===0.38, String(api.sessions()[0].price));

// Import einer Müll-Datei
api.importFromFile({ target:{ files:[Object.assign(new File([],'y'),{__content:'{"eintraege":[{"boese":1},null,"x"]}'})], value:'' } });
t('Müll-Import wird abgewiesen', alerts.some(a=>/Keine verwertbaren/.test(a)), JSON.stringify(alerts));
t('Bestand unangetastet', api.sessions().length===nBefore);

console.log(fail===0 ? `\n✅ Smoke-Test: alle Prüfungen grün` : `\n❌ ${fail} Prüfung(en) fehlgeschlagen`);
if (fail) Deno.exit(1);
