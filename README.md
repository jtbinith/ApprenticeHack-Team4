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

**On Windows?** Follow [docs/SETUP-WINDOWS.md](docs/SETUP-WINDOWS.md).

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

Focus timer: **⌘⌥⇧F** (macOS) / **Ctrl+Alt+Shift+F** (Linux) starts/pauses from anywhere; the countdown also shows in the tray / menu bar.

Env vars:
- `CANOPY_DEVTOOLS=1` opens DevTools
- `CANOPY_SCREENSHOT=shot.png` saves a screenshot and quits (`CANOPY_SCREENSHOT_DELAY=5000` to wait longer)
- `CANOPY_RESET_DATA=1` wipes local data so the demo data is re-seeded
- `CANOPY_USER_DATA=/tmp/canopy-test` uses a separate profile, so testing doesn't touch your own data

CI (`.github/workflows/build.yml`) runs typecheck, lint and `make` on Ubuntu and macOS for every PR and uploads the installers as artifacts.

## Project structure

```
src/
  main.ts              Electron main process: window, OS features, IPC handlers
  main/
    focus-timer.ts     Tray countdown, global shortcut, idle auto-pause (#52)
  preload.ts           Exposes the typed API as window.canopy
  renderer.ts          UI entry point: starts the shell, registers features
  shared/
    types.ts           Data model shared by all processes
    ipc.ts             Typed IPC channels and the window.canopy API
  styles/
    tokens.css         Colours, radii, fonts (from the design) — use these variables
    components.css     Shared UI kit (buttons, pills, dialog, fields…)
    shell.css          Top bar and page layout
  renderer/
    db.ts              Dexie (IndexedDB) database, seedIfEmpty(), deleteAllData()
    seed.ts            Demo data generated relative to today
    timer/             Focus timer widget, state, log + reflection dialog (#52)
    shell/             Top bar, tab router (registerView), widget slots (registerWidget)
    ui/                icon(), openDialog(), escapeHtml(), byId()
    features/          One folder per feature, e.g. features/calendar/
      placeholders.ts  "Coming soon" views — delete your entry when your feature lands
assets/icon.png        App icon
scripts/               Launcher scripts
```

## Adding your feature

Create `src/renderer/features/<name>/index.ts`, export a register function, and call it in `src/renderer.ts` after `registerPlaceholders()`.

**A tab view** (Calendar, Journal, Hours, KSBs, Reviews):

```ts
import { registerView } from '../../shell/router';

export function registerCalendar() {
  registerView('calendar', {
    eyebrow: 'Your learning calendar',
    title: 'May 2025',
    mount(container) {
      container.innerHTML = '...';
      return () => {/* optional cleanup when leaving the tab */};
    },
  });
}
```

Set `customHeader: true` to draw your own header (e.g. the calendar's title row with Today / prev / next / Add entry).

**A right-hand widget** (`'ai'`, `'timer'`, `'progress'`):

```ts
import { registerWidget } from '../../shell/widgets';

export function registerFocusTimer() {
  registerWidget('timer', (card) => {
    card.innerHTML = '...';
  });
}
```

**A dialog:**

```ts
import { openDialog } from '../../ui/dialog';

openDialog({
  title: 'New entry',
  body: formElement, // or an HTML string
  actions: [
    { label: 'Cancel' },
    { label: 'Save', variant: 'primary', onClick: () => save() }, // return false to keep it open
  ],
});
```

**Open the journal entry form** (from the calendar, timer, etc.):

```ts
import { openEntryDialog } from '../journal';

openEntryDialog({ activityId });          // clicked a calendar event
openEntryDialog({ date: '2026-10-07' });  // clicked an empty day
openEntryDialog({ otjSessionId });        // focus timer just stopped
openEntryDialog();                        // "+ Add entry"
```

Saving creates or updates the calendar activity and its STAR reflection, so the calendar and Journal tab stay in sync. Use Dexie's `liveQuery` to re-render when data changes.

**Entry completeness / hints** (KSBs tab, review pack…):

```ts
import { completeness, visibleHints } from '../hints';

completeness(reflection, ksbs); // { score: 0–1, passed, total: 8 }
visibleHints(reflection, ksbs); // top 3 open hints: { id, field, message, weight }
```

To add behaviour to every entry form, use `registerEditorExtension()` from `features/journal/editor.ts` (this is how hints attach).

## UI kit

Classes in `src/styles/components.css`:

| Class | Use |
|---|---|
| `.card` | Panel with border and rounded corners |
| `.eyebrow`, `.view-title` | Small uppercase label, page title |
| `.btn` + `.btn-primary` / `.btn-secondary` / `.btn-brown` / `.btn-ghost` | Buttons; add `.btn-icon` for square icon buttons |
| `.btn-group` | Joined buttons (prev / next) |
| `.chip` (+ `.is-active`) | Segmented choices (15 / 25 / 45 min) |
| `.pill` + `.pill--journal` / `meeting` / `deadline` / `learning` / `review` | Calendar event pills |
| `.dot` + `.dot--<kind>` | Legend dots |
| `.badge` | Small label ("58% complete") |
| `.progress` > `.progress-bar` | Progress bar (set `style="width: 58%"`) |
| `.field` > `span` + `.input` | Labelled form field (`input`, `select`, `textarea`) |
| `.placeholder` | Dashed "coming soon" box |

Icons: `icon('plus')` from `src/renderer/ui/icons.ts` returns an SVG string. Escape any user text with `escapeHtml()` before putting it in `innerHTML`.

## Conventions

- **Renderer has no Node access.** Anything OS-level (notifications, tray, files, PDF) goes in `main.ts` and is exposed via `src/shared/ipc.ts` → `src/preload.ts` → `window.canopy`.
- **Data:** read and write through `db` in `src/renderer/db.ts`. Add fields to `src/shared/types.ts`. If you add an index, bump the Dexie `version()`.
- **Styling:** use the variables in `src/styles/tokens.css`, not raw hex values. Put feature CSS next to your feature and import it from your `index.ts`.
- **Reset demo data:** DevTools → Application → IndexedDB → delete `canopy`, then reload.
- Branch per feature (`feat/<issue>-<name>`), open a PR, and reference the issue (`Closes #49`).
- Commit messages: short, plain English (e.g. "Add month view to the calendar").
