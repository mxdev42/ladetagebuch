# AGENTS.md

Dieses Repo ist eine private Single-File-Web-App (`index.html`) zum Führen
eines Ladetagebuchs für einen CUPRA Leon e-Hybrid. Es gibt keinen Build,
keine Dependencies, kein Test-Framework.

**Kontext & Konventionen stehen in [CLAUDE.md](CLAUDE.md).** Bitte vor jeder
Änderung lesen — insbesondere die Domänenkonstanten (`PRICE`, `NET_KWH`,
`LOSS_BY_A`) und die Sprach-Konvention (UI-Texte auf Deutsch).

## Quickstart

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

## Was Agenten beachten müssen

- Alles in `index.html` lassen, solange nichts anderes vereinbart ist.
- Keine npm-Pakete, keine Build-Toolchain einführen ohne Rückfrage.
- Domänenkonstanten nicht ohne Rückfrage ändern — sie hängen am
  Mietvertrag bzw. an Fahrzeugdaten.
- Bei Schemaänderungen am Storage-Eintrag den Key `cupra_ladetagebuch_v1`
  hochzählen oder in `load()` migrieren.
- Manuelles Smoke-Testen ist Pflicht (siehe CLAUDE.md → "Testen").
