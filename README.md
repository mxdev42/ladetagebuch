# Ladetagebuch · CUPRA Leon

Private PWA zum Erfassen der Heim-Ladevorgänge eines CUPRA Leon e-Hybrid.

**Live:** https://mxdev42.github.io/ladetagebuch/

Auf iPhone: Seite in Safari öffnen → Teilen → "Zum Home-Bildschirm
hinzufügen". Läuft danach offline.

Kontext, Architektur, Konventionen und Pflege-Befehle stehen in
[AGENTS.md](AGENTS.md). `CLAUDE.md` ist ein Symlink darauf.

## Lokal testen

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

`file://` funktioniert nicht — Service Worker brauchen HTTP(S).
