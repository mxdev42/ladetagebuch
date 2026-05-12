# Ladetagebuch · CUPRA Leon

Private Web-App zum Erfassen der Heim-Ladevorgänge eines CUPRA Leon e-Hybrid.
Geladen wird zuhause; die Stromabrechnung läuft über den Vermieter, daher
müssen die geladenen kWh und die Kosten nachvollziehbar dokumentiert werden.

**Setup:** Mode-2-Kabel an Schuko (keine Wallbox). Zwischen Wanddose und
Verlängerungskabel sitzt ein Energiezähler (NOVKIT JK-PM04) — sein
Display ist die Quelle der Wahrheit für die Abrechnung. Der
**"kWh direkt"-Modus** der App ist dafür da, diesen abgelesenen Wert
einzutragen. Der **SOC-Modus** ist nur Backup, wenn der Zähler nicht
abgelesen wurde — er rechnet aus Akku-SOC × Kapazität / (1 − Verlust).

## Architektur

**Single-File-App.** Alles (HTML, CSS, JS) steckt in `index.html`. Kein Build,
keine Dependencies, kein Framework. Öffnen mit Doppelklick oder per
`python3 -m http.server` reicht zum Testen.

Aktuell ist die App eine installierbare iOS-WebApp ("Zum Home-Bildschirm
hinzufügen") — sie hat **kein** `manifest.webmanifest` und **keinen** Service
Worker. Trotzdem wird sie im UI als "PWA" bezeichnet, weil sie standalone
laufen kann (`apple-mobile-web-app-capable`).

Persistenz:
- `localStorage` unter dem Key `cupra_ladetagebuch_v1`
- Manueller Export/Import via Web Share API (iOS → "In Dateien sichern" →
  iCloud Drive) bzw. File-Picker zum Import einer JSON

## Domänenlogik (in `index.html` ab dem `<script>`-Block)

Konstanten — **nicht ohne Rückfrage ändern**:

| Konstante     | Wert  | Bedeutung                                    |
|---------------|-------|----------------------------------------------|
| `PRICE`       | 0.38  | €/kWh, der mit dem Vermieter abgerechnet wird|
| `NET_KWH`     | 19.7  | Netto-Akkukapazität CUPRA Leon e-Hybrid (kWh)|
| `LOSS_BY_A`   | siehe | OBC-Ladeverlust nach Ladestrom               |

`LOSS_BY_A`:
- 10 A (~2.0 kW) → 12 % Verlust
- 8 A (~1.6 kW) → 15 % Verlust
- 6 A (~1.0 kW) → 20 % Verlust

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

## Konventionen

- **Sprache: Deutsch.** UI-Texte, Toasts, Commit-Messages und Variablennamen
  für domänenspezifische Begriffe (`eintraege`, `Ladung`, `Verlust`) auf
  Deutsch halten. Technische Bezeichner wie `sessions`/`kwh` bleiben englisch
  — bestehender Stil.
- **Keine externen Dependencies.** Keine npm-Pakete, keine CDN-Frameworks.
  Google Fonts (Syne, DM Mono) sind die einzige externe Abhängigkeit.
- **Mobile-first.** Primäres Zielgerät ist iPhone im Standalone-Modus.
  Touch-Targets ≥ 40 px, `env(safe-area-inset-*)` beachten.
- **Storage-Migrationen.** Wenn sich das Eintragsschema ändert, den
  Storage-Key (`cupra_ladetagebuch_v1`) hochzählen oder im `load()` migrieren
  — nicht still neue Felder erwarten.
- **CSS-Variablen** in `:root` für Farben/Radien benutzen, keine Hex-Werte
  inline.

## Testen

Es gibt keine Test-Suite. Manueller Smoke-Test reicht:

1. `python3 -m http.server 8000` im Repo-Root
2. http://localhost:8000 öffnen
3. SOC-Modus: Werte eingeben → Vorschau muss kWh und € zeigen
4. kWh-Modus: Direkteingabe testen
5. Eintrag speichern → Liste & Stats aktualisieren sich
6. Reload → Eintrag bleibt (localStorage)
7. CSV-Export und JSON-Export öffnen sich/laden runter

Bei UI-Änderungen Browser-DevTools im Mobile-Viewport (iPhone) nutzen.

## Aufgaben, die typischerweise auf dich zukommen

- Neue Eingabefelder/Felder in der Historie
- Neue Statistiken (z. B. €/Monat, kWh/Woche)
- PWA echt machen: `manifest.webmanifest` + Service Worker für Offline
- Backup/Sync-Verbesserungen
- Preisänderungen oder Mehrtarif-Logik (sobald der Vermieter den Preis ändert)
