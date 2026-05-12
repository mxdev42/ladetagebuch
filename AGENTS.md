# AGENTS.md

Dieses Repo ist eine private PWA (`index.html` + PWA-Assets) zum Führen
eines Ladetagebuchs für einen CUPRA Leon e-Hybrid. Es gibt keinen Build,
keine npm-Dependencies, kein Test-Framework.

**Kontext & Konventionen stehen in [CLAUDE.md](CLAUDE.md).** Bitte vor jeder
Änderung lesen — insbesondere die Domänenkonstanten (`PRICE`, `NET_KWH`,
`LOSS_BY_A`) und die Sprach-Konvention (UI-Texte auf Deutsch).

## Quickstart

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

`file://` funktioniert nicht — der Service Worker braucht HTTP(S).

## Was Agenten beachten müssen

- App-Code lebt in `index.html`. Daneben gehören `manifest.webmanifest`,
  `sw.js`, die `icon-*`-Dateien und `fonts/` zur PWA.
- Keine npm-Pakete, keine Build-Toolchain, keine externen Laufzeit-Assets
  (CDN-Fonts/Skripte) einführen ohne Rückfrage — das würde Offline brechen.
- Domänenkonstanten nicht ohne Rückfrage ändern — sie hängen am
  Mietvertrag bzw. an Fahrzeugdaten.
- Bei Schemaänderungen am Storage-Eintrag den Key `cupra_ladetagebuch_v1`
  hochzählen oder in `load()` migrieren.
- Bei Änderungen an Dateien aus `sw.js → ASSETS[]` die `CACHE_VERSION`
  in `sw.js` hochzählen, sonst bleibt der alte Cache aktiv.
- Manuelles Smoke-Testen ist Pflicht (siehe CLAUDE.md → "Testen"),
  inkl. Offline-Check.
