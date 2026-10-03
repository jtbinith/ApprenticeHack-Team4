// Renderer entry point. Runs in the browser context (no Node APIs) — talk to
// main only via `window.canopy` (see src/shared/ipc.ts).
//
// Features plug in with registerView() (tabs) and registerWidget() (right column).
// Import your feature below the placeholders so it replaces its placeholder.

import './styles/index.css';
import { db, removeOrphanFiles, seedIfEmpty } from './renderer/db';
import { registerJournal } from './renderer/features/journal';
import { registerPlaceholders } from './renderer/features/placeholders';
import { startRouter } from './renderer/shell/router';
import { renderTopbar, setAvatar } from './renderer/shell/topbar';
import { byId } from './renderer/ui/dom';

// Dropping a file outside a drop zone shouldn't do anything (Electron would try to open it).
for (const type of ['dragover', 'drop'] as const) {
  document.addEventListener(type, (e) => e.preventDefault());
}

async function init() {
  renderTopbar(byId('topbar'));
  registerPlaceholders();
  registerJournal(); // #50
  // Feature modules go here, e.g.:
  // registerCalendar();   // #49
  // registerFocusTimer(); // #52

  await seedIfEmpty();
  await removeOrphanFiles();
  startRouter(byId('view'));

  const settings = await db.settings.get('settings');
  if (settings) setAvatar(settings.apprenticeName);

  const info = await window.canopy.appInfo();
  console.info(`${info.name} v${info.version} on ${info.platform}`);
}

init().catch((err) => {
  console.error(err);
  byId('view').textContent = `Canopy failed to start: ${String(err)}`;
});
