// Renderer entry point. Runs in the browser context (no Node APIs) — talk to
// main only via `window.canopy` (see src/shared/ipc.ts).
//
// Features plug in with registerView() (tabs) and registerWidget() (right column).
// Import your feature below the placeholders so it replaces its placeholder.

import './styles/index.css';
import { db, seedIfEmpty } from './renderer/db';
import { registerCalendar } from './renderer/features/calendar';
import { registerPlaceholders } from './renderer/features/placeholders';
import { startRouter } from './renderer/shell/router';
import { renderTopbar, setAvatar } from './renderer/shell/topbar';
import { byId } from './renderer/ui/dom';

async function init() {
  renderTopbar(byId('topbar'));
  registerPlaceholders();
  registerCalendar(); // #49
  // Feature modules go here, e.g.:
  // registerFocusTimer(); // #52

  await seedIfEmpty();
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
