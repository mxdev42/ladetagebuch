# Ladetagebuch · CUPRA Leon

Private Web-App / PWA zum Erfassen der Heim-Ladevorgänge eines CUPRA Leon
e-Hybrid. Geladen wird zuhause; die Stromabrechnung läuft über den
Vermieter, daher müssen die geladenen kWh und die Kosten nachvollziehbar
dokumentiert werden.

> Diese Datei ist die einzige Doku-Quelle für Tools/Agenten.
> `CLAUDE.md` ist ein Symlink hierauf.

**Setup:** Mode-2-Kabel an Schuko (keine Wallbox). Zwischen Wanddose und
Verlängerungskabel sitzt ein Energiezähler (NOVKIT JK-PM04) — sein
Display ist die Quelle der Wahrheit für die Abrechnung. Der
**"kWh direkt"-Modus** der App ist dafür da, diesen abgelesenen Wert
einzutragen. Der **SOC-Modus** ist nur Backup, wenn der Zähler nicht
abgelesen wurde — er rechnet aus Akku-SOC × Kapazität / (1 − Verlust).

## Architektur

App-Code lebt vollständig in `index.html` (HTML + CSS + JS). Kein Build,
keine npm-Dependencies, kein Framework. Daneben gibt es ein paar statische
PWA-Assets:

```
index.html              ← App-Code
manifest.webmanifest    ← PWA-Manifest
sw.js                   ← Service Worker (Offline-Cache)
icon.svg                ← Master-Icon
icon-192.png            ← Manifest-Icon (Android)
icon-512.png            ← Manifest-Icon + Splash (maskable)
apple-touch-icon.png    ← 180×180 für iOS-Homescreen
fonts/*.woff2           ← Syne + DM Mono, lokal (Offline-fähig)
.nojekyll               ← schaltet Jekyll auf GitHub Pages ab
```

**Live-Deployment:** https://mxdev42.github.io/ladetagebuch/ via
GitHub Pages (Branch `main`, Folder `/`).

**Lokal testen:**

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

`file://` funktioniert nicht — der Service Worker braucht HTTP(S).

Die App ist eine echte installierbare PWA: Manifest, Service Worker und
lokale Fonts sind eingebunden. Auf iOS via "Zum Home-Bildschirm hinzufügen",
auf Android/Chrome erscheint der native Install-Prompt.

Persistenz:
- `localStorage` unter dem Key `cupra_ladetagebuch_v1`
- Manueller Export/Import via Web Share API (iOS → "In Dateien sichern" →
  iCloud Drive) bzw. File-Picker zum Import einer JSON

## Offline-Strategie (Service Worker)

`sw.js` precached beim `install` alle Dateien aus `ASSETS[]`. Im
`fetch`-Handler:

- **HTML / Navigation**: network-first mit Cache-Fallback. Online liegt
  also immer die neueste Version vor; offline wird der zuletzt gecachte
  Stand von `./index.html` ausgeliefert.
- **Statische Assets** (Fonts, Icons, Manifest): cache-first.

**Update-Workflow für statische Assets**: Wenn du `sw.js` oder eine Datei
aus `ASSETS[]` änderst, **zähle `CACHE_VERSION` hoch** (`v1` → `v2` …).
Sonst liefert der alte Cache weiter die alten Dateien aus. `index.html`
selbst ist davon ausgenommen — sie wird per network-first immer frisch
geholt, wenn online.

## Domänenlogik (in `index.html` ab dem `<script>`-Block)

Konstanten — **nicht ohne Rückfrage ändern**, sie hängen am Mietvertrag
bzw. an Fahrzeugdaten:

| Konstante     | Wert  | Bedeutung                                    |
|---------------|-------|----------------------------------------------|
| `PRICE`       | 0.38  | €/kWh, der mit dem Vermieter abgerechnet wird|
| `NET_KWH`     | 19.7  | Netto-Akkukapazität CUPRA Leon e-Hybrid (kWh)|
| `LOSS_BY_A`   | siehe | OBC-Ladeverlust nach Ladestrom               |

`LOSS_BY_A`:
- 10 A (real 9,6 A → ~2,2 kW) → 15 % Verlust
  - Messung 2026-05-14: 13,89 kWh für 17→77 % SOC → 14,9 % Verlust (saubere Einzelmessung)
  - Messung 2026-05-16: 3,591 kWh für 64→80 % SOC → 17,7 % Verlust (gemischt 1 + 2 kW, nicht trennbar; konsistent mit 15 % bei 2,2 kW)
- 8 A (~1,6 kW) → 15 % Verlust (geschätzt, noch nicht gemessen)
- 6 A (~1,0 kW) → 20 % Verlust (geschätzt, noch nicht gemessen)

Formel zur kWh-Berechnung aus SOC-Differenz:

```
kWh = NET_KWH · (SOC_ende − SOC_start) / 100 / (1 − Verlust/100)
```

Der Verlust kann per Slider (8–25 %) manuell übersteuert werden.

## Datenmodell

Ein Eintrag in `sessions[]`:

```js
{
  id: 1715500000000,            // Date.now()
  date: "2026-05-12",           // YYYY-MM-DD
  kwh: 5.612,                   // mit 3 Nachkommastellen gespeichert
  label: "21% → 49%",           // oder "5.60 kWh (direkt)"
  meta: "~2.0 kW · 12% Verlust" // oder "Direkteingabe"
}
```

