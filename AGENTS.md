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

| Konstante       | Wert  | Bedeutung                                                              |
|-----------------|-------|------------------------------------------------------------------------|
| `DEFAULT_PRICE` | 0.38  | Seed-Wert für den €/kWh-Preis (erster App-Start, Migration alter Daten)|
| `NET_KWH`       | 19.7  | Netto-Akkukapazität CUPRA Leon e-Hybrid (kWh)                          |

**Aktueller Strompreis** wird zur Laufzeit unter
`localStorage['cupra_ladetagebuch_price']` gehalten und ist über die
Einstellungs-Card in der App editierbar. Neue Einträge bekommen den
aktuellen Preis als eigenes `price`-Feld; alte Einträge behalten ihren
Preis vom Erfassungs-Zeitpunkt — die Abrechnungs-Historie bleibt damit
korrekt, wenn der Vermieter den Preis ändert.

**Ladeverlust:** Marco lädt zuhause immer mit dem Maximum (Auto-Setting
"10 A", real 9,6 A × 230 V ≈ 2,2 kW). Der Default-Verlust ist deshalb
fest auf 16 % gesetzt (Slider-Startwert in `index.html`), kann aber per
Slider (8–25 %) manuell übersteuert werden. Frühere Mehrstufen-Logik
(`LOSS_BY_A` für 10/8/6 A) wurde entfernt, weil nur eine Stufe genutzt
wird.

Messungen, die den 16-%-Wert stützen (Mittelwert; nach Brutto-kWh
gewichtet ≈ 16,2 %, einfacher Mittelwert 16,5 %):
- 2026-05-14: 13,89 kWh für 17→77 % SOC → 14,9 % Verlust (saubere Einzelmessung bei 2,2 kW)
- 2026-05-16: 3,591 kWh für 64→80 % SOC → 17,7 % Verlust (gemischt 1 + 2 kW)
- 2026-05-19: 15,89 kWh für 29→51 % + 35→80 % SOC (Σ 67 %) → 16,9 % Verlust (zwei aufeinanderfolgende Ladungen bei ~2,2 kW / 10 A)

Formel zur kWh-Berechnung aus SOC-Differenz:

```
kWh = NET_KWH · (SOC_ende − SOC_start) / 100 / (1 − Verlust/100)
```

## Datenmodell

Es gibt zwei Eintrags-Typen, unterschieden durch das Feld `socStart`:

**SOC-Eintrag** — `socStart`/`socEnd` sind Source of Truth, `kwh` ist abgeleitet:

```js
{
  id: 1715500000000,             // Date.now()
  date: "2026-05-12",            // YYYY-MM-DD
  socStart: 21,                  // SOC % am Anfang
  socEnd: 49,                    // SOC % am Ende
  loss: 16,                      // Verlust-%
  price: 0.38,                   // €/kWh
  kwh: 5.679,                    // abgeleitet: NET_KWH·(socEnd−socStart)/100/(1−loss/100)
  label: "21% → 49%",            // abgeleitet aus socStart/socEnd
  meta: "~2.2 kW · 16% Verlust"  // abgeleitet aus loss
}
```

**kWh-Direkt-Eintrag** — `kwh` ist Source of Truth (vom NOVKIT abgelesen):

```js
{
  id: 1715500000000,
  date: "2026-05-12",
  kwh: 5.612,                       // Source of Truth
  loss: 16,                         // nur für €-Verlust- und Netto-Preis-Anzeige
  price: 0.38,
  label: "5.61 kWh (direkt)",       // abgeleitet aus kwh
  meta: "Direkteingabe · 16% Verlust" // abgeleitet aus loss
}
```

`label`, `meta` und (bei SOC) `kwh` werden über die Helper-Funktion
`refreshDerived(s)` aus den Source-of-Truth-Feldern berechnet — in
`addSession` und `saveEdit` nach jeder Änderung.

Editierbar pro Eintrag (über das ✎-Icon): `date`, `loss`, sowie
`socStart`/`socEnd` (bei SOC-Einträgen) bzw. `kwh` (bei Direkt-Einträgen).
`price` ist bewusst **nicht** editierbar — der gespeicherte Erfassungs-Preis
ist die Wahrheit für die Abrechnung.

Reihenfolge: neueste zuerst (`unshift`). Import unterstützt zwei Formate:
ein nacktes Array oder `{ eintraege: [...], version: 1 }`. Alte Einträge
werden in `load()` migriert:
- fehlendes `loss` → aus `meta` geparst, sonst 16 %
- fehlendes `price` → `DEFAULT_PRICE` (0.38)
- fehlendes `socStart`/`socEnd` → aus Label "X% → Y%" geparst (nur SOC-Einträge;
  Direkt-Einträge bleiben ohne socStart/socEnd)

Aus `loss` und `price` werden zwei Werte pro Eintrag abgeleitet:
- **Verlust in €**: `kwh × price × loss/100` — wie viel des Preises auf
  den Ladeverlust entfällt
- **Netto-Preis €/kWh**: `price / (1 − loss/100)` — was 1 kWh **im Akku**
  effektiv kostet. Vergleichswert zu öffentlichen Ladestationen (z. B.
  11 kW-Lader mit ~5 % Verlust haben einen niedrigeren Wert pro Brutto-kWh,
  aber einen anderen Netto-Preis je nach deren Verlust).

## Arbeitsweise mit dem Nutzer

Marco arbeitet empirisch: er misst real (z. B. mit dem NOVKIT-Zähler an
der Schuko-Steckdose) und kalibriert Code-Konstanten anhand der
Messwerte — siehe Verlust-Wert, der aus eigener Messung abgeleitet ist
und keine Schätzung aus dem Datenblatt. Wenn Marco
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
3. SOC-Modus: Werte eingeben → Vorschau muss kWh, €, Verlust-€ und Netto-€/kWh zeigen
4. kWh-Modus: Direkteingabe testen
5. Eintrag speichern → Liste & Stats aktualisieren sich
6. Reload → Eintrag bleibt (localStorage)
7. **Eintrag bearbeiten (✎)**: Verlust ändern → Speichern → kWh und Verlust-€
   müssen sich neu berechnet haben (bei SOC-Einträgen)
8. **Einstellungen**: Strompreis ändern → Speichern → Vorschau und neue
   Einträge nutzen den neuen Preis; alte Einträge behalten ihren
9. CSV-Export und JSON-Export öffnen sich/laden runter
10. JSON-Re-Import einer eigenen Export-Datei → Einträge erscheinen, alte
    Felder (`loss`, `price`, `socStart`/`socEnd`) werden via `migrateEntries()`
    nachgezogen
11. **Offline-Check**: DevTools → Application → Service Workers → "Offline"
    anhaken, dann Reload — App muss vollständig funktionieren (inkl. Fonts).

Bei UI-Änderungen Browser-DevTools im Mobile-Viewport (iPhone) nutzen.

## Aufgaben, die typischerweise auf dich zukommen

- Neue Eingabefelder/Felder in der Historie
- Neue Statistiken (z. B. €/Monat, kWh/Woche)
- Backup/Sync-Verbesserungen
- Mehrtarif-Logik (z. B. Tag/Nacht-Tarif) — der einfache Strompreis ist
  schon editierbar (siehe "Einstellungen"-Card), aber pro Eintrag gilt
  genau ein Preis

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
