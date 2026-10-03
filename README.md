# Canopy

Desktop workspace for UK apprentices: calendar, STAR journal, OTJ hours and KSB evidence, ready for every review.
Built with **Electron + TypeScript** (vanilla TS, no framework). Runs on Linux and macOS.

- Product spec: [IDEA.md](IDEA.md)
- Design: [`Canopy Concept 2 screenshot.png`](Canopy%20Concept%202%20screenshot.png)
- Tasks: [Team4-Kanban](https://github.com/users/jtbinith/projects/4)

## Getting started

Requires Node.js 22+.

```bash
npm install
npm start            # macOS
npm run start:linux  # Linux (adds --no-sandbox)
```

The app opens with seeded demo data (stored locally in IndexedDB).

**Linux desktop launcher** (app menu + Desktop icon, runs this checkout):

```bash
./scripts/install-desktop-launcher.sh
```

## Scripts

| Command | What it does |
|---|---|
| `npm start` / `npm run start:linux` | Run in dev mode with hot reload |
| `npm run typecheck` | TypeScript check |
| `npm run lint` / `npm run lint:fix` | Lint + format check (oxlint, oxfmt) |
| `npm run make` | Build installers into `out/make` (`.deb` + `.zip` on Linux, `.zip` on macOS) |

Env vars: `CANOPY_DEVTOOLS=1` opens DevTools; `CANOPY_SCREENSHOT=shot.png` saves a screenshot and quits.

CI (`.github/workflows/build.yml`) runs typecheck, lint and `make` on Ubuntu and macOS for every PR and uploads the installers as artifacts.

## Project structure

```
src/
  main.ts            Electron main process: window, OS features, IPC handlers
  preload.ts         Exposes the typed API as window.canopy
  renderer.ts        UI entry point (tabs + widget slots)
  index.css          Design tokens (palette from the design) + layout
  shared/
    types.ts         Data model shared by all processes
    ipc.ts           Typed IPC channels and the window.canopy API
  renderer/
    db.ts            Dexie (IndexedDB) database, seedIfEmpty(), deleteAllData()
    seed.ts          Demo data generated relative to today
assets/icon.png      App icon
scripts/             Launcher scripts
```

## Conventions

- **Renderer has no Node access.** Anything OS-level (notifications, tray, files, PDF) goes in `main.ts` and is exposed via `src/shared/ipc.ts` → `src/preload.ts` → `window.canopy`.
- **Data:** read and write through `db` in `src/renderer/db.ts`. Add fields to `src/shared/types.ts`. If you add an index, bump the Dexie `version()`.
- **Styling:** use the CSS variables in `src/index.css`, not raw hex values.
- **Features:** each tab and widget has a placeholder naming its board issue. Put a feature's code in its own folder, e.g. `src/renderer/calendar/`.
- **Reset demo data:** DevTools → Application → IndexedDB → delete `canopy`, then reload.
- Branch per feature (`feat/<issue>-<name>`), open a PR, and reference the issue (`Closes #49`).