Reihenfolge: neueste zuerst (`unshift`). Import unterstützt zwei Formate:
ein nacktes Array oder `{ eintraege: [...], version: 1 }`.

## Arbeitsweise mit dem Nutzer

Marco arbeitet empirisch: er misst real (z. B. mit dem NOVKIT-Zähler an
der Schuko-Steckdose) und kalibriert Code-Konstanten anhand der
Messwerte — siehe `LOSS_BY_A`, die Verlust-Werte sind keine Schätzungen
aus dem Datenblatt, sondern aus eigener Messung abgeleitet. Wenn Marco
"kann es sein dass …" oder eine ähnlich beobachtende Frage stellt,
steckt meist eine konkrete eigene Beobachtung dahinter — ernst nehmen,
im Code/Verhalten verifizieren statt abzuwiegeln.

Kommunikationsstil: Deutsch, knapp, oft kleinbuchstaben, wenig
Förmlichkeit. Antworten dürfen entsprechend kurz und direkt sein.

**Commit + Push als Default:** In diesem Repo ist Pushen pauschal
freigegeben. Nach einer abgeschlossenen Änderung direkt committen und
pushen — nicht jedes Mal rückfragen. Das gilt explizit nur für dieses
Projekt; in anderen Repos bleibt die normale Vorsichtsregel ("vor Push
fragen") gültig.

## Konventionen

- **Sprache: Deutsch.** UI-Texte, Toasts, Commit-Messages und Variablennamen
  für domänenspezifische Begriffe (`eintraege`, `Ladung`, `Verlust`) auf
  Deutsch halten. Technische Bezeichner wie `sessions`/`kwh` bleiben englisch
  — bestehender Stil.
- **Keine externen Dependencies.** Keine npm-Pakete, keine CDN-Frameworks,
  keine externen Fonts/Skripte zur Laufzeit — alles liegt im Repo, damit
  die App offline ohne Netz läuft.
- **Mobile-first.** Primäres Zielgerät ist iPhone im Standalone-Modus.
  Touch-Targets ≥ 40 px, `env(safe-area-inset-*)` beachten.
- **Storage-Migrationen.** Wenn sich das Eintragsschema ändert, den
  Storage-Key (`cupra_ladetagebuch_v1`) hochzählen oder im `load()` migrieren
  — nicht still neue Felder erwarten.
- **CSS-Variablen** in `:root` für Farben/Radien benutzen, keine Hex-Werte
  inline.
- **Domänenkonstanten** nicht ohne Rückfrage anpassen.
- **`CACHE_VERSION` in `sw.js`** bei jeder Änderung an einer Datei aus
  `ASSETS[]` hochzählen.

## Testen

Es gibt keine Test-Suite. Manueller Smoke-Test ist Pflicht:

1. `python3 -m http.server 8000` im Repo-Root
2. http://localhost:8000 öffnen
3. SOC-Modus: Werte eingeben → Vorschau muss kWh und € zeigen
4. kWh-Modus: Direkteingabe testen
5. Eintrag speichern → Liste & Stats aktualisieren sich
6. Reload → Eintrag bleibt (localStorage)
7. CSV-Export und JSON-Export öffnen sich/laden runter
8. **Offline-Check**: DevTools → Application → Service Workers → "Offline"
   anhaken, dann Reload — App muss vollständig funktionieren (inkl. Fonts).

Bei UI-Änderungen Browser-DevTools im Mobile-Viewport (iPhone) nutzen.

## Aufgaben, die typischerweise auf dich zukommen

- Neue Eingabefelder/Felder in der Historie
- Neue Statistiken (z. B. €/Monat, kWh/Woche)
- Backup/Sync-Verbesserungen
- Preisänderungen oder Mehrtarif-Logik (sobald der Vermieter den Preis ändert)

## Pflege: Assets neu erzeugen

Das Repo enthält generierte Assets (Icon-PNGs, lokale WOFF2-Fonts). Wer
sie verändern will, findet hier die ursprünglichen Befehle (macOS).

**Icon-PNGs aus `icon.svg`** (master ist die SVG-Datei):

```bash
mkdir -p /tmp/iconout
qlmanage -t -s 512 -o /tmp/iconout icon.svg
cp /tmp/iconout/icon.svg.png icon-512.png
sips -z 192 192 icon-512.png --out icon-192.png
sips -z 180 180 icon-512.png --out apple-touch-icon.png
```

`qlmanage` ist macOS-Quick-Look und rendert SVG zu PNG. Auf anderen
Systemen geht z. B. `rsvg-convert` oder ImageMagick.

**Fonts neu von Google Fonts holen** (Safari-User-Agent ist Pflicht,
sonst gibt's TTF statt WOFF2):

```bash
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15'
curl -sSL -H "User-Agent: $UA" \
  'https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@400;600;700&display=swap'
# → liefert das CSS mit den aktuellen woff2-URLs. Die URLs ändern sich
#   gelegentlich (Hash im Pfad), deshalb das CSS einmal greppen und die
#   fonts/*.woff2 entsprechend neu ziehen.
```

Wenn sich danach Asset-Inhalte geändert haben, **`CACHE_VERSION` in
`sw.js` hochzählen** — siehe "Offline-Strategie".
